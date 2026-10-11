/**
 * Lab Management System (LMS) - Route Protection Guard
 * 
 * Enforces authenticated session boundaries and Super Admin privilege separation.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, Loader2 } from 'lucide-react';

export function ProtectedRoute({ children, requireSuperAdmin = false, requiredPermission = null }) {
  const { user, isAuthenticated, isSuperAdmin, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: '1rem',
          color: 'var(--slate-600)',
        }}
      >
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary-blue)' }} />
        <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Verifying secure session...</span>
      </div>
    );
  }

  // Unauthenticated user -> redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Super Admin privilege requirement
  if (requireSuperAdmin && !isSuperAdmin) {
    return (
      <div
        style={{
          padding: '2.5rem',
          maxWidth: '600px',
          margin: '2rem auto',
          background: 'white',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--danger-200)',
          boxShadow: 'var(--shadow-md)',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--danger-50)',
            color: 'var(--danger-600)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}
        >
          <ShieldAlert size={26} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-900)', marginBottom: '0.5rem' }}>
          Access Denied
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          Platform Super Admin privileges are required to view this administrative resource. Your authenticated laboratory credentials do not have platform-level access.
        </p>
        <a
          href="/dashboard"
          className="btn btn-primary"
          style={{ display: 'inline-flex', padding: '0.625rem 1.25rem' }}
        >
          Return to Laboratory Dashboard
        </a>
      </div>
    );
  }

  // Security Guard: Super Admin is restricted to platform management (/super-admin)
  // Super Admin does not automatically receive unrestricted clinical data access
  if (isSuperAdmin && !location.pathname.startsWith('/super-admin')) {
    return <Navigate to="/super-admin" replace />;
  }

  // Tenant Permission Check
  if (requiredPermission && !isSuperAdmin) {
    const isLabAdmin = user?.role === 'lab_admin' || user?.role === 'lab_director';
    const userPermissions = user?.permissions || user?.roleDefinition?.permissions || [];
    const hasPermission = isLabAdmin || userPermissions.includes('*') || userPermissions.includes(requiredPermission);

    if (!hasPermission) {
      return (
        <div
          style={{
            padding: '2.5rem',
            maxWidth: '600px',
            margin: '2rem auto',
            background: 'white',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--warning-200)',
            boxShadow: 'var(--shadow-md)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'var(--warning-50)',
              color: 'var(--warning-600)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem',
            }}
          >
            <ShieldAlert size={26} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-900)', marginBottom: '0.5rem' }}>
            Insufficient Permission
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Your assigned role does not have authorization to view this module.
            <br />
            Required permission: <code style={{ color: 'var(--danger-600)' }}>{requiredPermission}</code>
          </p>
          <a
            href="/dashboard"
            className="btn btn-primary"
            style={{ display: 'inline-flex', padding: '0.625rem 1.25rem' }}
          >
            Return to Dashboard
          </a>
        </div>
      );
    }
  }

  return children;
}

export default ProtectedRoute;
