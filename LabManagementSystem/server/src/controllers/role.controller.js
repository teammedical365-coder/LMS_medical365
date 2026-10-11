/**
 * Lab Management System (LMS) - Tenant Role Controller
 * 
 * Handles CRUD operations on custom laboratory roles and permissions.
 */

import roleService, { RoleServiceError } from '../services/role.service.js';
import { TenantConnectionError } from '../services/tenantConnection.service.js';
import ApiResponse from '../utils/apiResponse.js';

class RoleController {
  /**
   * Get dynamic permission matrix and available navigation options
   * GET /api/v1/tenants/:tenantId/roles/permissions-matrix
   */
  async getPermissionsMatrix(req, res, next) {
    try {
      const matrix = roleService.getPermissionsMatrix();
      return ApiResponse.success(res, matrix, 'Permission matrix retrieved successfully');
    } catch (err) {
      if (err instanceof RoleServiceError || err instanceof TenantConnectionError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * List all roles in this laboratory
   * GET /api/v1/tenants/:tenantId/roles
   */
  async listRoles(req, res, next) {
    try {
      const { tenantId } = req.params;
      const roles = await roleService.listRoles(tenantId, req.query);
      return ApiResponse.success(res, { roles, total: roles.length }, 'Roles retrieved successfully');
    } catch (err) {
      if (err instanceof RoleServiceError || err instanceof TenantConnectionError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * Get role details by roleId or code
   * GET /api/v1/tenants/:tenantId/roles/:roleId
   */
  async getRoleById(req, res, next) {
    try {
      const { tenantId, roleId } = req.params;
      const role = await roleService.getRoleById(tenantId, roleId);
      return ApiResponse.success(res, role, 'Role retrieved successfully');
    } catch (err) {
      if (err instanceof RoleServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * Create a new custom role
   * POST /api/v1/tenants/:tenantId/roles
   */
  async createRole(req, res, next) {
    try {
      const { tenantId } = req.params;
      const role = await roleService.createRole(tenantId, req.body, req.user);
      return ApiResponse.created(res, role, 'Custom role created successfully');
    } catch (err) {
      if (err instanceof RoleServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * Update role details and permissions
   * PUT /api/v1/tenants/:tenantId/roles/:roleId
   */
  async updateRole(req, res, next) {
    try {
      const { tenantId, roleId } = req.params;
      const role = await roleService.updateRole(tenantId, roleId, req.body, req.user);
      return ApiResponse.success(res, role, 'Role updated successfully');
    } catch (err) {
      if (err instanceof RoleServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * Update role active status
   * PATCH /api/v1/tenants/:tenantId/roles/:roleId/status
   */
  async updateRoleStatus(req, res, next) {
    try {
      const { tenantId, roleId } = req.params;
      const { isActive } = req.body;
      const role = await roleService.updateRoleStatus(tenantId, roleId, isActive, req.user);
      return ApiResponse.success(res, role, `Role ${isActive ? 'activated' : 'deactivated'} successfully`);
    } catch (err) {
      if (err instanceof RoleServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }
}

export const roleController = new RoleController();
export default roleController;
