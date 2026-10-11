/**
 * Lab Management System (LMS) - Tenant Clinical Service
 * 
 * Provides unified API client methods for all tenant clinical modules:
 * - Patients Accessioning
 * - Requisition Orders
 * - Specimen Sample Tracking
 * - Test Catalog Management
 * - Diagnostic Pathology Reports
 * - Billing Ledger & Invoices
 * - Dashboard Analytics
 */

import api from './api';

export const clinicalService = {
  // Patients
  getPatients: (tenantId, params = {}) =>
    api.get(`/tenants/${tenantId}/patients`, { params }).then((res) => res.data),

  createPatient: (tenantId, data) =>
    api.post(`/tenants/${tenantId}/patients`, data).then((res) => res.data),

  // Orders
  getOrders: (tenantId, params = {}) =>
    api.get(`/tenants/${tenantId}/orders`, { params }).then((res) => res.data),

  createOrder: (tenantId, data) =>
    api.post(`/tenants/${tenantId}/orders`, data).then((res) => res.data),

  recordOrderItemResult: (tenantId, orderId, itemId, data) =>
    api.patch(`/tenants/${tenantId}/orders/${orderId}/items/${itemId}/result`, data).then((res) => res.data),

  // Samples & Specimen Tracking
  getSamples: (tenantId, params = {}) =>
    api.get(`/tenants/${tenantId}/samples`, { params }).then((res) => res.data),

  updateSampleStatus: (tenantId, sampleId, updates) =>
    api.patch(`/tenants/${tenantId}/samples/${sampleId}/status`, updates).then((res) => res.data),

  getSampleLabel: (tenantId, sampleId) =>
    api.get(`/tenants/${tenantId}/samples/${sampleId}/label`).then((res) => res.data),

  getOrderLabels: (tenantId, orderId) =>
    api.get(`/tenants/${tenantId}/orders/${orderId}/labels`).then((res) => res.data),

  getRecollectionTasks: (tenantId, params = {}) =>
    api.get(`/tenants/${tenantId}/samples/recollections`, { params }).then((res) => res.data),

  resolveRecollectionTask: (tenantId, taskId, data = {}) =>
    api.post(`/tenants/${tenantId}/samples/recollections/${taskId}/recollect`, data).then((res) => res.data),

  // Test Catalog
  getTestCatalog: (tenantId, params = {}) =>
    api.get(`/tenants/${tenantId}/tests`, { params }).then((res) => res.data),

  getTest: (tenantId, testId) =>
    api.get(`/tenants/${tenantId}/tests/${testId}`).then((res) => res.data),

  createTest: (tenantId, data) =>
    api.post(`/tenants/${tenantId}/tests`, data).then((res) => res.data),

  updateTest: (tenantId, testId, data) =>
    api.patch(`/tenants/${tenantId}/tests/${testId}`, data).then((res) => res.data),

  // Reports
  getReports: (tenantId, params = {}) =>
    api.get(`/tenants/${tenantId}/reports`, { params }).then((res) => res.data),

  createReport: (tenantId, data) =>
    api.post(`/tenants/${tenantId}/reports`, data).then((res) => res.data),

  approveReport: (tenantId, reportId, data = {}) =>
    api.post(`/tenants/${tenantId}/reports/${reportId}/approve`, data).then((res) => res.data),

  releaseReport: (tenantId, reportId) =>
    api.post(`/tenants/${tenantId}/reports/${reportId}/release`).then((res) => res.data),

  batchReleaseReports: (tenantId, reportIds) =>
    api.post(`/tenants/${tenantId}/reports/batch-release`, { reportIds }).then((res) => res.data),

  downloadReport: (tenantId, reportId) =>
    api.get(`/tenants/${tenantId}/reports/${reportId}/download`).then((res) => res.data),

  batchDownloadReports: (tenantId, reportIds) =>
    api.post(`/tenants/${tenantId}/reports/batch-download`, { reportIds }).then((res) => res.data),

  // Billing
  getInvoices: (tenantId, params = {}) =>
    api.get(`/tenants/${tenantId}/billing/invoices`, { params }).then((res) => res.data),

  recordPayment: (tenantId, invoiceId, data) =>
    api.post(`/tenants/${tenantId}/billing/invoices/${invoiceId}/payments`, data).then((res) => res.data),

  getBillingSummary: (tenantId) =>
    api.get(`/tenants/${tenantId}/billing/summary`).then((res) => res.data),

  // Dashboard Metrics
  getDashboardSummary: (tenantId, params = {}) =>
    api.get(`/tenants/${tenantId}/dashboard-summary`, { params }).then((res) => res.data),

  getTodaySummary: (tenantId, params = {}) =>
    api.get(`/tenants/${tenantId}/dashboard/today-summary`, { params }).then((res) => res.data),

  getTodayTat: (tenantId, params = {}) =>
    api.get(`/tenants/${tenantId}/dashboard/today-tat`, { params }).then((res) => res.data),

  // Public Report Verification
  verifyPublicReport: (token) =>
    api.get(`/public/verify-report/${token}`).then((res) => res.data),

  // Audit Logs & Compliance Trail
  getAuditLogs: (tenantId, params = {}) =>
    api.get(`/tenants/${tenantId}/audit-logs`, { params }).then((res) => res.data),

  getAuditActions: (tenantId) =>
    api.get(`/tenants/${tenantId}/audit-logs/actions`).then((res) => res.data),
};

export default clinicalService;
