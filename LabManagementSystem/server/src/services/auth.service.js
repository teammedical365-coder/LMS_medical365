/**
 * Lab Management System (LMS) - Authentication Service
 * 
 * Implements genuine multi-tier authentication:
 * 1. Platform Super Admin (Master Database)
 * 2. Laboratory Users (Strictly isolated per-tenant database)
 * 
 * SECURITY RULES:
 * 1. Never authenticate a laboratory user by searching across all tenant databases.
 * 2. Use constant-time bcrypt verification.
 * 3. Use generic error messages to eliminate username/account enumeration.
 * 4. Never log or return passwords, hashes, or secrets.
 * 5. Reject login for inactive or unprovisioned tenants.
 * 6. Return 503 Service Unavailable when live MongoDB is not connected and not in test memory mode.
 */

import PlatformAdminModel from '../models/platformAdmin.model.js';
import TenantModel from '../models/tenant.model.js';
import tenantConnectionService from './tenantConnection.service.js';
import tenantResolutionService from './tenantResolution.service.js';
import laboratoryManagementService from './laboratoryManagement.service.js';
import tenantUserService from './tenantUser.service.js';
import roleService from './role.service.js';
import passwordService from './password.service.js';
import tokenService from './token.service.js';
import auditLogService from './auditLog.service.js';
import config from '../config/env.js';
import dbConnection from '../config/db.js';
import { ACCOUNT_TYPE, LAB_STATUS, PROVISIONING_STATUS, AUDIT_ACTIONS } from '../config/constants.js';
import logger from '../utils/logger.js';

