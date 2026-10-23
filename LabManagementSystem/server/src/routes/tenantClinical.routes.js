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
tenantClinicalRouter.post('/patients/register-with-order', requirePermission('patients:create'), tenantClinicalController.registerPatientWithOrder);

// ---------------------------------------------------------------------------
// LABORATORY ORDERS / REQUISITIONS
// ---------------------------------------------------------------------------
tenantClinicalRouter.get('/orders', requirePermission('orders:view'), tenantClinicalController.listOrders);
tenantClinicalRouter.post('/orders', requirePermission('orders:create'), tenantClinicalController.createOrder);
tenantClinicalRouter.patch('/orders/:orderId/items/:itemId/result', requirePermission('samples:process'), tenantClinicalController.recordOrderItemResult);
tenantClinicalRouter.get('/orders/:orderId/labels', requirePermission('samples:view'), tenantClinicalController.getOrderBarcodeLabels);

// ---------------------------------------------------------------------------
// SPECIMEN & SAMPLE TRACKING & RECOLLECTION
// ---------------------------------------------------------------------------
tenantClinicalRouter.get('/samples', requirePermission(['samples:view', 'orders:view']), tenantClinicalController.listSamples);
tenantClinicalRouter.get('/samples/:sampleId', requirePermission(['samples:view', 'orders:view']), tenantClinicalController.getSample);
tenantClinicalRouter.get('/samples/recollections', requirePermission(['samples:view', 'orders:view']), tenantClinicalController.listRecollectionTasks);
tenantClinicalRouter.post('/samples/recollections/:taskId/recollect', requirePermission(['samples:collect', 'samples:process']), tenantClinicalController.resolveRecollectionTask);
tenantClinicalRouter.get('/samples/:sampleId/label', requirePermission('samples:view'), tenantClinicalController.getSampleBarcodeLabel);
tenantClinicalRouter.patch('/samples/:sampleId/status', requirePermission(['samples:collect', 'samples:receive', 'samples:process']), tenantClinicalController.updateSampleStatus);
tenantClinicalRouter.put('/samples/:sampleId/status', requirePermission(['samples:collect', 'samples:receive', 'samples:process']), tenantClinicalController.updateSampleStatus);
tenantClinicalRouter.patch('/samples/status', requirePermission(['samples:collect', 'samples:receive', 'samples:process']), tenantClinicalController.updateSampleStatus);
tenantClinicalRouter.put('/samples/status', requirePermission(['samples:collect', 'samples:receive', 'samples:process']), tenantClinicalController.updateSampleStatus);
tenantClinicalRouter.patch('/samples/:sampleId', requirePermission(['samples:collect', 'samples:receive', 'samples:process']), tenantClinicalController.updateSampleStatus);
tenantClinicalRouter.put('/samples/:sampleId', requirePermission(['samples:collect', 'samples:receive', 'samples:process']), tenantClinicalController.updateSampleStatus);
tenantClinicalRouter.post('/samples/:sampleId/results', requirePermission('samples:process'), tenantClinicalController.recordSampleResults);

// ---------------------------------------------------------------------------
// TEST CATALOG
// ---------------------------------------------------------------------------
tenantClinicalRouter.get('/tests', requirePermission(['tests:view', 'orders:create']), tenantClinicalController.listTestCatalog);
tenantClinicalRouter.get('/tests/:testId', requirePermission(['tests:view', 'orders:create']), tenantClinicalController.getTest);
tenantClinicalRouter.post('/tests', requirePermission('tests:manage'), tenantClinicalController.createTest);
tenantClinicalRouter.patch('/tests/:testId', requirePermission('tests:manage'), tenantClinicalController.updateTest);

tenantClinicalRouter.get('/departments', requirePermission(['tests:view', 'orders:create']), tenantClinicalController.listDepartments);
tenantClinicalRouter.get('/test-categories', requirePermission(['tests:view', 'orders:create']), tenantClinicalController.listTestCategories);
tenantClinicalRouter.post('/test-categories', requirePermission('tests:manage'), tenantClinicalController.createTestCategory);
tenantClinicalRouter.put('/test-categories/:categoryId', requirePermission('tests:manage'), tenantClinicalController.updateTestCategory);
tenantClinicalRouter.patch('/test-categories/:categoryId', requirePermission('tests:manage'), tenantClinicalController.updateTestCategory);
tenantClinicalRouter.delete('/test-categories/:categoryId', requirePermission('tests:manage'), tenantClinicalController.deleteTestCategory);

