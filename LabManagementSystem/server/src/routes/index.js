/**
 * Lab Management System (LMS) - Versioned API Router (v1)
 */

import { Router } from 'express';
import healthRoutes from './health.routes.js';
import superAdminRoutes from './superAdmin.routes.js';
import authRoutes from './auth.routes.js';
import tenantUserRoutes from './tenantUser.routes.js';
import roleRoutes from './role.routes.js';
import tenantClinicalRoutes from './tenantClinical.routes.js';
import tenantClinicalController from '../controllers/tenantClinical.controller.js';
import ApiResponse from '../utils/apiResponse.js';

const apiV1Router = Router();

// Health check endpoint under /api/v1/health
apiV1Router.use('/health', healthRoutes);

// Authentication endpoints under /api/v1/auth
apiV1Router.use('/auth', authRoutes);

// Super Admin Platform Management under /api/v1/super-admin
apiV1Router.use('/super-admin', superAdminRoutes);

// Public unauthenticated white-label branding resolution
apiV1Router.get('/tenant/branding', tenantClinicalController.resolvePublicBranding);
apiV1Router.get('/branding', tenantClinicalController.resolvePublicBranding);

// Public unauthenticated diagnostic report authenticity verification
apiV1Router.get('/public/verify-report/:token', tenantClinicalController.verifyPublicReport);
apiV1Router.get('/reports/verify/:token', tenantClinicalController.verifyPublicReport);

// Tenant User Management under /api/v1/tenants/:tenantId/users
apiV1Router.use('/tenants/:tenantId/users', tenantUserRoutes);

// Tenant Role & Permission Management under /api/v1/tenants/:tenantId/roles
apiV1Router.use('/tenants/:tenantId/roles', roleRoutes);

// Tenant Clinical & Operational Management under /api/v1/tenants/:tenantId
apiV1Router.use('/tenants/:tenantId', tenantClinicalRoutes);

// Root v1 info route
apiV1Router.get('/', (req, res) => {
  return ApiResponse.success(res, {
    api: 'Lab Management System API',
    version: 'v1',
    phase: 'Phase 3, Phase 4A & Phase 5 - Complete LMS SaaS Role Hierarchy, Laboratory Onboarding & White-Label Management',
    docs: '/api/v1/health',
    endpoints: {
      health: 'GET /api/v1/health',
      auth: {
        superAdminLogin: 'POST /api/v1/auth/super-admin/login',
        laboratoryLogin: 'POST /api/v1/auth/laboratory/login',
        profile: 'GET /api/v1/auth/me',
        logout: 'POST /api/v1/auth/logout',
      },
      branding: {
        publicResolve: 'GET /api/v1/tenant/branding?domain=<host>&code=<code>',
      },
      tenantUsers: {
        list: 'GET /api/v1/tenants/:tenantId/users',
        create: 'POST /api/v1/tenants/:tenantId/users',
        get: 'GET /api/v1/tenants/:tenantId/users/:userId',
        updateStatus: 'PATCH /api/v1/tenants/:tenantId/users/:userId/status',
        assignRole: 'PATCH /api/v1/tenants/:tenantId/users/:userId/role',
      },
      roles: {
        permissionsMatrix: 'GET /api/v1/tenants/:tenantId/roles/permissions-matrix',
        list: 'GET /api/v1/tenants/:tenantId/roles',
        create: 'POST /api/v1/tenants/:tenantId/roles',
        get: 'GET /api/v1/tenants/:tenantId/roles/:roleId',
        update: 'PUT /api/v1/tenants/:tenantId/roles/:roleId',
        updateStatus: 'PATCH /api/v1/tenants/:tenantId/roles/:roleId/status',
      },
      superAdmin: {
        overview: 'GET /api/v1/super-admin/overview',
        laboratories: 'GET /api/v1/super-admin/laboratories',
        registerLab: 'POST /api/v1/super-admin/laboratories',
        getLab: 'GET /api/v1/super-admin/laboratories/:id',
        updateLab: 'PATCH /api/v1/super-admin/laboratories/:id',
        transitionStatus: 'POST /api/v1/super-admin/laboratories/:id/status',
        provisioningStatus: 'GET /api/v1/super-admin/laboratories/:id/provisioning',
        retryProvisioning: 'POST /api/v1/super-admin/laboratories/:id/provisioning/retry',
        auditLogs: 'GET /api/v1/super-admin/audit-logs',
      },
      clinical: {
        patients: 'GET/POST /api/v1/tenants/:tenantId/patients',
        orders: 'GET/POST /api/v1/tenants/:tenantId/orders',
        samples: 'GET /api/v1/tenants/:tenantId/samples, PATCH /api/v1/tenants/:tenantId/samples/:sampleId/status',
        tests: 'GET/POST /api/v1/tenants/:tenantId/tests',
        reports: 'GET/POST /api/v1/tenants/:tenantId/reports, POST .../approve, .../reject, .../release',
        billing: 'GET /api/v1/tenants/:tenantId/billing/invoices, POST .../payments, GET .../summary',
        dashboardSummary: 'GET /api/v1/tenants/:tenantId/dashboard-summary',
        settings: 'GET /api/v1/tenants/:tenantId/settings, PATCH .../branding',
      },
    },
  }, 'LMS v1 API root');
});

export default apiV1Router;
