/**
 * Lab Management System (LMS) - Dedicated White-Label Laboratory Login Page
 * 
 * Route: /lab/:labId and /lab/:labId/login
 * 
 * Provides isolated, white-label authentication strictly for:
 * 1. Laboratory Administrators
 * 2. Laboratory Pathologists, Technicians, Accessioners & Billing Staff
 * 
 * Dynamically resolves facility identity & custom branding by laboratory code or tenantId.
 * Automatically binds the authenticated session to the laboratory's dedicated tenant database.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Building2,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  AlertTriangle,
  FlaskConical,
  ExternalLink,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import api from '../../services/api';

export function LaboratoryLoginPage() {
  const { labId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { loginLabUser, isLoading: authLoading, isAuthenticated, user, tenant: activeTenant } = useAuth();
  const { branding } = useTenant();

  // Resolved laboratory profile
  const [labProfile, setLabProfile] = useState(null);
  const [resolvingLab, setResolvingLab] = useState(true);
  const [resolveError, setResolveError] = useState(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // UI States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);

  const from = location.state?.from?.pathname || '/dashboard';

  // If already authenticated to this tenant, redirect to dashboard
  useEffect(() => {
    if (isAuthenticated && activeTenant && (activeTenant.code?.toLowerCase() === labId?.toLowerCase() || activeTenant.tenantId === labId)) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, activeTenant, labId, navigate]);

  // Persist active laboratory context for sign-in & sign-out lifecycle
  useEffect(() => {
    if (labId && typeof window !== 'undefined') {
      localStorage.setItem('lms_active_lab_code', labId.trim().toLowerCase());
    }
  }, [labId]);

  // Resolve laboratory branding & verification
  useEffect(() => {
    let isMounted = true;

    async function fetchLabProfile() {
      if (!labId) {
        setResolveError('No laboratory identifier specified in portal URL.');
        setResolvingLab(false);
        return;
      }

      setResolvingLab(true);
      setResolveError(null);

      try {
        const res = await api.get('/tenant/branding', {
          params: { code: labId.trim() },
        });

        if (isMounted) {
          if (res.data?.success && res.data?.data) {
            const data = res.data.data;
            setLabProfile(data);

            // Apply custom theme tokens dynamically
            const root = document.documentElement;
            if (data.branding?.primaryColor) {
              root.style.setProperty('--primary-blue', data.branding.primaryColor);
              root.style.setProperty('--primary-600', data.branding.primaryColor);
              root.style.setProperty('--primary-500', data.branding.primaryColor);
            }
            if (data.branding?.accentColor) {
              root.style.setProperty('--accent-cyan', data.branding.accentColor);
              root.style.setProperty('--cyan-500', data.branding.accentColor);
            }
            const displayName = data.branding?.displayName || data.name || 'Laboratory Portal';
            document.title = `${displayName} | Staff Portal`;
          } else {
            setResolveError(`Laboratory facility "${labId}" not found.`);
          }
        }
      } catch (err) {
        if (isMounted) {
          const msg =
            err.response?.data?.message ||
            `No registered laboratory facility matched identifier "${labId}".`;
          setResolveError(msg);
        }
      } finally {
        if (isMounted) {
          setResolvingLab(false);
        }
      }
    }

    fetchLabProfile();

    return () => {
      isMounted = false;
    };
  }, [labId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorStatus(null);
    setIsSubmitting(true);

    try {
      const orgCode = labProfile?.code || labId;
      const result = await loginLabUser({
        organizationCode: orgCode,
        email: email.trim().toLowerCase(),
        password,
      });

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

  // State 1: Resolving Laboratory Identifier
  if (resolvingLab) {
    return (
      <div className="auth-card" style={{ maxWidth: '440px', textAlign: 'center', padding: '3rem 2rem' }}>
        <Loader2
          size={36}
          className="animate-spin"
          style={{ color: 'var(--primary-blue)', margin: '0 auto 1.25rem' }}
        />
        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--slate-800)', marginBottom: '0.5rem' }}>
          Resolving Laboratory Portal
        </h2>
        <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
          Connecting to facility white-label configuration for <code>{labId}</code>...
        </p>
      </div>
    );
  }

  // State 2: Laboratory Not Found
  if (resolveError || !labProfile) {
    return (
      <div className="auth-card" style={{ maxWidth: '460px', textAlign: 'center', padding: '2.5rem 2rem' }}>
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--danger-50)',
            color: 'var(--danger-600)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem',
          }}
        >
          <Building2 size={28} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-900)', marginBottom: '0.5rem' }}>
          Laboratory Portal Not Found
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '1.5rem', lineHeight: 1.5 }}>
          {resolveError || `No active clinical laboratory matches the URL identifier "${labId}".`}
        </p>

        <div
          style={{
            background: 'var(--slate-50)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '0.875rem',
            marginBottom: '1.5rem',
            fontSize: '0.8125rem',
            color: 'var(--slate-600)',
            textAlign: 'left',
          }}
        >
          <div style={{ fontWeight: 600, color: 'var(--slate-800)', marginBottom: '4px' }}>Troubleshooting:</div>
          <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
            <li>Verify the spelling of the laboratory code in your browser address bar.</li>
            <li>Confirm with your Laboratory Administrator that the facility has been activated.</li>
          </ul>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <Link to="/login" className="btn btn-primary" style={{ padding: '0.625rem 1.25rem' }}>
            <span>Platform Super Admin Login</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    );
  }

  // State 3: Active Laboratory Whitelabel Login Portal
  const brandTitle = labProfile.branding?.displayName || labProfile.name || 'Laboratory Staff Portal';
  const bannerText = labProfile.branding?.loginBannerText || 'Healthcare Diagnostic & Pathology Operations';
  const logoUrl = labProfile.branding?.logoUrl;
  const primaryBrandColor = labProfile.branding?.primaryColor || 'var(--primary-blue)';

  return (
    <div className="auth-card" style={{ maxWidth: '440px' }}>
      {/* Brand Header */}
      <div className="auth-brand-head">
        {logoUrl ? (
          <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
            <img
              src={logoUrl}
              alt={`${brandTitle} Logo`}
              style={{ maxHeight: '52px', maxWidth: '200px', objectFit: 'contain' }}
            />
          </div>
        ) : (
          <div
            className="auth-logo-box"
            style={{
              background: `linear-gradient(135deg, ${primaryBrandColor}, #0284c7)`,
              boxShadow: `0 4px 14px rgba(37, 99, 235, 0.25)`,
            }}
          >
            <FlaskConical size={28} />
          </div>
        )}
        <h1 className="auth-title">{brandTitle}</h1>
        <p className="auth-subtitle">{bannerText}</p>
      </div>

      {/* Automatically Bound Facility Badge */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          background: 'var(--mint-bg)',
          border: '1px solid var(--mint-200)',
          borderRadius: 'var(--radius-md)',
          padding: '0.5rem 0.75rem',
          marginBottom: '1.25rem',
          fontSize: '0.78rem',
          color: 'var(--mint-text)',
          fontWeight: 600,
        }}
      >
        <ShieldCheck size={15} style={{ flexShrink: 0 }} />
        <span>
          Facility Confirmed: <code style={{ color: 'var(--mint-800)', fontSize: '0.85rem' }}>{labProfile.code}</code>
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

      {/* Login Form */}
      <form onSubmit={handleSubmit}>
        {/* Email Address */}
        <div className="form-group">
          <label className="form-label" htmlFor="staff-email">
            Staff / Administrator Email
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
              id="staff-email"
              type="email"
              className="form-input"
              style={{ paddingLeft: '2rem' }}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@laboratory.org"
              required
              autoComplete="username"
            />
          </div>
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="staff-password">
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
              id="staff-password"
              type="password"
              className="form-input"
              style={{ paddingLeft: '2rem' }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your account password"
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
              <span>Sign In to {labProfile.name}</span>
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </form>

      {/* Footer Info */}
      <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--slate-400)' }}>
        <span>Isolated Multi-Tenant Session • Scoped to {labProfile.name}</span>
      </div>
    </div>
  );
}

export default LaboratoryLoginPage;
