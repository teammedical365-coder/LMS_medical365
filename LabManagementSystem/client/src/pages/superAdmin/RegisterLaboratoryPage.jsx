/**
 * Lab Management System (LMS) - Laboratory Registration & Onboarding
 * Medical365 Aesthetic: White rounded cards, light borders, crisp form layout, server-enforced security
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Building2,
  Shield,
  Database,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Mail,
  Phone,
  MapPin,
  Clock,
  Sparkles,
  UserCheck,
  Palette,
  Lock,
  Copy,
  ExternalLink,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import superAdminService from '../../services/superAdminService';

export function RegisterLaboratoryPage() {
  const navigate = useNavigate();
  const [copiedPortal, setCopiedPortal] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    legalName: '',
    contactEmail: '',
    contactPhone: '',
    domain: '',
    timezone: 'UTC',
    locale: 'en-US',
    subscriptionPlan: 'standard',
    // Initial Laboratory Administrator
    adminFullName: '',
    adminEmail: '',
    adminPassword: '',
    // White-Label Branding
    displayName: '',
    primaryColor: '#2563EB',
    accentColor: '#22C1DC',
    logoUrl: '',
    faviconUrl: '',
    loginBannerText: '',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'United States',
    },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('addr_')) {
      const field = name.replace('addr_', '');
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, [field]: value },
      }));
    } else if (name === 'code') {
      // Auto-uppercase alphanumeric and hyphens
      setFormData((prev) => ({
        ...prev,
        code: value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.com$/i;
    if (!formData.contactEmail?.trim() || !emailRegex.test(formData.contactEmail.trim())) {
      setError('Laboratory contact email must be a valid email ending with .com (e.g. contact@labdomain.com)');
      setLoading(false);
      return;
    }

    if (formData.adminEmail?.trim() && !emailRegex.test(formData.adminEmail.trim())) {
      setError('Initial administrator email must be a valid email ending with .com (e.g. admin@labdomain.com)');
      setLoading(false);
      return;
    }

    // Prepare payload
    const payload = {
      name: formData.name.trim(),
      code: formData.code.trim(),
      legalName: formData.legalName.trim() || undefined,
      email: formData.contactEmail.trim().toLowerCase(),
      contactEmail: formData.contactEmail.trim().toLowerCase(),
      phone: formData.contactPhone.trim() || undefined,
      timezone: formData.timezone,
      locale: formData.locale,
      subscriptionPlan: formData.subscriptionPlan,
      address: {
        street: formData.address.street.trim(),
        city: formData.address.city.trim(),
        state: formData.address.state.trim(),
        postalCode: formData.address.postalCode.trim(),
        country: formData.address.country.trim(),
      },
      domains: formData.domain.trim()
        ? [formData.domain.trim().toLowerCase()]
        : undefined,
      initialAdmin: formData.adminEmail.trim() && formData.adminPassword
        ? {
            fullName: formData.adminFullName.trim() || `${formData.name.trim()} Administrator`,
            email: formData.adminEmail.trim().toLowerCase(),
            password: formData.adminPassword,
          }
        : undefined,
      branding: {
        displayName: formData.displayName.trim() || formData.name.trim(),
        primaryColor: formData.primaryColor || '#2563EB',
        accentColor: formData.accentColor || '#22C1DC',
        logoUrl: formData.logoUrl.trim() || undefined,
        faviconUrl: formData.faviconUrl.trim() || undefined,
        loginBannerText: formData.loginBannerText.trim() || undefined,
      },
    };

    try {
      const createdLab = await superAdminService.registerLaboratory(payload);
      setSuccess(createdLab);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Super Administrator authentication required. Direct laboratory creation without an authenticated administrator session is prohibited on this platform.');
      } else {
        setError(
          err.response?.data?.message ||
            err.message ||
            'Failed to register laboratory. Check if code or domain is already registered.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Register Diagnostic Laboratory"
        description="Onboard an independent clinical laboratory to the multi-tenant SaaS platform with server-provisioned isolated logical database."
        actions={
          <Link to="/super-admin/laboratories" className="btn btn-secondary">
            <ArrowLeft size={16} />
            <span>Back to Laboratories</span>
          </Link>
        }
      />

      {/* Security Architecture Callout */}
      <StatusBanner
        type="info"
        badgeText="Multi-Tenant Security Architecture"
        message="Internal Tenant IDs (ten_...) and isolated tenant logical database names (lms_lab_...) are cryptographically server-generated upon registration. The browser cannot specify custom database names or cross-tenant boundaries."
      />

      {error && (
        <div style={{ marginBottom: '1.25rem' }}>
          <StatusBanner
            type="warning"
            badgeText="Registration Error"
            message={error}
          />
        </div>
      )}

      {success ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.5rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem auto',
            }}
          >
            <CheckCircle2 size={32} />
          </div>

          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--slate-900)' }}>
            Laboratory Onboarded Successfully
          </h2>
          <p style={{ color: 'var(--slate-600)', maxWidth: '520px', margin: '0.5rem auto 1.5rem auto', fontSize: '0.875rem' }}>
            Laboratory <strong>{success.name}</strong> has been registered with initial status{' '}
            <span className="badge badge-warning">PENDING</span> and its dedicated logical database has been prepared.
          </p>

          <div
            style={{
              background: '#f8fafc',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              maxWidth: '480px',
              margin: '0 auto 2rem auto',
              padding: '1rem',
              textAlign: 'left',
              fontSize: '0.8125rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--slate-500)' }}>Internal Tenant ID:</span>
              <code style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{success.tenantId}</code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--slate-500)' }}>Laboratory Code:</span>
              <code style={{ fontWeight: 600, color: 'var(--primary-700)' }}>{success.code}</code>
            </div>
            {formData.adminEmail && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: 'var(--slate-500)' }}>Initial Administrator:</span>
                <code style={{ fontWeight: 600, color: '#059669' }}>{formData.adminEmail}</code>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ color: 'var(--slate-500)' }}>Provisioning Status:</span>
              <span className="badge badge-teal">
                {success.database?.provisioningStatus || 'READY'}
              </span>
            </div>

            {/* Generated Whitelabel Portal URL */}
            <div
              style={{
                marginTop: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e40af', marginBottom: '6px' }}>
                Dedicated Whitelabel Portal URL (Staff & Admin):
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="text"
                  readOnly
                  value={`${window.location.origin}/lab/${(success.code || success.tenantId).toLowerCase()}`}
                  className="form-input"
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '0.8125rem',
                    background: 'white',
                    color: 'var(--primary-800)',
                    fontWeight: 600,
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(`${window.location.origin}/lab/${(success.code || success.tenantId).toLowerCase()}`);
                    }
                    setCopiedPortal(true);
                    setTimeout(() => setCopiedPortal(false), 2000);
                  }}
                  title="Copy URL"
                >
                  {copiedPortal ? (
                    <span style={{ color: '#059669', fontWeight: 600 }}>Copied!</span>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <a
                  href={`/lab/${(success.code || success.tenantId).toLowerCase()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                  title="Open in new tab"
                >
                  <span>Open</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <Link to={`/super-admin/laboratories/${success.tenantId}`} className="btn btn-primary">
              <span>View Laboratory Details & Activate</span>
            </Link>
            <Link to="/super-admin/laboratories" className="btn btn-secondary">
              <span>Return to Directory</span>
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
            {/* Core Identity */}
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={18} style={{ color: 'var(--primary-600)' }} />
                  <h2 className="card-title">Laboratory Identity</h2>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="name">
                  Laboratory Name <span style={{ color: 'var(--danger-500)' }}>*</span>
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. Apex Reference Laboratories"
                  value={formData.name}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="code">
                  Unique Laboratory Code <span style={{ color: 'var(--danger-500)' }}>*</span>
                </label>
                <input
                  id="code"
                  name="code"
                  type="text"
                  className="form-input"
                  required
                  maxLength={30}
                  placeholder="e.g. APEX-01"
                  value={formData.code}
                  onChange={handleInputChange}
                  style={{ textTransform: 'uppercase', fontFamily: 'monospace' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                  Alphanumeric & hyphens. Permanent identifier for reports, sample tubes, and billing.
                </span>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="legalName">
                    Legal / Registered Entity Name
                  </label>
                  <input
                    id="legalName"
                    name="legalName"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Apex Diagnostics Group LLC"
                    value={formData.legalName}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="timezone">
                    Time Zone
                  </label>
                  <select
                    id="timezone"
                    name="timezone"
                    className="form-select"
                    value={formData.timezone}
                    onChange={handleInputChange}
                  >
                    <option value="UTC">UTC (Universal)</option>
                    <option value="America/New_York">Eastern Time (US)</option>
                    <option value="America/Chicago">Central Time (US)</option>
                    <option value="America/Los_Angeles">Pacific Time (US)</option>
                    <option value="Europe/London">London (GMT/BST)</option>
                    <option value="Asia/Kolkata">India Standard Time (IST)</option>
                    <option value="Asia/Dubai">Gulf Standard Time (GST)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contact & Domain Verification */}
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={18} style={{ color: 'var(--primary-600)' }} />
                  <h2 className="card-title">Contact & Hostname Resolution</h2>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="contactEmail">
                  Primary Contact / Admin Email <span style={{ color: 'var(--danger-500)' }}>*</span>
                </label>
                <input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  className="form-input"
                  required
                  placeholder="director@apexlabs.com"
                  value={formData.contactEmail}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="contactPhone">
                  Primary Contact Phone
                </label>
                <input
                  id="contactPhone"
                  name="contactPhone"
                  type="tel"
                  className="form-input"
                  placeholder="+1 (555) 234-5678"
                  value={formData.contactPhone}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="domain">
                  Primary Hostname / Custom Domain
                </label>
                <input
                  id="domain"
                  name="domain"
                  type="text"
                  className="form-input"
                  placeholder="apex.lab.medical365.local"
                  value={formData.domain}
                  onChange={handleInputChange}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                  Used for incoming hostname tenant resolution (must be normalized and verified).
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="locale">
                  Reporting Locale
                </label>
                <input
                  id="locale"
                  name="locale"
                  type="text"
                  className="form-input"
                  placeholder="en-US"
                  value={formData.locale}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Initial Lab Administrator */}
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserCheck size={18} style={{ color: 'var(--primary-600)' }} />
                  <h2 className="card-title">Initial Lab Administrator</h2>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="adminFullName">
                  Administrator Full Name
                </label>
                <input
                  id="adminFullName"
                  name="adminFullName"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Dr. Julian Vance, MD"
                  value={formData.adminFullName}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="adminEmail">
                  Administrator Login Email <span style={{ color: 'var(--danger-500)' }}>*</span>
                </label>
                <input
                  id="adminEmail"
                  name="adminEmail"
                  type="email"
                  className="form-input"
                  required
                  placeholder="admin@apexlabs.com"
                  value={formData.adminEmail}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="adminPassword">
                  Initial Secure Password <span style={{ color: 'var(--danger-500)' }}>*</span>
                </label>
                <input
                  id="adminPassword"
                  name="adminPassword"
                  type="password"
                  className="form-input"
                  required
                  placeholder="Min 8 chars, 1 uppercase, 1 symbol"
                  value={formData.adminPassword}
                  onChange={handleInputChange}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                  Created as the founding <code>lab_admin</code> upon tenant database provisioning.
                </span>
              </div>
            </div>

            {/* White-Label Branding Configuration */}
            <div className="card">
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Palette size={18} style={{ color: 'var(--primary-600)' }} />
                  <h2 className="card-title">White-Label Branding & Identity</h2>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="displayName">
                  Laboratory Display Name
                </label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Apex Diagnostics Network"
                  value={formData.displayName}
                  onChange={handleInputChange}
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="primaryColor">
                    Primary Brand Color
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      id="primaryColor"
                      name="primaryColor"
                      type="color"
                      value={formData.primaryColor}
                      onChange={handleInputChange}
                      style={{ width: '42px', height: '38px', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: 0 }}
                    />
                    <input
                      type="text"
                      name="primaryColor"
                      className="form-input"
                      value={formData.primaryColor}
                      onChange={handleInputChange}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="accentColor">
                    Accent Color
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      id="accentColor"
                      name="accentColor"
                      type="color"
                      value={formData.accentColor}
                      onChange={handleInputChange}
                      style={{ width: '42px', height: '38px', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: 0 }}
                    />
                    <input
                      type="text"
                      name="accentColor"
                      className="form-input"
                      value={formData.accentColor}
                      onChange={handleInputChange}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="logoUrl">
                  Logo Image URL
                </label>
                <input
                  id="logoUrl"
                  name="logoUrl"
                  type="url"
                  className="form-input"
                  placeholder="https://cdn.apexlabs.com/logo.svg"
                  value={formData.logoUrl}
                  onChange={handleInputChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="loginBannerText">
                  Login Page Welcome Banner
                </label>
                <input
                  id="loginBannerText"
                  name="loginBannerText"
                  type="text"
                  className="form-input"
                  placeholder="Welcome to Apex Diagnostic Portal"
                  value={formData.loginBannerText}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {/* Physical Facility Address */}
            <div className="card" style={{ gridColumn: '1 / -1' }}>
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={18} style={{ color: 'var(--primary-600)' }} />
                  <h2 className="card-title">Laboratory Facility Address</h2>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="addr_street">
                  Street Address
                </label>
                <input
                  id="addr_street"
                  name="addr_street"
                  type="text"
                  className="form-input"
                  placeholder="400 Clinical Parkway, Suite 300"
                  value={formData.address.street}
                  onChange={handleInputChange}
                />
              </div>

              <div className="grid-4">
                <div className="form-group">
                  <label className="form-label" htmlFor="addr_city">
                    City
                  </label>
                  <input
                    id="addr_city"
                    name="addr_city"
                    type="text"
                    className="form-input"
                    placeholder="New York"
                    value={formData.address.city}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="addr_state">
                    State / Province
                  </label>
                  <input
                    id="addr_state"
                    name="addr_state"
                    type="text"
                    className="form-input"
                    placeholder="NY"
                    value={formData.address.state}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="addr_postalCode">
                    Postal Code
                  </label>
                  <input
                    id="addr_postalCode"
                    name="addr_postalCode"
                    type="text"
                    className="form-input"
                    placeholder="10001"
                    value={formData.address.postalCode}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="addr_country">
                    Country
                  </label>
                  <input
                    id="addr_country"
                    name="addr_country"
                    type="text"
                    className="form-input"
                    value={formData.address.country}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <Link to="/super-admin/laboratories" className="btn btn-secondary">
                  Cancel
                </Link>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? (
                    <span>Provisioning Logical Tenant...</span>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Register Laboratory & Prepare Database</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </>
  );
}

export default RegisterLaboratoryPage;
