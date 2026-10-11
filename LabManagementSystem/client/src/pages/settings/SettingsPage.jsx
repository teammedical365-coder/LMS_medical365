/**
 * Lab Management System (LMS) - Lab Settings Page (Phase 1 UI Shell)
 */

import React, { useState } from 'react';
import { Settings, Building, Save, Shield, Database, Sliders } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import { useTenant } from '../../context/TenantContext';

export function SettingsPage() {
  const { tenant } = useTenant();
  const [labName, setLabName] = useState(tenant.name);
  const [cliaNumber, setCliaNumber] = useState('99D102948');
  const [orderPrefix, setOrderPrefix] = useState('ORD-');
  const [samplePrefix, setSamplePrefix] = useState('SMP-');
  const [timezone, setTimezone] = useState('UTC+00:00');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <>
      <PageHeader
        title="Laboratory & Tenant Settings"
        description="Configure laboratory entity metadata, accreditation identifiers, numbering sequences, and tenant white-label branding."
      />

      <StatusBanner
        type="info"
        badgeText="UI Shell Demonstration"
        message="Laboratory settings modified below are saved to local demonstration state. Live multi-tenant database configuration storage will be connected in Phase 2."
      />

      {savedSuccess && (
        <div style={{ background: 'var(--success-50)', color: 'var(--success-700)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #bbf7d0', fontSize: '0.875rem' }}>
          ✅ Demonstration settings saved successfully to local state!
        </div>
      )}

      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Lab Profile Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={18} style={{ color: 'var(--primary-600)' }} />
              <h2 className="card-title">Laboratory Entity Profile</h2>
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Laboratory Official Name</label>
              <input
                type="text"
                className="form-input"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">CLIA / Accreditation License #</label>
              <input
                type="text"
                className="form-input"
                value={cliaNumber}
                onChange={(e) => setCliaNumber(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Workflow & Numbering Prefixes */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sliders size={18} style={{ color: 'var(--primary-600)' }} />
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
              <label className="form-label">Default Laboratory Timezone</label>
              <select
                className="form-select"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                <option value="UTC+00:00">UTC+00:00 (Universal Time)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="America/Chicago">America/Chicago (CST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Multi-Tenant Architectural Readiness */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} style={{ color: 'var(--primary-600)' }} />
              <h2 className="card-title">Multi-Tenant Isolation Architecture (Phase 1 Status)</h2>
            </div>
            <span className="badge badge-teal">Prepared Boundary</span>
          </div>

          <div style={{ fontSize: '0.875rem', color: 'var(--slate-600)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p>
              The system architecture is structured for multi-tenant deployment across sovereign medical laboratories.
            </p>
            <div style={{ background: 'var(--slate-50)', padding: '0.85rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Active Tenant Code</span>
                  <p style={{ fontWeight: 600, fontFamily: 'monospace' }}>{tenant.code}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Tenant Model</span>
                  <p style={{ fontWeight: 600 }}>{tenant.type}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Database Boundary</span>
                  <p style={{ fontWeight: 600, color: 'var(--primary-700)' }}>Isolated DB Strategy Prepared</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Database State</span>
                  <p style={{ fontWeight: 600, color: 'var(--warning-700)' }}>Offline (Phase 1 Foundation)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.625rem 1.25rem' }}>
            <Save size={16} />
            <span>Save Configuration (Demo)</span>
          </button>
        </div>
      </form>
    </>
  );
}

export default SettingsPage;
