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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await superAdminService.getOverview();
      setData(result);
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

  if (loading) return <LoadingState message="Loading platform overview & multi-tenant registry metrics..." />;
  if (error && (error.status === 401 || error.status === 403)) {
    return <AdminSecurityBoundary errorDetails={error.message} />;
  }
  if (error) return <ErrorState title="Platform Administration Error" message={error.message} onRetry={fetchOverview} />;

  const { metrics, recentAudits = [] } = data || { metrics: {} };

  const getActionBadge = (action) => {
    if (action.includes('REGISTERED')) return <Badge variant="blue">Registered</Badge>;
    if (action.includes('ACTIVATED') || action.includes('SUCCEEDED')) return <Badge variant="success">Active / Ready</Badge>;
    if (action.includes('SUSPENDED')) return <Badge variant="purple">Suspended</Badge>;
    if (action.includes('FAILED')) return <Badge variant="danger">Failed</Badge>;
    return <Badge variant="slate">{action}</Badge>;
  };

  return (
    <>
      <PageHeader
        title="Platform Administration & Multi-Tenant Registry"
        description="Global platform supervision, sovereign laboratory onboarding, logical tenant databases, and security compliance."
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
            value={metrics?.totalLaboratories || 0}
            subtitle="Registered medical facilities"
            icon={Building2}
            colorScheme="blue"
            badgeText="Master DB"
          />
          <StatCard
            title="Active Operational"
            value={metrics?.activeLaboratories || 0}
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
            title="Provisioning Alerts"
            value={metrics?.failedProvisioningCount || 0}
            subtitle="Failed database setups"
            icon={Database}
            colorScheme={metrics?.failedProvisioningCount > 0 ? 'red' : 'teal'}
            badgeText={metrics?.failedProvisioningCount > 0 ? 'Action Req.' : 'Nominal'}
          />
        </div>
      </section>

      {/* Multi-Tenant Architecture & Platform Status Card */}
      <section className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Server size={18} style={{ color: 'var(--primary-blue)' }} />
            <h2 className="card-title">Multi-Tenant Database Architecture Status (Phase 2)</h2>
          </div>
          <span className="badge badge-success">Architecture Active</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', fontSize: '0.875rem' }}>
          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Layers size={16} style={{ color: 'var(--primary-blue)' }} />
              <strong style={{ color: 'var(--text-main)' }}>Tenant Isolation Model</strong>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              Database-Per-Tenant logical isolation strategy. Every laboratory receives its own logical database (<code style={{ color: 'var(--primary-blue)' }}>lms_lab_&lt;tenantId&gt;</code>) preventing cross-tenant data leakage.
            </p>
          </div>

          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Shield size={16} style={{ color: 'var(--mint-text)' }} />
              <strong style={{ color: 'var(--text-main)' }}>Tenant Resolution Guard</strong>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              Cryptographic domain-matching active. Client-supplied headers (<code style={{ color: 'var(--slate-700)' }}>X-Tenant-ID</code>) are strictly treated as untrusted hints and rejected as authorization proof.
            </p>
          </div>

          <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Activity size={16} style={{ color: 'var(--cyan-600)' }} />
              <strong style={{ color: 'var(--text-main)' }}>Provisioning Lifecycle</strong>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
              Automated schema index and collection provisioning. Retries are strictly idempotent. Activation is blocked until database is verified ready.
            </p>
          </div>
        </div>
      </section>

      {/* Quick Navigation and Recent Audit Logs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
        <section className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} style={{ color: 'var(--primary-blue)' }} />
              <h2 className="card-title">Recent Platform Audit Trail</h2>
            </div>
            <Link to="/super-admin/laboratories" className="btn btn-secondary btn-sm">
              <span>View All Laboratories</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {recentAudits.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>No audit events recorded yet.</p>
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
                    <tr key={event.eventId}>
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
    </>
  );
}

export default SuperAdminOverview;
