/**
 * Lab Management System (LMS) - Platform Admin Security Boundary Notice
 * 
 * Displayed when sensitive Super Admin operations are locked pending
 * authenticated server-side administrator credentials.
 */

import React from 'react';
import { Lock, ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AdminSecurityBoundary({ message, errorDetails }) {
  return (
    <div
      className="card"
      style={{
        padding: '2.5rem 2rem',
        textAlign: 'center',
        maxWidth: '720px',
        margin: '2rem auto',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#fef2f2',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem auto',
          border: '2px solid #fee2e2',
        }}
      >
        <Lock size={28} />
      </div>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-900)', marginBottom: '0.5rem' }}>
        Server-Side Administrator Authentication Required
      </h2>

      <p style={{ color: 'var(--slate-600)', fontSize: '0.875rem', lineHeight: '1.6', marginBottom: '1.5rem' }}>
        {message ||
          'Direct browser execution using client-exposed shared API keys has been removed in compliance with the Phase 2 security audit. Platform management operations are locked on the server until secure administrator authentication is unlocked in Phase 3.'}
      </p>

      {errorDetails && (
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            fontSize: '0.8125rem',
            color: 'var(--slate-700)',
            textAlign: 'left',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--slate-900)', marginBottom: '4px' }}>Server Security Response:</div>
          <code style={{ color: 'var(--danger-700)' }}>{errorDetails}</code>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
        <Link to="/dashboard" className="btn btn-secondary">
          <ArrowLeft size={14} />
          <span>Return to Laboratory Dashboard</span>
        </Link>
      </div>
    </div>
  );
}

export default AdminSecurityBoundary;
