/**
 * Lab Management System (LMS) - Dedicated White-Label Laboratory Login Page
 * 
 * Route: /lab/:labId and /lab/:labId/login
 * 
 * Modern, single-screen locked viewport without scrollbars.
 * Preserves 100% of underlying API contracts, authentication endpoints,
 * tenant resolution, and routing.
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
  Eye,
  EyeOff,
  Check,
  Shield,
  Activity,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import api from '../../services/api';

export function LaboratoryLoginPage() {
  const { labId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { loginLabUser, isLoading: authLoading, isAuthenticated, tenant: activeTenant } = useAuth();
  const { branding } = useTenant();

  // Resolved laboratory profile
  const [labProfile, setLabProfile] = useState(null);
  const [resolvingLab, setResolvingLab] = useState(true);
  const [resolveError, setResolveError] = useState(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // UI Feedback States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);

  const from = location.state?.from?.pathname || '/dashboard';

  // If already authenticated to this tenant, redirect to dashboard
  useEffect(() => {
    if (
      isAuthenticated &&
      activeTenant &&
      (activeTenant.code?.toLowerCase() === labId?.toLowerCase() || activeTenant.tenantId === labId)
    ) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, activeTenant, labId, navigate]);

  // Persist active laboratory context for sign-in & sign-out lifecycle
  useEffect(() => {
    if (labId && typeof window !== 'undefined') {
      localStorage.setItem('lms_active_lab_code', labId.trim().toLowerCase());
    }
  }, [labId]);

  // Lock body/html scroll on desktop to guarantee single-page fixed viewport without scrollbar
  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.innerWidth > 960 && window.innerHeight > 580;
      if (isDesktop) {
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
      } else {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);

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
            document.title = `${displayName} | Staff Sign in`;
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
    setInfoMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter a valid work email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your account password.');
      return;
    }

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
      <div className="auth-page-wrapper">
        <header className="auth-topbar">
          <div className="auth-brand">
            <div className="auth-logo">
              <FlaskConical size={20} />
            </div>
            <div>
              <div className="auth-brand-name">Medical365 LMS</div>
              <div className="auth-brand-caption">Laboratory management</div>
            </div>
          </div>
          <div className="auth-top-right">
            <Shield size={16} />
            <span>Secure staff portal</span>
          </div>
        </header>

        <main className="auth-main">
          <div className="auth-login-card" style={{ maxWidth: '420px', width: '100%', textAlign: 'center', padding: '36px 28px' }}>
            <Loader2 size={34} className="animate-spin" style={{ color: 'var(--primary-blue, #2358d5)', margin: '0 auto 14px' }} />
            <h2 className="auth-card-title" style={{ fontSize: '20px' }}>Resolving Facility Portal</h2>
            <p className="auth-card-subtitle" style={{ marginTop: '6px' }}>
              Connecting to secure white-label configuration for <code>{labId}</code>...
            </p>
          </div>
        </main>
      </div>
    );
  }

  // State 2: Laboratory Not Found
  if (resolveError || !labProfile) {
    return (
      <div className="auth-page-wrapper">
        <header className="auth-topbar">
          <div className="auth-brand">
            <div className="auth-logo" style={{ background: '#ef4444' }}>
              <Building2 size={20} />
            </div>
            <div>
              <div className="auth-brand-name">Medical365 LMS</div>
              <div className="auth-brand-caption">Facility lookup</div>
            </div>
          </div>
          <div className="auth-top-right">
            <AlertTriangle size={16} style={{ color: '#ef4444' }} />
            <span>Portal unresolved</span>
          </div>
        </header>

        <main className="auth-main">
          <div className="auth-login-card" style={{ maxWidth: '440px', width: '100%', textAlign: 'center', padding: '32px 28px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 16px',
              }}
            >
              <Building2 size={24} />
            </div>
            <h2 className="auth-card-title" style={{ fontSize: '20px' }}>Facility Portal Not Found</h2>
            <p className="auth-card-subtitle" style={{ marginBottom: '18px', lineHeight: 1.5 }}>
              {resolveError || `No registered laboratory matches the portal identifier "${labId}".`}
            </p>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '9px',
                padding: '12px 14px',
                marginBottom: '20px',
                fontSize: '11.5px',
                color: '#475569',
                textAlign: 'left',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '3px' }}>Troubleshooting:</div>
              <ul style={{ paddingLeft: '16px', margin: 0 }}>
                <li>Confirm the laboratory code in your browser address bar.</li>
                <li>Contact your Laboratory Administrator to confirm the facility is active.</li>
              </ul>
            </div>

            <Link to="/login" className="auth-submit" style={{ textDecoration: 'none' }}>
              <span>Platform Super Admin Sign in</span>
              <ArrowRight size={15} />
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // State 3: Active Laboratory Whitelabel Login Portal
  const brandTitle = labProfile.branding?.displayName || labProfile.name || 'Laboratory Portal';
  const logoUrl = labProfile.branding?.logoUrl;
  const facilityCode = (labProfile.code || labProfile.tenantId || labId || '').toUpperCase();

  return (
    <div className="auth-page-wrapper">
      {/* Top Header Bar */}
      <header className="auth-topbar">
        <div className="auth-brand">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${brandTitle} Logo`}
              style={{ height: '36px', maxWidth: '140px', objectFit: 'contain' }}
            />
          ) : (
            <div className="auth-logo" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path
                  d="M9 3h6M10 3v6l-5.2 8.8A2 2 0 0 0 6.5 21h11a2 2 0 0 0 1.7-3.2L14 9V3M8 15h8"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          )}
          <div>
            <div className="auth-brand-name">{brandTitle}</div>
            <div className="auth-brand-caption">Laboratory management</div>
          </div>
        </div>

        <div className="auth-top-right">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" stroke="currentColor" strokeWidth="1.7" />
            <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <span>Secure staff portal</span>
        </div>
      </header>

      {/* Main Split Layout */}
      <main className="auth-main">
        <div className="auth-layout">
          {/* Left Intro Column */}
          <section className="auth-intro">
            <div className="auth-kicker">Laboratory workspace</div>
            <h1>
              Precision in every test. <span>Confidence in every result.</span>
            </h1>
            <p className="auth-intro-copy">
              One secure place for your laboratory team to manage daily operations, coordinate workflows, and keep essential clinical records organized.
            </p>

            <div className="auth-trust-list">
              <div className="auth-trust-item">
                <div className="auth-trust-icon">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" stroke="currentColor" strokeWidth="1.7" />
                    <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </div>
                <span>Access scoped to your registered facility</span>
              </div>

              <div className="auth-trust-item">
                <div className="auth-trust-icon">
                  <svg viewBox="0 0 24 24" fill="none">
                    <rect x="4" y="10" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </div>
                <span>Private sign-in for authorized staff</span>
              </div>

              <div className="auth-trust-item">
                <div className="auth-trust-icon">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M4 19V5m0 14h16M8 15l3-4 3 2 5-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span>Built around clear, efficient diagnostic workflows</span>
              </div>
            </div>
          </section>

          {/* Right Form Card */}
          <section className="auth-login-card" aria-label="Sign in form">
            <div className="auth-card-top">
              <div>
                <h2 className="auth-card-title">Welcome back</h2>
                <p className="auth-card-subtitle">Enter your credentials to continue.</p>
              </div>
              {/* Lab Code Pill replacing FACILITY ACTIVE */}
              <div className="auth-facility-pill">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>Lab Code: {facilityCode}</span>
              </div>
            </div>

            <div className="auth-rule" />

            <form onSubmit={handleSubmit} noValidate>
              {/* Email Address */}
              <div className="auth-field">
                <label htmlFor="staff-email">Email ID</label>
                <div className="auth-inputbox">
                  <svg viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
                    <path d="m4 7 8 6 8-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input
                    id="staff-email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    placeholder="Enter your email ID"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="auth-field">
                <label htmlFor="staff-password">Password</label>
                <div className="auth-inputbox">
                  <svg viewBox="0 0 24 24" fill="none">
                    <rect x="4" y="10" width="16" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                  <input
                    id="staff-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="auth-eye"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Remember me only (Forgot password removed) */}
              <div className="auth-row-options">
                <label className="auth-remember">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember me</span>
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="auth-submit"
                disabled={isSubmitting || authLoading}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Signing in securely...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in securely</span>
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </button>

              {/* Feedback messages */}
              {errorMessage && (
                <div className="auth-feedback error" role="status" aria-live="polite">
                  {errorMessage}
                </div>
              )}

              {infoMessage && (
                <div className="auth-feedback info" role="status" aria-live="polite">
                  {infoMessage}
                </div>
              )}
            </form>

            {/* Card Footer Security Tag */}
            <div className="auth-card-footer">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" stroke="currentColor" strokeWidth="1.7" />
                <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <span>Private session · Scoped to {brandTitle}</span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default LaboratoryLoginPage;
