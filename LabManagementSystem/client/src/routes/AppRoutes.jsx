/**
 * Lab Management System (LMS) - Application Route Definitions
 * 
 * Enforces route guards via ProtectedRoute for authenticated users
 * and Super Admin routes.
 */

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Layouts
import MainLayout from '../layouts/MainLayout';
import AuthLayout from '../layouts/AuthLayout';

// Guard
import ProtectedRoute from '../components/common/ProtectedRoute';

// Pages
import LoginPage from '../pages/auth/LoginPage';
import DashboardPage from '../pages/dashboard/DashboardPage';
import PatientsPage from '../pages/patients/PatientsPage';
import OrdersPage from '../pages/orders/OrdersPage';
import SamplesPage from '../pages/samples/SamplesPage';
import TestCatalogPage from '../pages/tests/TestCatalogPage';
import ReportsPage from '../pages/reports/ReportsPage';
import BillingPage from '../pages/billing/BillingPage';
import UsersPage from '../pages/users/UsersPage';
import SettingsPage from '../pages/settings/SettingsPage';
import NotFoundPage from '../pages/NotFoundPage';

// Super Admin Pages (Phase 2)
import SuperAdminOverview from '../pages/superAdmin/SuperAdminOverview';
import LaboratoriesPage from '../pages/superAdmin/LaboratoriesPage';
import RegisterLaboratoryPage from '../pages/superAdmin/RegisterLaboratoryPage';
import LaboratoryDetailsPage from '../pages/superAdmin/LaboratoryDetailsPage';

export function AppRoutes() {
  return (
    <Routes>
      {/* Authentication routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
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
          path="/super-admin/laboratories/new"
          element={
            <ProtectedRoute requireSuperAdmin>
              <RegisterLaboratoryPage />
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
  );
}

export default AppRoutes;
