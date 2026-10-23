/**
 * Lab Management System (LMS) - Tenant Clinical & Operational Controller
 * 
 * Exposes patient accessioning, requisition orders, specimen processing,
 * diagnostic pathology reports, and billing ledger endpoints with granular
 * role permission checking and strict multi-tenant boundary validation.
 */

import tenantClinicalService, { ClinicalServiceError } from '../services/tenantClinical.service.js';
import laboratoryManagementService from '../services/laboratoryManagement.service.js';
import auditLogService from '../services/auditLog.service.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../config/constants.js';

export class TenantClinicalController {
  // -------------------------------------------------------------------------
  // PATIENTS
  // -------------------------------------------------------------------------
  static async listPatients(req, res, next) {
    try {
      const { tenantId } = req.params;
      const data = await tenantClinicalService.listPatients(tenantId, req.query);
      return ApiResponse.success(res, data, 'Patients retrieved successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async createPatient(req, res, next) {
    try {
      const { tenantId } = req.params;
      const patient = await tenantClinicalService.createPatient(tenantId, req.body, req.user);
      return ApiResponse.success(res, patient, 'Patient registered successfully', HTTP_STATUS.CREATED);
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async registerPatientWithOrder(req, res, next) {
    try {
      const { tenantId } = req.params;
      const result = await tenantClinicalService.registerPatientWithOrder(tenantId, req.body, req.user);
      return ApiResponse.success(res, result, 'Patient registered and order processed successfully', HTTP_STATUS.CREATED);
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // LAB ORDERS
  // -------------------------------------------------------------------------
  static async listOrders(req, res, next) {
    try {
      const { tenantId } = req.params;
      const data = await tenantClinicalService.listOrders(tenantId, req.query);
      return ApiResponse.success(res, data, 'Lab orders retrieved successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async createOrder(req, res, next) {
    try {
      const { tenantId } = req.params;
      const order = await tenantClinicalService.createOrder(tenantId, req.body, req.user);
      return ApiResponse.success(res, order, 'Laboratory order created successfully', HTTP_STATUS.CREATED);
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async recordOrderItemResult(req, res, next) {
    try {
      const { tenantId, orderId, itemId } = req.params;
      const order = await tenantClinicalService.recordOrderItemResult(tenantId, orderId, itemId, req.body, req.user);
      return ApiResponse.success(res, order, 'Test result recorded successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // SAMPLES / SPECIMENS
  // -------------------------------------------------------------------------
  static async listSamples(req, res, next) {
    try {
      const { tenantId } = req.params;
      const data = await tenantClinicalService.listSamples(tenantId, req.query);
      return ApiResponse.success(res, data, 'Samples retrieved successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async getSample(req, res, next) {
    try {
      const { tenantId, sampleId } = req.params;
      const sample = await tenantClinicalService.getSampleById(tenantId, sampleId);
      return ApiResponse.success(res, sample, 'Sample retrieved successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async updateSampleStatus(req, res, next) {
    try {
      const { tenantId } = req.params;
      const sampleId = req.params.sampleId || req.body?.sampleId || req.query?.sampleId;
      const sample = await tenantClinicalService.updateSampleStatus(tenantId, sampleId, req.body, req.user);
      return ApiResponse.success(res, sample, 'Sample status updated successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async recordSampleResults(req, res, next) {
    try {
      const { tenantId, sampleId } = req.params;
      const result = await tenantClinicalService.recordSampleResults(tenantId, sampleId, req.body, req.user);
      return ApiResponse.success(res, result, 'Sample test results recorded and pushed to verification queue');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async getSampleBarcodeLabel(req, res, next) {
    try {
      const { tenantId, sampleId } = req.params;
      const label = await tenantClinicalService.getSampleBarcodeLabel(tenantId, sampleId);
      return ApiResponse.success(res, label, 'Sample barcode label generated successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async getOrderBarcodeLabels(req, res, next) {
    try {
      const { tenantId, orderId } = req.params;
      const labels = await tenantClinicalService.getOrderBarcodeLabels(tenantId, orderId);
      return ApiResponse.success(res, labels, 'Order barcode labels generated successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async listRecollectionTasks(req, res, next) {
    try {
      const { tenantId } = req.params;
      const data = await tenantClinicalService.listRecollectionTasks(tenantId, req.query);
      return ApiResponse.success(res, data, 'Recollection tasks retrieved successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async resolveRecollectionTask(req, res, next) {
    try {
      const { tenantId, taskId } = req.params;
      const result = await tenantClinicalService.resolveRecollectionTask(tenantId, taskId, req.body, req.user);
      return ApiResponse.success(res, result, 'Specimen recollection processed successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // TEST CATALOG
  // -------------------------------------------------------------------------
  static async listTestCatalog(req, res, next) {
    try {
      const { tenantId } = req.params;
      const tests = await tenantClinicalService.listTestCatalog(tenantId, req.query);
      return ApiResponse.success(res, tests, 'Test catalog retrieved successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async createTest(req, res, next) {
    try {
      const { tenantId } = req.params;
      const test = await tenantClinicalService.createTest(tenantId, req.body, req.user);
      return ApiResponse.success(res, test, 'Test added to catalog successfully', HTTP_STATUS.CREATED);
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async getTest(req, res, next) {
    try {
      const { tenantId, testId } = req.params;
      const test = await tenantClinicalService.getTest(tenantId, testId);
      return ApiResponse.success(res, test, 'Test retrieved successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async updateTest(req, res, next) {
    try {
      const { tenantId, testId } = req.params;
      const test = await tenantClinicalService.updateTest(tenantId, testId, req.body, req.user);
      return ApiResponse.success(res, test, 'Test updated successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // DIAGNOSTIC DEPARTMENTS
  // -------------------------------------------------------------------------
  static async listDepartments(req, res, next) {
    try {
      const { tenantId } = req.params;
      const departments = await tenantClinicalService.listDepartments(tenantId);
      return ApiResponse.success(res, departments, 'Diagnostic departments retrieved successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // TEST CATEGORIES
  // -------------------------------------------------------------------------
  static async listTestCategories(req, res, next) {
    try {
      const { tenantId } = req.params;
      const categories = await tenantClinicalService.listTestCategories(tenantId, req.query);
      return ApiResponse.success(res, categories, 'Test categories retrieved successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async createTestCategory(req, res, next) {
    try {
      const { tenantId } = req.params;
      const category = await tenantClinicalService.createTestCategory(tenantId, req.body, req.user);
      return ApiResponse.success(res, category, 'Test category created successfully', HTTP_STATUS.CREATED);
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async updateTestCategory(req, res, next) {
    try {
      const { tenantId, categoryId } = req.params;
      const category = await tenantClinicalService.updateTestCategory(tenantId, categoryId, req.body, req.user);
      return ApiResponse.success(res, category, 'Test category updated successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async deleteTestCategory(req, res, next) {
    try {
      const { tenantId, categoryId } = req.params;
      const result = await tenantClinicalService.deleteTestCategory(tenantId, categoryId, req.user);
      return ApiResponse.success(res, result, 'Test category deleted successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // DIAGNOSTIC REPORTS
  // -------------------------------------------------------------------------
  static async listReports(req, res, next) {
    try {
      const { tenantId } = req.params;
      const reports = await tenantClinicalService.listReports(tenantId, req.query);
      return ApiResponse.success(res, reports, 'Reports retrieved successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async createReport(req, res, next) {
    try {
      const { tenantId } = req.params;
      const report = await tenantClinicalService.createReport(tenantId, req.body, req.user);
      return ApiResponse.success(res, report, 'Diagnostic report drafted successfully', HTTP_STATUS.CREATED);
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async approveReport(req, res, next) {
    try {
      const { tenantId, reportId } = req.params;
      const report = await tenantClinicalService.approveReport(tenantId, reportId, req.user, req.body);
      return ApiResponse.success(res, report, 'Report verified and approved by pathologist');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async rejectReport(req, res, next) {
    try {
      const { tenantId, reportId } = req.params;
      const { reason } = req.body || {};
      const report = await tenantClinicalService.rejectReport(tenantId, reportId, reason, req.user);
      return ApiResponse.success(res, report, 'Report rejected and returned for revision');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async updateReport(req, res, next) {
    try {
      const { tenantId, reportId } = req.params;
      const report = await tenantClinicalService.updateReport(tenantId, reportId, req.body, req.user);
      return ApiResponse.success(res, report, 'Report updated and re-submitted to Pathologist review queue');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async releaseReport(req, res, next) {
    try {
      const { tenantId, reportId } = req.params;
      const report = await tenantClinicalService.releaseReport(tenantId, reportId, req.user);
      return ApiResponse.success(res, report, 'Diagnostic report verified and released');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async batchReleaseReports(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { reportIds } = req.body;
      if (!Array.isArray(reportIds) || reportIds.length === 0) {
        return ApiResponse.error(res, 'reportIds must be a non-empty array of report identifiers', 400, 'VALIDATION_ERROR');
      }
      const summary = await tenantClinicalService.batchReleaseReports(tenantId, reportIds, req.user);
      return ApiResponse.success(res, summary, `Batch report release completed: ${summary.releasedCount} released, ${summary.failedCount} failed`);
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async downloadReport(req, res, next) {
    try {
      const { tenantId, reportId } = req.params;
      const result = await tenantClinicalService.getReportForDownload(tenantId, reportId, req.user);
      res.setHeader('Content-Disposition', `attachment; filename="${result.safeFilename}"`);
      return ApiResponse.success(res, result, 'Official report ready for download');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async batchDownloadReports(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { reportIds } = req.body;
      if (!Array.isArray(reportIds) || reportIds.length === 0) {
        return ApiResponse.error(res, 'reportIds must be a non-empty array of report identifiers', 400, 'VALIDATION_ERROR');
      }
      const summary = await tenantClinicalService.batchDownloadReports(tenantId, reportIds, req.user);
      return ApiResponse.success(res, summary, `Batch report download authorization completed: ${summary.downloadedCount} eligible, ${summary.failedCount} failed`);
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // BILLING & INVOICES
  // -------------------------------------------------------------------------
  static async listInvoices(req, res, next) {
    try {
      const { tenantId } = req.params;
      const invoices = await tenantClinicalService.listInvoices(tenantId, req.query);
      return ApiResponse.success(res, invoices, 'Invoices retrieved successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async recordPayment(req, res, next) {
    try {
      const { tenantId, invoiceId } = req.params;
      const invoice = await tenantClinicalService.recordPayment(tenantId, invoiceId, req.body, req.user);
      return ApiResponse.success(res, invoice, 'Payment recorded successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async getBillingSummary(req, res, next) {
    try {
      const { tenantId } = req.params;
      const summary = await tenantClinicalService.getBillingSummary(tenantId);
      return ApiResponse.success(res, summary, 'Billing summary retrieved successfully');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // DASHBOARD SUMMARY (Role-Specific & Today's Orders Summary)
  // -------------------------------------------------------------------------
  static async getDashboardSummary(req, res, next) {
    try {
      const { tenantId } = req.params;
      const userRole = req.user?.role || 'lab_admin';
      const timeZone = req.query.timezone || req.headers['x-timezone'];
      const summary = await tenantClinicalService.getDashboardSummary(tenantId, userRole, { timeZone });
      return ApiResponse.success(res, summary, 'Laboratory dashboard metrics retrieved');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async getTodaySummary(req, res, next) {
    try {
      const { tenantId } = req.params;
      const timeZone = req.query.timezone || req.headers['x-timezone'];
      const summary = await tenantClinicalService.getTodayOrderSummary(tenantId, { timeZone });
      return ApiResponse.success(res, summary, "Today's lab orders summary retrieved");
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  static async getTodayTatSummary(req, res, next) {
    try {
      const { tenantId } = req.params;
      const timeZone = req.query.timezone || req.headers['x-timezone'];
      const summary = await tenantClinicalService.getTodayOrderSummary(tenantId, { timeZone });
      return ApiResponse.success(res, {
        averageTatMinutes: summary.averageTatMinutes,
        formattedTat: summary.formattedTat,
        eligibleReportsCount: summary.tatReportCount,
        date: summary.date,
        timeZone: summary.timeZone,
      }, "Today's report turnaround time (TAT) summary retrieved");
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // LABORATORY SETTINGS & WHITE-LABEL BRANDING
  // -------------------------------------------------------------------------
  static async getTenantSettings(req, res, next) {
    try {
      const { tenantId } = req.params;
      const lab = await laboratoryManagementService.getLaboratoryById(tenantId);
      return ApiResponse.success(res, {
        tenantId: lab.tenantId,
        code: lab.code,
        name: lab.name,
        legalName: lab.legalName,
        email: lab.email,
        phone: lab.phone,
        address: lab.address,
        timezone: lab.timezone,
        locale: lab.locale,
        status: lab.status,
        plan: lab.plan,
        branding: lab.branding,
        domains: lab.domains,
      }, 'Laboratory settings retrieved');
    } catch (err) {
      next(err);
    }
  }

  static async updateTenantSettings(req, res, next) {
    try {
      const { tenantId } = req.params;
      const updated = await laboratoryManagementService.updateLaboratory(tenantId, req.body, req.user);
      return ApiResponse.success(res, updated, 'Laboratory settings updated successfully');
    } catch (err) {
      next(err);
    }
  }

  static async updateTenantBranding(req, res, next) {
    try {
      const { tenantId } = req.params;
      const updated = await laboratoryManagementService.updateLaboratory(tenantId, { branding: req.body }, req.user);
      return ApiResponse.success(res, updated.branding, 'Laboratory white-label branding updated successfully');
    } catch (err) {
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // PUBLIC UN-AUTHENTICATED BRANDING RESOLUTION
  // -------------------------------------------------------------------------
  static async resolvePublicBranding(req, res, next) {
    try {
      const domainOrCode = req.query.domain || req.query.code || req.get('host') || req.hostname;
      const branding = await laboratoryManagementService.resolvePublicBranding(domainOrCode);
      if (!branding) {
        return ApiResponse.success(res, {
          tenantId: null,
          name: 'Medical365 Laboratory Platform',
          displayName: 'Medical365 LMS',
          branding: {
            displayName: 'Medical365 LMS',
            primaryColor: '#2563EB',
            accentColor: '#22C1DC',
            logoUrl: null,
            faviconUrl: null,
            loginBannerText: 'Welcome to Laboratory Management System',
          },
          status: 'ACTIVE',
        }, 'Default platform branding resolved');
      }
      return ApiResponse.success(res, branding, 'Laboratory branding resolved successfully');
    } catch (err) {
      next(err);
    }
  }
  // -------------------------------------------------------------------------
  // PUBLIC UN-AUTHENTICATED REPORT VERIFICATION
  // -------------------------------------------------------------------------
  static async verifyPublicReport(req, res, next) {
    try {
      const { token } = req.params;
      if (!token) {
        return ApiResponse.error(res, 'Verification token is required', 400);
      }
      const data = await tenantClinicalService.verifyPublicReport(token);
      return ApiResponse.success(res, data, 'Report authenticity verified');
    } catch (err) {
      if (err instanceof ClinicalServiceError) {
        if (err.statusCode === 404) {
          return res.status(404).json({
            success: false,
            message: err.message,
            data: { valid: false },
          });
        }
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  // -------------------------------------------------------------------------
  // AUDIT LOGS (Compliance & Security)
  // -------------------------------------------------------------------------
  static async getTenantAuditLogs(req, res, next) {
    try {
      const { tenantId } = req.params;
      const { action, startDate, endDate, limit, page } = req.query;
      const data = await auditLogService.getAuditLogs({
        tenantId,
        action,
        startDate,
        endDate,
        limit,
        page,
      });
      return ApiResponse.success(res, data, 'Audit logs retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  static async getTenantAuditActions(req, res, next) {
    try {
      const { tenantId } = req.params;
      const actions = await auditLogService.getDistinctActions(tenantId);
      return ApiResponse.success(res, actions, 'Audit actions retrieved successfully');
    } catch (err) {
      next(err);
    }
  }
}

export default TenantClinicalController;
