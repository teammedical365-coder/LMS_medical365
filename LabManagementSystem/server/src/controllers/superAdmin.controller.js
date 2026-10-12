/**
 * Lab Management System (LMS) - Super Admin Controller
 * 
 * Exposes platform management operations with strict validation,
 * consistent response formats, and safe error handling.
 */

import laboratoryManagementService, { LaboratoryManagementError } from '../services/laboratoryManagement.service.js';
import auditLogService from '../services/auditLog.service.js';
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
}

export default SuperAdminController;
