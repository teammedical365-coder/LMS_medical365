/**
 * Lab Management System (LMS) - Platform Super Admin Login Page
 * 
 * Exclusively authenticates Platform Super Administrators against the Master Database.
 * Laboratory staff & administrators access their facility via dedicated white-label URLs.
 * 
 * Preserves 100% of underlying API contracts, authentication endpoints,
 * and routing logic.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
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
  Eye,
  EyeOff,
  Activity,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { loginSuperAdmin, isLoading: authLoading } = useAuth();

  // Form fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Quick laboratory jump input
  const [labJumpCode, setLabJumpCode] = useState('');

  // UI Feedback States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [errorStatus, setErrorStatus] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);

  const from = location.state?.from?.pathname || '/super-admin';

  // If a laboratory identifier is provided in query params (?lab=, ?code=, ?org=),
  // immediately route to the facility's dedicated white-label portal
  const searchParams = new URLSearchParams(location.search);
  const labParam = searchParams.get('lab') || searchParams.get('code') || searchParams.get('org');

  useEffect(() => {
    if (labParam) {
      navigate(`/lab/${encodeURIComponent(labParam.trim().toLowerCase())}`, { replace: true });
    }
  }, [labParam, navigate]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage(null);
    setErrorStatus(null);
    setInfoMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your administrator email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your administrator password.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await loginSuperAdmin({
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

  const handleLabJumpSubmit = (e) => {
    e.preventDefault();
    if (labJumpCode.trim()) {
      navigate(`/lab/${encodeURIComponent(labJumpCode.trim().toLowerCase())}`);
    }
  };

  return (
    <div className="auth-page-wrapper">
      {/* Top Header Bar */}
      <header className="auth-topbar">
        <div className="auth-brand">
          <div className="auth-logo" aria-hidden="true">
            <Shield size={22} />
          </div>
          <div>
            <div className="auth-brand-name">Medical365 LMS</div>
            <div className="auth-brand-caption">Platform Governance</div>
          </div>
        </div>

        <div className="auth-top-right">
          <ShieldCheck size={16} />
          <span>Super Admin Console</span>
        </div>
      </header>

      {/* Main Split Layout */}
      <main className="auth-main">
        <div className="auth-layout">
          {/* Left Intro Column */}
          <section className="auth-intro">
            <div className="auth-kicker">Platform Administration</div>
            <h1>
              Multi-tenant control. <span>Unified clinical governance.</span>
            </h1>
            <p className="auth-intro-copy">
              Centralized administration console to manage laboratories, audit security compliance, configure master catalogues, and oversee facility lifecycles.
            </p>

            <div className="auth-trust-list">
              <div className="auth-trust-item">
                <div className="auth-trust-icon">
                  <ShieldCheck size={18} />
                </div>
                <span>Master database authentication boundary</span>
              </div>

              <div className="auth-trust-item">
                <div className="auth-trust-icon">
                  <Layers size={18} />
                </div>
                <span>Tamper-evident platform-wide audit logging</span>
              </div>

              <div className="auth-trust-item">
                <div className="auth-trust-icon">
                  <Activity size={18} />
                </div>
                <span>Independent multi-tenant database provisioning</span>
              </div>
            </div>
          </section>

          {/* Right Form Card */}
          <section className="auth-login-card" aria-label="Super admin login form">
            <div className="auth-card-top">
              <div>
                <h2 className="auth-card-title">Super Admin</h2>
                <p className="auth-card-subtitle">Authenticate with master credentials.</p>
              </div>
              <div className="auth-facility-pill" style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}>
                <Shield size={14} />
                <span>MASTER AUTH</span>
              </div>
            </div>

            <div className="auth-rule" />

            <form onSubmit={handleSubmit} noValidate>
              {/* Administrator Email */}
              <div className="auth-field">
                <label htmlFor="admin-email">Email ID</label>
                <div className="auth-inputbox">
                  <Mail size={17} />
                  <input
                    id="admin-email"
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
                <label htmlFor="admin-password">Master Password</label>
                <div className="auth-inputbox">
                  <Lock size={17} />
                  <input
                    id="admin-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter master password"
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
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Remember me only */}
              <div className="auth-row-options">
                <label className="auth-remember">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span>Remember session</span>
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
                    <span>Authenticating Master Session...</span>
                  </>
                ) : (
                  <>
                    <span>Sign in to Master Console</span>
                    <ArrowRight size={17} />
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

            {/* Quick Facility Portal Switcher */}
            <div
              style={{
                marginTop: '22px',
                paddingTop: '16px',
                borderTop: '1px solid #edf1f6',
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={14} style={{ color: 'var(--primary-blue, #2358d5)' }} />
                <span>Laboratory Staff or Clinical User?</span>
              </div>
              <form onSubmit={handleLabJumpSubmit} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Enter Lab Code (e.g. jaipurlab)"
                  value={labJumpCode}
                  onChange={(e) => setLabJumpCode(e.target.value)}
                  style={{
                    flex: 1,
                    height: '36px',
                    padding: '0 10px',
                    fontSize: '12px',
                    border: '1px solid #dce4ef',
                    borderRadius: '8px',
                    background: '#fcfdff',
                    outline: 'none',
                  }}
                />
                <button
                  type="submit"
                  disabled={!labJumpCode.trim()}
                  className="btn btn-secondary"
                  style={{
                    height: '36px',
                    padding: '0 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span>Go to Lab</span>
                  <ArrowRight size={12} />
                </button>
              </form>
            </div>

            {/* Card Footer Security Tag */}
            <div className="auth-card-footer">
              <ShieldCheck size={14} />
              <span>Master Platform Session · Multi-Tenant Governance</span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default LoginPage;
