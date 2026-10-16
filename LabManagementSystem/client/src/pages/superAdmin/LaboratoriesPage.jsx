/**
 * Lab Management System (LMS) - Platform Super Admin Laboratories Directory
 * Medical365 Aesthetic: Integrated Registration Form, Filterable Table, Dedicated Portals
 */

import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Building2,
  PlusCircle,
  UserPlus,
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
  Eye,
  EyeOff,
  Trash2,
  User,
} from 'lucide-react';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import AdminSecurityBoundary from '../../components/common/AdminSecurityBoundary';
import superAdminService from '../../services/superAdminService';
import notify from '../../utils/notify';

export function LaboratoriesPage() {
  const [searchParams] = useSearchParams();
  const isRegisterParam = searchParams.get('action') === 'register' || searchParams.get('register') === 'true';

  const [laboratories, setLaboratories] = useState([]);
  const [allLabsForDropdown, setAllLabsForDropdown] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Active dedicated form: null | 'laboratory' | 'admin'
  const [activeForm, setActiveForm] = useState(isRegisterParam ? 'laboratory' : null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [provFilter, setProvFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Dedicated Laboratory Registration Form State
  const initialLabFormState = {
    name: '',
    code: '',
    legalName: '',
    contactEmail: '',
    contactPhone: '',
    domain: '',
    timezone: 'Asia/Kolkata',
    locale: 'en-IN',
    subscriptionPlan: 'standard',
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

  const [labForm, setLabForm] = useState(initialLabFormState);
  const [labErrors, setLabErrors] = useState({});
  const [labLoading, setLabLoading] = useState(false);
  const [labError, setLabError] = useState(null);
  const [labSuccess, setLabSuccess] = useState(null);
  const [createdLabSuccessModal, setCreatedLabSuccessModal] = useState(null);
  const [labCopied, setLabCopied] = useState(false);

  // Dedicated Lab Admin Form State
  const initialAdminFormState = {
    laboratoryId: '',
    fullName: '',
    age: '',
    email: '',
    password: '',
    phone: '',
    department: 'Administration',
  };

  const [adminForm, setAdminForm] = useState(initialAdminFormState);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [adminErrors, setAdminErrors] = useState({});
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState(null);
  const [adminSuccess, setAdminSuccess] = useState(null);
  const [adminCopied, setAdminCopied] = useState(false);

  // Validation Helpers
  const validateEmailCom = (email) => {
    if (!email || !email.trim()) return 'Email is required';
    const trimmed = email.trim();
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.com$/i;
    if (!emailRegex.test(trimmed)) {
      return 'Email must be valid and end with .com (e.g. name@domain.com)';
    }
    return '';
  };

  const validateMobile10 = (phone) => {
    if (!phone || !phone.trim()) return 'Mobile number is required';
    const clean = phone.replace(/\D/g, '');
    if (clean.length !== 10) {
      return 'Mobile number must be exactly 10 digits';
    }
    return '';
  };

  const validateAge2Digit = (age) => {
    if (!age || String(age).trim() === '') return 'Age is required';
    const clean = String(age).replace(/\D/g, '');
    if (clean.length !== 2) {
      return 'Age must be a 2-digit number (e.g. 28)';
    }
    const num = parseInt(clean, 10);
    if (num < 18 || num > 99) {
      return 'Age must be between 18 and 99';
    }
    return '';
  };

  const validatePassword = (pass) => {
    if (!pass) return 'Password is required';
    if (pass.length < 8) return 'Password must be at least 8 characters';
    return '';
  };

  const copyPortalUrl = (url, labId) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopiedId(labId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchAllLabsForDropdown = async () => {
    try {
      const result = await superAdminService.listLaboratories({ page: 1, limit: 100 });
      if (result && result.laboratories) {
        setAllLabsForDropdown(result.laboratories);
      }
    } catch {
      // Fallback silently
    }
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
    fetchAllLabsForDropdown();
  }, []);

  useEffect(() => {
    fetchLabs();
  }, [currentPage, statusFilter, provFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchLabs();
  };

  // Lab Registration Input Change Handler
  const handleLabInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('addr_')) {
      const field = name.replace('addr_', '');
      setLabForm((prev) => ({
        ...prev,
        address: { ...prev.address, [field]: value },
      }));
      if (labErrors[name]) setLabErrors((prev) => ({ ...prev, [name]: '' }));
    } else if (name === 'code') {
      setLabForm((prev) => ({
        ...prev,
        code: value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''),
      }));
      if (labErrors.code) setLabErrors((prev) => ({ ...prev, code: '' }));
    } else if (name === 'contactPhone') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
      setLabForm((prev) => ({ ...prev, contactPhone: digitsOnly }));
      if (labErrors.contactPhone) setLabErrors((prev) => ({ ...prev, contactPhone: '' }));
    } else {
      setLabForm((prev) => ({ ...prev, [name]: value }));
      if (labErrors[name]) setLabErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Lab Registration Submission
  const handleLabRegisterSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!labForm.name.trim()) errors.name = 'Laboratory name is required';
    if (!labForm.code.trim()) errors.code = 'Lab code is required';
    const emailErr = validateEmailCom(labForm.contactEmail);
    if (emailErr) errors.contactEmail = emailErr;
    const phoneErr = validateMobile10(labForm.contactPhone);
    if (phoneErr) errors.contactPhone = phoneErr;
    if (!labForm.address.city.trim()) errors.addr_city = 'City is required';
    if (!labForm.address.state.trim()) errors.addr_state = 'State is required';

    if (Object.keys(errors).length > 0) {
      setLabErrors(errors);
      return;
    }
    setLabErrors({});
    setLabLoading(true);
    setLabError(null);
    setLabSuccess(null);

    const payload = {
      name: labForm.name.trim(),
      code: labForm.code.trim(),
      legalName: labForm.legalName.trim() || undefined,
      email: labForm.contactEmail.trim().toLowerCase(),
      contactEmail: labForm.contactEmail.trim().toLowerCase(),
      phone: labForm.contactPhone.trim() || undefined,
      timezone: labForm.timezone,
      locale: labForm.locale,
      subscriptionPlan: labForm.subscriptionPlan,
      address: {
        street: labForm.address.street.trim(),
        city: labForm.address.city.trim(),
        state: labForm.address.state.trim(),
        postalCode: labForm.address.postalCode.trim(),
        country: labForm.address.country.trim() || 'India',
      },
      domains: labForm.domain.trim() ? [labForm.domain.trim().toLowerCase()] : undefined,
      branding: {
        displayName: labForm.displayName.trim() || labForm.name.trim(),
        primaryColor: labForm.primaryColor || '#2563EB',
        accentColor: labForm.accentColor || '#22C1DC',
      },
    };

    try {
      const createdLab = await superAdminService.registerLaboratory(payload);
      const labName = createdLab?.name || payload.name;
      notify.success(`Laboratory "${labName}" registered successfully!`);
      setCreatedLabSuccessModal(createdLab);
      setLabSuccess(null);
      setLabForm(initialLabFormState);
      fetchLabs();
      fetchAllLabsForDropdown();
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setLabError('Super Administrator authentication required to register new medical facilities.');
        notify.error('Super Administrator authentication required to register new medical facilities.');
      } else {
        const msg = err.response?.data?.message || err.message || 'Failed to register laboratory';
        setLabError(msg);
        notify.error(err, { fallback: 'Failed to register laboratory' });
      }
    } finally {
      setLabLoading(false);
    }
  };

  // Lab Admin Input Handlers
  const handleAdminInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
      setAdminForm((prev) => ({ ...prev, phone: digitsOnly }));
      if (adminErrors.phone) setAdminErrors((prev) => ({ ...prev, phone: '' }));
    } else if (name === 'age') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, 2);
      setAdminForm((prev) => ({ ...prev, age: digitsOnly }));
      if (adminErrors.age) setAdminErrors((prev) => ({ ...prev, age: '' }));
    } else {
      setAdminForm((prev) => ({ ...prev, [name]: value }));
      if (adminErrors[name]) setAdminErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Lab Admin Submission
  const handleAdminSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!adminForm.laboratoryId) errors.laboratoryId = 'Please choose a laboratory for this administrator.';
    if (!adminForm.fullName.trim()) errors.fullName = 'Full Name is required.';
    const ageErr = validateAge2Digit(adminForm.age);
    if (ageErr) errors.age = ageErr;
    const emailErr = validateEmailCom(adminForm.email);
    if (emailErr) errors.email = emailErr;
    const passErr = validatePassword(adminForm.password);
    if (passErr) errors.password = passErr;
    const phoneErr = validateMobile10(adminForm.phone);
    if (phoneErr) errors.phone = phoneErr;

    if (Object.keys(errors).length > 0) {
      setAdminErrors(errors);
      return;
    }
    setAdminErrors({});
    setAdminLoading(true);
    setAdminError(null);
    setAdminSuccess(null);

    const availableLabs = allLabsForDropdown.length > 0 ? allLabsForDropdown : laboratories;
    const selectedLab = availableLabs.find(
      (l) => l.tenantId === adminForm.laboratoryId || l._id === adminForm.laboratoryId || l.id === adminForm.laboratoryId
    );
    const labIdentifier = selectedLab ? (selectedLab.tenantId || selectedLab._id) : adminForm.laboratoryId;

    const payload = {
      fullName: adminForm.fullName.trim(),
      email: adminForm.email.trim().toLowerCase(),
      password: adminForm.password,
      phone: adminForm.phone.trim(),
      age: adminForm.age ? Number(adminForm.age) : undefined,
      department: adminForm.department.trim() || 'Administration',
      role: 'lab_admin',
    };

    try {
      const createdStaff = await superAdminService.createLaboratoryStaff(labIdentifier, payload);
      notify.success(`Administrator "${payload.fullName}" created successfully for ${selectedLab?.name || 'Laboratory'}.`);
      setAdminSuccess({
        user: createdStaff,
        lab: selectedLab || { name: 'Laboratory Facility', code: '' },
      });
      setAdminForm((prev) => ({
        ...prev,
        fullName: '',
        age: '',
        email: '',
        password: '',
        phone: '',
      }));
      fetchLabs();
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setAdminError('Super Administrator authentication required to create laboratory administrators.');
        notify.error('Super Administrator authentication required to create laboratory administrators.');
      } else {
        const msg = err.response?.data?.message || err.message || 'Failed to create laboratory administrator';
        setAdminError(msg);
        notify.error(err, { fallback: 'Failed to create laboratory administrator' });
      }
    } finally {
      setAdminLoading(false);
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
  const availableLabs = allLabsForDropdown.length > 0 ? allLabsForDropdown : laboratories;
  const selectedAdminLab = availableLabs.find(
    (l) => l.tenantId === adminForm.laboratoryId || l._id === adminForm.laboratoryId || l.id === adminForm.laboratoryId
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Central Administration Dashboard Banner (Styled directly as reference in Image 2) */}
      <div
        className="card"
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: '#eff6ff',
              border: '1.5px solid #bfdbfe',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.08)',
              flexShrink: 0,
            }}
          >
            <Building2 size={24} />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: '1.35rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.02em',
                lineHeight: 1.25,
              }}
            >
              Laboratory Administration & Registry
            </h1>
            <p
              style={{
                margin: '3px 0 0 0',
                fontSize: '0.825rem',
                color: '#64748b',
                fontWeight: 500,
              }}
            >
              Manage all laboratories, staff, and system configurations
            </p>
          </div>
        </div>

        {/* Action Buttons styled precisely from Reference Image 2 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={fetchLabs}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#475569',
              fontWeight: 600,
              padding: '0.55rem 0.95rem',
              borderRadius: '8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
            }}
            title="Refresh directory"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* + Add Lab Admin Button (Reference Image 2: + Add Hospital Admin style) */}
          <button
            type="button"
            onClick={() => {
              setActiveForm((prev) => (prev === 'admin' ? null : 'admin'));
              setAdminSuccess(null);
              setAdminError(null);
            }}
            style={{
              background: activeForm === 'admin' ? '#eff6ff' : '#ffffff',
              border: '1.5px solid #2563eb',
              color: '#2563eb',
              fontWeight: 600,
              padding: '0.55rem 1.15rem',
              borderRadius: '8px',
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(37, 99, 235, 0.08)',
              transition: 'all 0.15s ease',
            }}
          >
            {activeForm === 'admin' ? <X size={15} /> : <UserPlus size={15} />}
            <span>{activeForm === 'admin' ? 'Close Admin Form' : '+ Add Lab Admin'}</span>
          </button>

          {/* + Add Laboratory Button (Reference Image 2: + Add Enterprise Hospital style) */}
          <button
            type="button"
            onClick={() => {
              setActiveForm((prev) => (prev === 'laboratory' ? null : 'laboratory'));
              setLabSuccess(null);
              setLabError(null);
            }}
            style={{
              background: activeForm === 'laboratory' ? '#1d4ed8' : '#2563eb',
              color: '#ffffff',
              border: '1.5px solid #2563eb',
              fontWeight: 600,
              padding: '0.55rem 1.15rem',
              borderRadius: '8px',
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(37, 99, 235, 0.22)',
              transition: 'all 0.15s ease',
            }}
          >
            {activeForm === 'laboratory' ? <X size={15} /> : <PlusCircle size={15} />}
            <span>{activeForm === 'laboratory' ? 'Close Lab Form' : '+ Add Laboratory'}</span>
          </button>
        </div>
      </div>

      {/* 1. Dedicated Laboratory Registration Form */}
      {activeForm === 'laboratory' && (
        <div
          className="card cool-form-card"
          style={{
            background: 'linear-gradient(145deg, #f0fdfa 0%, #f0f9ff 50%, #f8fafc 100%)',
            border: '1.5px solid #bae6fd',
            borderRadius: '16px',
            boxShadow: '0 10px 25px -5px rgba(14, 165, 233, 0.1), 0 8px 10px -6px rgba(14, 165, 233, 0.05)',
            padding: '1.5rem',
            animation: 'modalIn 0.2s ease-out',
            marginBottom: '1.5rem',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #e0f2fe',
            }}
          >
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
                <Building2 size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Register Diagnostic Laboratory
                </h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.785rem', color: 'var(--slate-500)' }}>
                  Provision facility access, isolated database, and custom white-label portal.
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveForm(null)}
              className="btn-icon"
              style={{ color: 'var(--slate-400)' }}
              title="Close form"
            >
              <X size={18} />
            </button>
          </div>

          {/* Success Banner */}
          {/* Success Banner removed to prevent duplicate messaging with top toast & centered details modal */}

          {/* Error Banner */}
          {labError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                color: '#b91c1c',
                fontSize: '0.825rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={16} />
              <span>{labError}</span>
            </div>
          )}

          <form onSubmit={handleLabRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            {/* Line 1 (2 fields: Name & Code) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              {/* Lab Name */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  Laboratory Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  className="form-input"
                  placeholder="e.g. Apex Diagnostics Lab"
                  value={labForm.name}
                  onChange={handleLabInputChange}
                  style={{ borderColor: labErrors.name ? '#ef4444' : undefined }}
                  required
                />
                {labErrors.name && (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '3px', display: 'block' }}>
                    {labErrors.name}
                  </span>
                )}
              </div>

              {/* Lab Code */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  Unique Lab Code <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="code"
                  className="form-input"
                  placeholder="e.g. APEX-01"
                  value={labForm.code}
                  onChange={handleLabInputChange}
                  style={{
                    textTransform: 'uppercase',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    borderColor: labErrors.code ? '#ef4444' : undefined,
                  }}
                  maxLength={16}
                  required
                />
                {labErrors.code ? (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '3px', display: 'block' }}>
                    {labErrors.code}
                  </span>
                ) : (
                  <span className="form-hint">URL slug: /lab/apex-01</span>
                )}
              </div>
            </div>

            {/* Line 2 (3 fields) */}
            <div className="form-row-3col">
              {/* Contact Email (must end with .com) */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  Contact Email <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  name="contactEmail"
                  className="form-input"
                  placeholder="lab@example.com"
                  value={labForm.contactEmail}
                  onChange={handleLabInputChange}
                  style={{ borderColor: labErrors.contactEmail ? '#ef4444' : undefined }}
                  required
                />
                {labErrors.contactEmail ? (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '3px', display: 'block' }}>
                    {labErrors.contactEmail}
                  </span>
                ) : (
                  <span className="form-hint">Must end with .com</span>
                )}
              </div>

              {/* Contact Phone (10 digits) */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  Contact Phone / Mobile <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="tel"
                  name="contactPhone"
                  className="form-input"
                  placeholder="10-digit mobile number"
                  value={labForm.contactPhone}
                  onChange={handleLabInputChange}
                  maxLength={10}
                  style={{ borderColor: labErrors.contactPhone ? '#ef4444' : undefined }}
                  required
                />
                {labErrors.contactPhone ? (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '3px', display: 'block' }}>
                    {labErrors.contactPhone}
                  </span>
                ) : (
                  <span className="form-hint">10 digits only</span>
                )}
              </div>

              {/* Legal Registered Entity (Optional) */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  Legal Entity / Organization
                </label>
                <input
                  type="text"
                  name="legalName"
                  className="form-input"
                  placeholder="e.g. Apex Diagnostics LLP (Optional)"
                  value={labForm.legalName}
                  onChange={handleLabInputChange}
                />
                <span className="form-hint">Registered legal business name</span>
              </div>
            </div>

            {/* Line 3 (3 fields) */}
            <div className="form-row-3col">
              {/* City */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  City <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="addr_city"
                  className="form-input"
                  placeholder="e.g. Mumbai"
                  value={labForm.address.city}
                  onChange={handleLabInputChange}
                  style={{ borderColor: labErrors.addr_city ? '#ef4444' : undefined }}
                  required
                />
                {labErrors.addr_city && (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '3px', display: 'block' }}>
                    {labErrors.addr_city}
                  </span>
                )}
              </div>

              {/* State */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  State <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="addr_state"
                  className="form-input"
                  placeholder="e.g. Maharashtra"
                  value={labForm.address.state}
                  onChange={handleLabInputChange}
                  style={{ borderColor: labErrors.addr_state ? '#ef4444' : undefined }}
                  required
                />
                {labErrors.addr_state && (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '3px', display: 'block' }}>
                    {labErrors.addr_state}
                  </span>
                )}
              </div>

              {/* Country */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  Country
                </label>
                <input
                  type="text"
                  name="addr_country"
                  className="form-input"
                  placeholder="India"
                  value={labForm.address.country || 'India'}
                  onChange={handleLabInputChange}
                />
                <span className="form-hint">Operating region</span>
              </div>
            </div>

            {/* Line 4: White-Label Branding & Portal Configuration Section */}
            <div
              style={{
                background: 'rgba(255, 255, 255, 0.85)',
                border: '1.5px solid #bae6fd',
                borderRadius: '12px',
                padding: '1.15rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.95rem',
                boxShadow: '0 2px 8px rgba(14, 165, 233, 0.05)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  borderBottom: '1px solid #e0f2fe',
                  paddingBottom: '0.6rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Palette size={16} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      White-Label Branding & Custom Domain
                    </h4>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Configure facility brand identity, colors, and dedicated whitelabel portal.
                    </span>
                  </div>
                </div>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    color: '#0369a1',
                    background: '#e0f2fe',
                    padding: '3px 8px',
                    borderRadius: '20px',
                  }}
                >
                  <Sparkles size={12} />
                  White-Label Portal
                </span>
              </div>

              {/* White-Label Inputs (3 columns) */}
              <div className="form-row-3col">
                {/* Display Brand Name */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                    White-Label Brand Display Name
                  </label>
                  <input
                    type="text"
                    name="displayName"
                    className="form-input"
                    placeholder={labForm.name ? labForm.name : 'e.g. Apex Diagnostics Network'}
                    value={labForm.displayName}
                    onChange={handleLabInputChange}
                  />
                  <span className="form-hint">Displayed on patient reports & portal banner</span>
                </div>

                {/* Custom Domain / Subdomain */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                    Custom Hostname / Subdomain
                  </label>
                  <input
                    type="text"
                    name="domain"
                    className="form-input"
                    placeholder="e.g. apex.lab.medical365.local"
                    value={labForm.domain}
                    onChange={handleLabInputChange}
                  />
                  <span className="form-hint">For tenant hostname resolution (Optional)</span>
                </div>

                {/* Brand Colors */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                    Brand Colors (Primary & Accent)
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="color"
                        name="primaryColor"
                        value={labForm.primaryColor || '#2563EB'}
                        onChange={handleLabInputChange}
                        style={{ width: '36px', height: '36px', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', padding: 0 }}
                        title="Choose Primary Brand Color"
                      />
                      <input
                        type="text"
                        name="primaryColor"
                        className="form-input"
                        value={labForm.primaryColor || '#2563EB'}
                        onChange={handleLabInputChange}
                        style={{ fontFamily: 'monospace', fontSize: '0.75rem', padding: '6px 8px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="color"
                        name="accentColor"
                        value={labForm.accentColor || '#22C1DC'}
                        onChange={handleLabInputChange}
                        style={{ width: '36px', height: '36px', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', padding: 0 }}
                        title="Choose Accent Color"
                      />
                      <input
                        type="text"
                        name="accentColor"
                        className="form-input"
                        value={labForm.accentColor || '#22C1DC'}
                        onChange={handleLabInputChange}
                        style={{ fontFamily: 'monospace', fontSize: '0.75rem', padding: '6px 8px' }}
                      />
                    </div>
                  </div>
                  <span className="form-hint">Colors used across portal UI & patient reports</span>
                </div>
              </div>

              {/* Live Whitelabel Portal Preview Bar */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px dashed #bae6fd',
                  borderRadius: '8px',
                  padding: '0.65rem 0.9rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={15} style={{ color: labForm.primaryColor || '#2563EB' }} />
                  <span style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    Generated Whitelabel URL:
                  </span>
                  <code style={{ fontSize: '0.75rem', background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: '4px' }}>
                    {`${originUrl}/lab/${(labForm.code || 'your-lab-code').toLowerCase()}`}
                  </code>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#64748b' }}>
                    <span>Live Theme Preview:</span>
                    <span
                      style={{
                        display: 'inline-block',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: labForm.primaryColor || '#2563EB',
                        border: '1px solid rgba(0,0,0,0.1)',
                      }}
                      title="Primary Color"
                    />
                    <span
                      style={{
                        display: 'inline-block',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        background: labForm.accentColor || '#22C1DC',
                        border: '1px solid rgba(0,0,0,0.1)',
                      }}
                      title="Accent Color"
                    />
                    <span style={{ fontWeight: 600, color: labForm.primaryColor || '#2563EB', marginLeft: '4px' }}>
                      {labForm.displayName || labForm.name || 'Sample Laboratory'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '0.75rem', borderTop: '1px solid #e0f2fe' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveForm(null)}
                disabled={labLoading}
              >
                Cancel
              </button>

              <button type="submit" className="btn btn-primary" disabled={labLoading}>
                {labLoading ? (
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

      {/* 2. Dedicated Laboratory Administrator Form */}
      {activeForm === 'admin' && (
        <div
          className="card cool-form-card"
          style={{
            background: 'linear-gradient(145deg, #f0fdfa 0%, #f0f9ff 50%, #f8fafc 100%)',
            border: '1.5px solid #bae6fd',
            borderRadius: '16px',
            boxShadow: '0 10px 25px -5px rgba(14, 165, 233, 0.1), 0 8px 10px -6px rgba(14, 165, 233, 0.05)',
            padding: '1.5rem',
            animation: 'modalIn 0.2s ease-out',
            marginBottom: '1.5rem',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.25rem',
              paddingBottom: '0.75rem',
              borderBottom: '1px solid #e0f2fe',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #2563eb, #7c3aed)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <UserPlus size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Add Laboratory Administrator
                </h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.785rem', color: 'var(--slate-500)' }}>
                  Provision dedicated administrator credentials for diagnostic facility operations.
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveForm(null)}
              className="btn-icon"
              style={{ color: 'var(--slate-400)' }}
              title="Close form"
            >
              <X size={18} />
            </button>
          </div>

          {/* Success Banner */}
          {adminSuccess && (
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '0.9rem 1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: 700, fontSize: '0.9rem' }}>
                <CheckCircle2 size={18} />
                <span>
                  Administrator "{adminSuccess.user?.fullName || adminForm.fullName}" ({adminSuccess.user?.email || adminForm.email}) Created Successfully!
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#15803d' }}>
                Assigned to <strong>{adminSuccess.lab?.name}</strong> ({adminSuccess.lab?.code}). Credentials are now active.
              </p>
              {adminSuccess.lab?.code && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                  <code style={{ fontSize: '0.775rem', background: '#dcfce7', padding: '4px 8px', borderRadius: '4px', color: '#166534' }}>
                    {`${originUrl}/lab/${adminSuccess.lab.code.toLowerCase()}`}
                  </code>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(`${originUrl}/lab/${adminSuccess.lab.code.toLowerCase()}`);
                        setAdminCopied(true);
                        setTimeout(() => setAdminCopied(false), 2000);
                      }
                    }}
                  >
                    {adminCopied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                    <span>{adminCopied ? 'Copied!' : 'Copy Portal URL'}</span>
                  </button>
                  <a
                    href={`${originUrl}/lab/${adminSuccess.lab.code.toLowerCase()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                  >
                    <ExternalLink size={12} />
                    <span>Open Portal</span>
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Error Banner */}
          {adminError && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1.25rem',
                color: '#b91c1c',
                fontSize: '0.825rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertTriangle size={16} />
              <span>{adminError}</span>
            </div>
          )}

          <form onSubmit={handleAdminSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            {/* Line 1 (3 fields) */}
            <div className="form-row-3col">
              {/* Target Diagnostic Laboratory */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  Target Diagnostic Laboratory <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  name="laboratoryId"
                  className="form-select"
                  value={adminForm.laboratoryId}
                  onChange={handleAdminInputChange}
                  style={{ borderColor: adminErrors.laboratoryId ? '#ef4444' : undefined }}
                  required
                >
                  <option value="">-- Choose Laboratory Facility --</option>
                  {availableLabs.map((lab) => (
                    <option key={lab.tenantId || lab._id} value={lab.tenantId || lab._id}>
                      {lab.name} ({lab.code})
                    </option>
                  ))}
                </select>
                {adminErrors.laboratoryId ? (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '3px', display: 'block' }}>
                    {adminErrors.laboratoryId}
                  </span>
                ) : (
                  <span className="form-hint">
                    {availableLabs.length === 0
                      ? 'No laboratories registered yet.'
                      : 'Select assigned diagnostic facility.'}
                  </span>
                )}
              </div>

              {/* Admin Full Name */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  Admin Full Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="fullName"
                  className="form-input"
                  placeholder="e.g. Dr. Rajesh Kumar"
                  value={adminForm.fullName}
                  onChange={handleAdminInputChange}
                  style={{ borderColor: adminErrors.fullName ? '#ef4444' : undefined }}
                  required
                />
                {adminErrors.fullName && (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '3px', display: 'block' }}>
                    {adminErrors.fullName}
                  </span>
                )}
              </div>

              {/* Age (Strictly 2 digits: 18 - 99) */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  Age <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  name="age"
                  className="form-input"
                  placeholder="2-digit age (e.g. 32)"
                  value={adminForm.age}
                  onChange={handleAdminInputChange}
                  maxLength={2}
                  style={{ borderColor: adminErrors.age ? '#ef4444' : undefined }}
                  required
                />
                {adminErrors.age ? (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '3px', display: 'block' }}>
                    {adminErrors.age}
                  </span>
                ) : (
                  <span className="form-hint">2 digits (18 - 99)</span>
                )}
              </div>
            </div>

            {/* Line 2 (3 fields) */}
            <div className="form-row-3col">
              {/* Admin Login Email (Strictly ends with .com) */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  Admin Email <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  className="form-input"
                  placeholder="admin@hospital.com"
                  value={adminForm.email}
                  onChange={handleAdminInputChange}
                  style={{ borderColor: adminErrors.email ? '#ef4444' : undefined }}
                  required
                />
                {adminErrors.email ? (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '3px', display: 'block' }}>
                    {adminErrors.email}
                  </span>
                ) : (
                  <span className="form-hint">Must end with .com</span>
                )}
              </div>

              {/* Mobile Number (Strictly 10 digits) */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  Mobile Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  className="form-input"
                  placeholder="10-digit mobile number"
                  value={adminForm.phone}
                  onChange={handleAdminInputChange}
                  maxLength={10}
                  style={{ borderColor: adminErrors.phone ? '#ef4444' : undefined }}
                  required
                />
                {adminErrors.phone ? (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '3px', display: 'block' }}>
                    {adminErrors.phone}
                  </span>
                ) : (
                  <span className="form-hint">10 digits only</span>
                )}
              </div>

              {/* Password (NOT temporary password) with Show/Hide toggle */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  Password <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showAdminPassword ? 'text' : 'password'}
                    name="password"
                    className="form-input"
                    placeholder="Enter password (min 8 chars)"
                    value={adminForm.password}
                    onChange={handleAdminInputChange}
                    minLength={8}
                    style={{
                      paddingRight: '38px',
                      borderColor: adminErrors.password ? '#ef4444' : undefined,
                    }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword((prev) => !prev)}
                    style={{
                      position: 'absolute',
                      right: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    tabIndex={-1}
                  >
                    {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {adminErrors.password ? (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '3px', display: 'block' }}>
                    {adminErrors.password}
                  </span>
                ) : (
                  <span className="form-hint">Minimum 8 characters</span>
                )}
              </div>
            </div>

            {/* Department / Designation */}
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                Department / Designation
              </label>
              <input
                type="text"
                name="department"
                className="form-input"
                placeholder="e.g. Administration / Lab In-Charge"
                value={adminForm.department}
                onChange={handleAdminInputChange}
              />
            </div>

            {/* Form Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '0.75rem', borderTop: '1px solid #e0f2fe' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveForm(null)}
                disabled={adminLoading}
              >
                Cancel
              </button>

              <button type="submit" className="btn btn-primary" disabled={adminLoading}>
                {adminLoading ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Creating Administrator...</span>
                  </>
                ) : (
                  <>
                    <UserCheck size={15} />
                    <span>Create Administrator Account</span>
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
              <button onClick={() => setActiveForm('laboratory')} className="btn btn-primary">
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

      {/* Laboratory Registration Success Details Modal */}
      {createdLabSuccessModal && (
        <div
          className="modal-backdrop"
          onClick={() => setCreatedLabSuccessModal(null)}
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '1rem',
          }}
        >
          <div
            className="modal-dialog modal-md"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '520px',
              width: '100%',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
              animation: 'confirmModalIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
              margin: 'auto',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: '#dcfce7',
                    color: '#16a34a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <CheckCircle2 size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                    Laboratory Registered Successfully
                  </h3>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.775rem', color: '#64748b' }}>
                    Dedicated tenant and portal provisioned
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreatedLabSuccessModal(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem' }}>
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '10px',
                  padding: '1rem 1.25rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ fontSize: '0.8rem', color: '#166534', fontWeight: 600, marginBottom: '4px' }}>
                  Laboratory Facility
                </div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#14532d', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>{createdLabSuccessModal.name}</span>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      background: '#dcfce7',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      border: '1px solid #86efac',
                    }}
                  >
                    {createdLabSuccessModal.code}
                  </span>
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>
                  Whitelabel Dedicated Login Portal URL:
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '8px 12px',
                  }}
                >
                  <code style={{ fontSize: '0.825rem', color: '#0f172a', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {`${originUrl}/lab/${(createdLabSuccessModal.code || '').toLowerCase()}`}
                  </code>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ flex: 1, minWidth: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(`${originUrl}/lab/${(createdLabSuccessModal.code || '').toLowerCase()}`);
                      setLabCopied(true);
                      setTimeout(() => setLabCopied(false), 2000);
                    }
                  }}
                >
                  {labCopied ? <Check size={16} color="#16a34a" /> : <Copy size={16} />}
                  <span>{labCopied ? 'Copied to Clipboard!' : 'Copy Portal URL'}</span>
                </button>
                <a
                  href={`${originUrl}/lab/${(createdLabSuccessModal.code || '').toLowerCase()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{ flex: 1, minWidth: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <ExternalLink size={16} />
                  <span>Open Portal</span>
                </a>
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '0.875rem 1.5rem',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'flex-end',
                background: '#f8fafc',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCreatedLabSuccessModal(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LaboratoriesPage;
