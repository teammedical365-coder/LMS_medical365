/**
 * Lab Management System (LMS) - Tenant User Routes
 * 
 * Mounted under /api/v1/tenants/:tenantId/users
 */

import { Router } from 'express';
import tenantUserController from '../controllers/tenantUser.controller.js';
import { authenticateToken, requirePermission } from '../middleware/auth.middleware.js';

const tenantUserRouter = Router({ mergeParams: true });

// Protect all tenant user management routes
tenantUserRouter.use(authenticateToken);

// List users within this tenant
tenantUserRouter.get('/', requirePermission('users:view'), tenantUserController.listUsers);

// Create a new user in this tenant
tenantUserRouter.post('/', requirePermission('users:manage'), tenantUserController.createUser);

// Get specific user by ID
tenantUserRouter.get('/:userId', requirePermission('users:view'), tenantUserController.getUserById);

// Update user active status (safe deactivation)
tenantUserRouter.patch('/:userId/status', requirePermission('users:manage'), tenantUserController.updateUserStatus);

// Assign role to user
tenantUserRouter.patch('/:userId/role', requirePermission('users:manage'), tenantUserController.assignUserRole);

// Safely soft-delete a staff member from this tenant
tenantUserRouter.delete('/:userId', requirePermission('users:manage'), tenantUserController.deleteUser);

export default tenantUserRouter;
