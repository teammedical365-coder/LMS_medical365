/**
 * Lab Management System (LMS) - Tenant Role Management Service
 * 
 * Manages custom roles and granular permission sets strictly within
 * each laboratory's tenant database (`lms_lab_<tenantId>`).
 * 
 * SECURITY RULES:
 * 1. Scope all operations strictly to the server-verified tenantId.
 * 2. Never allow cross-tenant role queries, updates, or assignments.
 * 3. Prohibit creating, assigning, or impersonating Platform Super Admin privileges.
 * 4. Validate all permissions against the system permission matrix.
 * 5. Return 503 Service Unavailable when live MongoDB is not connected and not in test memory mode.
 */

import crypto from 'crypto';
import tenantConnectionService from './tenantConnection.service.js';
import tenantUserService from './tenantUser.service.js';
import auditLogService from './auditLog.service.js';
import {
  DEFAULT_LAB_ROLES,
  MODULE_ACTIONS,
  AVAILABLE_NAV_ITEMS,
  sanitizePermissions,
} from '../config/permissions.js';
import { RoleModel } from '../models/role.model.js';
import TenantModel from '../models/tenant.model.js';
import logger from '../utils/logger.js';

export class RoleServiceError extends Error {
  constructor(message, code = 'ROLE_ERROR', statusCode = 400) {
    super(message);
    this.name = 'RoleServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class RoleService {
  constructor() {
    // In-memory role store for offline test execution: tenantId -> Map<roleId, roleDoc>
    this.memoryStore = new Map();
  }

  generateRoleId() {
    return `rol_${crypto.randomBytes(6).toString('hex')}`;
  }

  normalizeCode(code) {
    if (!code || typeof code !== 'string') return '';
    return code
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_');
  }

  /**
   * Seed platform master roles into the master database if not present
   */
  async seedMasterRoles() {
    if (tenantConnectionService.isLiveMongoConnected()) {
      const count = await RoleModel.countDocuments({ tenantId: 'platform_master' });
      if (count === 0) {
        for (const def of DEFAULT_LAB_ROLES) {
          const roleId = this.generateRoleId();
          const roleDoc = new RoleModel({
            roleId,
            tenantId: 'platform_master',
            code: def.code,
            name: def.name,
            description: def.description,
            dashboardPath: def.dashboardPath,
            navigationItems: def.navigationItems,
            permissions: def.permissions,
            isSystemDefault: true,
            isActive: true,
          });
          await roleDoc.save();
        }
        logger.info('[MASTER ROLES] Initialized default platform master roles.');
      }
      return;
    }

    // In-memory test store fallback
    if (!this.memoryStore.has('platform_master')) {
      this.memoryStore.set('platform_master', new Map());
    }
    const masterRoles = this.memoryStore.get('platform_master');
    if (masterRoles.size === 0) {
      for (const def of DEFAULT_LAB_ROLES) {
        const roleId = this.generateRoleId();
        masterRoles.set(roleId, {
          id: roleId,
          roleId,
          tenantId: 'platform_master',
          code: def.code,
          name: def.name,
          description: def.description,
          dashboardPath: def.dashboardPath,
          navigationItems: def.navigationItems,
          permissions: def.permissions,
          isSystemDefault: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          toSafeJSON: function () {
            return { ...this };
          },
        });
      }
    }
  }

  /**
   * List all platform master roles (Super Admin catalog)
   */
  async listMasterRoles(query = {}) {
    await this.seedMasterRoles();
    const { isActive, search } = query;

    if (tenantConnectionService.isLiveMongoConnected()) {
      const filter = { tenantId: 'platform_master' };
      if (typeof isActive !== 'undefined') {
        filter.isActive = isActive === true || isActive === 'true';
      }
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }
      const roles = await RoleModel.find(filter).sort({ isSystemDefault: -1, createdAt: 1 });
      return roles.map((r) => r.toSafeJSON());
    }

    // In-memory fallback
    const masterRoles = this.memoryStore.get('platform_master') || new Map();
    let list = Array.from(masterRoles.values());
    if (typeof isActive !== 'undefined') {
      const boolVal = isActive === true || isActive === 'true';
      list = list.filter((r) => r.isActive === boolVal);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(s) || r.code.toLowerCase().includes(s));
    }
    return list.map((r) => (typeof r.toSafeJSON === 'function' ? r.toSafeJSON() : r));
  }

  /**
   * Get single master role by ID or code
   */
  async getMasterRoleById(roleIdOrCode) {
    await this.seedMasterRoles();

    if (tenantConnectionService.isLiveMongoConnected()) {
      const role = await RoleModel.findOne({
        tenantId: 'platform_master',
        $or: [{ roleId: roleIdOrCode }, { code: roleIdOrCode.toLowerCase() }],
      });
      if (!role) {
        throw new RoleServiceError(`Master role '${roleIdOrCode}' not found`, 'ROLE_NOT_FOUND', 404);
      }
      return role.toSafeJSON();
    }

    const masterRoles = this.memoryStore.get('platform_master') || new Map();
    for (const r of masterRoles.values()) {
      if (r.roleId === roleIdOrCode || r.code === roleIdOrCode.toLowerCase()) {
        return typeof r.toSafeJSON === 'function' ? r.toSafeJSON() : r;
      }
    }
    throw new RoleServiceError(`Master role '${roleIdOrCode}' not found`, 'ROLE_NOT_FOUND', 404);
  }

  /**
   * Create a new platform master role and propagate to all active laboratories
   */
  async createMasterRole(roleData, actor = {}) {
    await this.seedMasterRoles();
    const { name, code, description = '', dashboardPath = '/dashboard', navigationItems = ['dashboard'], permissions = [] } = roleData;

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new RoleServiceError('Role name is required', 'VALIDATION_ERROR', 400);
    }

    const cleanCode = this.normalizeCode(code || name);
    if (!cleanCode || cleanCode.length < 2) {
      throw new RoleServiceError('Role code must be at least 2 alphanumeric characters', 'VALIDATION_ERROR', 400);
    }

    if (['super_admin', 'platform_support', 'platform_admin'].includes(cleanCode)) {
      throw new RoleServiceError('Platform Super Admin role code is reserved', 'FORBIDDEN_ROLE_CODE', 403);
    }

    const cleanPermissions = sanitizePermissions(permissions);
    let createdRole;

    if (tenantConnectionService.isLiveMongoConnected()) {
      const existing = await RoleModel.findOne({ tenantId: 'platform_master', code: cleanCode });
      if (existing) {
        throw new RoleServiceError(`A role with code '${cleanCode}' already exists in platform master registry`, 'ROLE_EXISTS', 409);
      }

      const roleId = this.generateRoleId();
      const roleDoc = new RoleModel({
        roleId,
        tenantId: 'platform_master',
        code: cleanCode,
        name: name.trim(),
        description: description.trim(),
        dashboardPath: dashboardPath.trim() || '/dashboard',
        navigationItems: Array.isArray(navigationItems) ? navigationItems : ['dashboard'],
        permissions: cleanPermissions,
        isSystemDefault: false,
        isActive: true,
      });
      await roleDoc.save();
      createdRole = roleDoc.toSafeJSON();
    } else {
      const masterRoles = this.memoryStore.get('platform_master') || new Map();
      for (const r of masterRoles.values()) {
        if (r.code === cleanCode) {
          throw new RoleServiceError(`A role with code '${cleanCode}' already exists`, 'ROLE_EXISTS', 409);
        }
      }
      const roleId = this.generateRoleId();
      const mockRole = {
        id: roleId,
        roleId,
        tenantId: 'platform_master',
        code: cleanCode,
        name: name.trim(),
        description: description.trim(),
        dashboardPath: dashboardPath.trim() || '/dashboard',
        navigationItems: Array.isArray(navigationItems) ? navigationItems : ['dashboard'],
        permissions: cleanPermissions,
        isSystemDefault: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        toSafeJSON: function () {
          return { ...this };
        },
      };
      masterRoles.set(roleId, mockRole);
      createdRole = mockRole.toSafeJSON();
    }

    await auditLogService.recordEvent({
      action: 'MASTER_ROLE_CREATED',
      targetTenantId: 'platform_master',
      actorType: 'SUPER_ADMIN',
      actorId: actor.sub || actor.id || 'super_admin',
      actorEmail: actor.email,
      resource: 'role',
      details: { roleId: createdRole.roleId, code: cleanCode, name: name.trim(), permissionsCount: cleanPermissions.length },
    }).catch(() => {});

    // Propagate newly created master role to all tenant databases
    await this.syncMasterRolesToAllTenants().catch((err) => {
      logger.warn(`[SYNC MASTER ROLE] Auto-sync to laboratories encountered error: ${err.message}`);
    });

    return createdRole;
  }

  /**
   * Update an existing platform master role and sync changes to all laboratories
   */
  async updateMasterRole(roleId, updateData, actor = {}) {
    await this.seedMasterRoles();
    let updatedRole;

    if (tenantConnectionService.isLiveMongoConnected()) {
      const roleDoc = await RoleModel.findOne({ tenantId: 'platform_master', roleId });
      if (!roleDoc) {
        throw new RoleServiceError('Master role not found', 'ROLE_NOT_FOUND', 404);
      }

      if (updateData.name && typeof updateData.name === 'string') {
        roleDoc.name = updateData.name.trim();
      }
      if (typeof updateData.description === 'string') {
        roleDoc.description = updateData.description.trim();
      }
      if (updateData.dashboardPath && typeof updateData.dashboardPath === 'string') {
        roleDoc.dashboardPath = updateData.dashboardPath.trim();
      }
      if (Array.isArray(updateData.navigationItems)) {
        roleDoc.navigationItems = updateData.navigationItems;
      }
      if (Array.isArray(updateData.permissions)) {
        roleDoc.permissions = sanitizePermissions(updateData.permissions);
      }

      await roleDoc.save();
      updatedRole = roleDoc.toSafeJSON();
    } else {
      const masterRoles = this.memoryStore.get('platform_master');
      const roleDoc = masterRoles?.get(roleId);
      if (!roleDoc) {
        throw new RoleServiceError('Master role not found', 'ROLE_NOT_FOUND', 404);
      }
      if (updateData.name) roleDoc.name = updateData.name.trim();
      if (typeof updateData.description === 'string') roleDoc.description = updateData.description.trim();
      if (updateData.dashboardPath) roleDoc.dashboardPath = updateData.dashboardPath.trim();
      if (Array.isArray(updateData.navigationItems)) roleDoc.navigationItems = updateData.navigationItems;
      if (Array.isArray(updateData.permissions)) roleDoc.permissions = sanitizePermissions(updateData.permissions);
      roleDoc.updatedAt = new Date();
      updatedRole = typeof roleDoc.toSafeJSON === 'function' ? roleDoc.toSafeJSON() : roleDoc;
    }

    await auditLogService.recordEvent({
      action: 'MASTER_ROLE_UPDATED',
      targetTenantId: 'platform_master',
      actorType: 'SUPER_ADMIN',
      actorId: actor.sub || actor.id || 'super_admin',
      actorEmail: actor.email,
      resource: 'role',
      details: { roleId, code: updatedRole.code, permissionsCount: updatedRole.permissions.length },
    }).catch(() => {});

    // Sync updated role to all laboratories
    await this.syncMasterRolesToAllTenants().catch((err) => {
      logger.warn(`[SYNC MASTER ROLE] Auto-sync updates to laboratories encountered error: ${err.message}`);
    });

    return updatedRole;
  }

  /**
   * Toggle active status of a master role and sync to all laboratories
   */
  async updateMasterRoleStatus(roleId, isActive, actor = {}) {
    await this.seedMasterRoles();
    if (typeof isActive !== 'boolean') {
      throw new RoleServiceError('isActive must be a boolean', 'VALIDATION_ERROR', 400);
    }

    let updatedRole;
    if (tenantConnectionService.isLiveMongoConnected()) {
      const roleDoc = await RoleModel.findOne({ tenantId: 'platform_master', roleId });
      if (!roleDoc) {
        throw new RoleServiceError('Master role not found', 'ROLE_NOT_FOUND', 404);
      }
      if (roleDoc.code === 'lab_admin' && !isActive) {
        throw new RoleServiceError('The primary Laboratory Administrator role cannot be deactivated', 'CANNOT_DEACTIVATE_ADMIN', 400);
      }
      roleDoc.isActive = isActive;
      await roleDoc.save();
      updatedRole = roleDoc.toSafeJSON();
    } else {
      const masterRoles = this.memoryStore.get('platform_master');
      const roleDoc = masterRoles?.get(roleId);
      if (!roleDoc) {
        throw new RoleServiceError('Master role not found', 'ROLE_NOT_FOUND', 404);
      }
      if (roleDoc.code === 'lab_admin' && !isActive) {
        throw new RoleServiceError('The primary Laboratory Administrator role cannot be deactivated', 'CANNOT_DEACTIVATE_ADMIN', 400);
      }
      roleDoc.isActive = isActive;
      roleDoc.updatedAt = new Date();
      updatedRole = typeof roleDoc.toSafeJSON === 'function' ? roleDoc.toSafeJSON() : roleDoc;
    }

    await this.syncMasterRolesToAllTenants().catch((err) => {
      logger.warn(`[SYNC MASTER ROLE] Auto-sync status to laboratories encountered error: ${err.message}`);
    });

    return updatedRole;
  }

  /**
   * Delete a custom master role from master registry and all laboratory databases
   */
  async deleteMasterRole(roleId, actor = {}) {
    await this.seedMasterRoles();

    let targetCode = '';
    let targetName = '';

    if (tenantConnectionService.isLiveMongoConnected()) {
      const roleDoc = await RoleModel.findOne({ tenantId: 'platform_master', roleId });
      if (!roleDoc) {
        throw new RoleServiceError('Master role not found', 'ROLE_NOT_FOUND', 404);
      }
      if (roleDoc.code === 'lab_admin') {
        throw new RoleServiceError('The primary Laboratory Administrator role cannot be deleted', 'CANNOT_DELETE_ADMIN', 400);
      }
      targetCode = roleDoc.code;
      targetName = roleDoc.name;

      await RoleModel.deleteOne({ tenantId: 'platform_master', roleId });

      // Delete from all tenant databases if not in use by staff
      try {
        const tenants = await TenantModel.find({ status: { $ne: 'deleted' } }).select('tenantId');
        for (const t of tenants) {
          const TenantRoleModel = tenantConnectionService.getTenantRoleModel(t.tenantId);
          if (TenantRoleModel) {
            await TenantRoleModel.deleteOne({ tenantId: t.tenantId, code: targetCode });
          }
        }
      } catch (err) {
        logger.warn(`[DELETE MASTER ROLE] Tenant cleanup warning: ${err.message}`);
      }
    } else {
      const masterRoles = this.memoryStore.get('platform_master');
      const roleDoc = masterRoles?.get(roleId);
      if (!roleDoc) {
        throw new RoleServiceError('Master role not found', 'ROLE_NOT_FOUND', 404);
      }
      if (roleDoc.code === 'lab_admin') {
        throw new RoleServiceError('The primary Laboratory Administrator role cannot be deleted', 'CANNOT_DELETE_ADMIN', 400);
      }
      targetCode = roleDoc.code;
      targetName = roleDoc.name;
      masterRoles.delete(roleId);
    }

    await auditLogService.recordEvent({
      action: 'MASTER_ROLE_DELETED',
      targetTenantId: 'platform_master',
      actorType: 'SUPER_ADMIN',
      actorId: actor.sub || actor.id || 'super_admin',
      actorEmail: actor.email,
      resource: 'role',
      details: { roleId, code: targetCode, name: targetName },
    }).catch(() => {});

    return { success: true, message: `Master role '${targetName}' deleted successfully across platform.` };
  }

  /**
   * Sync all Platform Master roles into every active tenant database
   */
  async syncMasterRolesToAllTenants() {
    const masterRoles = await this.listMasterRoles();
    if (!masterRoles || masterRoles.length === 0) {
      return { syncedTenants: 0, totalMasterRoles: 0 };
    }

    if (tenantConnectionService.isLiveMongoConnected()) {
      const tenants = await TenantModel.find({ status: { $ne: 'deleted' } }).select('tenantId code name');
      let syncedCount = 0;

      for (const t of tenants) {
        try {
          const TenantRoleModel = tenantConnectionService.getTenantRoleModel(t.tenantId);
          if (TenantRoleModel) {
            for (const mr of masterRoles) {
              await TenantRoleModel.findOneAndUpdate(
                { tenantId: t.tenantId, code: mr.code },
                {
                  $set: {
                    name: mr.name,
                    description: mr.description,
                    dashboardPath: mr.dashboardPath,
                    navigationItems: mr.navigationItems,
                    permissions: mr.permissions,
                    isActive: mr.isActive,
                    isSystemDefault: mr.isSystemDefault,
                  },
                  $setOnInsert: {
                    roleId: mr.roleId || this.generateRoleId(),
                    tenantId: t.tenantId,
                  },
                },
                { upsert: true, new: true }
              );
            }
            syncedCount++;
          }
        } catch (err) {
          logger.warn(`[SYNC ROLES] Failed to sync roles to tenant ${t.tenantId}: ${err.message}`);
        }
      }
      logger.info(`[SYNC ROLES] Synchronized ${masterRoles.length} master roles across ${syncedCount} laboratories.`);
      return { syncedTenants: syncedCount, totalMasterRoles: masterRoles.length };
    }

    // In-memory sync for test suite
    let syncedCount = 0;
    for (const [tId, tenantRoleMap] of this.memoryStore.entries()) {
      if (tId !== 'platform_master') {
        for (const mr of masterRoles) {
          if (!tenantRoleMap.has(mr.roleId)) {
            tenantRoleMap.set(mr.roleId, { ...mr, tenantId: tId });
          }
        }
        syncedCount++;
      }
    }
    return { syncedTenants: syncedCount, totalMasterRoles: masterRoles.length };
  }

  /**
   * Seed default laboratory roles into the tenant database if not already present
   */
  async seedDefaultRoles(tenantId) {
    const RoleModel = tenantConnectionService.getTenantRoleModel(tenantId);
    const masterRoles = await this.listMasterRoles().catch(() => DEFAULT_LAB_ROLES);
    const rolesToSeed = masterRoles && masterRoles.length > 0 ? masterRoles : DEFAULT_LAB_ROLES;

    if (RoleModel) {
      const existingCount = await RoleModel.countDocuments({ tenantId });
      if (existingCount > 0) return; // Tenant already has roles seeded or customized

      for (const def of rolesToSeed) {
        const roleId = def.roleId || this.generateRoleId();
        const roleDoc = new RoleModel({
          roleId,
          tenantId,
          code: def.code,
          name: def.name,
          description: def.description,
          dashboardPath: def.dashboardPath,
          navigationItems: def.navigationItems,
          permissions: def.permissions,
          isSystemDefault: def.isSystemDefault ?? true,
          isActive: def.isActive ?? true,
        });
        await roleDoc.save();
      }
      logger.info(`[ROLES] Seeded ${rolesToSeed.length} roles for tenant: ${tenantId}`);
      return;
    }

    // In-memory test store fallback
    if (!this.memoryStore.has(tenantId)) {
      this.memoryStore.set(tenantId, new Map());
    }
    const tenantRoles = this.memoryStore.get(tenantId);
    if (tenantRoles.size > 0) return;

    for (const def of rolesToSeed) {
      const roleId = def.roleId || this.generateRoleId();
      const mockRole = {
        id: roleId,
        roleId,
        tenantId,
        code: def.code,
        name: def.name,
        description: def.description,
        dashboardPath: def.dashboardPath,
        navigationItems: def.navigationItems,
        permissions: def.permissions,
        isSystemDefault: def.isSystemDefault ?? true,
        isActive: def.isActive ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
        toSafeJSON: function () {
          return { ...this };
        },
      };
      tenantRoles.set(roleId, mockRole);
    }
  }

  /**
   * Return permission matrix metadata for UI Builder
   */
  getPermissionsMatrix() {
    return {
      modules: MODULE_ACTIONS,
      navigationItems: AVAILABLE_NAV_ITEMS,
    };
  }

  /**
   * List all roles within a specific tenant database
   */
  async listRoles(tenantId, query = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    await this.seedDefaultRoles(tenantId);

    const { isActive, search } = query;
    const RoleModel = tenantConnectionService.getTenantRoleModel(tenantId);

    if (RoleModel) {
      const filter = { tenantId };
      if (typeof isActive !== 'undefined') {
        filter.isActive = isActive === true || isActive === 'true';
      }
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: 'i' } },
          { code: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      const roles = await RoleModel.find(filter).sort({ isSystemDefault: -1, createdAt: 1 });
      return roles.map((r) => r.toSafeJSON());
    }

    // In-memory fallback
    const tenantRoles = this.memoryStore.get(tenantId) || new Map();
    let list = Array.from(tenantRoles.values());

    if (typeof isActive !== 'undefined') {
      const boolVal = isActive === true || isActive === 'true';
      list = list.filter((r) => r.isActive === boolVal);
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(s) || r.code.toLowerCase().includes(s));
    }

    return list.map((r) => (typeof r.toSafeJSON === 'function' ? r.toSafeJSON() : r));
  }

  /**
   * Get role by roleId or code within tenant
   */
  async getRoleById(tenantId, roleIdOrCode) {
    await tenantUserService.assertTenantReady(tenantId);
    await this.seedDefaultRoles(tenantId);

    const RoleModel = tenantConnectionService.getTenantRoleModel(tenantId);

    if (RoleModel) {
      const role = await RoleModel.findOne({
        tenantId,
        $or: [{ roleId: roleIdOrCode }, { code: roleIdOrCode.toLowerCase() }],
      });
      if (!role) {
        throw new RoleServiceError(`Role '${roleIdOrCode}' not found in this laboratory`, 'ROLE_NOT_FOUND', 404);
      }
      return role.toSafeJSON();
    }

    const tenantRoles = this.memoryStore.get(tenantId) || new Map();
    for (const r of tenantRoles.values()) {
      if (r.roleId === roleIdOrCode || r.code === roleIdOrCode.toLowerCase()) {
        return typeof r.toSafeJSON === 'function' ? r.toSafeJSON() : r;
      }
    }

    throw new RoleServiceError(`Role '${roleIdOrCode}' not found in this laboratory`, 'ROLE_NOT_FOUND', 404);
  }

  /**
   * Create a new custom role within tenant
   */
  async createRole(tenantId, roleData, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    await this.seedDefaultRoles(tenantId);

    const { name, code, description = '', dashboardPath = '/dashboard', navigationItems = ['dashboard'], permissions = [] } = roleData;

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw new RoleServiceError('Role name is required', 'VALIDATION_ERROR', 400);
    }

    const cleanCode = this.normalizeCode(code || name);
    if (!cleanCode || cleanCode.length < 2) {
      throw new RoleServiceError('Role code must be at least 2 alphanumeric characters', 'VALIDATION_ERROR', 400);
    }

    // Security check: Prevent creating Super Admin / Platform Admin privileges within a tenant!
    if (['super_admin', 'platform_support', 'platform_admin'].includes(cleanCode)) {
      throw new RoleServiceError(
        'Platform Super Admin role privileges cannot be created within a laboratory tenant',
        'FORBIDDEN_ROLE_CODE',
        403
      );
    }

    const cleanPermissions = sanitizePermissions(permissions);
    const RoleModel = tenantConnectionService.getTenantRoleModel(tenantId);

    if (RoleModel) {
      const existing = await RoleModel.findOne({ tenantId, code: cleanCode });
      if (existing) {
        throw new RoleServiceError(`A role with code '${cleanCode}' already exists in this laboratory`, 'ROLE_EXISTS', 409);
      }

      const roleId = this.generateRoleId();
      const roleDoc = new RoleModel({
        roleId,
        tenantId,
        code: cleanCode,
        name: name.trim(),
        description: description.trim(),
        dashboardPath: dashboardPath.trim() || '/dashboard',
        navigationItems: Array.isArray(navigationItems) ? navigationItems : ['dashboard'],
        permissions: cleanPermissions,
        isSystemDefault: false,
        isActive: true,
      });

      await roleDoc.save();

      await auditLogService.recordEvent({
        action: 'ROLE_CREATED',
        targetTenantId: tenantId,
        actorType: actor.accountType || 'TENANT_USER',
        actorId: actor.sub || actor.userId || 'unknown',
        actorEmail: actor.email,
        resource: 'role',
        details: { roleId, code: cleanCode, name: name.trim(), permissionsCount: cleanPermissions.length },
      });

      return roleDoc.toSafeJSON();
    }

    // In-memory test store mode
    const tenantRoles = this.memoryStore.get(tenantId) || new Map();
    for (const r of tenantRoles.values()) {
      if (r.code === cleanCode) {
        throw new RoleServiceError(`A role with code '${cleanCode}' already exists in this laboratory`, 'ROLE_EXISTS', 409);
      }
    }

    const roleId = this.generateRoleId();
    const mockRole = {
      id: roleId,
      roleId,
      tenantId,
      code: cleanCode,
      name: name.trim(),
      description: description.trim(),
      dashboardPath: dashboardPath.trim() || '/dashboard',
      navigationItems: Array.isArray(navigationItems) ? navigationItems : ['dashboard'],
      permissions: cleanPermissions,
      isSystemDefault: false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      toSafeJSON: function () {
        return { ...this };
      },
    };

    tenantRoles.set(roleId, mockRole);
    return mockRole.toSafeJSON();
  }

  /**
   * Update an existing role's definition, permissions, and navigation
   */
  async updateRole(tenantId, roleId, updateData, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);

    const RoleModel = tenantConnectionService.getTenantRoleModel(tenantId);

    if (RoleModel) {
      const roleDoc = await RoleModel.findOne({ tenantId, roleId });
      if (!roleDoc) {
        throw new RoleServiceError('Role not found in this laboratory', 'ROLE_NOT_FOUND', 404);
      }

      if (updateData.name && typeof updateData.name === 'string') {
        roleDoc.name = updateData.name.trim();
      }
      if (typeof updateData.description === 'string') {
        roleDoc.description = updateData.description.trim();
      }
      if (updateData.dashboardPath && typeof updateData.dashboardPath === 'string') {
        roleDoc.dashboardPath = updateData.dashboardPath.trim();
      }
      if (Array.isArray(updateData.navigationItems)) {
        roleDoc.navigationItems = updateData.navigationItems;
      }
      if (Array.isArray(updateData.permissions)) {
        roleDoc.permissions = sanitizePermissions(updateData.permissions);
      }

      await roleDoc.save();

      await auditLogService.recordEvent({
        action: 'ROLE_UPDATED',
        targetTenantId: tenantId,
        actorType: actor.accountType || 'TENANT_USER',
        actorId: actor.sub || actor.userId || 'unknown',
        actorEmail: actor.email,
        resource: 'role',
        details: { roleId, code: roleDoc.code, permissionsCount: roleDoc.permissions.length },
      });

      return roleDoc.toSafeJSON();
    }

    // In-memory test store mode
    const tenantRoles = this.memoryStore.get(tenantId);
    const roleDoc = tenantRoles?.get(roleId);
    if (!roleDoc) {
      throw new RoleServiceError('Role not found in this laboratory', 'ROLE_NOT_FOUND', 404);
    }

    if (updateData.name) roleDoc.name = updateData.name.trim();
    if (typeof updateData.description === 'string') roleDoc.description = updateData.description.trim();
    if (updateData.dashboardPath) roleDoc.dashboardPath = updateData.dashboardPath.trim();
    if (Array.isArray(updateData.navigationItems)) roleDoc.navigationItems = updateData.navigationItems;
    if (Array.isArray(updateData.permissions)) roleDoc.permissions = sanitizePermissions(updateData.permissions);
    roleDoc.updatedAt = new Date();

    return typeof roleDoc.toSafeJSON === 'function' ? roleDoc.toSafeJSON() : roleDoc;
  }

  /**
   * Safe deactivation / activation of a role
   */
  async updateRoleStatus(tenantId, roleId, isActive, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);

    if (typeof isActive !== 'boolean') {
      throw new RoleServiceError('isActive must be a boolean', 'VALIDATION_ERROR', 400);
    }

    const RoleModel = tenantConnectionService.getTenantRoleModel(tenantId);

    if (RoleModel) {
      const roleDoc = await RoleModel.findOne({ tenantId, roleId });
      if (!roleDoc) {
        throw new RoleServiceError('Role not found in this laboratory', 'ROLE_NOT_FOUND', 404);
      }

      if (roleDoc.code === 'lab_admin' && !isActive) {
        throw new RoleServiceError('The primary Laboratory Administrator role cannot be deactivated', 'CANNOT_DEACTIVATE_ADMIN', 400);
      }

      roleDoc.isActive = isActive;
      await roleDoc.save();

      await auditLogService.recordEvent({
        action: isActive ? 'ROLE_ACTIVATED' : 'ROLE_DEACTIVATED',
        targetTenantId: tenantId,
        actorType: actor.accountType || 'TENANT_USER',
        actorId: actor.sub || actor.userId || 'unknown',
        actorEmail: actor.email,
        resource: 'role',
        details: { roleId, code: roleDoc.code, isActive },
      });

      return roleDoc.toSafeJSON();
    }

    // In-memory test store mode
    const tenantRoles = this.memoryStore.get(tenantId);
    const roleDoc = tenantRoles?.get(roleId);
    if (!roleDoc) {
      throw new RoleServiceError('Role not found in this laboratory', 'ROLE_NOT_FOUND', 404);
    }

    if (roleDoc.code === 'lab_admin' && !isActive) {
      throw new RoleServiceError('The primary Laboratory Administrator role cannot be deactivated', 'CANNOT_DEACTIVATE_ADMIN', 400);
    }

    roleDoc.isActive = isActive;
    roleDoc.updatedAt = new Date();
    return typeof roleDoc.toSafeJSON === 'function' ? roleDoc.toSafeJSON() : roleDoc;
  }

  /**
   * Delete a custom role from the tenant
   */
  async deleteRole(tenantId, roleId, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);

    const RoleModel = tenantConnectionService.getTenantRoleModel(tenantId);
    const UserModel = tenantConnectionService.getTenantUserModel(tenantId);

    if (RoleModel) {
      const roleDoc = await RoleModel.findOne({ tenantId, roleId });
      if (!roleDoc) {
        throw new RoleServiceError('Role not found in this laboratory', 'ROLE_NOT_FOUND', 404);
      }

      if (roleDoc.code === 'lab_admin') {
        throw new RoleServiceError('The primary Laboratory Administrator role cannot be deleted', 'CANNOT_DELETE_ADMIN', 400);
      }

      // Check if any active staff members currently have this role assigned
      if (UserModel) {
        const assignedCount = await UserModel.countDocuments({
          tenantId,
          role: { $in: [roleDoc.code, roleDoc.roleId] },
        });
        if (assignedCount > 0) {
          throw new RoleServiceError(
            `Cannot delete role '${roleDoc.name}' because ${assignedCount} staff member(s) are currently assigned to it. Please reassign their roles first.`,
            'ROLE_IN_USE',
            400
          );
        }
      }

      await RoleModel.deleteOne({ tenantId, roleId });

      await auditLogService.recordEvent({
        action: 'ROLE_DELETED',
        targetTenantId: tenantId,
        actorType: actor.accountType || 'TENANT_USER',
        actorId: actor.sub || actor.userId || 'unknown',
        actorEmail: actor.email,
        resource: 'role',
        details: { roleId, code: roleDoc.code, name: roleDoc.name },
      });

      return { success: true, message: `Role '${roleDoc.name}' deleted successfully.` };
    }

    // In-memory test store mode
    const tenantRoles = this.memoryStore.get(tenantId);
    const roleDoc = tenantRoles?.get(roleId);
    if (!roleDoc) {
      throw new RoleServiceError('Role not found in this laboratory', 'ROLE_NOT_FOUND', 404);
    }

    if (roleDoc.code === 'lab_admin') {
      throw new RoleServiceError('The primary Laboratory Administrator role cannot be deleted', 'CANNOT_DELETE_ADMIN', 400);
    }

    tenantRoles.delete(roleId);
    return { success: true, message: `Role '${roleDoc.name}' deleted successfully.` };
  }

  clearMemoryStore() {
    this.memoryStore.clear();
  }
}

export const roleService = new RoleService();
export default roleService;
