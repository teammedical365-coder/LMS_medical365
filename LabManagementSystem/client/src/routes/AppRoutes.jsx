/**
 * Lab Management System (LMS) - Application Route Definitions
 * 
 * Enforces route guards via ProtectedRoute for authenticated users
 * and Super Admin routes.
 * 
 * Performance:
 * Route-level code-splitting via React.lazy() and Suspense to prevent monolithic
 * bundle loading and ensure sub-second navigation performance.
 */

import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// Layouts (Loaded eagerly with shell)
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';

// Route Guard
import ProtectedRoute from '../components/common/ProtectedRoute';

/**
 * Resilient lazy loader that recovers gracefully from Vite dynamic import chunk invalidations,
 * on-demand optimize dep updates, or stale browser cache issues.
 */
function lazyWithRetry(componentImport) {
  return lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });
}

// Lazy-loaded Pages (Code-split per route with resilient retry)
const LoginPage = lazyWithRetry(() => import('../pages/auth/LoginPage'));
const LaboratoryLoginPage = lazyWithRetry(() => import('../pages/auth/LaboratoryLoginPage'));
const DashboardPage = lazyWithRetry(() => import('../pages/dashboard/DashboardPage'));
const PatientsPage = lazyWithRetry(() => import('../pages/patients/PatientsPage'));
const OrdersPage = lazyWithRetry(() => import('../pages/orders/OrdersPage'));
const SamplesPage = lazyWithRetry(() => import('../pages/samples/SamplesPage'));
const TestCatalogPage = lazyWithRetry(() => import('../pages/tests/TestCatalogPage'));
const ReportsPage = lazyWithRetry(() => import('../pages/reports/ReportsPage'));
const BillingPage = lazyWithRetry(() => import('../pages/billing/BillingPage'));
const UsersPage = lazyWithRetry(() => import('../pages/users/UsersPage'));
const SettingsPage = lazyWithRetry(() => import('../pages/settings/SettingsPage'));
const AuditLogsPage = lazyWithRetry(() => import('../pages/audit/AuditLogsPage'));
const NotFoundPage = lazyWithRetry(() => import('../pages/NotFoundPage'));

// Super Admin Pages (Phase 2)
const SuperAdminOverview = lazyWithRetry(() => import('../pages/superAdmin/SuperAdminOverview'));
const LaboratoriesPage = lazyWithRetry(() => import('../pages/superAdmin/LaboratoriesPage'));
const RegisterLaboratoryPage = lazyWithRetry(() => import('../pages/superAdmin/RegisterLaboratoryPage'));
const LaboratoryDetailsPage = lazyWithRetry(() => import('../pages/superAdmin/LaboratoryDetailsPage'));
const SuperAdminRolesPage = lazyWithRetry(() => import('../pages/superAdmin/SuperAdminRolesPage'));

// Public Unauthenticated Pages
const PublicVerifyReportPage = lazyWithRetry(() => import('../pages/public/PublicVerifyReportPage'));


/**
 * Modern Medical365 Page Loading Fallback for Suspense transitions
 */
function PageLoadingFallback() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: '1rem',
        color: 'var(--slate-600, #475569)',
      }}
    >
      <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary-blue, #2563eb)' }} />
      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Loading module...</span>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Routes>
        {/* Public unauthenticated verification routes */}
        <Route path="/verify/:token" element={<PublicVerifyReportPage />} />
        <Route path="/verify-report/:token" element={<PublicVerifyReportPage />} />

        {/* Authentication routes */}
        <Route element={<AuthLayout />}>
          {/* Platform Super Admin Login (Root / Master) */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin/login" element={<LoginPage />} />

          {/* Dedicated Laboratory Whitelabel Login Portals */}
          <Route path="/lab/:labId" element={<LaboratoryLoginPage />} />
          <Route path="/lab/:labId/login" element={<LaboratoryLoginPage />} />
          <Route path="/portal/:labId" element={<LaboratoryLoginPage />} />
        </Route>

        {/* Main LMS Application Shell routes (Protected) */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route
            path="/patients"
            element={
              <ProtectedRoute requiredPermission="patients:view">
                <PatientsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute requiredPermission="orders:view">
                <OrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/samples"
            element={
              <ProtectedRoute requiredPermission="samples:view">
                <SamplesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tests"
            element={
              <ProtectedRoute requiredPermission="tests:view">
                <TestCatalogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute requiredPermission="reports:view">
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedRoute requiredPermission="billing:view">
                <BillingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute requiredPermission="users:view">
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute requiredPermission="audit:view">
                <AuditLogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute requiredPermission="settings:view">
                <SettingsPage />
              </ProtectedRoute>
            }
          />

          {/* Super Admin & Multi-Tenant Management Routes (Require Super Admin) */}
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute requireSuperAdmin>
                <SuperAdminOverview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin/laboratories"
            element={
              <ProtectedRoute requireSuperAdmin>
                <LaboratoriesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin/roles"
            element={
              <ProtectedRoute requireSuperAdmin>
                <SuperAdminRolesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin/laboratories/new"
            element={
              <ProtectedRoute requireSuperAdmin>
                <Navigate to="/super-admin/laboratories?action=register" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/super-admin/laboratories/:id"
            element={
              <ProtectedRoute requireSuperAdmin>
                <LaboratoryDetailsPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
