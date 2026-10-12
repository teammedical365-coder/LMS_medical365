/**
 * Lab Management System (LMS) - Super Admin Controller
 * 
 * Exposes platform management operations with strict validation,
 * consistent response formats, and safe error handling.
 */

import laboratoryManagementService, { LaboratoryManagementError } from '../services/laboratoryManagement.service.js';
import auditLogService from '../services/auditLog.service.js';
import roleService, { RoleServiceError } from '../services/role.service.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../config/constants.js';

export class SuperAdminController {
  /**
   * GET /api/v1/super-admin/overview
   */
  static async getOverview(req, res, next) {
    try {
      const metrics = await laboratoryManagementService.getPlatformOverview();
      const auditResult = await auditLogService.getAuditLogs({ limit: 10 }).catch(() => ({ logs: [] }));
      const recentLaboratories = await laboratoryManagementService.listLaboratories({ limit: 10 }).catch(() => ({ laboratories: [] }));

      const payload = {
        metrics,
        recentAudits: auditResult?.logs || [],
        recentLaboratories: recentLaboratories?.laboratories || [],
      };
      return ApiResponse.success(res, payload, 'Platform overview retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/super-admin/laboratories
   */
  static async listLaboratories(req, res, next) {
    try {
      const { page, limit, status, provisioningStatus, q } = req.query;
      const data = await laboratoryManagementService.listLaboratories({
        page,
        limit,
        status,
        provisioningStatus,
        q,
      });
      return ApiResponse.success(res, data.laboratories, 'Laboratories retrieved successfully', HTTP_STATUS.OK, {
        pagination: data.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/super-admin/laboratories/:id
   */
  static async getLaboratory(req, res, next) {
    try {
      const { id } = req.params;
      const lab = await laboratoryManagementService.getLaboratoryById(id);
      return ApiResponse.success(res, lab, 'Laboratory details retrieved successfully');
    } catch (err) {
      if (err instanceof LaboratoryManagementError) {
        return ApiResponse.error(res, err.message, err.statusCode);
      }
      next(err);
    }
  }

  /**
   * GET /api/v1/super-admin/laboratories/:id/staff
   */
  static async getLaboratoryStaff(req, res, next) {
    try {
      const { id } = req.params;
      const lab = await laboratoryManagementService.getLaboratoryById(id);
      return ApiResponse.success(res, lab.staff || [], 'Laboratory staff list retrieved successfully');
    } catch (err) {
      if (err instanceof LaboratoryManagementError) {
        return ApiResponse.error(res, err.message, err.statusCode);
      }
      next(err);
    }
  }

  /**
   * POST /api/v1/super-admin/laboratories
   */
  static async registerLaboratory(req, res, next) {
    try {
      const actor = req.platformAdmin || { type: 'api_key', id: 'system' };
      const lab = await laboratoryManagementService.registerLaboratory(req.body, actor);
      return ApiResponse.success(
        res,
        lab,
        `Laboratory '${lab.name}' registered successfully with status ${lab.status}`,
        HTTP_STATUS.CREATED
      );
    } catch (err) {
      if (err instanceof LaboratoryManagementError) {
        return ApiResponse.error(res, err.message, err.statusCode);
      }
      next(err);
    }
  }

  /**
   * PATCH /api/v1/super-admin/laboratories/:id
   */
  static async updateLaboratory(req, res, next) {
    try {
      const { id } = req.params;
      const actor = req.platformAdmin || { type: 'api_key', id: 'system' };
      const lab = await laboratoryManagementService.updateLaboratory(id, req.body, actor);
      return ApiResponse.success(res, lab, 'Laboratory updated successfully');
    } catch (err) {
      if (err instanceof LaboratoryManagementError) {
        return ApiResponse.error(res, err.message, err.statusCode);
      }
      next(err);
    }
  }

  /**
   * POST /api/v1/super-admin/laboratories/:id/status
   */
  static async transitionStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status, reason } = req.body;
      if (!status) {
        return ApiResponse.error(res, 'Target status is required in body', HTTP_STATUS.BAD_REQUEST);
      }

      const actor = req.platformAdmin || { type: 'api_key', id: 'system' };
      const lab = await laboratoryManagementService.transitionStatus(id, status, reason, actor);
      return ApiResponse.success(res, lab, `Laboratory status transitioned to ${lab.status}`);
    } catch (err) {
      if (err instanceof LaboratoryManagementError) {
        return ApiResponse.error(res, err.message, err.statusCode);
      }
      next(err);
    }
  }

  /**
   * GET /api/v1/super-admin/laboratories/:id/provisioning
   */
  static async getProvisioningStatus(req, res, next) {
    try {
      const { id } = req.params;
      const status = await laboratoryManagementService.getProvisioningStatus(id);
      return ApiResponse.success(res, status, 'Provisioning status retrieved');
    } catch (err) {
      if (err instanceof LaboratoryManagementError) {
        return ApiResponse.error(res, err.message, err.statusCode);
      }
      next(err);
    }
  }

  /**
   * POST /api/v1/super-admin/laboratories/:id/provisioning/retry
   */
  static async retryProvisioning(req, res, next) {
    try {
      const { id } = req.params;
      const actor = req.platformAdmin || { type: 'api_key', id: 'system' };
      const result = await laboratoryManagementService.retryProvisioning(id, actor);
      const statusCode = result.success ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;
      return ApiResponse.success(
        res,
        result,
        result.alreadyProvisioned ? 'Database is already provisioned.' : (result.success ? 'Provisioning retry succeeded' : 'Provisioning retry failed'),
        statusCode
      );
    } catch (err) {
      if (err instanceof LaboratoryManagementError) {
        return ApiResponse.error(res, err.message, err.statusCode);
      }
      next(err);
    }
  }

  /**
   * POST /api/v1/super-admin/laboratories/:id/domains/:domain/verify
   */
  static async verifyDomain(req, res, next) {
    try {
      const { id, domain } = req.params;
      const actor = req.platformAdmin || { type: 'api_key', id: 'system' };
      const lab = await laboratoryManagementService.verifyDomain(id, domain, actor);
      return ApiResponse.success(res, lab, `Domain '${domain}' verified successfully`);
    } catch (err) {
      if (err instanceof LaboratoryManagementError) {
        return ApiResponse.error(res, err.message, err.statusCode);
      }
      next(err);
    }
  }

  /**
   * GET /api/v1/super-admin/audit-logs
   */
  static async getAuditLogs(req, res, next) {
    try {
      const { tenantId, limit, page } = req.query;
      const data = await auditLogService.getAuditLogs({
        tenantId: tenantId || null,
        limit: Math.min(100, Math.max(1, parseInt(limit, 10) || 20)),
        page: Math.max(1, parseInt(page, 10) || 1),
      });
      return ApiResponse.success(res, data.items, 'Audit logs retrieved', HTTP_STATUS.OK, {
        pagination: { total: data.total, page: data.page, limit: data.limit },
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/super-admin/roles/matrix
   * Retrieve module actions & navigation items matrix
   */
  static async getPermissionsMatrix(req, res, next) {
    try {
      const matrix = roleService.getPermissionsMatrix();
      return ApiResponse.success(res, matrix, 'Permissions matrix metadata retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/super-admin/roles
   * List all platform master roles
   */
  static async listRoles(req, res, next) {
    try {
      const roles = await roleService.listMasterRoles(req.query);
      return ApiResponse.success(res, roles, 'Platform master roles retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/super-admin/roles/:id
   */
  static async getRole(req, res, next) {
    try {
      const { id } = req.params;
      const role = await roleService.getMasterRoleById(id);
      return ApiResponse.success(res, role, 'Role definition retrieved successfully');
    } catch (err) {
      if (err instanceof RoleServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * POST /api/v1/super-admin/roles
   * Create custom master role and propagate to all laboratories
   */
  static async createRole(req, res, next) {
    try {
      const actor = req.platformAdmin || { id: 'super_admin', sub: 'super_admin' };
      const role = await roleService.createMasterRole(req.body, actor);
      return ApiResponse.success(res, role, 'Role created and synchronized to all laboratories', HTTP_STATUS.CREATED);
    } catch (err) {
      if (err instanceof RoleServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * PUT /api/v1/super-admin/roles/:id
   * Update master role and propagate updates to all laboratories
   */
  static async updateRole(req, res, next) {
    try {
      const { id } = req.params;
      const actor = req.platformAdmin || { id: 'super_admin', sub: 'super_admin' };
      const role = await roleService.updateMasterRole(id, req.body, actor);
      return ApiResponse.success(res, role, 'Role updated and synchronized across all laboratories');
    } catch (err) {
      if (err instanceof RoleServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * PATCH /api/v1/super-admin/roles/:id/status
   * Toggle master role active status across all laboratories
   */
  static async updateRoleStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isActive } = req.body;
      const actor = req.platformAdmin || { id: 'super_admin', sub: 'super_admin' };
      const role = await roleService.updateMasterRoleStatus(id, isActive, actor);
      return ApiResponse.success(res, role, `Role status updated to ${isActive ? 'active' : 'inactive'}`);
    } catch (err) {
      if (err instanceof RoleServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * DELETE /api/v1/super-admin/roles/:id
   * Delete custom master role across platform
   */
  static async deleteRole(req, res, next) {
    try {
      const { id } = req.params;
      const actor = req.platformAdmin || { id: 'super_admin', sub: 'super_admin' };
      const result = await roleService.deleteMasterRole(id, actor);
      return ApiResponse.success(res, result, result.message);
    } catch (err) {
      if (err instanceof RoleServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * POST /api/v1/super-admin/roles/sync
   * Explicitly synchronize all platform master roles to all laboratories
   */
  static async syncRoles(req, res, next) {
    try {
      const result = await roleService.syncMasterRolesToAllTenants();
      return ApiResponse.success(res, result, `Synchronized ${result.totalMasterRoles} roles across ${result.syncedTenants} laboratories`);
    } catch (err) {
      next(err);
    }
  }
}

export default SuperAdminController;
