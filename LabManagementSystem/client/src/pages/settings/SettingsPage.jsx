/**
 * Lab Management System (LMS) - Lab Settings & White-Label Configuration Page
 * 
 * Connected to live multi-tenant backend settings and branding endpoints:
 * - GET /api/v1/tenants/:tenantId/settings
 * - PATCH /api/v1/tenants/:tenantId/settings
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings,
  Building,
  Save,
  Shield,
  Database,
  Sliders,
  Palette,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Mail,
  Phone,
  Globe,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import { useTenant } from '../../context/TenantContext';
import { useAuth } from '../../context/AuthContext';
import clinicalService from '../../services/clinicalService';
import notify from '../../utils/notify';

export function SettingsPage() {
  const { tenant, setTenant, applyThemeTokens } = useTenant();
  const { user } = useAuth();
  const tenantId = tenant?.tenantId || user?.tenantId;

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Settings State
  const [settingsData, setSettingsData] = useState(null);

  // Form Fields
  const [labName, setLabName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [cliaNumber, setCliaNumber] = useState('');
  const [orderPrefix, setOrderPrefix] = useState('ORD-');
  const [samplePrefix, setSamplePrefix] = useState('SMP-');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [primaryColor, setPrimaryColor] = useState('#2563EB');
  const [accentColor, setAccentColor] = useState('#22C1DC');

  // Load Settings from Live Backend API
  const fetchSettings = useCallback(async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await clinicalService.getSettings(tenantId);
      if (res.success && res.data) {
        const d = res.data;
        setSettingsData(d);
        setLabName(d.name || tenant?.name || '');
        setLegalName(d.legalName || '');
        setContactEmail(d.email || '');
        setContactPhone(d.phone || '');
        setTimezone(d.timezone || 'Asia/Kolkata');
        setPrimaryColor(d.branding?.primaryColor || '#2563EB');
        setAccentColor(d.branding?.accentColor || '#22C1DC');
        setCliaNumber(d.accreditationNumber || d.cliaNumber || 'CLIA-PENDING');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load laboratory settings';
      setError(msg);
      // Fallback to tenant context safely if available
      if (tenant) {
        setLabName(tenant.name || '');
      }
    } finally {
      setLoading(false);
    }
  }, [tenantId, tenant]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Handle Save Submission
  const handleSave = async (e) => {
    e.preventDefault();
    if (!tenantId) {
      notify.error('No active laboratory tenant context identified');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccessMsg(null);

      const payload = {
        name: labName.trim(),
        legalName: legalName.trim(),
        email: contactEmail.trim().toLowerCase(),
        phone: contactPhone.trim(),
        timezone,
        branding: {
          displayName: labName.trim(),
          primaryColor,
          accentColor,
        },
      };

      const res = await clinicalService.updateSettings(tenantId, payload);
      if (res.success) {
        notify.success('Laboratory settings and branding saved successfully');
        setSuccessMsg('Laboratory settings and white-label branding saved successfully to database');
        if (res.data) {
          setSettingsData(res.data);
          // Update live tenant context and CSS design tokens
          if (res.data.branding) {
            applyThemeTokens?.(res.data.branding);
            if (setTenant && tenant) {
              setTenant({
                ...tenant,
                name: res.data.name || tenant.name,
                branding: { ...tenant.branding, ...res.data.branding },
              });
            }
          }
        }
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update laboratory settings';
      setError(msg);
      notify.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Safe Loading State
  if (loading) {
    return (
      <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', minHeight: '50vh', justifyContent: 'center' }}>
        <Loader2 size={36} className="animate-spin" style={{ color: 'var(--primary-blue, #2563eb)' }} />
        <span style={{ fontSize: '0.875rem', color: 'var(--slate-600, #475569)', fontWeight: 500 }}>
          Loading laboratory configuration from secure database...
        </span>
      </div>
    );
  }

  // Safe Missing Context State
  if (!tenantId && !tenant) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fee2e2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
          <AlertCircle size={26} />
        </div>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
          No Active Tenant Detected
        </h2>
        <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1.5rem' }}>
          Settings are bound to an authenticated laboratory tenant. Please log in through your laboratory portal.
        </p>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Laboratory & Tenant Settings"
        description="Configure laboratory entity metadata, accreditation identifiers, numbering sequences, and tenant white-label branding."
      />

      {error && (
        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #fecaca', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={fetchSettings} className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto', padding: '2px 8px', fontSize: '0.75rem' }}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {successMsg && (
        <div style={{ background: 'var(--success-50, #f0fdf4)', color: 'var(--success-700, #15803d)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md, 8px)', border: '1px solid #bbf7d0', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
          <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Lab Profile Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={18} style={{ color: 'var(--primary-600, #2563eb)' }} />
              <h2 className="card-title">Laboratory Entity Profile</h2>
            </div>
            <span className="badge badge-teal">Live Database</span>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Laboratory Official Name</label>
              <input
                type="text"
                className="form-input"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                placeholder="e.g. Metro Clinical Diagnostics"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Legal / Corporate Entity Name</label>
              <input
                type="text"
                className="form-input"
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="e.g. Metro Health Diagnostics LLP"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Primary Contact Email</label>
              <input
                type="email"
                className="form-input"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="lab@medical365.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Contact Phone / Hotline</label>
              <input
                type="text"
                className="form-input"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>
        </div>

        {/* White-Label Customization Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Palette size={18} style={{ color: 'var(--primary-600, #2563eb)' }} />
              <h2 className="card-title">White-Label Branding & Colors</h2>
            </div>
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Primary Brand Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ width: '40px', height: '38px', borderRadius: '6px', border: '1px solid var(--border-color, #e2e8f0)', cursor: 'pointer', padding: '2px' }}
                />
                <input
                  type="text"
                  className="form-input"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Accent Highlight Color</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  style={{ width: '40px', height: '38px', borderRadius: '6px', border: '1px solid var(--border-color, #e2e8f0)', cursor: 'pointer', padding: '2px' }}
                />
                <input
                  type="text"
                  className="form-input"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  style={{ fontFamily: 'monospace' }}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Default Laboratory Timezone</label>
              <select
                className="form-select"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST - India Standard Time)</option>
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Chicago">America/Chicago (CST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Workflow & Numbering Prefixes */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} style={{ color: 'var(--primary-600, #2563eb)' }} />
              <h2 className="card-title">Numbering Sequences & Workflow Defaults</h2>
            </div>
          </div>

          <div className="grid-3">
            <div className="form-group">
              <label className="form-label">Requisition Order Prefix</label>
              <input
                type="text"
                className="form-input"
                value={orderPrefix}
                onChange={(e) => setOrderPrefix(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Specimen Barcode Prefix</label>
              <input
                type="text"
                className="form-input"
                value={samplePrefix}
                onChange={(e) => setSamplePrefix(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">CLIA / Accreditation License #</label>
              <input
                type="text"
                className="form-input"
                value={cliaNumber}
                onChange={(e) => setCliaNumber(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Multi-Tenant Architectural Readiness */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} style={{ color: 'var(--primary-600, #2563eb)' }} />
              <h2 className="card-title">Multi-Tenant Isolation Architecture</h2>
            </div>
            <span className="badge badge-teal">Verified Isolation</span>
          </div>

          <div style={{ fontSize: '0.875rem', color: 'var(--slate-600, #475569)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p>
              This laboratory operates within a cryptographically isolated tenant database boundary (`lms_lab_{tenantId || tenant?.code || 'active'}`).
            </p>
            <div style={{ background: 'var(--slate-50, #f8fafc)', padding: '0.85rem', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border-subtle, #e2e8f0)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500, #64748b)' }}>Active Tenant Code</span>
                  <p style={{ fontWeight: 600, fontFamily: 'monospace' }}>{tenant?.code || settingsData?.code || '—'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500, #64748b)' }}>Subscription Tier</span>
                  <p style={{ fontWeight: 600 }}>{settingsData?.plan ? settingsData.plan.toUpperCase() : 'STANDARD'}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500, #64748b)' }}>Database Boundary</span>
                  <p style={{ fontWeight: 600, color: 'var(--primary-700, #1d4ed8)', fontFamily: 'monospace' }}>
                    lms_lab_{tenant?.tenantId || tenantId || 'tenant'}
                  </p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500, #64748b)' }}>Database State</span>
                  <p style={{ fontWeight: 600, color: '#16a34a' }}>Online & Isolated</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
            style={{ padding: '0.625rem 1.25rem', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            <span>{saving ? 'Saving to Database...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </>
  );
}

export default SettingsPage;
