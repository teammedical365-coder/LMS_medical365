/**
 * Lab Management System (LMS) - Tenant Role & Permission Routes
 * 
 * Mounted under /api/v1/tenants/:tenantId/roles
 */

import { Router } from 'express';
import roleController from '../controllers/role.controller.js';
import { authenticateToken, requirePermission } from '../middleware/auth.middleware.js';

const roleRouter = Router({ mergeParams: true });

// Require authentication for all role endpoints
roleRouter.use(authenticateToken);

// Get permission matrix and options for Role Builder UI
roleRouter.get('/permissions-matrix', roleController.getPermissionsMatrix);

// List roles in laboratory
roleRouter.get('/', requirePermission('roles:view'), roleController.listRoles);

// Create new custom role
roleRouter.post('/', requirePermission('roles:manage'), roleController.createRole);

// Get single role
roleRouter.get('/:roleId', requirePermission('roles:view'), roleController.getRoleById);

// Update role definition
roleRouter.put('/:roleId', requirePermission('roles:manage'), roleController.updateRole);
roleRouter.patch('/:roleId', requirePermission('roles:manage'), roleController.updateRole);

// Deactivate / activate role
roleRouter.patch('/:roleId/status', requirePermission('roles:manage'), roleController.updateRoleStatus);

// Delete custom role
roleRouter.delete('/:roleId', requirePermission('roles:manage'), roleController.deleteRole);

export default roleRouter;
