/**
 * Lab Management System (LMS) - Laboratory Tenant User Management Service
 * 
 * Manages users strictly within their isolated tenant database.
 * 
 * SECURITY RULES:
 * 1. Store users strictly in `lms_lab_<tenantId>` database.
 * 2. Never query the master database or other tenant databases for user records.
 * 3. Enforce strong password complexity before persisting.
 * 4. Never return password hashes in responses.
 * 5. Validate tenant exists, is ACTIVE, and database is READY before creating users.
 */

import crypto from 'crypto';
import tenantConnectionService from './tenantConnection.service.js';
import tenantResolutionService from './tenantResolution.service.js';
import passwordService from './password.service.js';
import roleService from './role.service.js';
import auditLogService from './auditLog.service.js';
import { USER_ROLES, AUDIT_ACTIONS } from '../config/constants.js';
import logger from '../utils/logger.js';

export class TenantUserError extends Error {
  constructor(message, code = 'TENANT_USER_ERROR', statusCode = 400) {
    super(message);
    this.name = 'TenantUserError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class TenantUserService {
  constructor() {
    // Isolated in-memory tenant user store: tenantId -> Map<userId, userDoc>
    this.memoryStore = new Map();
  }

  /**
   * Helper to generate unique tenant user ID
   */
  generateUserId() {
    return `usr_${crypto.randomBytes(6).toString('hex')}`;
  }

  /**
   * Validate that tenant exists, is ACTIVE, and has READY database
   */
  async assertTenantReady(tenantId) {
    const resolution = await tenantResolutionService.resolveByTenantId(tenantId);
    if (!resolution.isResolved) {
      if (resolution.reason === 'TENANT_NOT_FOUND') {
        throw new TenantUserError('Target laboratory does not exist', 'TENANT_NOT_FOUND', 404);
      }
      if (resolution.reason?.startsWith('TENANT_')) {
        throw new TenantUserError(`Laboratory is not active (current status: ${resolution.status})`, 'TENANT_INACTIVE', 403);
      }
      if (resolution.reason === 'DATABASE_NOT_READY') {
        throw new TenantUserError('Laboratory database has not finished provisioning', 'TENANT_DB_NOT_READY', 400);
      }
      throw new TenantUserError('Laboratory verification failed', 'TENANT_INVALID', 400);
    }
    return resolution;
  }

  /**
   * Create a new user in the specific tenant's database
   * @param {string} tenantId 
   * @param {Object} userData 
   * @param {Object} actor 
   */
  async createUser(tenantId, userData, actor = {}) {
    await this.assertTenantReady(tenantId);

    let rawRole = userData.role;
    if (!rawRole) {
      try {
        const tenantRoles = await roleService.listRoles(tenantId, { isActive: true });
        const nonAdmin = tenantRoles.find((r) => r.code !== 'lab_admin') || tenantRoles[0];
        rawRole = nonAdmin ? nonAdmin.code : USER_ROLES.LAB_TECHNICIAN;
      } catch {
        rawRole = USER_ROLES.LAB_TECHNICIAN;
      }
    }

    const { email, password, fullName, department, phone } = userData;
    const role = rawRole;

    if (!email || typeof email !== 'string') {
      throw new TenantUserError('User email is required', 'VALIDATION_ERROR', 400);
    }
    if (!fullName || typeof fullName !== 'string') {
      throw new TenantUserError('User full name is required', 'VALIDATION_ERROR', 400);
    }

    const cleanEmail = passwordService.normalizeEmail(email);

    // Security Guard: Prevent assigning Super Admin or Platform Support to a tenant user!
    let cleanRoleInput = String(role || '').trim().toLowerCase();
    if (['super_admin', 'platform_support', 'platform_admin'].includes(cleanRoleInput)) {
      throw new TenantUserError(
        'Platform Super Admin privileges cannot be assigned to laboratory accounts',
        'FORBIDDEN_ROLE',
        403
      );
    }

    // Role aliases to map SaaS domain terminology to standard laboratory roles
    const ROLE_ALIASES = {
      accountant: USER_ROLES.BILLING_CLERK,
      report_reviewer: USER_ROLES.PATHOLOGIST,
      approver: USER_ROLES.PATHOLOGIST,
      reviewer: USER_ROLES.PATHOLOGIST,
      sample_collection: USER_ROLES.SAMPLE_COLLECTION,
      sample_collector: USER_ROLES.SAMPLE_COLLECTION,
      phlebotomy: USER_ROLES.PHLEBOTOMIST,
    };
    if (ROLE_ALIASES[cleanRoleInput]) {
      cleanRoleInput = ROLE_ALIASES[cleanRoleInput];
    }

    // Resolve role definition (check tenant custom/active role first, fallback to standard role)
    let resolvedRoleCode = cleanRoleInput;
    let resolvedRoleId = null;

    try {
      const customRole = await roleService.getRoleById(tenantId, cleanRoleInput);
      resolvedRoleCode = customRole.code;
      resolvedRoleId = customRole.roleId;
    } catch {
      if (Object.values(USER_ROLES).includes(cleanRoleInput)) {
        resolvedRoleCode = cleanRoleInput;
      } else {
        throw new TenantUserError(
          `Invalid role: ${role}. Must be a valid standard or custom role in this laboratory.`,
          'INVALID_ROLE',
          400
        );
      }
    }

    // Validate password complexity & hash
    const passCheck = passwordService.validatePassword(password);
    if (!passCheck.isValid) {
      throw new TenantUserError(passCheck.message, 'WEAK_PASSWORD', 400);
    }
    const passwordHash = await passwordService.hashPassword(password);

    const UserModel = tenantConnectionService.getTenantUserModel(tenantId);

    if (UserModel) {
      // Live MongoDB mode
      const existing = await UserModel.findOne({ tenantId, email: cleanEmail });
      if (existing) {
        throw new TenantUserError(
          `User with email ${cleanEmail} already exists in this laboratory`,
          'EMAIL_EXISTS',
          409
        );
      }

      const userId = this.generateUserId();
      const userDoc = new UserModel({
        userId,
        tenantId,
        email: cleanEmail,
        fullName: fullName.trim(),
        passwordHash,
        role: resolvedRoleCode,
        roleId: resolvedRoleId,
        department: department?.trim() || null,
        phone: phone?.trim() || null,
        isActive: true,
      });

      await userDoc.save();

      await auditLogService.recordEvent({
        action: AUDIT_ACTIONS.TENANT_USER_CREATE,
        actorType: actor.accountType || 'SYSTEM',
        actorId: actor.sub || actor.adminId || 'system',
        actorEmail: actor.email,
        targetTenantId: tenantId,
        resource: 'user',
        details: { userId, email: cleanEmail, role: resolvedRoleCode },
      });

      return userDoc.toSafeJSON();
    }

    // In-memory test store mode
    if (!this.memoryStore.has(tenantId)) {
      this.memoryStore.set(tenantId, new Map());
    }
    const tenantUsers = this.memoryStore.get(tenantId);

    for (const u of tenantUsers.values()) {
      if (u.email === cleanEmail) {
        throw new TenantUserError(
          `User with email ${cleanEmail} already exists in this laboratory`,
          'EMAIL_EXISTS',
          409
        );
      }
    }

    const userId = this.generateUserId();
    const mockUser = {
      id: userId,
      userId,
      tenantId,
      email: cleanEmail,
      fullName: fullName.trim(),
      passwordHash,
      role: resolvedRoleCode,
      roleId: resolvedRoleId,
      department: department?.trim() || null,
      phone: phone?.trim() || null,
      isActive: true,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      comparePassword: async (candidate) => passwordService.comparePassword(candidate, passwordHash),
      toSafeJSON: function () {
        const copy = { ...this };
        delete copy.passwordHash;
        delete copy.comparePassword;
        delete copy.toSafeJSON;
        return copy;
      },
    };

    tenantUsers.set(userId, mockUser);
    return mockUser.toSafeJSON();
  }

  /**
   * List users within a specific tenant database
   * @param {string} tenantId 
   * @param {Object} query 
   */
  async listUsers(tenantId, query = {}) {
    await this.assertTenantReady(tenantId);

    const { role, isActive, search } = query;
    const UserModel = tenantConnectionService.getTenantUserModel(tenantId);

    if (UserModel) {
      const filter = { tenantId };
      if (!query.includeDeleted || query.includeDeleted === 'false') {
        filter.isDeleted = { $ne: true };
      }
      if (role) filter.role = role;
      if (typeof isActive === 'boolean' || isActive === 'true' || isActive === 'false') {
        filter.isActive = isActive === true || isActive === 'true';
      }
      if (search) {
        filter.$or = [
          { fullName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
        ];
      }

      const users = await UserModel.find(filter).sort({ createdAt: -1 });
      return users.map((u) => u.toSafeJSON());
    }

    // In-memory test store fallback
    const tenantUsers = this.memoryStore.get(tenantId) || new Map();
    let list = Array.from(tenantUsers.values());

    if (!query.includeDeleted || query.includeDeleted === 'false') {
      list = list.filter((u) => !u.isDeleted && u.status !== 'deleted');
    }

    if (role) {
      list = list.filter((u) => u.role === role);
    }
    if (typeof isActive !== 'undefined') {
      const activeBool = isActive === true || isActive === 'true';
      list = list.filter((u) => u.isActive === activeBool);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((u) => u.fullName.toLowerCase().includes(s) || u.email.toLowerCase().includes(s));
    }

    return list.map((u) => (typeof u.toSafeJSON === 'function' ? u.toSafeJSON() : u));
  }

  /**
   * Get a specific user by userId within a tenant database
   */
  async getUserById(tenantId, userId) {
    await this.assertTenantReady(tenantId);

    const UserModel = tenantConnectionService.getTenantUserModel(tenantId);
    if (UserModel) {
      const user = await UserModel.findOne({ tenantId, userId });
      if (!user) {
        throw new TenantUserError('Laboratory user not found', 'USER_NOT_FOUND', 404);
      }
      return user.toSafeJSON();
    }

    const tenantUsers = this.memoryStore.get(tenantId);
    const user = tenantUsers?.get(userId);
    if (!user) {
      throw new TenantUserError('Laboratory user not found', 'USER_NOT_FOUND', 404);
    }
    return typeof user.toSafeJSON === 'function' ? user.toSafeJSON() : user;
  }

  /**
   * Update a user's active status (safe deactivation)
   * @param {string} tenantId 
   * @param {string} userId 
   * @param {boolean} isActive 
   * @param {Object} actor 
   */
  async updateUserStatus(tenantId, userId, isActive, actor = {}) {
    await this.assertTenantReady(tenantId);

    if (typeof isActive !== 'boolean') {
      throw new TenantUserError('isActive must be a boolean', 'VALIDATION_ERROR', 400);
    }

    const UserModel = tenantConnectionService.getTenantUserModel(tenantId);

    if (UserModel) {
      const user = await UserModel.findOne({ tenantId, userId });
      if (!user) {
        throw new TenantUserError('Laboratory user not found', 'USER_NOT_FOUND', 404);
      }

      if (user.isDeleted || user.status === 'deleted') {
        throw new TenantUserError('Cannot update status of a deleted staff account.', 'USER_ALREADY_DELETED', 400);
      }

      user.isActive = isActive;
      user.status = isActive ? 'active' : 'deactivated';
      await user.save();

      await auditLogService.recordEvent({
        action: isActive ? AUDIT_ACTIONS.TENANT_USER_ACTIVATE : AUDIT_ACTIONS.TENANT_USER_DEACTIVATE,
        actorType: actor.accountType || 'SYSTEM',
        actorId: actor.sub || actor.adminId || 'system',
        actorEmail: actor.email,
        targetTenantId: tenantId,
        resource: 'user',
        details: { userId, isActive },
      });

      return user.toSafeJSON();
    }

    const tenantUsers = this.memoryStore.get(tenantId);
    const user = tenantUsers?.get(userId);
    if (!user) {
      throw new TenantUserError('Laboratory user not found', 'USER_NOT_FOUND', 404);
    }

    if (user.isDeleted || user.status === 'deleted') {
      throw new TenantUserError('Cannot update status of a deleted staff account.', 'USER_ALREADY_DELETED', 400);
    }

    user.isActive = isActive;
    user.status = isActive ? 'active' : 'deactivated';
    user.updatedAt = new Date();
    return typeof user.toSafeJSON === 'function' ? user.toSafeJSON() : user;
  }

  /**
   * Assign a role to an existing user within the tenant
   */
  async assignUserRole(tenantId, userId, roleIdentifier, actor = {}) {
    await this.assertTenantReady(tenantId);

    if (!roleIdentifier || typeof roleIdentifier !== 'string') {
      throw new TenantUserError('Role identifier is required', 'VALIDATION_ERROR', 400);
    }

    let cleanRoleInput = String(roleIdentifier).trim().toLowerCase();
    const ROLE_ALIASES = {
      accountant: USER_ROLES.BILLING_CLERK,
      report_reviewer: USER_ROLES.PATHOLOGIST,
      approver: USER_ROLES.PATHOLOGIST,
      reviewer: USER_ROLES.PATHOLOGIST,
      sample_collection: USER_ROLES.SAMPLE_COLLECTION,
      sample_collector: USER_ROLES.SAMPLE_COLLECTION,
      phlebotomy: USER_ROLES.PHLEBOTOMIST,
    };
    if (ROLE_ALIASES[cleanRoleInput]) {
      cleanRoleInput = ROLE_ALIASES[cleanRoleInput];
    }

    // Security Guard: Prevent assigning Platform Super Admin or Support privileges
    if (['super_admin', 'platform_support', 'platform_admin'].includes(cleanRoleInput)) {
      throw new TenantUserError(
        'Platform Super Admin privileges cannot be assigned to laboratory accounts',
        'FORBIDDEN_ROLE',
        403
      );
    }

    // Resolve target role in this tenant
    const roleDoc = await roleService.getRoleById(tenantId, cleanRoleInput);
    if (!roleDoc.isActive) {
      throw new TenantUserError(`Role '${roleDoc.name}' is inactive and cannot be assigned`, 'ROLE_INACTIVE', 400);
    }

    const UserModel = tenantConnectionService.getTenantUserModel(tenantId);

    if (UserModel) {
      const user = await UserModel.findOne({ tenantId, userId });
      if (!user) {
        throw new TenantUserError('Laboratory user not found', 'USER_NOT_FOUND', 404);
      }

      if (user.isDeleted || user.status === 'deleted') {
        throw new TenantUserError('Cannot assign role to a deleted staff account.', 'USER_ALREADY_DELETED', 400);
      }

      user.role = roleDoc.code;
      user.roleId = roleDoc.roleId;
      await user.save();

      await auditLogService.recordEvent({
        action: 'USER_ROLE_ASSIGNED',
        targetTenantId: tenantId,
        actorType: actor.accountType || 'TENANT_USER',
        actorId: actor.sub || actor.userId || 'system',
        actorEmail: actor.email,
        resource: 'user',
        details: { userId, assignedRole: roleDoc.code, roleId: roleDoc.roleId },
      });

      const safeUser = user.toSafeJSON();
      safeUser.assignedRole = roleDoc;
      return safeUser;
    }

    // Test memory store fallback
    const tenantUsers = this.memoryStore.get(tenantId);
    const user = tenantUsers?.get(userId);
    if (!user) {
      throw new TenantUserError('Laboratory user not found', 'USER_NOT_FOUND', 404);
    }

    if (user.isDeleted || user.status === 'deleted') {
      throw new TenantUserError('Cannot assign role to a deleted staff account.', 'USER_ALREADY_DELETED', 400);
    }

    user.role = roleDoc.code;
    user.roleId = roleDoc.roleId;
    user.updatedAt = new Date();

    const safeUser = typeof user.toSafeJSON === 'function' ? user.toSafeJSON() : { ...user };
    safeUser.assignedRole = roleDoc;
    return safeUser;
  }

  /**
   * Safely soft-delete a laboratory staff member
   *
   * SECURITY & DATA-INTEGRITY RULES:
   * 1. Preserves patient, sample, test, report, invoice, and historical audit records.
   * 2. Sets isDeleted: true, status: 'deleted', isActive: false to immediately block login.
   * 3. Prevents an administrator from deleting their own account (lockout prevention).
   * 4. Prevents deleting the last active laboratory administrator in the tenant.
   * 5. Scoped strictly to the isolated tenant database.
   *
   * @param {string} tenantId
   * @param {string} userId
   * @param {Object} actor
   */
  async deleteUser(tenantId, userId, actor = {}) {
    await this.assertTenantReady(tenantId);

    if (!userId || typeof userId !== 'string') {
      throw new TenantUserError('Target user ID is required', 'VALIDATION_ERROR', 400);
    }

    const cleanUserId = userId.trim();
    const UserModel = tenantConnectionService.getTenantUserModel(tenantId);

    if (UserModel) {
      const targetUser = await UserModel.findOne({ tenantId, userId: cleanUserId });
      if (!targetUser) {
        throw new TenantUserError('Laboratory staff member not found', 'USER_NOT_FOUND', 404);
      }

      if (targetUser.isDeleted || targetUser.status === 'deleted') {
        throw new TenantUserError('Laboratory staff account has already been deleted', 'USER_ALREADY_DELETED', 400);
      }

      // Security Guard: Prevent administrator self-deletion lockout
      const actorUserId = actor.userId || actor.sub || actor.adminId;
      const actorEmail = (actor.email || '').toLowerCase().trim();
      const targetEmail = (targetUser.email || '').toLowerCase().trim();

      if (
        (actorUserId && actorUserId === targetUser.userId) ||
        (actorEmail && targetEmail && actorEmail === targetEmail)
      ) {
        throw new TenantUserError(
          'Cannot delete your own administrator account. Another laboratory administrator must perform this action if required.',
          'CANNOT_DELETE_SELF',
          400
        );
      }

      // Security Guard: Protect the last active administrator
      if ([USER_ROLES.LAB_ADMIN, USER_ROLES.LAB_DIRECTOR].includes(targetUser.role)) {
        const activeAdminCount = await UserModel.countDocuments({
          tenantId,
          role: { $in: [USER_ROLES.LAB_ADMIN, USER_ROLES.LAB_DIRECTOR] },
          isActive: true,
          isDeleted: { $ne: true },
        });

        if (activeAdminCount <= 1) {
          throw new TenantUserError(
            'Cannot delete the last active Laboratory Administrator account. A laboratory must retain at least one active administrator.',
            'LAST_ADMIN_PROTECTED',
            400
          );
        }
      }

      // Safe Soft Deletion
      targetUser.isDeleted = true;
      targetUser.isActive = false;
      targetUser.status = 'deleted';
      targetUser.deletedAt = new Date();
      targetUser.deletedBy = actorEmail || actorUserId || 'administrator';

      await targetUser.save();

      // Audit Trail Logging
      await auditLogService.recordEvent({
        action: AUDIT_ACTIONS.TENANT_USER_DELETE || 'USER_DELETED',
        targetTenantId: tenantId,
        actorType: actor.accountType || 'TENANT_USER',
        actorId: actorUserId || 'system',
        actorEmail: actor.email,
        resource: 'user',
        details: {
          userId: targetUser.userId,
          email: targetUser.email,
          fullName: targetUser.fullName,
          role: targetUser.role,
          deletedAt: targetUser.deletedAt,
          deletedBy: targetUser.deletedBy,
        },
      });

      return targetUser.toSafeJSON();
    }

    // Test memory store fallback
    if (!this.memoryStore.has(tenantId)) {
      this.memoryStore.set(tenantId, new Map());
    }
    const tenantUsers = this.memoryStore.get(tenantId);
    const targetUser = tenantUsers.get(cleanUserId);

    if (!targetUser) {
      throw new TenantUserError('Laboratory staff member not found', 'USER_NOT_FOUND', 404);
    }

    if (targetUser.isDeleted || targetUser.status === 'deleted') {
      throw new TenantUserError('Laboratory staff account has already been deleted', 'USER_ALREADY_DELETED', 400);
    }

    const actorUserId = actor.userId || actor.sub || actor.adminId;
    const actorEmail = (actor.email || '').toLowerCase().trim();
    const targetEmail = (targetUser.email || '').toLowerCase().trim();

    if (
      (actorUserId && actorUserId === targetUser.userId) ||
      (actorEmail && targetEmail && actorEmail === targetEmail)
    ) {
      throw new TenantUserError(
        'Cannot delete your own administrator account. Another laboratory administrator must perform this action if required.',
        'CANNOT_DELETE_SELF',
        400
      );
    }

    if ([USER_ROLES.LAB_ADMIN, USER_ROLES.LAB_DIRECTOR].includes(targetUser.role)) {
      const activeAdminCount = Array.from(tenantUsers.values()).filter(
        (u) =>
          [USER_ROLES.LAB_ADMIN, USER_ROLES.LAB_DIRECTOR].includes(u.role) &&
          u.isActive &&
          !u.isDeleted &&
          u.status !== 'deleted'
      ).length;

      if (activeAdminCount <= 1) {
        throw new TenantUserError(
          'Cannot delete the last active Laboratory Administrator account. A laboratory must retain at least one active administrator.',
          'LAST_ADMIN_PROTECTED',
          400
        );
      }
    }

    targetUser.isDeleted = true;
    targetUser.isActive = false;
    targetUser.status = 'deleted';
    targetUser.deletedAt = new Date();
    targetUser.deletedBy = actorEmail || actorUserId || 'administrator';
    targetUser.updatedAt = new Date();

    return typeof targetUser.toSafeJSON === 'function' ? targetUser.toSafeJSON() : targetUser;
  }

  /**
   * Clear test memory store
   */
  clearMemoryStore() {
    this.memoryStore.clear();
  }
}

export const tenantUserService = new TenantUserService();
export default tenantUserService;