// ---------------------------------------------------------------------------
// DIAGNOSTIC REPORTS & VERIFICATION WORKFLOW
// ---------------------------------------------------------------------------
tenantClinicalRouter.get('/reports', requirePermission(['reports:view', 'orders:view']), tenantClinicalController.listReports);
tenantClinicalRouter.post('/reports', requirePermission('reports:create'), tenantClinicalController.createReport);
tenantClinicalRouter.post('/reports/batch-release', requirePermission('reports:release'), tenantClinicalController.batchReleaseReports);
tenantClinicalRouter.post('/reports/batch-download', requirePermission('reports:view'), tenantClinicalController.batchDownloadReports);
tenantClinicalRouter.post('/reports/:reportId/approve', requirePermission('reports:verify'), tenantClinicalController.approveReport);
tenantClinicalRouter.post('/reports/:reportId/reject', requirePermission('reports:verify'), tenantClinicalController.rejectReport);
tenantClinicalRouter.patch('/reports/:reportId', requirePermission(['reports:create', 'samples:process', 'reports:verify']), tenantClinicalController.updateReport);
tenantClinicalRouter.put('/reports/:reportId', requirePermission(['reports:create', 'samples:process', 'reports:verify']), tenantClinicalController.updateReport);
tenantClinicalRouter.post('/reports/:reportId/release', requirePermission('reports:release'), tenantClinicalController.releaseReport);
tenantClinicalRouter.get('/reports/:reportId/download', requirePermission('reports:view'), tenantClinicalController.downloadReport);

// ---------------------------------------------------------------------------
// BILLING, INVOICING & PAYMENTS
// ---------------------------------------------------------------------------
tenantClinicalRouter.get('/billing/invoices', requirePermission(['billing:view', 'orders:view']), tenantClinicalController.listInvoices);
tenantClinicalRouter.post('/billing/invoices/:invoiceId/payments', requirePermission('billing:manage'), tenantClinicalController.recordPayment);
tenantClinicalRouter.get('/billing/summary', requirePermission('billing:view'), tenantClinicalController.getBillingSummary);

// ---------------------------------------------------------------------------
// ROLE-SPECIFIC DASHBOARD SUMMARY & TODAY'S ORDER SUMMARY
// ---------------------------------------------------------------------------
tenantClinicalRouter.get('/dashboard-summary', tenantClinicalController.getDashboardSummary);
tenantClinicalRouter.get('/dashboard/today-summary', requirePermission('orders:view'), tenantClinicalController.getTodaySummary);
tenantClinicalRouter.get('/orders/today-summary', requirePermission('orders:view'), tenantClinicalController.getTodaySummary);
tenantClinicalRouter.get('/dashboard/today-tat', requirePermission('orders:view'), tenantClinicalController.getTodayTatSummary);
tenantClinicalRouter.get('/reports/today-tat', requirePermission('reports:view'), tenantClinicalController.getTodayTatSummary);

// ---------------------------------------------------------------------------
// LABORATORY SETTINGS & WHITE-LABEL BRANDING
// ---------------------------------------------------------------------------
tenantClinicalRouter.get('/settings', requirePermission('settings:view'), tenantClinicalController.getTenantSettings);
tenantClinicalRouter.patch('/settings', requirePermission('settings:manage'), tenantClinicalController.updateTenantSettings);
tenantClinicalRouter.patch('/settings/branding', requirePermission('settings:manage'), tenantClinicalController.updateTenantBranding);

// ---------------------------------------------------------------------------
// AUDIT LOGS & COMPLIANCE TRAIL
// ---------------------------------------------------------------------------
tenantClinicalRouter.get('/audit-logs/actions', requirePermission('audit:view'), tenantClinicalController.getTenantAuditActions);
tenantClinicalRouter.get('/audit-logs', requirePermission('audit:view'), tenantClinicalController.getTenantAuditLogs);

export default tenantClinicalRouter;
