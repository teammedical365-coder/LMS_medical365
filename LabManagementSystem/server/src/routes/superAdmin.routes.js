/**
 * Lab Management System (LMS) - Super Admin Platform Routes
 * 
 * All routes in this router require valid Super Admin authorization.
 */

import { Router } from 'express';
import SuperAdminController from '../controllers/superAdmin.controller.js';
import superAdminAuthMiddleware from '../middleware/superAdminAuth.middleware.js';

const router = Router();

// Apply Super Admin Authorization Guard to ALL routes in this router
router.use(superAdminAuthMiddleware);

// Platform Overview Metrics & Activity
router.get('/overview', SuperAdminController.getOverview);

// Laboratory Registry Management
router.get('/laboratories', SuperAdminController.listLaboratories);
router.post('/laboratories', SuperAdminController.registerLaboratory);
router.get('/laboratories/:id', SuperAdminController.getLaboratory);
router.get('/laboratories/:id/staff', SuperAdminController.getLaboratoryStaff);
router.patch('/laboratories/:id', SuperAdminController.updateLaboratory);

// Lifecycle Transitions
router.post('/laboratories/:id/status', SuperAdminController.transitionStatus);

// Database Provisioning Controls
router.get('/laboratories/:id/provisioning', SuperAdminController.getProvisioningStatus);
router.post('/laboratories/:id/provisioning/retry', SuperAdminController.retryProvisioning);

// Domain Verification
router.post('/laboratories/:id/domains/:domain/verify', SuperAdminController.verifyDomain);

// Platform Audit Logs
router.get('/audit-logs', SuperAdminController.getAuditLogs);

export default router;
