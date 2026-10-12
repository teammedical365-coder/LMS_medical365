/**
 * Lab Management System (LMS) - Platform Super Admin Overview
 * Medical365 Aesthetic: White rounded cards, light borders, crisp typography, and stat cards
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Server,
  Shield,
  PlusCircle,
  Database,
  ArrowRight,
  RefreshCw,
  Activity,
  Layers,
  ExternalLink,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
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
  const [copiedCode, setCopiedCode] = useState(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewData, labsData] = await Promise.all([
        superAdminService.getOverview(),
        superAdminService.listLaboratories({ limit: 50 }).catch(() => ({ laboratories: [] })),
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

  const copyToClipboard = (text, code) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  if (loading) return <LoadingState message="Loading platform overview & verified laboratories..." />;
  if (error && (error.status === 401 || error.status === 403)) {
    return <AdminSecurityBoundary errorDetails={error.message} />;
  }
  if (error) return <ErrorState title="Platform Administration Error" message={error.message} onRetry={fetchOverview} />;

  const metrics = data?.metrics || data || {};
  const recentAudits = data?.recentAudits || [];

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

  const originUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <PageHeader
        title="Platform Administration & Registered Laboratories"
        description="Global platform supervision, active medical laboratories, direct white-label portals, and security compliance."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={fetchOverview} title="Refresh metrics">
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
            <Link to="/super-admin/laboratories/new" className="btn btn-primary">
              <PlusCircle size={16} />
              <span>Register New Laboratory</span>
            </Link>
          </div>
        }
      />

      {/* Primary KPI Metrics */}
      <section>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          <StatCard
            title="Total Laboratories"
            value={metrics?.totalLaboratories || laboratories.length || 0}
            subtitle="Your registered facilities"
            icon={Building2}
            colorScheme="blue"
            badgeText="Master DB"
          />
          <StatCard
            title="Active Operational"
            value={metrics?.activeLaboratories || laboratories.filter((l) => l.status === 'ACTIVE').length || 0}
            subtitle="Verified & provisioned"
            icon={CheckCircle2}
            colorScheme="green"
            badgeText="Live"
          />
          <StatCard
            title="Pending Onboarding"
            value={metrics?.pendingLaboratories || 0}
            subtitle="Awaiting activation"
            icon={Clock}
            colorScheme="cyan"
            badgeText="Pending"
          />
          <StatCard
            title="Suspended / Inactive"
            value={(metrics?.suspendedLaboratories || 0) + (metrics?.inactiveLaboratories || 0)}
            subtitle="Compliance holds"
            icon={AlertTriangle}
            colorScheme="amber"
            badgeText="Hold"
          />
          <StatCard
            title="System Health"
            value={metrics?.systemHealth || 'OPERATIONAL'}
            subtitle="Database connectivity"
            icon={Database}
            colorScheme="teal"
            badgeText="Normal"
          />
        </div>
      </section>

      {/* Active Registered Laboratories List */}
      <section className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={18} style={{ color: 'var(--primary-blue)' }} />
            <h2 className="card-title">Registered Laboratories ({laboratories.length})</h2>
          </div>
          <Link to="/super-admin/laboratories" className="btn btn-secondary btn-sm">
            <span>View All</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {laboratories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            <Building2 size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '6px' }}>No Laboratories Found</h3>
            <p style={{ fontSize: '0.875rem', marginBottom: '16px' }}>You haven't registered any medical laboratories yet.</p>
            <Link to="/super-admin/laboratories/new" className="btn btn-primary btn-sm">
              <PlusCircle size={15} />
              <span>Register Your First Laboratory</span>
            </Link>
          </div>
        ) : (
          <div className="table-container">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Laboratory</th>
                  <th>Lab Code</th>
                  <th>Lab Administrator</th>
                  <th>Staff Team</th>
                  <th>Dedicated Portal URL</th>
                  <th>Status</th>
                  <th>Database</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {laboratories.map((lab) => {
                  const portalUrl = `${originUrl}/lab/${lab.code.toLowerCase()}`;
                  const isCopied = copiedCode === lab.code;

                  return (
                    <tr key={lab.tenantId || lab.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--primary-subtle, #eff6ff)',
                              color: 'var(--primary-blue, #2563eb)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 600,
                              fontSize: '0.9rem',
                            }}
                          >
                            {(lab.name || 'L').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.925rem' }}>
                              {lab.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {lab.email || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            padding: '3px 8px',
                            background: '#f1f5f9',
                            borderRadius: '4px',
                            color: '#1e293b',
                            fontSize: '0.8125rem',
                          }}
                        >
                          {lab.code}
                        </span>
                      </td>
                      <td>
                        {lab.adminUser ? (
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem' }}>
                              {lab.adminUser.fullName}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {lab.adminUser.email}
                            </div>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <Badge variant="blue">
                          {(lab.staffCount ?? lab.staff?.length ?? 0)} Staff
                        </Badge>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <code
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--primary-blue, #2563eb)',
                              background: '#eff6ff',
                              padding: '3px 8px',
                              borderRadius: '4px',
                              maxWidth: '240px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'inline-block',
                            }}
                            title={portalUrl}
                          >
                            {`/lab/${lab.code.toLowerCase()}`}
                          </code>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() => copyToClipboard(portalUrl, lab.code)}
                            title="Copy full portal login link"
                          >
                            <span style={{ fontSize: '0.75rem' }}>{isCopied ? 'Copied!' : 'Copy'}</span>
                          </button>
                          <a
                            href={portalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', color: 'var(--primary-blue)' }}
                            title="Open login portal in new tab"
                          >
                            <ExternalLink size={13} />
                          </a>
                        </div>
                      </td>
                      <td>{getStatusBadge(lab.status)}</td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            color: lab.database?.provisioningStatus === 'READY' ? '#16a34a' : '#64748b',
                            background: lab.database?.provisioningStatus === 'READY' ? '#f0fdf4' : '#f8fafc',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: '1px solid',
                            borderColor: lab.database?.provisioningStatus === 'READY' ? '#bbf7d0' : '#e2e8f0',
                          }}
                        >
                          {lab.database?.name || `lms_lab_${lab.tenantId}`}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <Link
                            to={`/super-admin/laboratories/${lab.tenantId}`}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 10px' }}
                          >
                            <span>Manage</span>
                          </Link>
                          <a
                            href={portalUrl}
                            className="btn btn-primary btn-sm"
                            style={{ padding: '4px 10px' }}
                          >
                            <span>Enter Portal</span>
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Platform Audit Trail */}
      <section className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} style={{ color: 'var(--primary-blue)' }} />
            <h2 className="card-title">Recent Platform Activity</h2>
          </div>
          <Link to="/super-admin/laboratories" className="btn btn-secondary btn-sm">
            <span>All Laboratories</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {recentAudits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '0.875rem' }}>No recent administrative events recorded. Platform operations are running cleanly.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Target Laboratory</th>
                  <th>Actor</th>
                  <th>Event Details</th>
                </tr>
              </thead>
              <tbody>
                {recentAudits.map((event) => (
                  <tr key={event.eventId || event._id || Math.random()}>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {new Date(event.timestamp).toLocaleString()}
                    </td>
                    <td>{getActionBadge(event.action)}</td>
                    <td>
                      <strong style={{ fontFamily: 'monospace', color: 'var(--primary-blue)' }}>
                        {event.targetTenantId || 'Global Platform'}
                      </strong>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--slate-700)' }}>
                        {event.actor?.email || event.actor?.type || 'Super Admin'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {event.metadata ? JSON.stringify(event.metadata).slice(0, 70) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default SuperAdminOverview;
