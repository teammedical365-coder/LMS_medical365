/**
 * Lab Management System (LMS) - Tenant Clinical & Operational Routes
 * 
 * Mounted under /api/v1/tenants/:tenantId
 * 
 * SECURITY RULES:
 * 1. Requires valid authentication token.
 * 2. Requires tenant-scoped user credentials (requireTenantUser).
 * 3. Rejects Platform Super Admin from unrestricted clinical access.
 * 4. Rejects cross-tenant access.
 * 5. Enforces granular module action permissions.
 */

import { Router } from 'express';
import tenantClinicalController from '../controllers/tenantClinical.controller.js';
import { authenticateToken, requireTenantUser, requirePermission } from '../middleware/auth.middleware.js';

const tenantClinicalRouter = Router({ mergeParams: true });

// Strict tenant-boundary middleware pipeline
tenantClinicalRouter.use(authenticateToken);
tenantClinicalRouter.use(requireTenantUser);

// ---------------------------------------------------------------------------
// PATIENTS & ACCESSIONING
// ---------------------------------------------------------------------------
tenantClinicalRouter.get('/patients', requirePermission('patients:view'), tenantClinicalController.listPatients);
tenantClinicalRouter.post('/patients', requirePermission('patients:create'), tenantClinicalController.createPatient);

// ---------------------------------------------------------------------------
// LABORATORY ORDERS / REQUISITIONS
// ---------------------------------------------------------------------------
tenantClinicalRouter.get('/orders', requirePermission('orders:view'), tenantClinicalController.listOrders);
tenantClinicalRouter.post('/orders', requirePermission('orders:create'), tenantClinicalController.createOrder);
tenantClinicalRouter.patch('/orders/:orderId/items/:itemId/result', requirePermission('samples:process'), tenantClinicalController.recordOrderItemResult);

// ---------------------------------------------------------------------------
// SPECIMEN & SAMPLE TRACKING
// ---------------------------------------------------------------------------
tenantClinicalRouter.get('/samples', requirePermission('samples:view'), tenantClinicalController.listSamples);
tenantClinicalRouter.patch('/samples/:sampleId/status', requirePermission('samples:process'), tenantClinicalController.updateSampleStatus);

// ---------------------------------------------------------------------------
// TEST CATALOG
// ---------------------------------------------------------------------------
tenantClinicalRouter.get('/tests', requirePermission('tests:view'), tenantClinicalController.listTestCatalog);
tenantClinicalRouter.post('/tests', requirePermission('tests:manage'), tenantClinicalController.createTest);

// ---------------------------------------------------------------------------
// DIAGNOSTIC REPORTS & VERIFICATION WORKFLOW
// ---------------------------------------------------------------------------
tenantClinicalRouter.get('/reports', requirePermission('reports:view'), tenantClinicalController.listReports);
tenantClinicalRouter.post('/reports', requirePermission('reports:create'), tenantClinicalController.createReport);
tenantClinicalRouter.post('/reports/:reportId/approve', requirePermission('reports:verify'), tenantClinicalController.approveReport);
tenantClinicalRouter.post('/reports/:reportId/reject', requirePermission('reports:verify'), tenantClinicalController.rejectReport);
tenantClinicalRouter.post('/reports/:reportId/release', requirePermission('reports:release'), tenantClinicalController.releaseReport);

// ---------------------------------------------------------------------------
// BILLING, INVOICING & PAYMENTS
// ---------------------------------------------------------------------------
tenantClinicalRouter.get('/billing/invoices', requirePermission('billing:view'), tenantClinicalController.listInvoices);
tenantClinicalRouter.post('/billing/invoices/:invoiceId/payments', requirePermission('billing:manage'), tenantClinicalController.recordPayment);
tenantClinicalRouter.get('/billing/summary', requirePermission('billing:view'), tenantClinicalController.getBillingSummary);

// ---------------------------------------------------------------------------
// ROLE-SPECIFIC DASHBOARD SUMMARY
// ---------------------------------------------------------------------------
tenantClinicalRouter.get('/dashboard-summary', tenantClinicalController.getDashboardSummary);

// ---------------------------------------------------------------------------
// LABORATORY SETTINGS & WHITE-LABEL BRANDING
// ---------------------------------------------------------------------------
tenantClinicalRouter.get('/settings', requirePermission('settings:view'), tenantClinicalController.getTenantSettings);
tenantClinicalRouter.patch('/settings/branding', requirePermission('settings:manage'), tenantClinicalController.updateTenantBranding);

export default tenantClinicalRouter;
