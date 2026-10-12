/**
 * Lab Management System (LMS) - Platform Super Admin Laboratory Details & Provisioning Control
 * Medical365 Aesthetic: White rounded cards, light borders, crisp typography, and lifecycle controls
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
  History,
  XCircle,
  Server,
  Copy,
  Users,
  UserCheck,
  UserPlus,
  ExternalLink,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
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
  const [auditLogs, setAuditLogs] = useState([]);
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

      // Also fetch audit logs for this tenant
      try {
        const auditRes = await superAdminService.getAuditLogs({ tenantId: data.tenantId, limit: 10 });
        setAuditLogs(auditRes.items || []);
      } catch (err) {
        console.warn('Could not load tenant audit logs:', err);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to load laboratory details';
      const status = err.response?.status;
      setError({ message: msg, status });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabDetails();
  }, [id]);

  // Handle Lifecycle Status Transition
  const handleOpenStatusModal = (status) => {
    setTargetStatus(status);
    setStatusReason('');
    setStatusModalOpen(true);
  };

  const handleConfirmStatusTransition = async () => {
    setActionLoading(true);
    setActionFeedback(null);
    try {
      const updated = await superAdminService.transitionStatus(lab.tenantId, targetStatus, statusReason);
      setLab(updated);
      setStatusModalOpen(false);
      setActionFeedback({
        type: 'success',
        message: `Laboratory status successfully transitioned to ${targetStatus}.`,
      });
      // Refresh audit logs
      const auditRes = await superAdminService.getAuditLogs({ tenantId: lab.tenantId, limit: 10 });
      setAuditLogs(auditRes.items || []);
    } catch (err) {
      setActionFeedback({
        type: 'warning',
        message: err.response?.data?.message || err.message || 'Status transition failed',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Idempotent Database Provisioning Retry
  const handleRetryProvisioning = async () => {
    setActionLoading(true);
    setActionFeedback(null);
    try {
      const result = await superAdminService.retryProvisioning(lab.tenantId);
      setActionFeedback({
        type: 'success',
        message: `Tenant logical database provisioning succeeded: ${result.provisioningStatus}. Database: ${result.databaseName}`,
      });
      fetchLabDetails();
    } catch (err) {
      setActionFeedback({
        type: 'warning',
        message: err.response?.data?.message || err.message || 'Provisioning retry failed',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Domain Verification
  const handleVerifyDomain = async (domain) => {
    setActionLoading(true);
    setActionFeedback(null);
    try {
      await superAdminService.verifyDomain(lab.tenantId, domain);
      setActionFeedback({
        type: 'success',
        message: `Domain ${domain} has been verified for tenant resolution.`,
      });
      fetchLabDetails();
    } catch (err) {
      setActionFeedback({
        type: 'warning',
        message: err.response?.data?.message || err.message || 'Domain verification failed',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Profile Update
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    setActionFeedback(null);
    try {
      const updated = await superAdminService.updateLaboratory(lab.tenantId, editFormData);
      setLab(updated);
      setEditModalOpen(false);
      setActionFeedback({
        type: 'success',
        message: 'Laboratory profile successfully updated.',
      });
    } catch (err) {
      setActionFeedback({
        type: 'warning',
        message: err.response?.data?.message || err.message || 'Profile update failed',
      });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingState message="Loading laboratory profile and database status..." />;
  if (error && (error.status === 401 || error.status === 403)) {
    return <AdminSecurityBoundary errorDetails={error.message} />;
  }
  if (error) return <ErrorState title="Laboratory Not Found" message={error.message} onRetry={fetchLabDetails} />;
  if (!lab) return null;

  const dbState = lab.database || {};
  const isProvReady = dbState.provisioningStatus === 'READY';
  const isProvFailed = dbState.provisioningStatus === 'FAILED';

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ACTIVE': return <Badge variant="success">Active</Badge>;
      case 'PENDING': return <Badge variant="amber">Pending</Badge>;
      case 'SUSPENDED': return <Badge variant="purple">Suspended</Badge>;
      case 'INACTIVE': return <Badge variant="slate">Inactive</Badge>;
      default: return <Badge variant="slate">{status}</Badge>;
    }
  };

  const getProvisioningBadge = (status) => {
    switch (status) {
      case 'READY': return <Badge variant="teal">Ready</Badge>;
      case 'IN_PROGRESS': return <Badge variant="blue">In Progress</Badge>;
      case 'FAILED': return <Badge variant="danger">Failed</Badge>;
      case 'NOT_STARTED':
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

  return (
    <>
      <PageHeader
        title={lab.name}
        description={`Master Tenant ID: ${lab.tenantId} | Unique Clinical Code: ${lab.code}`}
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Link to="/super-admin/laboratories" className="btn btn-secondary">
              <ArrowLeft size={14} />
              <span>Laboratories</span>
            </Link>
            <button className="btn btn-secondary" onClick={fetchLabDetails} title="Refresh details">
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setEditModalOpen(true)}>
              <Edit size={14} />
              <span>Edit Profile</span>
            </button>
          </div>
        }
      />

      {actionFeedback && (
        <div style={{ marginBottom: '1.25rem' }}>
          <StatusBanner
            type={actionFeedback.type}
            badgeText="Super Admin Action"
            message={actionFeedback.message}
          />
        </div>
      )}

      {/* Dedicated Whitelabel Portal & Staff Sign-In Card */}
      {lab && (
        <div
          className="card"
          style={{
            marginBottom: '1.25rem',
            background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #eff6ff 100%)',
            border: '1px solid #bae6fd',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, var(--primary-blue), #0284c7)',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)',
                }}
              >
                <Globe size={22} />
              </div>
              <div>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: '#0369a1' }}>
                  Dedicated Whitelabel Portal URL
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#0c4a6e' }}>
                  Laboratory Administrators, pathologists, technicians, and accessioners sign in directly through this isolated URL.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/lab/${(lab.code || lab.tenantId).toLowerCase()}`}
                className="form-input"
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.8125rem',
                  minWidth: '290px',
                  background: 'white',
                  fontWeight: 600,
                  color: 'var(--primary-800)',
                }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => copyPortalUrl(`${window.location.origin}/lab/${(lab.code || lab.tenantId).toLowerCase()}`)}
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
      )}

      {/* Primary Lifecycle & Controls Header Card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Operational Lifecycle
              </div>
              <div style={{ marginTop: '4px' }}>{getStatusBadge(lab.status)}</div>
            </div>

            <div style={{ height: '36px', width: '1px', background: 'var(--border-subtle)' }} />

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Tenant DB Provisioning
              </div>
              <div style={{ marginTop: '4px' }}>{getProvisioningBadge(dbState.provisioningStatus)}</div>
            </div>

            <div style={{ height: '36px', width: '1px', background: 'var(--border-subtle)' }} />

            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Logical DB Name
              </div>
              <div style={{ marginTop: '4px', fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-700)', fontSize: '0.8125rem' }}>
                {dbState.databaseName || `lms_lab_${lab.tenantId}`}
              </div>
            </div>
          </div>

          {/* Action Buttons based on state machine */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Retry Database Provisioning button if not ready */}
            {(!isProvReady || isProvFailed) && (
              <button
                className="btn btn-secondary"
                style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                disabled={actionLoading}
                onClick={handleRetryProvisioning}
                title="Retry tenant logical database provisioning"
              >
                <RefreshCw size={15} className={actionLoading ? 'animate-spin' : ''} />
                <span>Retry DB Provisioning</span>
              </button>
            )}

            {lab.status === 'PENDING' && (
              <button
                className="btn btn-primary"
                disabled={actionLoading || !isProvReady}
                onClick={() => handleOpenStatusModal('ACTIVE')}
                title={!isProvReady ? 'Database provisioning must be READY before activating laboratory' : 'Activate laboratory'}
              >
                <CheckCircle2 size={16} />
                <span>Activate Laboratory</span>
              </button>
            )}

            {lab.status === 'ACTIVE' && (
              <button
                className="btn btn-secondary"
                style={{ color: '#b45309', borderColor: '#fde68a' }}
                disabled={actionLoading}
                onClick={() => handleOpenStatusModal('SUSPENDED')}
              >
                <Pause size={16} />
                <span>Suspend Laboratory</span>
              </button>
            )}

            {lab.status === 'SUSPENDED' && (
              <button
                className="btn btn-primary"
                disabled={actionLoading}
                onClick={() => handleOpenStatusModal('ACTIVE')}
              >
                <Play size={16} />
                <span>Reactivate Laboratory</span>
              </button>
            )}

            {(lab.status === 'SUSPENDED' || lab.status === 'PENDING') && (
              <button
                className="btn btn-secondary"
                style={{ color: 'var(--slate-600)' }}
                disabled={actionLoading}
                onClick={() => handleOpenStatusModal('INACTIVE')}
              >
                <XCircle size={16} />
                <span>Deactivate</span>
              </button>
            )}
          </div>
        </div>

        {lab.status === 'PENDING' && !isProvReady && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span>
                <strong>Activation Guard:</strong> This laboratory cannot be activated until its dedicated logical database has finished provisioning successfully.
              </span>
            </div>
            <button
              className="btn btn-primary btn-sm"
              disabled={actionLoading}
              onClick={handleRetryProvisioning}
              style={{ whiteSpace: 'nowrap' }}
            >
              <RefreshCw size={13} className={actionLoading ? 'animate-spin' : ''} />
              <span>Retry Database Provisioning</span>
            </button>
          </div>
        )}
      </div>

      {/* Laboratory Staff & Administrative Team Section */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} style={{ color: 'var(--primary-blue, #2563eb)' }} />
            <h2 className="card-title">
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
              padding: '1rem',
              marginBottom: '1rem',
              background: '#f8fafc',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              borderRadius: 'var(--radius-md, 8px)',
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
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--purple-100, #f3e8ff)',
                  color: 'var(--purple-700, #7e22ce)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1.1rem',
                }}
              >
                {(lab.adminUser.fullName || 'A').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '0.95rem', color: 'var(--slate-900, #0f172a)' }}>
                    {lab.adminUser.fullName}
                  </strong>
                  <Badge variant="purple">Lab Administrator</Badge>
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--slate-600, #475569)', marginTop: '2px' }}>
                  <span>Email: <strong>{lab.adminUser.email}</strong></span>
                  {lab.adminUser.phone && <span> • Phone: {lab.adminUser.phone}</span>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <a
                href={`${window.location.origin}/lab/${lab.code.toLowerCase()}`}
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {/* Database Provisioning Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Database size={18} style={{ color: 'var(--primary-600)' }} />
              <h2 className="card-title">Dedicated Tenant Database</h2>
            </div>
            {getProvisioningBadge(dbState.provisioningStatus)}
          </div>

          <p style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', marginBottom: '1rem' }}>
            Sovereign multi-tenant logical database isolation. No patient data, test orders, or clinical records are stored in the platform master database.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: 'var(--slate-500)' }}>Logical Database Name:</span>
              <code style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{dbState.databaseName || `lms_lab_${lab.tenantId}`}</code>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: 'var(--slate-500)' }}>Provisioning Mode:</span>
              <span style={{ fontWeight: 600 }}>
                {dbState.isLiveDatabase ? (
                  <span style={{ color: '#059669' }}>● LIVE MONGODB CLUSTER</span>
                ) : (
                  <span style={{ color: '#d97706' }}>● OFFLINE SIMULATED STORAGE</span>
                )}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: 'var(--slate-500)' }}>Strategy:</span>
              <span style={{ fontWeight: 500 }}>{dbState.provisioningStrategy || 'OFFLINE_SIMULATED_DB'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: 'var(--slate-500)' }}>Provisioned Collections:</span>
              <span style={{ fontWeight: 500 }}>
                {dbState.provisionedCollections?.length || 0} collections initialized
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: 'var(--slate-500)' }}>Last Provisioned:</span>
              <span style={{ color: 'var(--slate-700)' }}>
                {dbState.lastProvisionedAt ? new Date(dbState.lastProvisionedAt).toLocaleString() : 'N/A'}
              </span>
            </div>

            {dbState.errorMessage && (
              <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#b91c1c' }}>
                <div style={{ fontWeight: 600, marginBottom: '2px' }}>Provisioning Error:</div>
                <div>{dbState.errorMessage}</div>
              </div>
            )}
          </div>

          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={actionLoading}
              onClick={handleRetryProvisioning}
            >
              <RefreshCw size={13} />
              <span>Retry Database Provisioning (Idempotent)</span>
            </button>
          </div>
        </div>

        {/* Domain Mappings Card */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={18} style={{ color: 'var(--primary-600)' }} />
              <h2 className="card-title">Verified Domain Mappings</h2>
            </div>
            <Badge variant="blue">{lab.domainMappings?.length || 0} Domains</Badge>
          </div>

          <p style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', marginBottom: '1rem' }}>
            Strict hostname-to-tenant resolution. Arbitrary client tenant headers are explicitly rejected by tenant resolution middleware.
          </p>

          {lab.domainMappings && lab.domainMappings.length > 0 ? (
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
          ) : (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.8125rem' }}>
              No custom domain mappings registered for this tenant.
            </div>
          )}
        </div>

        {/* Laboratory Profile Details */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building2 size={18} style={{ color: 'var(--primary-600)' }} />
              <h2 className="card-title">Laboratory Profile</h2>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: 'var(--slate-500)' }}>Full Facility Name:</span>
              <span style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{lab.name}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: 'var(--slate-500)' }}>Legal Registered Entity:</span>
              <span style={{ color: 'var(--slate-700)' }}>{lab.legalName || 'N/A'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: 'var(--slate-500)' }}>Primary Email:</span>
              <span style={{ color: 'var(--slate-900)' }}>{lab.contactEmail}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: 'var(--slate-500)' }}>Contact Phone:</span>
              <span style={{ color: 'var(--slate-700)' }}>{lab.contactPhone || 'N/A'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: 'var(--slate-500)' }}>Time Zone:</span>
              <span style={{ color: 'var(--slate-700)' }}>{lab.timezone || 'UTC'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: 'var(--slate-500)' }}>Reporting Locale:</span>
              <span style={{ color: 'var(--slate-700)' }}>{lab.locale || 'en-US'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: 'var(--slate-500)' }}>Subscription Plan:</span>
              <Badge variant="blue">{lab.subscriptionPlan || 'standard'}</Badge>
            </div>

            {lab.address && (
              <div style={{ paddingTop: '0.25rem' }}>
                <span style={{ color: 'var(--slate-500)' }}>Physical Address:</span>
                <div style={{ color: 'var(--slate-800)', marginTop: '2px' }}>
                  {[lab.address.street, lab.address.city, lab.address.state, lab.address.postalCode, lab.address.country]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tenant Audit Trail */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={18} style={{ color: 'var(--primary-600)' }} />
              <h2 className="card-title">Tenant Audit Trail</h2>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Master DB Events</span>
          </div>

          {auditLogs.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {auditLogs.map((log, idx) => (
                <div
                  key={log._id || idx}
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    background: '#f8fafc',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <code style={{ fontWeight: 600, color: 'var(--primary-700)' }}>{log.action}</code>
                    <span style={{ color: 'var(--slate-400)' }}>
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ color: 'var(--slate-600)', marginTop: '3px' }}>
                    Actor: <strong>{log.actorEmail || 'platform-admin'}</strong> | Status: <strong>{log.status}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.8125rem' }}>
              No audit events recorded for this laboratory yet.
            </div>
          )}
        </div>
      </div>

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
                Suspension Reason (Required for compliance)
              </label>
              <textarea
                id="suspendReason"
                className="form-textarea"
                rows={3}
                placeholder="e.g. Administrative hold pending regulatory renewal..."
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1.25rem' }}>
            <button
              className="btn btn-secondary"
              onClick={() => setStatusModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirmStatusTransition}
              disabled={actionLoading}
            >
              {actionLoading ? 'Transitioning...' : `Confirm ${targetStatus}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Update Laboratory Profile"
      >
        <form onSubmit={handleSaveProfile} style={{ padding: '0.5rem 0' }}>
          <div className="form-group">
            <label className="form-label">Laboratory Name</label>
            <input
              type="text"
              className="form-input"
              required
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Legal Name</label>
            <input
              type="text"
              className="form-input"
              value={editFormData.legalName}
              onChange={(e) => setEditFormData({ ...editFormData, legalName: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Contact Email</label>
            <input
              type="email"
              className="form-input"
              required
              value={editFormData.contactEmail}
              onChange={(e) => setEditFormData({ ...editFormData, contactEmail: e.target.value })}
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

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Time Zone</label>
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setEditModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>
              {actionLoading ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Create Staff / Administrator Modal */}
      <Modal
        isOpen={staffModalOpen}
        onClose={() => setStaffModalOpen(false)}
        title={lab.adminUser ? 'Add Laboratory Staff Member' : 'Configure Initial Laboratory Administrator'}
      >
        <form onSubmit={handleCreateStaff} style={{ padding: '0.5rem 0' }}>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              className="form-input"
              required
              placeholder="e.g. Dr. John Doe"
              value={staffFormData.fullName}
              onChange={(e) => setStaffFormData({ ...staffFormData, fullName: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input
              type="email"
              className="form-input"
              required
              placeholder="e.g. admin@lab.com"
              value={staffFormData.email}
              onChange={(e) => setStaffFormData({ ...staffFormData, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password * (Min 8 characters, Upper, Lower & Number)</label>
            <input
              type="password"
              className="form-input"
              required
              placeholder="••••••••"
              value={staffFormData.password}
              onChange={(e) => setStaffFormData({ ...staffFormData, password: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Assigned Role</label>
            <select
              className="form-select"
              value={staffFormData.role}
              onChange={(e) => setStaffFormData({ ...staffFormData, role: e.target.value })}
            >
              <option value="lab_admin">Laboratory Administrator (Full Lab Access)</option>
              <option value="pathologist">Pathologist (Review & Verification)</option>
              <option value="lab_technician">Lab Technician (Testing & Results)</option>
              <option value="receptionist">Receptionist (Intake & Registration)</option>
              <option value="phlebotomist">Phlebotomist (Sample Collection)</option>
              <option value="billing_clerk">Billing Clerk (Invoices & Payments)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input
              type="tel"
              className="form-input"
              placeholder="+91 98765 43210"
              value={staffFormData.phone}
              onChange={(e) => setStaffFormData({ ...staffFormData, phone: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStaffModalOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={actionLoading}>
              {actionLoading ? 'Creating...' : (staffFormData.role === 'lab_admin' ? 'Create Administrator' : 'Create Staff Member')}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default LaboratoryDetailsPage;
