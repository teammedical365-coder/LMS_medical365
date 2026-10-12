/**
 * Lab Management System (LMS) - Platform Super Admin Laboratories Directory
 * Medical365 Aesthetic: Integrated Registration Form, Filterable Table, Dedicated Portals
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Building2,
  PlusCircle,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Server,
  Layers,
  Copy,
  Sparkles,
  Globe,
  X,
  Check,
  Shield,
  Mail,
  Phone,
  MapPin,
  Lock,
  Palette,
  UserCheck,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import AdminSecurityBoundary from '../../components/common/AdminSecurityBoundary';
import superAdminService from '../../services/superAdminService';

export function LaboratoriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const isRegisterParam = searchParams.get('action') === 'register' || searchParams.get('register') === 'true';

  const [laboratories, setLaboratories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [showRegisterForm, setShowRegisterForm] = useState(isRegisterParam);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [provFilter, setProvFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Registration Form State
  const initialFormState = {
    name: '',
    code: '',
    legalName: '',
    contactEmail: '',
    contactPhone: '',
    domain: '',
    timezone: 'UTC',
    locale: 'en-US',
    subscriptionPlan: 'standard',
    adminFullName: '',
    adminEmail: '',
    adminPassword: '',
    displayName: '',
    primaryColor: '#2563EB',
    accentColor: '#22C1DC',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'India',
    },
  };

  const [regForm, setRegForm] = useState(initialFormState);
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState(null);
  const [regSuccess, setRegSuccess] = useState(null);
  const [regCopied, setRegCopied] = useState(false);

  const copyPortalUrl = (url, labId) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopiedId(labId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchLabs = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await superAdminService.listLaboratories({
        page: currentPage,
        limit: 10,
        q: searchQuery,
        status: statusFilter,
        provisioningStatus: provFilter,
      });
      setLaboratories(result.laboratories || []);
      setPagination(result.pagination || { page: currentPage, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to retrieve laboratories';
      const status = err.response?.status;
      setError({ message: msg, status });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabs();
  }, [currentPage, statusFilter, provFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLabs();
  };

  const handleRegInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('addr_')) {
      const field = name.replace('addr_', '');
      setRegForm((prev) => ({
        ...prev,
        address: { ...prev.address, [field]: value },
      }));
    } else if (name === 'code') {
      setRegForm((prev) => ({
        ...prev,
        code: value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
      }));
    } else {
      setRegForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegLoading(true);
    setRegError(null);
    setRegSuccess(null);

    const payload = {
      name: regForm.name.trim(),
      code: regForm.code.trim(),
      legalName: regForm.legalName.trim() || undefined,
      email: regForm.contactEmail.trim().toLowerCase(),
      contactEmail: regForm.contactEmail.trim().toLowerCase(),
      phone: regForm.contactPhone.trim() || undefined,
      timezone: regForm.timezone,
      locale: regForm.locale,
      subscriptionPlan: regForm.subscriptionPlan,
      address: {
        street: regForm.address.street.trim(),
        city: regForm.address.city.trim(),
        state: regForm.address.state.trim(),
        postalCode: regForm.address.postalCode.trim(),
        country: regForm.address.country.trim() || 'India',
      },
      domains: regForm.domain.trim() ? [regForm.domain.trim().toLowerCase()] : undefined,
      initialAdmin:
        regForm.adminEmail.trim() && regForm.adminPassword
          ? {
              fullName: regForm.adminFullName.trim() || `${regForm.name.trim()} Administrator`,
              email: regForm.adminEmail.trim().toLowerCase(),
              password: regForm.adminPassword,
            }
          : undefined,
      branding: {
        displayName: regForm.displayName.trim() || regForm.name.trim(),
        primaryColor: regForm.primaryColor || '#2563EB',
        accentColor: regForm.accentColor || '#22C1DC',
      },
    };

    try {
      const createdLab = await superAdminService.registerLaboratory(payload);
      setRegSuccess(createdLab);
      setRegForm(initialFormState);
      fetchLabs(); // Automatically refresh list below so new lab appears immediately!
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setRegError('Super Administrator authentication required to register new medical facilities.');
      } else {
        setRegError(err.response?.data?.message || err.message || 'Failed to register laboratory');
      }
    } finally {
      setRegLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>;
      case 'PENDING':
        return <Badge variant="amber">Pending</Badge>;
      case 'SUSPENDED':
        return <Badge variant="purple">Suspended</Badge>;
      case 'INACTIVE':
        return <Badge variant="slate">Inactive</Badge>;
      default:
        return <Badge variant="slate">{status}</Badge>;
    }
  };

  const getProvisioningBadge = (status) => {
    switch (status) {
      case 'READY':
        return <Badge variant="teal">Ready</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="blue">Provisioning</Badge>;
      case 'FAILED':
        return <Badge variant="danger">Failed</Badge>;
      case 'NOT_STARTED':
      default:
        return <Badge variant="slate">Not Started</Badge>;
    }
  };

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <PageHeader
        title="Laboratory Registry & Tenant Provisioning"
        description="Master catalog of healthcare diagnostic facilities, tenant lifecycle states, and dedicated database provisioning."
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={fetchLabs} title="Refresh directory">
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
            <button
              className={`btn ${showRegisterForm ? 'btn-secondary' : 'btn-primary'}`}
              onClick={() => {
                setShowRegisterForm((prev) => !prev);
                setRegSuccess(null);
                setRegError(null);
              }}
            >
              {showRegisterForm ? <X size={15} /> : <PlusCircle size={15} />}
              <span>{showRegisterForm ? 'Close Registration Form' : 'Register New Laboratory'}</span>
            </button>
          </div>
        }
      />

      {/* Embedded Registration Form Section */}
      {showRegisterForm && (
        <div
          className="card"
          style={{
            background: '#ffffff',
            border: '1.5px solid #0284c7',
            borderRadius: 'var(--radius-lg, 12px)',
            boxShadow: '0 8px 24px -4px rgba(2, 132, 199, 0.15)',
            padding: '1.5rem',
            animation: 'modalIn 0.2s ease-out',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <PlusCircle size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Register New Diagnostic Laboratory
                </h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.785rem', color: 'var(--slate-500)' }}>
                  Instantly provision tenant isolation, custom whitelabel login portal, and administrator credentials.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowRegisterForm(false)}
              className="btn-icon"
              style={{ color: 'var(--slate-400)' }}
              title="Close form"
            >
              <X size={18} />
            </button>
          </div>

          {/* Success Banner */}
          {regSuccess && (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: 700, fontSize: '0.9rem' }}>
                <CheckCircle2 size={18} />
                <span>Laboratory "{regSuccess.name}" ({regSuccess.code}) Registered Successfully!</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#15803d' }}>
                Dedicated Whitelabel Portal has been generated and isolated database provisioning initiated.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                <code style={{ fontSize: '0.775rem', background: '#dcfce7', padding: '4px 8px', borderRadius: '4px', color: '#166534' }}>
                  {`${originUrl}/lab/${regSuccess.code.toLowerCase()}`}
                </code>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(`${originUrl}/lab/${regSuccess.code.toLowerCase()}`);
                      setRegCopied(true);
                      setTimeout(() => setRegCopied(false), 2000);
                    }
                  }}
                >
                  {regCopied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                  <span>{regCopied ? 'Copied!' : 'Copy Portal URL'}</span>
                </button>
                <a
                  href={`${originUrl}/lab/${regSuccess.code.toLowerCase()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                >
                  <ExternalLink size={12} />
                  <span>Open Portal</span>
                </a>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {regError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
                color: '#b91c1c',
                fontSize: '0.825rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={16} />
              <span>{regError}</span>
            </div>
          )}

          <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Section 1: Facility Details */}
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--slate-800)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Building2 size={16} style={{ color: '#0284c7' }} />
                <span>1. Facility Information</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Laboratory Name *</label>
                  <input
                    type="text"
                    name="name"
                    className="form-input"
                    placeholder="e.g. Apex Diagnostics Lab"
                    value={regForm.name}
                    onChange={handleRegInputChange}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Unique Lab Code * (Short Prefix)</label>
                  <input
                    type="text"
                    name="code"
                    className="form-input"
                    placeholder="e.g. APEX-01"
                    value={regForm.code}
                    onChange={handleRegInputChange}
                    style={{ textTransform: 'uppercase', fontFamily: 'monospace', fontWeight: 700 }}
                    maxLength={16}
                    required
                  />
                  <span className="form-hint">Used in URLs: /lab/apex-01</span>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Contact Email *</label>
                  <input
                    type="email"
                    name="contactEmail"
                    className="form-input"
                    placeholder="lab@apexdiag.com"
                    value={regForm.contactEmail}
                    onChange={handleRegInputChange}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Contact Phone</label>
                  <input
                    type="tel"
                    name="contactPhone"
                    className="form-input"
                    placeholder="+91 98765 43210"
                    value={regForm.contactPhone}
                    onChange={handleRegInputChange}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Initial Administrator Account */}
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--slate-800)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={16} style={{ color: '#7c3aed' }} />
                <span>2. Laboratory Administrator Account</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Admin Full Name *</label>
                  <input
                    type="text"
                    name="adminFullName"
                    className="form-input"
                    placeholder="Dr. Rajesh Kumar"
                    value={regForm.adminFullName}
                    onChange={handleRegInputChange}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Admin Login Email *</label>
                  <input
                    type="email"
                    name="adminEmail"
                    className="form-input"
                    placeholder="admin@apexdiag.com"
                    value={regForm.adminEmail}
                    onChange={handleRegInputChange}
                    required
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Temporary Password *</label>
                  <input
                    type="password"
                    name="adminPassword"
                    className="form-input"
                    placeholder="••••••••••••"
                    value={regForm.adminPassword}
                    onChange={handleRegInputChange}
                    minLength={8}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Branding & Whitelabel */}
            <div>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--slate-800)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Palette size={16} style={{ color: '#ea580c' }} />
                <span>3. White-Label Branding</span>
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Display Brand Name</label>
                  <input
                    type="text"
                    name="displayName"
                    className="form-input"
                    placeholder="Apex Diagnostics & Imaging"
                    value={regForm.displayName}
                    onChange={handleRegInputChange}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Primary Brand Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      name="primaryColor"
                      value={regForm.primaryColor}
                      onChange={handleRegInputChange}
                      style={{ width: '40px', height: '36px', padding: 0, border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      name="primaryColor"
                      className="form-input"
                      value={regForm.primaryColor}
                      onChange={handleRegInputChange}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Accent Color</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="color"
                      name="accentColor"
                      value={regForm.accentColor}
                      onChange={handleRegInputChange}
                      style={{ width: '40px', height: '36px', padding: 0, border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      name="accentColor"
                      className="form-input"
                      value={regForm.accentColor}
                      onChange={handleRegInputChange}
                      style={{ fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '0.75rem', borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowRegisterForm(false)}
                disabled={regLoading}
              >
                Cancel
              </button>

              <button type="submit" className="btn btn-primary" disabled={regLoading}>
                {regLoading ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Provisioning Laboratory...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Register & Provision Laboratory</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Multi-Tenant Whitelabel Portal Architecture Banner */}
      <div
        style={{
          background: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: 'var(--radius-md, 10px)',
          padding: '0.85rem 1.15rem',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <Sparkles size={20} style={{ color: '#0284c7', flexShrink: 0 }} />
        <div style={{ fontSize: '0.8125rem', color: '#0369a1', lineHeight: 1.45 }}>
          <strong>Multi-Tenant Whitelabel Architecture:</strong> Root login (<code>/login</code>) is exclusively for Platform Super Admins. Each laboratory below has a dedicated, generated whitelabel URL. Share that URL with the Lab Administrator and staff for direct, isolated sign-in.
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '0.85rem 1rem' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ flex: '1 1 260px', position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Search by laboratory name, code, email, or tenant ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.25rem' }}
            />
            <Search
              size={16}
              style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: 'auto', minWidth: '140px' }}
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="SUSPENDED">SUSPENDED</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>

            <select
              className="form-select"
              value={provFilter}
              onChange={(e) => {
                setProvFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: 'auto', minWidth: '150px' }}
            >
              <option value="">All DB States</option>
              <option value="READY">READY</option>
              <option value="IN_PROGRESS">IN_PROGRESS</option>
              <option value="FAILED">FAILED</option>
              <option value="NOT_STARTED">NOT_STARTED</option>
            </select>

            <button type="submit" className="btn btn-primary btn-sm">
              <Filter size={14} />
              <span>Filter</span>
            </button>
          </div>
        </form>
      </div>

      {/* Main Content State */}
      {loading ? (
        <LoadingState message="Querying master multi-tenant registry..." />
      ) : error && (error.status === 401 || error.status === 403) ? (
        <AdminSecurityBoundary errorDetails={error.message} />
      ) : error ? (
        <ErrorState title="Registry Query Failed" message={error.message} onRetry={fetchLabs} />
      ) : laboratories.length === 0 ? (
        <div className="card">
          <EmptyState
            title="No Laboratories Found"
            message={
              searchQuery || statusFilter || provFilter
                ? 'No registered laboratories matched your filter criteria. Try adjusting your query parameters.'
                : 'No diagnostic laboratories have been onboarded to this multi-tenant platform yet.'
            }
            action={
              <button onClick={() => setShowRegisterForm(true)} className="btn btn-primary">
                <PlusCircle size={15} />
                <span>Onboard First Laboratory</span>
              </button>
            }
          />
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Laboratory & Code</th>
                  <th>Lab Administrator</th>
                  <th>Staff Team</th>
                  <th>Tenant Identifier</th>
                  <th>Portal Login URL</th>
                  <th>Contact Info</th>
                  <th>Status</th>
                  <th>Database State</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {laboratories.map((lab) => {
                  const provStatus = lab.database?.provisioningStatus || lab.provisioningStatus || 'NOT_STARTED';
                  const primaryDomain = lab.domainMappings?.find((d) => d.isPrimary)?.domain || lab.domainMappings?.[0]?.domain;
                  const portalUrl = `${originUrl}/lab/${lab.code.toLowerCase()}`;

                  return (
                    <tr key={lab.tenantId || lab._id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{lab.name}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                            <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--primary-700)', background: 'var(--primary-50)', padding: '1px 6px', borderRadius: '4px' }}>
                              {lab.code}
                            </span>
                            {primaryDomain && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
                                ({primaryDomain})
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td>
                        {lab.adminUser ? (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--slate-900)', fontSize: '0.8125rem' }}>
                              {lab.adminUser.fullName}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
                              {lab.adminUser.email}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>—</span>
                        )}
                      </td>

                      <td>
                        <Badge variant="blue">
                          {(lab.staffCount ?? lab.staff?.length ?? 0)} Staff
                        </Badge>
                      </td>

                      <td>
                        <code style={{ fontSize: '0.75rem', color: 'var(--slate-600)', background: 'var(--slate-100)', padding: '2px 6px', borderRadius: '4px' }}>
                          {lab.tenantId}
                        </code>
                      </td>

                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <a
                            href={`/lab/${lab.code.toLowerCase()}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              color: 'var(--primary-700)',
                              background: 'var(--primary-50)',
                              border: '1px solid var(--primary-200)',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 600,
                            }}
                            title="Open Laboratory Login Portal in new tab"
                          >
                            <span>/lab/{lab.code.toLowerCase()}</span>
                            <ExternalLink size={11} />
                          </a>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '2px 8px', fontSize: '0.72rem', height: '24px' }}
                            onClick={() => copyPortalUrl(portalUrl, lab.tenantId || lab._id)}
                            title="Copy Login Portal URL"
                          >
                            {copiedId === (lab.tenantId || lab._id) ? (
                              <span style={{ color: '#059669', fontWeight: 600 }}>Copied!</span>
                            ) : (
                              <>
                                <Copy size={11} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>

                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8125rem' }}>
                          <span style={{ color: 'var(--slate-700)' }}>{lab.contactEmail || lab.email}</span>
                          {(lab.contactPhone || lab.phone) && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>{lab.contactPhone || lab.phone}</span>
                          )}
                        </div>
                      </td>

                      <td>{getStatusBadge(lab.status)}</td>

                      <td>{getProvisioningBadge(provStatus)}</td>

                      <td style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                        {new Date(lab.createdAt).toLocaleDateString()}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <Link
                          to={`/super-admin/laboratories/${lab.tenantId || lab._id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ gap: '4px' }}
                        >
                          <span>Manage</span>
                          <ExternalLink size={12} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.875rem 1.25rem',
                borderTop: '1px solid var(--border-subtle)',
                background: '#f8fafc',
                fontSize: '0.8125rem',
              }}
            >
              <span style={{ color: 'var(--slate-600)' }}>
                Showing page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} laboratories)
              </span>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default LaboratoriesPage;
