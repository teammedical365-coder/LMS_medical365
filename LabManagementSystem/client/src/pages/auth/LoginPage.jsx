/**
 * Lab Management System (LMS) - Platform Super Admin Login Page
 * 
 * Exclusively authenticates Platform Super Administrators against the Master Database.
 * Laboratory staff & administrators access their facility via dedicated white-label URLs.
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Shield,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginSuperAdmin, isLoading: authLoading } = useAuth();

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);

  const from = location.state?.from?.pathname || '/super-admin';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorStatus(null);
    setIsSubmitting(true);

    try {
      const result = await loginSuperAdmin({ email, password });

      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setErrorMessage(result.error);
        setErrorStatus(result.status);
      }
    } catch (err) {
      setErrorMessage(err.message || 'An unexpected connection error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-card" style={{ maxWidth: '440px' }}>
      {/* Brand Header */}
      <div className="auth-brand-head">
        <div
          className="auth-logo-box"
          style={{
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #0d9488 100%)',
            boxShadow: '0 4px 14px rgba(30, 64, 175, 0.35)',
          }}
        >
          <Shield size={28} />
        </div>
        <h1 className="auth-title">Super Admin Portal</h1>
        <p className="auth-subtitle">
          Master Multi-Tenant Administration & Facility Governance
        </p>
      </div>

      {/* Security Architecture Notice */}
      <div
        style={{
          background: 'var(--mint-bg)',
          border: '1px solid var(--mint-200)',
          borderRadius: 'var(--radius-md)',
          padding: '0.625rem 0.75rem',
          marginBottom: '1.25rem',
          fontSize: '0.75rem',
          color: 'var(--mint-text)',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <ShieldCheck size={16} style={{ flexShrink: 0 }} />
        <span>
          Platform Governance: Authenticates against Master Database with secure session tokens.
        </span>
      </div>

      {/* Error Alert Banner */}
      {errorMessage && (
        <div
          style={{
            background: errorStatus === 503 ? 'var(--warning-50)' : 'var(--danger-50)',
            border: `1px solid ${errorStatus === 503 ? 'var(--warning-200)' : 'var(--danger-200)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem',
            marginBottom: '1.25rem',
            fontSize: '0.8125rem',
            color: errorStatus === 503 ? 'var(--warning-800)' : 'var(--danger-700)',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
          }}
        >
          {errorStatus === 503 ? (
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--warning-600)' }} />
          ) : (
            <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--danger-600)' }} />
          )}
          <div>
            <strong>{errorStatus === 503 ? 'Service Unavailable:' : 'Authentication Failed:'}</strong>{' '}
            {errorMessage}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Email Address */}
        <div className="form-group">
          <label className="form-label" htmlFor="admin-email">
            Platform Administrator Email
          </label>
          <div style={{ position: 'relative' }}>
            <Mail
              size={16}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--slate-400)',
              }}
            />
            <input
              id="admin-email"
              type="email"
              className="form-input"
              style={{ paddingLeft: '2rem' }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@platform.local"
              required
              autoComplete="username"
            />
          </div>
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="admin-password">
            Password
          </label>
          <div style={{ position: 'relative' }}>
            <Lock
              size={16}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--slate-400)',
              }}
            />
            <input
              id="admin-password"
              type="password"
              className="form-input"
              style={{ paddingLeft: '2rem' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your administrator password"
              required
              autoComplete="current-password"
            />
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '0.75rem', padding: '0.75rem' }}
          disabled={isSubmitting || authLoading}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Verifying Super Admin Credentials...</span>
            </>
          ) : (
            <>
              <span>Sign In as Platform Super Admin</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Helpful Guidance Callout for Lab Staff */}
      <div
        style={{
          marginTop: '1.5rem',
          padding: '0.875rem',
          background: 'var(--slate-50)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center',
          fontSize: '0.78rem',
          color: 'var(--slate-600)',
          lineHeight: 1.45,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontWeight: 600, color: 'var(--slate-700)', marginBottom: '3px' }}>
          <Building2 size={13} style={{ color: 'var(--primary-600)' }} />
          <span>Laboratory Staff & Administrators</span>
        </div>
        Please sign in through your laboratory's dedicated white-label portal URL (e.g.{' '}
        <code style={{ color: 'var(--primary-700)', background: 'var(--primary-50)', padding: '1px 5px', borderRadius: '3px' }}>
          /lab/your-lab-code
        </code>
        ) provided by your platform administrator.
      </div>

      <div style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.72rem', color: 'var(--slate-400)' }}>
        <span>Medical365 LMS • Platform Governance & Security Engine</span>
      </div>
    </div>
  );
}

export default LoginPage;
