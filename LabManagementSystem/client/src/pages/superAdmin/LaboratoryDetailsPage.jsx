/**
 * Lab Management System (LMS) - Platform Super Admin Laboratory Details & Provisioning Control
 * Medical365 Aesthetic: 3D Soft Light Hero Banner, Integrated Profile Details, Portal Controls, Staff Directory
 */

import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Building2,
  Database,
  Shield,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  Globe,
  Clock,
  Layers,
  MapPin,
  Mail,
  Phone,
  Edit,
  XCircle,
  Copy,
  Users,
  UserPlus,
  ExternalLink,
} from 'lucide-react';
import Badge from '../../components/common/Badge';
import StatusBanner from '../../components/common/StatusBanner';
import LoadingState from '../../components/common/LoadingState';
import ErrorState from '../../components/common/ErrorState';
import AdminSecurityBoundary from '../../components/common/AdminSecurityBoundary';
import Modal from '../../components/common/Modal';
import superAdminService from '../../services/superAdminService';

export function LaboratoryDetailsPage() {
  const { id } = useParams();

  const [lab, setLab] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [copiedPortal, setCopiedPortal] = useState(false);

  const copyPortalUrl = (url) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
    }
    setCopiedPortal(true);
    setTimeout(() => setCopiedPortal(false), 2000);
  };

  // Status Modal State
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState('');
  const [statusReason, setStatusReason] = useState('');

  // Edit Profile Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    legalName: '',
    contactEmail: '',
    contactPhone: '',
    timezone: 'UTC',
    locale: 'en-US',
  });

  // Staff Modal State
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [staffFormData, setStaffFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'lab_admin',
    phone: '',
    department: '',
  });

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionFeedback(null);
    try {
      await superAdminService.createLaboratoryStaff(lab.tenantId, staffFormData);
      setStaffModalOpen(false);
      setStaffFormData({ fullName: '', email: '', password: '', role: 'lab_admin', phone: '', department: '' });
      setActionFeedback({
        type: 'success',
        message: `Staff member ${staffFormData.fullName} (${staffFormData.email}) created successfully with role ${staffFormData.role}.`,
      });
      fetchLabDetails();
    } catch (err) {
      setActionFeedback({
        type: 'warning',
        message: err.response?.data?.message || err.message || 'Failed to create staff member',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const fetchLabDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await superAdminService.getLaboratory(id);
      setLab(data);
      setEditFormData({
        name: data.name || '',
        legalName: data.legalName || '',
        contactEmail: data.contactEmail || '',
        contactPhone: data.contactPhone || '',
        timezone: data.timezone || 'UTC',
        locale: data.locale || 'en-US',
      });
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load laboratory';
      const status = err.response?.status;
      setError({ message: msg, status });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabDetails();
  }, [id]);

  const handleOpenStatusModal = (status) => {
    setTargetStatus(status);
    setStatusReason('');
    setStatusModalOpen(true);
  };

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionFeedback(null);
    try {
      await superAdminService.updateLaboratoryStatus(lab.tenantId, {
        status: targetStatus,
        reason: statusReason,
      });
      setStatusModalOpen(false);
      setActionFeedback({
        type: 'success',
        message: `Laboratory status successfully transitioned to ${targetStatus}.`,
      });
      fetchLabDetails();
    } catch (err) {
      setActionFeedback({
        type: 'warning',
        message: err.response?.data?.message || err.message || 'Failed to transition status',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionFeedback(null);
    try {
      await superAdminService.updateLaboratory(lab.tenantId, editFormData);
      setEditModalOpen(false);
      setActionFeedback({
        type: 'success',
        message: 'Laboratory profile details updated successfully.',
      });
      fetchLabDetails();
    } catch (err) {
      setActionFeedback({
        type: 'warning',
        message: err.response?.data?.message || err.message || 'Failed to update profile',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyDomain = async (domain) => {
    setActionLoading(true);
    setActionFeedback(null);
    try {
      await superAdminService.verifyDomainMapping(lab.tenantId, domain);
      setActionFeedback({
        type: 'success',
        message: `Hostname ${domain} verified and activated.`,
      });
      fetchLabDetails();
    } catch (err) {
      setActionFeedback({
        type: 'warning',
        message: err.response?.data?.message || err.message || 'Domain verification check failed',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingState message="Loading laboratory profile and portal access..." />;
  if (error && (error.status === 401 || error.status === 403)) {
    return <AdminSecurityBoundary errorDetails={error.message} />;
  }
  if (error) return <ErrorState title="Laboratory Not Found" message={error.message} onRetry={fetchLabDetails} />;
  if (!lab) return null;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE': return <Badge variant="success">Active</Badge>;
      case 'PENDING': return <Badge variant="amber">Pending</Badge>;
      case 'SUSPENDED': return <Badge variant="purple">Suspended</Badge>;
      case 'INACTIVE': return <Badge variant="slate">Inactive</Badge>;
      default: return <Badge variant="slate">{status}</Badge>;
    }
  };

  const getStaffRoleBadge = (role = '') => {
    const r = String(role).toLowerCase();
    switch (r) {
      case 'lab_admin':
        return <Badge variant="purple">Lab Administrator</Badge>;
      case 'pathologist':
      case 'report_reviewer':
        return <Badge variant="blue">Pathologist</Badge>;
      case 'lab_technician':
        return <Badge variant="cyan">Lab Technician</Badge>;
      case 'receptionist':
        return <Badge variant="teal">Receptionist</Badge>;
      case 'phlebotomist':
        return <Badge variant="warning">Phlebotomist</Badge>;
      case 'billing_clerk':
      case 'accountant':
        return <Badge variant="info">Billing Clerk</Badge>;
      default:
        return <Badge variant="slate">{role ? role.replace(/_/g, ' ') : 'Staff'}</Badge>;
    }
  };

  const portalUrl = `${window.location.origin}/lab/${(lab.code || lab.tenantId).toLowerCase()}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 3D-Styled Soft Eye-Friendly Hero Banner with Laboratory Profile Details */}
      <div
        className="lab-details-hero-banner"
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f0f7ff 45%, #e0f2fe 100%)',
          borderRadius: '16px',
          border: '1.5px solid #bae6fd',
          padding: '1.5rem 1.75rem',
          boxShadow: '0 12px 28px -6px rgba(2, 132, 199, 0.12), 0 4px 12px rgba(15, 23, 42, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.95)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Soft 3D ambient lighting orbs */}
        <div
          style={{
            position: 'absolute',
            top: '-30%',
            right: '-10%',
            width: '320px',
            height: '320px',
            background: 'radial-gradient(circle, rgba(186, 230, 253, 0.5) 0%, rgba(224, 242, 254, 0) 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-35%',
            left: '20%',
            width: '280px',
            height: '280px',
            background: 'radial-gradient(circle, rgba(224, 231, 255, 0.4) 0%, rgba(255, 255, 255, 0) 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* Top Action & Navigation Row inside Banner */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
            marginBottom: '1.25rem',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <Link
            to="/super-admin"
            className="btn btn-secondary btn-sm"
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              boxShadow: '0 2px 5px rgba(15, 23, 42, 0.05)',
              fontWeight: 600,
              color: 'var(--slate-700)',
            }}
          >
            <ArrowLeft size={14} />
            <span>Platform Overview</span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Lifecycle Action Button */}
            {lab.status === 'ACTIVE' && (
              <button
                className="btn btn-secondary btn-sm"
                style={{ color: '#b45309', borderColor: '#fde68a', background: '#ffffff', boxShadow: '0 2px 5px rgba(15, 23, 42, 0.05)' }}
                disabled={actionLoading}
                onClick={() => handleOpenStatusModal('SUSPENDED')}
              >
                <Pause size={14} />
                <span>Suspend Laboratory</span>
              </button>
            )}

            {lab.status === 'SUSPENDED' && (
              <button
                className="btn btn-primary btn-sm"
                disabled={actionLoading}
                onClick={() => handleOpenStatusModal('ACTIVE')}
              >
                <Play size={14} />
                <span>Reactivate Laboratory</span>
              </button>
            )}

            {lab.status === 'PENDING' && (
              <button
                className="btn btn-primary btn-sm"
                disabled={actionLoading}
                onClick={() => handleOpenStatusModal('ACTIVE')}
              >
                <CheckCircle2 size={14} />
                <span>Activate Laboratory</span>
              </button>
            )}

            <button
              className="btn btn-secondary btn-sm"
              style={{ background: '#ffffff', border: '1px solid #cbd5e1', boxShadow: '0 2px 5px rgba(15, 23, 42, 0.05)' }}
              onClick={fetchLabDetails}
              title="Refresh details"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>

            <button
              className="btn btn-secondary btn-sm"
              style={{ background: '#ffffff', border: '1px solid #cbd5e1', boxShadow: '0 2px 5px rgba(15, 23, 42, 0.05)' }}
              onClick={() => setEditModalOpen(true)}
            >
              <Edit size={14} />
              <span>Edit Profile</span>
            </button>
          </div>
        </div>

        {/* Laboratory Title & Primary Identification */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            marginBottom: '1.25rem',
            position: 'relative',
            zIndex: 1,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.3rem',
              fontWeight: 800,
              boxShadow: '0 6px 14px rgba(37, 99, 235, 0.22)',
            }}
          >
            {(lab.name || 'L').charAt(0).toUpperCase()}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1
                style={{
                  fontSize: '1.6rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  margin: 0,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                {lab.name}
              </h1>
              {getStatusBadge(lab.status)}
              <span
                style={{
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  background: '#e0f2fe',
                  color: '#0369a1',
                  padding: '2px 8px',
                  borderRadius: '5px',
                  border: '1px solid #bae6fd',
                }}
              >
                {lab.code}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginTop: '4px',
                fontSize: '0.785rem',
                color: '#64748b',
                flexWrap: 'wrap',
              }}
            >
              <span>Registered: <strong style={{ color: '#0f172a' }}>{new Date(lab.createdAt || Date.now()).toLocaleDateString()}</strong></span>
            </div>
          </div>
        </div>

        {/* Laboratory Profile Details Grid (Embedded directly inside this 3D Banner) */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0.75rem',
            paddingTop: '1rem',
            borderTop: '1px solid rgba(186, 230, 253, 0.65)',
          }}
        >
          {/* Facility Name */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(186, 230, 253, 0.75)',
              borderRadius: '10px',
              padding: '0.75rem 0.95rem',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.04)',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Full Facility Name
            </div>
            <div
              style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.875rem', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              title={lab.name}
            >
              {lab.name}
            </div>
          </div>

          {/* Legal Registered Entity */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(186, 230, 253, 0.75)',
              borderRadius: '10px',
              padding: '0.75rem 0.95rem',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.04)',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Legal Registered Entity
            </div>
            <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.85rem', marginTop: '3px' }}>
              {lab.legalName || 'N/A'}
            </div>
          </div>

          {/* Primary Email */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(186, 230, 253, 0.75)',
              borderRadius: '10px',
              padding: '0.75rem 0.95rem',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.04)',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Primary Email
            </div>
            <div
              style={{ fontWeight: 600, color: '#0284c7', fontSize: '0.85rem', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              title={lab.contactEmail || lab.email}
            >
              {lab.contactEmail || lab.email || 'N/A'}
            </div>
          </div>

          {/* Contact Phone */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(186, 230, 253, 0.75)',
              borderRadius: '10px',
              padding: '0.75rem 0.95rem',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.04)',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Contact Phone
            </div>
            <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.85rem', marginTop: '3px' }}>
              {lab.contactPhone || 'N/A'}
            </div>
          </div>

          {/* Timezone & Locale */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(186, 230, 253, 0.75)',
              borderRadius: '10px',
              padding: '0.75rem 0.95rem',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.04)',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Timezone & Locale
            </div>
            <div style={{ fontWeight: 600, color: '#334155', fontSize: '0.85rem', marginTop: '3px' }}>
              {lab.timezone || 'UTC'} ({lab.locale || 'en-US'})
            </div>
          </div>

          {/* Physical Address */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.88)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(186, 230, 253, 0.75)',
              borderRadius: '10px',
              padding: '0.75rem 0.95rem',
              boxShadow: '0 2px 6px rgba(2, 132, 199, 0.04)',
            }}
          >
            <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Physical Location
            </div>
            <div
              style={{ fontWeight: 600, color: '#334155', fontSize: '0.85rem', marginTop: '3px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              title={[lab.address?.street, lab.address?.city, lab.address?.state, lab.address?.postalCode, lab.address?.country].filter(Boolean).join(', ')}
            >
              {[lab.address?.street, lab.address?.city, lab.address?.state, lab.address?.postalCode, lab.address?.country].filter(Boolean).join(', ') || 'N/A'}
            </div>
          </div>
        </div>
      </div>

      {actionFeedback && (
        <div>
          <StatusBanner
            type={actionFeedback.type}
            badgeText="Super Admin Action"
            message={actionFeedback.message}
          />
        </div>
      )}

      {/* Dedicated Whitelabel Portal & Staff Sign-In Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #eff6ff 100%)',
          border: '1px solid #bae6fd',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          boxShadow: '0 4px 12px rgba(2, 132, 199, 0.06)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--primary-blue), #0284c7)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 10px rgba(2, 132, 199, 0.25)',
              }}
            >
              <Globe size={22} />
            </div>
            <div>
              <div style={{ fontSize: '0.925rem', fontWeight: 700, color: '#0369a1' }}>
                Dedicated Whitelabel Portal URL
              </div>
              <div style={{ fontSize: '0.8rem', color: '#0c4a6e' }}>
                Laboratory Administrators, pathologists, technicians, and accessioners sign in directly through this isolated URL.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              readOnly
              value={portalUrl}
              className="form-input"
              style={{
                fontFamily: 'monospace',
                fontSize: '0.8125rem',
                minWidth: '280px',
                background: 'white',
                fontWeight: 600,
                color: 'var(--primary-800)',
              }}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => copyPortalUrl(portalUrl)}
              title="Copy Portal URL to Clipboard"
            >
              {copiedPortal ? (
                <span style={{ color: '#059669', fontWeight: 600 }}>Copied!</span>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy URL</span>
                </>
              )}
            </button>
            <a
              href={`/lab/${(lab.code || lab.tenantId).toLowerCase()}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              title="Open Whitelabel Portal in a new tab"
            >
              <span>Launch Portal</span>
              <Globe size={14} />
            </a>
          </div>
        </div>
      </div>

      {/* Laboratory Staff & Administrative Team Section */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} style={{ color: 'var(--primary-blue, #2563eb)' }} />
            <h2 className="card-title" style={{ fontSize: '1.05rem', margin: 0 }}>
              Laboratory Staff & Administrative Team ({lab.staff?.length || 0})
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span className="badge badge-blue">
              {lab.adminUser ? `Admin: ${lab.adminUser.fullName}` : 'No Admin Configured'}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setStaffModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <UserPlus size={14} />
              <span>{lab.adminUser ? 'Add Staff Member' : 'Configure Administrator'}</span>
            </button>
          </div>
        </div>

        {/* Lab Administrator Spotlight Banner */}
        {lab.adminUser && (
          <div
            style={{
              padding: '0.85rem 1rem',
              marginBottom: '1rem',
              background: '#f8fafc',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              borderRadius: '8px',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--purple-100, #f3e8ff)',
                  color: 'var(--purple-700, #7e22ce)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1rem',
                }}
              >
                {(lab.adminUser.fullName || 'A').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '0.925rem', color: 'var(--slate-900, #0f172a)' }}>
                    {lab.adminUser.fullName}
                  </strong>
                  <Badge variant="purple">Lab Administrator</Badge>
                </div>
                <div style={{ fontSize: '0.785rem', color: 'var(--slate-600, #475569)', marginTop: '2px' }}>
                  <span>Email: <strong>{lab.adminUser.email}</strong></span>
                  {lab.adminUser.phone && <span> • Phone: {lab.adminUser.phone}</span>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <a
                href={portalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Open login portal in new tab"
              >
                <span>Admin Login Portal</span>
                <ExternalLink size={13} />
              </a>
            </div>
          </div>
        )}

        {/* All Staff Members Table */}
        <div className="table-container">
          <table className="lms-table">
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Email Address</th>
                <th>Assigned Role</th>
                <th>Department / Contact</th>
                <th>Status</th>
                <th>Created At</th>
              </tr>
            </thead>
            <tbody>
              {!lab.staff || lab.staff.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--slate-500)' }}>
                    No staff members registered in this laboratory's database yet.
                  </td>
                </tr>
              ) : (
                lab.staff.map((member) => (
                  <tr key={member.userId || member.email}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            backgroundColor: member.role === 'lab_admin' ? '#f3e8ff' : '#eff6ff',
                            color: member.role === 'lab_admin' ? '#7e22ce' : '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            fontSize: '0.85rem',
                          }}
                        >
                          {(member.fullName || 'S').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{member.fullName}</span>
                          <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>
                            {member.userId || '—'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--slate-800)' }}>{member.email}</span>
                    </td>
                    <td>{getStaffRoleBadge(member.role)}</td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--slate-600)' }}>
                        {member.department ? `${member.department} ` : ''}
                        {member.phone ? `(${member.phone})` : (!member.department ? '—' : '')}
                      </span>
                    </td>
                    <td>
                      <Badge variant={member.isActive !== false ? 'success' : 'slate'}>
                        {member.isActive !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--slate-500)', whiteSpace: 'nowrap' }}>
                      {member.createdAt ? new Date(member.createdAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verified Domain Mappings (Rendered only if domains exist) */}
      {lab.domainMappings && lab.domainMappings.length > 0 && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={18} style={{ color: 'var(--primary-600)' }} />
              <h2 className="card-title" style={{ fontSize: '1rem', margin: 0 }}>Verified Domain Mappings</h2>
            </div>
            <Badge variant="blue">{lab.domainMappings.length} Domains</Badge>
          </div>

          <p style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', marginBottom: '1rem' }}>
            Strict hostname-to-tenant resolution. Arbitrary client tenant headers are explicitly rejected by tenant resolution middleware.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {lab.domainMappings.map((dm) => (
              <div
                key={dm.domain}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem',
                  background: '#f8fafc',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--slate-900)' }}>
                    {dm.domain}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                    {dm.isPrimary ? 'Primary Tenant Hostname' : 'Alternate Hostname'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {dm.isVerified ? (
                    <Badge variant="success">Verified</Badge>
                  ) : (
                    <>
                      <Badge variant="amber">Pending Verification</Badge>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={actionLoading}
                        onClick={() => handleVerifyDomain(dm.domain)}
                      >
                        Verify
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lifecycle Transition Modal */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title={`Transition Status to ${targetStatus}`}
      >
        <div style={{ padding: '0.5rem 0' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '1rem' }}>
            Are you sure you want to transition laboratory <strong>{lab.name}</strong> from{' '}
            <span className="badge badge-slate">{lab.status}</span> to{' '}
            <span className="badge badge-blue">{targetStatus}</span>?
          </p>

          {targetStatus === 'SUSPENDED' && (
            <div className="form-group">
              <label className="form-label" htmlFor="suspendReason">
                Suspension Reason (Required for Audit Compliance):
              </label>
              <textarea
                id="suspendReason"
                className="form-textarea"
                rows={3}
                placeholder="e.g. Compliance review hold, outstanding billing, or security review..."
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
                required
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStatusModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${targetStatus === 'SUSPENDED' ? 'btn-danger' : 'btn-primary'}`}
              disabled={actionLoading || (targetStatus === 'SUSPENDED' && !statusReason.trim())}
              onClick={handleStatusSubmit}
            >
              {actionLoading ? 'Processing...' : `Confirm ${targetStatus}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Edit Laboratory Profile"
      >
        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.5rem 0' }}>
          <div className="form-group">
            <label className="form-label">Laboratory Name *</label>
            <input
              type="text"
              className="form-input"
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Legal Registered Entity</label>
            <input
              type="text"
              className="form-input"
              value={editFormData.legalName}
              onChange={(e) => setEditFormData({ ...editFormData, legalName: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Primary Contact Email *</label>
            <input
              type="email"
              className="form-input"
              value={editFormData.contactEmail}
              onChange={(e) => setEditFormData({ ...editFormData, contactEmail: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contact Phone</label>
            <input
              type="tel"
              className="form-input"
              value={editFormData.contactPhone}
              onChange={(e) => setEditFormData({ ...editFormData, contactPhone: e.target.value })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Timezone</label>
              <input
                type="text"
                className="form-input"
                value={editFormData.timezone}
                onChange={(e) => setEditFormData({ ...editFormData, timezone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Locale</label>
              <input
                type="text"
                className="form-input"
                value={editFormData.locale}
                onChange={(e) => setEditFormData({ ...editFormData, locale: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Staff Modal */}
      <Modal
        isOpen={staffModalOpen}
        onClose={() => setStaffModalOpen(false)}
        title={lab.adminUser ? 'Add Laboratory Staff Member' : 'Configure Initial Laboratory Administrator'}
      >
        <form onSubmit={handleCreateStaff} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.5rem 0' }}>
          <div className="form-group">
            <label className="form-label">Staff Full Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Dr. Rajesh Kumar"
              value={staffFormData.fullName}
              onChange={(e) => setStaffFormData({ ...staffFormData, fullName: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address (Login Username) *</label>
            <input
              type="email"
              className="form-input"
              placeholder="staff@laboratory.com"
              value={staffFormData.email}
              onChange={(e) => setStaffFormData({ ...staffFormData, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Temporary Password *</label>
            <input
              type="password"
              className="form-input"
              placeholder="••••••••••••"
              value={staffFormData.password}
              onChange={(e) => setStaffFormData({ ...staffFormData, password: e.target.value })}
              minLength={8}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Assigned Role *</label>
            <select
              className="form-select"
              value={staffFormData.role}
              onChange={(e) => setStaffFormData({ ...staffFormData, role: e.target.value })}
              required
            >
              <option value="lab_admin">Laboratory Administrator (Full Lab Access)</option>
              <option value="pathologist">Pathologist / Medical Reviewer</option>
              <option value="lab_technician">Laboratory Technician</option>
              <option value="receptionist">Receptionist / Front Desk</option>
              <option value="phlebotomist">Phlebotomist / Sample Collector</option>
              <option value="billing_clerk">Billing Clerk / Accountant</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+91 98765 43210"
                value={staffFormData.phone}
                onChange={(e) => setStaffFormData({ ...staffFormData, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Department</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Hematology"
                value={staffFormData.department}
                onChange={(e) => setStaffFormData({ ...staffFormData, department: e.target.value })}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStaffModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>
              {actionLoading ? 'Creating...' : 'Create Staff Member'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default LaboratoryDetailsPage;
