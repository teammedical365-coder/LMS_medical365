/**
 * Lab Management System (LMS) - Laboratory Tenant User Controller
 * 
 * Handles user management operations strictly within a specific laboratory tenant.
 */

import tenantUserService, { TenantUserError } from '../services/tenantUser.service.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../config/constants.js';

class TenantUserController {
  /**
   * List users in laboratory tenant
   * GET /api/v1/tenants/:tenantId/users
   */
  async listUsers(req, res, next) {
    try {
      const { tenantId } = req.params;
      const users = await tenantUserService.listUsers(tenantId, req.query);
      return ApiResponse.success(res, { users, total: users.length }, 'Laboratory users retrieved successfully');
    } catch (err) {
      if (err instanceof TenantUserError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * Create a new user in laboratory tenant
   * POST /api/v1/tenants/:tenantId/users
   */
  async createUser(req, res, next) {
    try {
      const { tenantId } = req.params;
      const user = await tenantUserService.createUser(tenantId, req.body, req.user);
      return ApiResponse.created(res, user, 'Laboratory user created successfully');
    } catch (err) {
      if (err instanceof TenantUserError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * Get specific user by userId
   * GET /api/v1/tenants/:tenantId/users/:userId
   */
  async getUserById(req, res, next) {
    try {
      const { tenantId, userId } = req.params;
      const user = await tenantUserService.getUserById(tenantId, userId);
      return ApiResponse.success(res, user, 'Laboratory user retrieved successfully');
    } catch (err) {
      if (err instanceof TenantUserError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * Update user status (safe activation / deactivation)
   * PATCH /api/v1/tenants/:tenantId/users/:userId/status
   */
  async updateUserStatus(req, res, next) {
    try {
      const { tenantId, userId } = req.params;
      const { isActive } = req.body;
      const user = await tenantUserService.updateUserStatus(tenantId, userId, isActive, req.user);
      return ApiResponse.success(res, user, `Laboratory user ${isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      if (err instanceof TenantUserError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * Assign role to user
   * PATCH /api/v1/tenants/:tenantId/users/:userId/role
   */
  async assignUserRole(req, res, next) {
    try {
      const { tenantId, userId } = req.params;
      const { role } = req.body;
      const user = await tenantUserService.assignUserRole(tenantId, userId, role, req.user);
      return ApiResponse.success(res, user, 'Role assigned to laboratory user successfully');
    } catch (err) {
      if (err instanceof TenantUserError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }
}

export const tenantUserController = new TenantUserController();
export default tenantUserController;
