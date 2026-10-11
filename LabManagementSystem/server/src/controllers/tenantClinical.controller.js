/**
 * Lab Management System (LMS) - Tenant Clinical & Operational Controller
 * 
 * Exposes patient accessioning, requisition orders, specimen processing,
 * diagnostic pathology reports, and billing ledger endpoints with granular
 * role permission checking and strict multi-tenant boundary validation.
 */

import tenantClinicalService, { ClinicalServiceError } from '../services/tenantClinical.service.js';
import laboratoryManagementService from '../services/laboratoryManagement.service.js';
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

  static async updateSampleStatus(req, res, next) {
    try {
      const { tenantId, sampleId } = req.params;
      const sample = await tenantClinicalService.updateSampleStatus(tenantId, sampleId, req.body, req.user);
      return ApiResponse.success(res, sample, 'Sample status updated successfully');
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
      const report = await tenantClinicalService.approveReport(tenantId, reportId, req.user);
      return ApiResponse.success(res, report, 'Report approved by pathologist');
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
  // DASHBOARD SUMMARY (Role-Specific)
  // -------------------------------------------------------------------------
  static async getDashboardSummary(req, res, next) {
    try {
      const { tenantId } = req.params;
      const userRole = req.user?.role || 'lab_admin';
      const summary = await tenantClinicalService.getDashboardSummary(tenantId, userRole);
      return ApiResponse.success(res, summary, 'Laboratory dashboard metrics retrieved');
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
        const clean = (domainOrCode || '').toString().trim().toLowerCase();
        if (clean === 'localhost' || clean === '127.0.0.1' || clean === '::1') {
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
          }, 'Default platform branding resolved for local host');
        }
        return ApiResponse.error(res, 'No laboratory found matching the provided domain or code', HTTP_STATUS.NOT_FOUND);
      }
      return ApiResponse.success(res, branding, 'Laboratory branding resolved successfully');
    } catch (err) {
      next(err);
    }
  }
}

export default TenantClinicalController;
