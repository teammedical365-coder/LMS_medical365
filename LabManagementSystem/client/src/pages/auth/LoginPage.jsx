/**
 * Lab Management System (LMS) - Real Authentication Login Page
 * 
 * Supports genuine authentication for:
 * 1. Laboratory Personnel (Organization Code + Email + Password)
 * 2. Platform Super Administrators (Email + Password)
 * 
 * Follows Medical365 visual design system with clear loading, error,
 * and service unavailable feedback.
 */

import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FlaskConical,
  Lock,
  Mail,
  Building,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Server,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginLabUser, loginSuperAdmin, isLoading: authLoading } = useAuth();
  const { tenant, branding } = useTenant();

  // Mode: 'laboratory' | 'superAdmin'
  const [loginMode, setLoginMode] = useState('laboratory');

  // Form fields
  const [organizationCode, setOrganizationCode] = useState(tenant?.code || 'central-diag');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);

  const from = location.state?.from?.pathname || (loginMode === 'superAdmin' ? '/super-admin' : '/dashboard');

  const handleSwitchMode = (mode) => {
    setLoginMode(mode);
    setErrorMessage(null);
    setErrorStatus(null);
    if (mode === 'superAdmin') {
      setEmail('');
      setPassword('');
    } else {
      setOrganizationCode(tenant?.code || 'central-diag');
      setEmail('');
      setPassword('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorStatus(null);
    setIsSubmitting(true);

    try {
      let result;
      if (loginMode === 'superAdmin') {
        result = await loginSuperAdmin({ email, password });
      } else {
        result = await loginLabUser({ organizationCode, email, password });
      }

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

  const brandTitle = loginMode === 'superAdmin'
    ? 'LMS Platform Portal'
    : (branding?.displayName || tenant?.name || 'LabMS Portal');

  return (
    <div className="auth-card" style={{ maxWidth: '440px' }}>
      {/* Brand Header */}
      <div className="auth-brand-head">
        {branding?.logoUrl && loginMode === 'laboratory' ? (
          <div style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'center' }}>
            <img
              src={branding.logoUrl}
              alt="Brand Logo"
              style={{ maxHeight: '48px', maxWidth: '160px', objectFit: 'contain' }}
            />
          </div>
        ) : (
          <div className="auth-logo-box">
            <FlaskConical size={28} />
          </div>
        )}
        <h1 className="auth-title">{brandTitle}</h1>
        <p className="auth-subtitle">
          {branding?.loginBannerText || 'Healthcare Diagnostic Laboratory Platform'}
        </p>
      </div>

      {/* Role Switcher Tabs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '4px',
          background: 'var(--slate-100)',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.25rem',
        }}
      >
        <button
          type="button"
          onClick={() => handleSwitchMode('laboratory')}
          style={{
            padding: '8px 12px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: loginMode === 'laboratory' ? 'white' : 'transparent',
            color: loginMode === 'laboratory' ? 'var(--primary-blue)' : 'var(--slate-600)',
            boxShadow: loginMode === 'laboratory' ? 'var(--shadow-sm)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Building size={14} />
          <span>Lab Staff</span>
        </button>

        <button
          type="button"
          onClick={() => handleSwitchMode('superAdmin')}
          style={{
            padding: '8px 12px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            borderRadius: 'var(--radius-sm)',
            border: 'none',
            background: loginMode === 'superAdmin' ? 'white' : 'transparent',
            color: loginMode === 'superAdmin' ? 'var(--primary-blue)' : 'var(--slate-600)',
            boxShadow: loginMode === 'superAdmin' ? 'var(--shadow-sm)' : 'none',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Server size={14} />
          <span>Super Admin</span>
        </button>
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
          {loginMode === 'superAdmin'
            ? 'Super Admin: Authenticates against Master Database with short-lived JWT.'
            : 'Multi-Tenant Auth: Scoped strictly to the selected laboratory database.'}
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Organization Code (Only in Laboratory Mode) */}
        {loginMode === 'laboratory' && (
          <div className="form-group">
            <label className="form-label" htmlFor="org-code">
              Laboratory Organization Code
            </label>
            <div style={{ position: 'relative' }}>
              <Building
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
                id="org-code"
                type="text"
                className="form-input"
                style={{ paddingLeft: '2rem' }}
                value={organizationCode}
                onChange={(e) => setOrganizationCode(e.target.value)}
                placeholder="e.g. central-diag"
                required
                autoComplete="organization"
              />
            </div>
          </div>
        )}

        {/* Email Address */}
        <div className="form-group">
          <label className="form-label" htmlFor="email">
            {loginMode === 'superAdmin' ? 'Platform Administrator Email' : 'Staff Email Address'}
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
              id="email"
              type="email"
              className="form-input"
              style={{ paddingLeft: '2rem' }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={loginMode === 'superAdmin' ? 'superadmin@test.com' : 'user@laboratory.org'}
              required
              autoComplete="username"
            />
          </div>
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="password">
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
              id="password"
              type="password"
              className="form-input"
              style={{ paddingLeft: '2rem' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
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
              <span>Authenticating Session...</span>
            </>
          ) : (
            <>
              <span>{loginMode === 'superAdmin' ? 'Sign In as Super Admin' : 'Sign In to Laboratory'}</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--slate-400)' }}>
        <span>LMS Version 1.0.0 • Phase 3 Cryptographic Authentication</span>
      </div>
    </div>
  );
}

export default LoginPage;