export class AuthenticationError extends Error {
  constructor(message, code = 'AUTH_FAILED', statusCode = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class AuthService {
  constructor() {
    // In-memory admin store fallback used exclusively in test mode
    this.testMemoryAdmins = new Map();
  }

  /**
   * Check if live database is ready or if test memory mode is enabled
   */
  checkDatabaseAvailability() {
    const isLive = dbConnection.getStatus().connected;
    if (!isLive && !tenantConnectionService.allowTestMemoryMode) {
      throw new AuthenticationError(
        'Authentication service unavailable: live database connection is not active.',
        'DATABASE_UNAVAILABLE',
        503
      );
    }
    return isLive;
  }

  /**
   * Authenticate Platform Super Admin against Master Database
   * @param {Object} credentials { email, password, ipAddress, userAgent }
   */
  async loginSuperAdmin({ email, password, ipAddress = null, userAgent = null }) {
    await this.checkDatabaseAvailability();

    if (!email || !password) {
      throw new AuthenticationError('Email and password are required', 'MISSING_CREDENTIALS', 400);
    }

    const cleanEmail = passwordService.normalizeEmail(email);

    let admin = null;
    const isLive = dbConnection.getStatus().connected;

    if (isLive) {
      // Query master DB for platform admin with passwordHash included
      admin = await PlatformAdminModel.findOne({ email: cleanEmail }).select('+passwordHash');
    } else {
      // Test memory fallback
      admin = this.testMemoryAdmins.get(cleanEmail);
    }

    // Generic error message if user not found to prevent enumeration
    if (!admin) {
      await auditLogService.recordEvent({
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
        actorType: 'PLATFORM_SUPER_ADMIN',
        actorEmail: cleanEmail,
        details: { reason: 'User not found', ipAddress, userAgent },
      });
      throw new AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
    }

    if (!admin.isActive) {
      throw new AuthenticationError('Super Admin account is deactivated. Contact platform administration.', 'ACCOUNT_DEACTIVATED', 403);
    }

    // Verify password hash
    const isValid = await admin.comparePassword(password);
    if (!isValid) {
      await auditLogService.recordEvent({
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
        actorType: 'PLATFORM_SUPER_ADMIN',
        actorId: admin.adminId,
        actorEmail: cleanEmail,
        details: { reason: 'Password mismatch', ipAddress, userAgent },
      });
      throw new AuthenticationError('Invalid email or password', 'INVALID_CREDENTIALS', 401);
    }

    // Update last login
    admin.lastLoginAt = new Date();
    if (isLive && typeof admin.save === 'function') {
      await admin.save();
    }

    // Generate JWT access token
    const token = tokenService.generatePlatformAdminToken(admin);

    await auditLogService.recordEvent({
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
      actorType: 'PLATFORM_SUPER_ADMIN',
      actorId: admin.adminId,
      actorEmail: cleanEmail,
      details: { ipAddress, userAgent },
    });

    return {
      user: admin.toSafeJSON(),
      token,
      accountType: ACCOUNT_TYPE.PLATFORM_SUPER_ADMIN,
    };
  }

  /**
   * Authenticate Laboratory User against their specific tenant database
   * Never searches across all tenant databases!
   * @param {Object} credentials { organizationCode, email, password, ipAddress, userAgent }
   */
  async loginLaboratoryUser({ organizationCode, email, password, ipAddress = null, userAgent = null }) {
    await this.checkDatabaseAvailability();

    if (!organizationCode || !email || !password) {
      throw new AuthenticationError(
        'Organization code, email, and password are required',
        'MISSING_CREDENTIALS',
        400
      );
    }

    const cleanOrgCode = organizationCode.trim().toLowerCase();
    const cleanEmail = passwordService.normalizeEmail(email);

    // 1. Resolve Tenant from Master Registry
    let tenant = null;
    const isLive = dbConnection.getStatus().connected;

    if (isLive) {
      tenant = await TenantModel.findOne({
        $or: [{ code: cleanOrgCode }, { tenantId: cleanOrgCode }],
      });
    } else {
      // In-memory registry fallback for tests
      for (const t of laboratoryManagementService.memoryTenants.values()) {
        if (t.code === cleanOrgCode || t.tenantId === cleanOrgCode) {
          tenant = t;
          break;
        }
      }
    }

    if (!tenant) {
      // Use generic error message
      throw new AuthenticationError('Invalid laboratory code, email, or password', 'INVALID_CREDENTIALS', 401);
    }

    // 2. Validate Tenant Status: Must be ACTIVE
    if (tenant.status !== LAB_STATUS.ACTIVE) {
      throw new AuthenticationError(
        `Laboratory access is currently suspended or inactive (${tenant.status}). Please contact your laboratory administrator.`,
        'TENANT_INACTIVE',
        403
      );
    }

    // 3. Validate Tenant Provisioning: Must be READY
    if (tenant.database?.provisioningStatus !== PROVISIONING_STATUS.READY) {
      throw new AuthenticationError(
        'Laboratory database is currently provisioning or not ready.',
        'DATABASE_NOT_READY',
        403
      );
    }

    // 4. Query user STRICTLY in the resolved tenant's database
    const UserModel = tenantConnectionService.getTenantUserModel(tenant.tenantId);
    let user = null;

    if (UserModel) {
      user = await UserModel.findOne({
        tenantId: tenant.tenantId,
        email: cleanEmail,
      }).select('+passwordHash');
    } else {
      // Test-memory store fallback
      const tenantUsers = tenantUserService.memoryStore.get(tenant.tenantId);
      if (tenantUsers) {
        for (const u of tenantUsers.values()) {
          if (u.email === cleanEmail) {
            user = u;
            break;
          }
        }
      }
    }

    if (!user) {
      await auditLogService.recordEvent({
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
        actorType: 'TENANT_USER',
        targetTenantId: tenant.tenantId,
        actorEmail: cleanEmail,
        details: { reason: 'User not found in tenant DB', ipAddress, userAgent },
      });
      throw new AuthenticationError('Invalid laboratory code, email, or password', 'INVALID_CREDENTIALS', 401);
    }

    // 5. Verify user is not deleted and account is active
    if (user.isDeleted || user.status === 'deleted') {
      await auditLogService.recordEvent({
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
        actorType: 'TENANT_USER',
        targetTenantId: tenant.tenantId,
        actorId: user.userId,
        actorEmail: cleanEmail,
        details: { reason: 'Account deleted', ipAddress, userAgent },
      });
      throw new AuthenticationError(
        'This laboratory staff account has been deleted. Please contact your laboratory administrator.',
        'ACCOUNT_DELETED',
        403
      );
    }

    if (!user.isActive) {
      throw new AuthenticationError(
        'Laboratory account is inactive or deactivated. Please contact your lab supervisor.',
        'ACCOUNT_DEACTIVATED',
        403
      );
    }

    // 6. Verify password
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      await auditLogService.recordEvent({
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILURE,
        actorType: 'TENANT_USER',
        targetTenantId: tenant.tenantId,
        actorId: user.userId,
        actorEmail: cleanEmail,
        details: { reason: 'Password mismatch', ipAddress, userAgent },
      });
      throw new AuthenticationError('Invalid laboratory code, email, or password', 'INVALID_CREDENTIALS', 401);
    }

    // 7. Update last login
    user.lastLoginAt = new Date();
    if (UserModel && typeof user.save === 'function') {
      await user.save();
    }

    // 8. Generate JWT access token strictly scoped to this tenant
    const token = tokenService.generateTenantUserToken(user, tenant.tenantId);

    await auditLogService.recordEvent({
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
      actorType: 'TENANT_USER',
      targetTenantId: tenant.tenantId,
      actorId: user.userId,
      actorEmail: cleanEmail,
      details: { ipAddress, userAgent },
    });

    // 9. Resolve full dynamic role definition for tenant user
    let roleDefinition = null;
    try {
      roleDefinition = await roleService.getRoleById(tenant.tenantId, user.role);
    } catch {
      // Fallback if role is not seeded yet or deleted
    }

    const safeUser = user.toSafeJSON();
    safeUser.roleDefinition = roleDefinition;

    return {
      user: safeUser,
      tenant: {
        tenantId: tenant.tenantId,
        code: tenant.code,
        name: tenant.name,
      },
      token,
      accountType: ACCOUNT_TYPE.TENANT_USER,
    };
  }

  /**
   * Get current authenticated user profile by validated token payload
   * @param {Object} tokenPayload 
   */
  async getCurrentUserProfile(tokenPayload) {
    if (!tokenPayload) {
      throw new AuthenticationError('Missing authentication claims', 'UNAUTHENTICATED', 401);
    }

    if (tokenPayload.accountType === ACCOUNT_TYPE.PLATFORM_SUPER_ADMIN) {
      const isLive = dbConnection.getStatus().connected;
      let admin = null;
      if (isLive) {
        admin = await PlatformAdminModel.findOne({ adminId: tokenPayload.sub });
      } else {
        admin = Array.from(this.testMemoryAdmins.values()).find((a) => a.adminId === tokenPayload.sub);
      }

      if (!admin || !admin.isActive) {
        throw new AuthenticationError('Platform Administrator account not found or inactive', 'USER_NOT_FOUND', 401);
      }

      return {
        user: typeof admin.toSafeJSON === 'function' ? admin.toSafeJSON() : admin,
        accountType: ACCOUNT_TYPE.PLATFORM_SUPER_ADMIN,
      };
    }

    if (tokenPayload.accountType === ACCOUNT_TYPE.TENANT_USER) {
      const tenantId = tokenPayload.tenantId;
      // Verify tenant
      const resolution = await tenantResolutionService.resolveByTenantId(tenantId);
      if (!resolution.isResolved) {
        throw new AuthenticationError('Associated laboratory is inactive or invalid', 'TENANT_INVALID', 403);
      }

      const user = await tenantUserService.getUserById(tenantId, tokenPayload.sub);
      let roleDefinition = null;
      try {
        roleDefinition = await roleService.getRoleById(tenantId, user.role);
      } catch {
        // Fallback
      }

      return {
        user: {
          ...user,
          roleDefinition,
        },
        tenant: {
          tenantId: resolution.tenantId,
          code: resolution.code,
          name: resolution.name,
        },
        accountType: ACCOUNT_TYPE.TENANT_USER,
      };
    }

    throw new AuthenticationError('Invalid account type in credentials', 'INVALID_ACCOUNT_TYPE', 401);
  }

  /**
   * Register a test admin for unit tests
   */
  registerTestAdmin(admin) {
    this.testMemoryAdmins.set(admin.email.toLowerCase(), admin);
  }

  clearTestAdmins() {
    this.testMemoryAdmins.clear();
  }
}

export const authService = new AuthService();
export default authService;
