/**
 * Lab Management System (LMS) - Platform Super Admin Overview
 * Medical365 Aesthetic: Cool-tone Operations Banner, Compact Stat Cards, Interactive Laboratory Directory
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlusCircle,
  UserPlus,
  ArrowRight,
  RefreshCw,
  Activity,
  ChevronRight,
  X,
  Check,
  Copy,
  ExternalLink,
  Shield,
  Mail,
  Phone,
  MapPin,
  Globe,
  Palette,
  UserCheck,
  Sparkles,
  Eye,
  EyeOff,
  Camera,
  Trash2,
  Pencil,
  User,
} from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import Badge from '../../components/common/Badge';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import AdminSecurityBoundary from '../../components/common/AdminSecurityBoundary';
import superAdminService from '../../services/superAdminService';

export function SuperAdminOverview() {
  const [data, setData] = useState(null);
  const [laboratories, setLaboratories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active Dedicated Form: null | 'laboratory' | 'admin'
  const [activeForm, setActiveForm] = useState(null);

  // Editing Laboratory State (Populated when user clicks Edit on any lab card)
  const [editingLabId, setEditingLabId] = useState(null);
  const [originalLabForm, setOriginalLabForm] = useState(null);

  // Deleting Laboratory State (Controls confirmation modal)
  const [deleteConfirmLab, setDeleteConfirmLab] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
  const [labCopied, setLabCopied] = useState(false);

  // Dirty Check: In edit mode, Update button stays disabled until at least one field is altered
  const isLabFormDirty = useMemo(() => {
    if (!editingLabId || !originalLabForm) return true;
    return JSON.stringify(labForm) !== JSON.stringify(originalLabForm);
  }, [editingLabId, labForm, originalLabForm]);

  // Dedicated Lab Admin Form State
  const initialAdminFormState = {
    laboratoryId: '',
    fullName: '',
    age: '',
    email: '',
    password: '',
    phone: '',
    profilePhoto: null,
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

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, labsData] = await Promise.all([
        superAdminService.getOverview(),
        superAdminService.listLaboratories({ limit: 100 }).catch(() => ({ laboratories: [] })),
      ]);

      setData(overviewData);
      setLaboratories(labsData?.laboratories || overviewData?.recentLaboratories || []);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load platform overview';
      const status = err.response?.status;
      setError({ message: msg, status });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

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

  // Lab Registration / Update Submission
  const handleLabRegisterSubmit = async (e) => {
    e.preventDefault();
    const errors = {};
    if (!labForm.name.trim()) errors.name = 'Laboratory name is required';
    if (!editingLabId && !labForm.code.trim()) errors.code = 'Lab code is required';
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
      legalName: labForm.legalName.trim() || undefined,
      email: labForm.contactEmail.trim().toLowerCase(),
      contactEmail: labForm.contactEmail.trim().toLowerCase(),
      phone: labForm.contactPhone.trim() || undefined,
      timezone: labForm.timezone,
      locale: labForm.locale,
      subscriptionPlan: labForm.subscriptionPlan,
      plan: labForm.subscriptionPlan,
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

    if (!editingLabId) {
      payload.code = labForm.code.trim();
    }

    try {
      if (editingLabId) {
        const updated = await superAdminService.updateLaboratory(editingLabId, payload);
        setLabSuccess({
          name: updated?.name || labForm.name,
          code: updated?.code || labForm.code,
          isUpdate: true,
        });
        setEditingLabId(null);
        setOriginalLabForm(null);
        setLabForm(initialLabFormState);
      } else {
        const createdLab = await superAdminService.registerLaboratory(payload);
        setLabSuccess(createdLab);
        setLabForm(initialLabFormState);
      }
      fetchOverview();
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setLabError('Super Administrator authentication required to register or update facilities.');
      } else {
        setLabError(err.response?.data?.message || err.message || (editingLabId ? 'Failed to update laboratory' : 'Failed to register laboratory'));
      }
    } finally {
      setLabLoading(false);
    }
  };

  // Edit Laboratory Handler (Prefills the form and enters edit mode)
  const handleEditLabClick = (e, lab) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveForm('laboratory');
    const labKey = lab.tenantId || lab._id || lab.id;
    setEditingLabId(labKey);
    const domainVal = Array.isArray(lab.domains)
      ? (typeof lab.domains[0] === 'string' ? lab.domains[0] : lab.domains[0]?.domain || '')
      : (lab.domain || '');
    const formData = {
      name: lab.name || '',
      code: lab.code || '',
      legalName: lab.legalName || '',
      contactEmail: lab.email || lab.contactEmail || '',
      contactPhone: lab.phone || '',
      domain: domainVal,
      timezone: lab.timezone || 'Asia/Kolkata',
      locale: lab.locale || 'en-IN',
      subscriptionPlan: lab.subscriptionPlan || lab.plan || 'standard',
      displayName: lab.branding?.displayName || lab.name || '',
      primaryColor: lab.branding?.primaryColor || '#2563EB',
      accentColor: lab.branding?.accentColor || '#22C1DC',
      address: {
        street: lab.address?.street || '',
        city: lab.address?.city || '',
        state: lab.address?.state || '',
        postalCode: lab.address?.postalCode || '',
        country: lab.address?.country || 'India',
      },
    };
    setLabForm(formData);
    setOriginalLabForm(JSON.parse(JSON.stringify(formData)));
    setLabErrors({});
    setLabError(null);
    setLabSuccess(null);
    // Smooth scroll to form
    const elem = document.getElementById('dedicated-lab-form');
    if (elem) elem.scrollIntoView({ behavior: 'smooth' });
  };

  // Delete Laboratory Handlers
  const handleDeleteLabClick = (e, lab) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirmLab(lab);
  };

  const handleConfirmDeleteLab = async () => {
    if (!deleteConfirmLab) return;
    setDeleteLoading(true);
    try {
      const labKey = deleteConfirmLab.tenantId || deleteConfirmLab._id || deleteConfirmLab.id;
      await superAdminService.deleteLaboratory(labKey);
      setLaboratories((prev) => prev.filter((l) => (l.tenantId || l._id || l.id) !== labKey));
      setDeleteConfirmLab(null);
      fetchOverview();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Failed to delete laboratory');
    } finally {
      setDeleteLoading(false);
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

  const handleAdminPhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAdminError('Please upload a valid image file (JPG, PNG, WebP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAdminError('Image file size must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAdminForm((prev) => ({ ...prev, profilePhoto: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAdminPhoto = () => {
    setAdminForm((prev) => ({ ...prev, profilePhoto: null }));
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

    const selectedLab = laboratories.find(
      (l) => l.tenantId === adminForm.laboratoryId || l._id === adminForm.laboratoryId || l.id === adminForm.laboratoryId
    );
    const labIdentifier = selectedLab ? (selectedLab.tenantId || selectedLab._id) : adminForm.laboratoryId;

    const payload = {
      fullName: adminForm.fullName.trim(),
      email: adminForm.email.trim().toLowerCase(),
      password: adminForm.password,
      phone: adminForm.phone.trim(),
      age: adminForm.age ? Number(adminForm.age) : undefined,
      profilePhoto: adminForm.profilePhoto || undefined,
      department: adminForm.department.trim() || 'Administration',
      role: 'lab_admin',
    };

    try {
      const createdStaff = await superAdminService.createLaboratoryStaff(labIdentifier, payload);
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
        profilePhoto: null,
      }));
      fetchOverview();
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setAdminError('Super Administrator authentication required to create laboratory administrators.');
      } else {
        setAdminError(err.response?.data?.message || err.message || 'Failed to create laboratory administrator');
      }
    } finally {
      setAdminLoading(false);
    }
  };

  if (loading) return <LoadingState message="Loading platform overview & verified laboratories..." />;
  if (error && (error.status === 401 || error.status === 403)) {
    return <AdminSecurityBoundary errorDetails={error.message} />;
  }
  if (error) return <ErrorState title="Platform Administration Error" message={error.message} onRetry={fetchOverview} />;

  const metrics = data?.metrics || data || {};
  const recentAudits = data?.recentAudits || [];
  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const selectedAdminLab = laboratories.find(
    (l) => l.tenantId === adminForm.laboratoryId || l._id === adminForm.laboratoryId || l.id === adminForm.laboratoryId
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>;
      case 'PENDING':
        return <Badge variant="warning">Pending</Badge>;
      case 'SUSPENDED':
        return <Badge variant="purple">Suspended</Badge>;
      case 'INACTIVE':
        return <Badge variant="slate">Inactive</Badge>;
      default:
        return <Badge variant="slate">{status || 'Unknown'}</Badge>;
    }
  };

  const getActionBadge = (action = '') => {
    if (action.includes('REGISTERED')) return <Badge variant="blue">Registered</Badge>;
    if (action.includes('ACTIVATED') || action.includes('SUCCEEDED')) return <Badge variant="success">Active / Ready</Badge>;
    if (action.includes('SUSPENDED')) return <Badge variant="purple">Suspended</Badge>;
    if (action.includes('FAILED')) return <Badge variant="danger">Failed</Badge>;
    return <Badge variant="slate">{action}</Badge>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Light Green & Light Blue Mixed Pastel Medical Banner (Flush Top/Left/Right) */}
      <div
        className="overview-hero-banner overview-hero-banner-flush"
        style={{
          background: 'linear-gradient(135deg, #e0f2fe 0%, #ecfdf5 45%, #f0fdf4 100%)',
          borderRadius: '0 0 16px 16px',
          padding: '1.5rem 1.75rem',
          color: '#0f172a',
          boxShadow: '0 4px 20px -2px rgba(2, 132, 199, 0.08), 0 2px 6px rgba(16, 185, 129, 0.05)',
          position: 'relative',
          overflow: 'hidden',
          borderBottom: '1.5px solid #bae6fd',
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
        }}
      >
        {/* Soft pastel ambient lighting orbs */}
        <div
          style={{
            position: 'absolute',
            top: '-50%',
            right: '-10%',
            width: '380px',
            height: '380px',
            background: 'radial-gradient(circle, rgba(167, 243, 208, 0.45) 0%, rgba(224, 242, 254, 0) 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-50%',
            left: '20%',
            width: '320px',
            height: '320px',
            background: 'radial-gradient(circle, rgba(186, 230, 253, 0.4) 0%, rgba(240, 253, 244, 0) 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.35rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
                  border: '1px solid #fbcfe8',
                  borderRadius: '20px',
                  padding: '3px 12px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  boxShadow: '0 2px 6px rgba(236, 72, 153, 0.1)',
                }}
              >
                <Sparkles size={12} color="#ec4899" />
                <span
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #ec4899 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Live Control Center
                </span>
              </span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(1.35rem, 2.5vw, 1.85rem)',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #0284c7 0%, #3b82f6 30%, #ec4899 70%, #f43f5e 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.25,
                margin: '0 0 0.45rem 0',
                letterSpacing: '-0.02em',
              }}
            >
              Laboratory Network & Multi-Tenant Operations
            </h1>

            <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.45, maxWidth: '620px' }}>
              Global platform supervision, active medical laboratories, direct white-label portals, and security compliance.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', marginLeft: 'auto' }}>
            <button
              onClick={fetchOverview}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '0.55rem 1rem',
                borderRadius: '8px',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                color: '#334155',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                boxShadow: '0 2px 5px rgba(15, 23, 42, 0.05)',
                transition: 'all 0.15s ease',
              }}
              title="Refresh overview metrics"
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Primary KPI Metrics (4 Colorful Pastel Cards: Blue, Green, Orange, Purple) */}
      <section>
        <div className="overview-stats-grid">
          <StatCard
            title="Total Laboratories"
            value={metrics?.totalLaboratories || laboratories.length || 0}
            subtitle="Registered facilities"
            icon={Building2}
            colorScheme="blue"
          />
          <StatCard
            title="Active Operational"
            value={metrics?.activeLaboratories || laboratories.filter((l) => l.status === 'ACTIVE').length || 0}
            subtitle="Verified & provisioned"
            icon={CheckCircle2}
            colorScheme="green"
          />
          <StatCard
            title="Pending Onboarding"
            value={metrics?.pendingLaboratories || 0}
            subtitle="Awaiting activation"
            icon={Clock}
            colorScheme="orange"
          />
          <StatCard
            title="Suspended / Inactive"
            value={(metrics?.suspendedLaboratories || 0) + (metrics?.inactiveLaboratories || 0)}
            subtitle="Compliance holds"
            icon={AlertTriangle}
            colorScheme="purple"
          />
        </div>
      </section>

      {/* 3. Action Header Bar with + Add Lab Admin and + Add Laboratory (Image 2 Aesthetic) */}
      <div
        className="card"
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
          padding: '1rem 1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.85rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
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
            <Building2 size={20} />
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: '1.05rem',
                fontWeight: 800,
                color: '#0f172a',
                letterSpacing: '-0.01em',
              }}
            >
              Laboratory Operations & Provisioning
            </h2>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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
              padding: '0.5rem 1.05rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
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
              padding: '0.5rem 1.05rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
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

      {/* 3A. Dedicated Laboratory Registration / Edit Form */}
      {activeForm === 'laboratory' && (
        <div
          id="dedicated-lab-form"
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
                {editingLabId ? <Pencil size={20} /> : <Building2 size={20} />}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {editingLabId ? 'Edit Diagnostic Laboratory' : 'Register Diagnostic Laboratory'}
                </h2>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.785rem', color: 'var(--slate-500)' }}>
                  {editingLabId
                    ? 'Update facility profile, contact information, subscription plan, and branding.'
                    : 'Provision facility access, isolated database, and custom white-label portal.'}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                setActiveForm(null);
                setEditingLabId(null);
                setOriginalLabForm(null);
                setLabForm(initialLabFormState);
              }}
              className="btn-icon"
              style={{ color: 'var(--slate-400)' }}
              title="Close form"
            >
              <X size={18} />
            </button>
          </div>

          {/* Success Banner */}
          {labSuccess && (
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
                <span>Laboratory "{labSuccess.name}" ({labSuccess.code}) Registered Successfully!</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <code style={{ fontSize: '0.775rem', background: '#dcfce7', padding: '4px 8px', borderRadius: '4px', color: '#166534' }}>
                  {`${originUrl}/lab/${labSuccess.code.toLowerCase()}`}
                </code>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '3px 8px', fontSize: '0.72rem' }}
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(`${originUrl}/lab/${labSuccess.code.toLowerCase()}`);
                      setLabCopied(true);
                      setTimeout(() => setLabCopied(false), 2000);
                    }
                  }}
                >
                  {labCopied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                  <span>{labCopied ? 'Copied!' : 'Copy Portal URL'}</span>
                </button>
                <a
                  href={`${originUrl}/lab/${labSuccess.code.toLowerCase()}`}
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
            {/* Line 1 (3 fields) */}
            <div className="form-row-3col">
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
                  disabled={!!editingLabId}
                  style={{
                    textTransform: 'uppercase',
                    fontFamily: 'monospace',
                    fontWeight: 700,
                    borderColor: labErrors.code ? '#ef4444' : undefined,
                    backgroundColor: editingLabId ? '#f1f5f9' : undefined,
                    cursor: editingLabId ? 'not-allowed' : undefined,
                  }}
                  maxLength={16}
                  required
                />
                {editingLabId ? (
                  <span className="form-hint" style={{ color: '#64748b' }}>
                    Lab code cannot be modified once created
                  </span>
                ) : labErrors.code ? (
                  <span style={{ color: '#dc2626', fontSize: '0.75rem', marginTop: '3px', display: 'block' }}>
                    {labErrors.code}
                  </span>
                ) : (
                  <span className="form-hint">URL slug: /lab/apex-01</span>
                )}
              </div>

              {/* Subscription Plan */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600 }}>
                  Subscription Plan <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  name="subscriptionPlan"
                  className="form-select"
                  value={labForm.subscriptionPlan}
                  onChange={handleLabInputChange}
                  required
                >
                  <option value="standard">Standard Plan</option>
                  <option value="professional">Professional Plan</option>
                  <option value="enterprise">Enterprise Plan</option>
                </select>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px', paddingTop: '0.75rem', borderTop: '1px solid #e0f2fe' }}>
              {editingLabId && !isLabFormDirty && (
                <span style={{ fontSize: '0.775rem', color: '#64748b', marginRight: 'auto' }}>
                  ℹ️ Modify at least one field to enable Update & Save
                </span>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setActiveForm(null);
                  setEditingLabId(null);
                  setOriginalLabForm(null);
                  setLabForm(initialLabFormState);
                }}
                disabled={labLoading}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={labLoading || (editingLabId && !isLabFormDirty)}
                style={{
                  opacity: editingLabId && !isLabFormDirty ? 0.6 : 1,
                  cursor: editingLabId && !isLabFormDirty ? 'not-allowed' : 'pointer',
                }}
              >
                {labLoading ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>{editingLabId ? 'Saving Changes...' : 'Provisioning Laboratory...'}</span>
                  </>
                ) : editingLabId ? (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Update & Save Changes</span>
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

      {/* 3B. Dedicated Laboratory Administrator Form */}
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
                  {laboratories.map((lab) => (
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
                    {laboratories.length === 0
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

            {/* Bottom Row: Simple Profile Photo Upload & Department */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: '1rem',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.75)',
                padding: '0.9rem 1.15rem',
                borderRadius: '10px',
                border: '1px solid #bae6fd',
              }}
            >
              {/* Profile Photo (Optional - Clean modern simple avatar uploader) */}
              <div>
                <label className="form-label" style={{ fontSize: '0.825rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                  Profile Photo <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 400 }}>(Optional)</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '50%',
                      background: adminForm.profilePhoto ? 'transparent' : '#e0f2fe',
                      border: '2px solid #bae6fd',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {adminForm.profilePhoto ? (
                      <img
                        src={adminForm.profilePhoto}
                        alt="Profile Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <User size={22} style={{ color: '#0284c7' }} />
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label
                      htmlFor="adminPhotoUpload"
                      className="btn btn-secondary btn-sm"
                      style={{ cursor: 'pointer', margin: 0, padding: '5px 12px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Camera size={13} />
                      <span>{adminForm.profilePhoto ? 'Change Photo' : 'Upload Photo'}</span>
                    </label>
                    <input
                      id="adminPhotoUpload"
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleAdminPhotoUpload}
                    />
                    {adminForm.profilePhoto && (
                      <button
                        type="button"
                        onClick={handleRemoveAdminPhoto}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '5px 8px', fontSize: '0.75rem' }}
                        title="Remove photo"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                    <span style={{ fontSize: '0.725rem', color: '#64748b' }}>JPG/PNG max 2MB</span>
                  </div>
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

      {/* 4. Registered Laboratories Directory Cards (Small Cards with Basic Details) */}
      <section className="card" style={{ padding: '1.25rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={18} style={{ color: 'var(--primary-blue)' }} />
              <h2 className="card-title" style={{ fontSize: '1.05rem', margin: 0 }}>
                Registered Laboratories ({laboratories.length})
              </h2>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.775rem', color: 'var(--slate-500)' }}>
              Click any laboratory card to open its full management details and portal access.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#0369a1',
                background: '#e0f2fe',
                padding: '3px 10px',
                borderRadius: '20px',
              }}
            >
              {laboratories.length} Active Facilities
            </span>
          </div>
        </div>

        {laboratories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
            <Building2 size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
            <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '4px' }}>No Laboratories Found</h3>
            <p style={{ fontSize: '0.825rem', marginBottom: '14px' }}>You haven't registered any medical laboratories yet.</p>
            <button onClick={() => setActiveForm('laboratory')} className="btn btn-primary btn-sm">
              <PlusCircle size={14} />
              <span>Register Your First Laboratory</span>
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
              gap: '0.85rem',
            }}
          >
            {laboratories.map((lab) => {
              const labKey = lab.tenantId || lab.id || lab._id;
              const detailsUrl = `/super-admin/laboratories/${labKey}`;

              return (
                <Link
                  key={labKey}
                  to={detailsUrl}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '0.9rem 1.1rem',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.85rem',
                    transition: 'all 0.18s ease',
                    boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#0284c7';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(2, 132, 199, 0.12)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(15, 23, 42, 0.04)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '9px',
                        backgroundColor: '#eff6ff',
                        color: '#2563eb',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        flexShrink: 0,
                        border: '1px solid #dbeafe',
                      }}
                    >
                      {(lab.name || 'L').charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: '#0f172a',
                          fontSize: '0.925rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1.3,
                        }}
                        title={lab.name}
                      >
                        {lab.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'nowrap' }}>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            fontSize: '0.72rem',
                            color: '#0369a1',
                            background: '#f0f9ff',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            whiteSpace: 'nowrap',
                            border: '1px solid #e0f2fe',
                          }}
                        >
                          {lab.code}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>•</span>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                          {lab.staffCount ?? lab.staff?.length ?? 1} Staff
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    {getStatusBadge(lab.status)}

                    {/* Edit Lab Button */}
                    <button
                      type="button"
                      onClick={(e) => handleEditLabClick(e, lab)}
                      title="Edit Laboratory Details"
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #cbd5e1',
                        color: '#0284c7',
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#e0f2fe';
                        e.currentTarget.style.borderColor = '#0284c7';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#f8fafc';
                        e.currentTarget.style.borderColor = '#cbd5e1';
                      }}
                    >
                      <Pencil size={13} />
                    </button>

                    {/* Delete Lab Button */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteLabClick(e, lab)}
                      title="Delete Laboratory"
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#dc2626',
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = '#fee2e2';
                        e.currentTarget.style.borderColor = '#dc2626';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = '#fef2f2';
                        e.currentTarget.style.borderColor = '#fecaca';
                      }}
                    >
                      <Trash2 size={13} />
                    </button>

                    <ChevronRight size={16} style={{ color: '#94a3b8' }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Delete Laboratory Confirmation Modal */}
      {deleteConfirmLab && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '1rem',
            animation: 'modalIn 0.2s ease-out',
          }}
        >
          <div
            style={{
              background: '#ffffff',
              borderRadius: '14px',
              maxWidth: '440px',
              width: '100%',
              padding: '1.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
              border: '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                  Delete Laboratory
                </h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Confirm laboratory facility removal
                </p>
              </div>
            </div>

            <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.5, marginBottom: '1.25rem' }}>
              Are you sure you want to delete <strong style={{ color: '#0f172a' }}>{deleteConfirmLab.name}</strong>{' '}
              (<code style={{ background: '#f1f5f9', padding: '2px 5px', borderRadius: '4px' }}>{deleteConfirmLab.code}</code>)?
              This will permanently remove the facility and its tenant configuration from the platform.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteConfirmLab(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDeleteLab}
                disabled={deleteLoading}
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.5rem 1rem',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {deleteLoading ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>Delete Laboratory</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SuperAdminOverview;

