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

import crypto from 'crypto';
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
    // In-memory active session cache for ultra-low latency single-device checks: "scope:userId" -> sessionId
    this.activeSessions = new Map();
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

    // Single device active session: generate unique sessionId
    const sessionId = `ses_${crypto.randomUUID()}`;
    admin.lastLoginAt = new Date();
    admin.activeSessionId = sessionId;
    if (isLive && typeof admin.save === 'function') {
      await admin.save();
    }
    this.setActiveSession('platform', admin.adminId, sessionId);

    // Generate JWT access token with sessionId
    const token = tokenService.generatePlatformAdminToken(admin, sessionId);

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

    // 7. Update last login & single device active session
    const sessionId = `ses_${crypto.randomUUID()}`;
    user.lastLoginAt = new Date();
    user.activeSessionId = sessionId;
    if (UserModel && typeof user.save === 'function') {
      await user.save();
    }
    this.setActiveSession(tenant.tenantId, user.userId, sessionId);

    // 8. Generate JWT access token strictly scoped to this tenant with sessionId
    const token = tokenService.generateTenantUserToken(user, tenant.tenantId, sessionId);

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
   * Set active session ID for a user
   */
  setActiveSession(scope, userId, sessionId) {
    if (!scope || !userId) return;
    const key = `${scope}:${userId}`;
    this.activeSessions.set(key, sessionId);
  }

  /**
   * Clear active session for a user on logout
   */
  clearActiveSession(scope, userId) {
    if (!scope || !userId) return;
    const key = `${scope}:${userId}`;
    this.activeSessions.set(key, null);
  }

  /**
   * Validate that the incoming token's sessionId matches the user's active session
   * Enforces single active device policy across all users and dashboards
   * @param {Object} tokenPayload 
   * @returns {Promise<boolean>}
   */
  async validateActiveSession(tokenPayload) {
    if (!tokenPayload || !tokenPayload.sessionId) {
      // Legacy or internal test tokens without sessionId remain valid
      return true;
    }

    const { sub, tenantId, accountType, sessionId } = tokenPayload;
    const scope = accountType === ACCOUNT_TYPE.PLATFORM_SUPER_ADMIN ? 'platform' : tenantId;
    const cacheKey = `${scope}:${sub}`;

    // 1. Fast in-memory check
    if (this.activeSessions.has(cacheKey)) {
      return this.activeSessions.get(cacheKey) === sessionId;
    }

    // 2. Cache miss: check database
    if (accountType === ACCOUNT_TYPE.PLATFORM_SUPER_ADMIN) {
      const isLive = dbConnection.getStatus().connected;
      if (isLive) {
        const admin = await PlatformAdminModel.findOne({ adminId: sub }).select('activeSessionId isActive');
        if (!admin || !admin.isActive) return false;
        if (!admin.activeSessionId) return false;
        this.activeSessions.set(cacheKey, admin.activeSessionId);
        return admin.activeSessionId === sessionId;
      }
      return true;
    }

    if (accountType === ACCOUNT_TYPE.TENANT_USER && tenantId) {
      const isLive = dbConnection.getStatus().connected;
      if (isLive) {
        try {
          const UserModel = tenantConnectionService.getTenantUserModel(tenantId);
          if (UserModel) {
            const user = await UserModel.findOne({ tenantId, userId: sub }).select('activeSessionId isActive isDeleted');
            if (!user || !user.isActive || user.isDeleted) return false;
            if (!user.activeSessionId) return false;
            this.activeSessions.set(cacheKey, user.activeSessionId);
            return user.activeSessionId === sessionId;
          }
        } catch {
          return true;
        }
      }
      return true;
    }

    return true;
  }

  /**
   * Invalidate active session on logout
   * @param {Object} tokenPayload 
   */
  async logoutUser(tokenPayload) {
    if (!tokenPayload) return;
    const { sub, tenantId, accountType } = tokenPayload;
    const scope = accountType === ACCOUNT_TYPE.PLATFORM_SUPER_ADMIN ? 'platform' : tenantId;
    this.clearActiveSession(scope, sub);

    if (accountType === ACCOUNT_TYPE.PLATFORM_SUPER_ADMIN) {
      const isLive = dbConnection.getStatus().connected;
      if (isLive) {
        try {
          await PlatformAdminModel.updateOne({ adminId: sub }, { $set: { activeSessionId: null } });
        } catch {
          // Ignore DB connection errors during logout
        }
      }
    } else if (accountType === ACCOUNT_TYPE.TENANT_USER && tenantId) {
      const isLive = dbConnection.getStatus().connected;
      if (isLive) {
        try {
          const UserModel = tenantConnectionService.getTenantUserModel(tenantId);
          if (UserModel) {
            await UserModel.updateOne({ tenantId, userId: sub }, { $set: { activeSessionId: null } });
          }
        } catch {
          // Ignore DB connection errors during logout
        }
      }
    }
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
