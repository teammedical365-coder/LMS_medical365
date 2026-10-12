/**
 * Lab Management System (LMS) - Platform Super Admin Overview
 * Medical365 Aesthetic: Cool-tone Operations Banner, Compact Stat Cards, Interactive Laboratory Directory
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  PlusCircle,
  ArrowRight,
  RefreshCw,
  Activity,
  ChevronRight,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Cool Medical Tech Overview Banner */}
      <div
        className="overview-hero-banner"
        style={{
          background: 'linear-gradient(135deg, #071527 0%, #0c2540 50%, #0e3b5e 100%)',
          borderRadius: 'var(--radius-lg, 14px)',
          padding: '1.5rem 1.75rem',
          color: 'white',
          boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.2), 0 4px 12px rgba(15, 23, 42, 0.25)',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(56, 189, 248, 0.18)',
        }}
      >
        {/* Cool radial glow overlay */}
        <div
          style={{
            position: 'absolute',
            top: '-60%',
            right: '-10%',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(34, 211, 238, 0.18) 0%, rgba(3, 105, 161, 0) 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div style={{ maxWidth: '680px' }}>
            <h1
              style={{
                fontSize: 'clamp(1.35rem, 2.5vw, 1.75rem)',
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.25,
                margin: '0 0 0.45rem 0',
                letterSpacing: '-0.02em',
              }}
            >
              Platform Administration & Registered Laboratories
            </h1>

            <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.45, maxWidth: '620px' }}>
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
                borderRadius: 'var(--radius-md, 8px)',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)')}
              title="Refresh overview metrics"
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics (4 Cards Only, Clean & Compact) */}
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
            colorScheme="cyan"
          />
          <StatCard
            title="Suspended / Inactive"
            value={(metrics?.suspendedLaboratories || 0) + (metrics?.inactiveLaboratories || 0)}
            subtitle="Compliance holds"
            icon={AlertTriangle}
            colorScheme="amber"
          />
        </div>
      </section>

      {/* Registered Laboratories Directory Cards */}
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

          <Link to="/super-admin/laboratories" className="btn btn-secondary btn-sm" style={{ fontSize: '0.775rem' }}>
            <span>Manage All in Directory</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {laboratories.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
            <Building2 size={36} style={{ margin: '0 auto 10px', opacity: 0.3 }} />
            <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '4px' }}>No Laboratories Found</h3>
            <p style={{ fontSize: '0.825rem', marginBottom: '14px' }}>You haven't registered any medical laboratories yet.</p>
            <Link to="/super-admin/laboratories" className="btn btn-primary btn-sm">
              <PlusCircle size={14} />
              <span>Register Your First Laboratory</span>
            </Link>
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
                    <ChevronRight size={16} style={{ color: '#94a3b8' }} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Platform Audit Trail */}
      <section className="card" style={{ padding: '1.25rem' }}>
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} style={{ color: 'var(--primary-blue)' }} />
            <h2 className="card-title" style={{ fontSize: '1rem', margin: 0 }}>Recent Platform Activity</h2>
          </div>
          <Link to="/super-admin/laboratories" className="btn btn-secondary btn-sm" style={{ fontSize: '0.775rem' }}>
            <span>All Laboratories</span>
            <ArrowRight size={13} />
          </Link>
        </div>

        {recentAudits.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1.75rem 1rem', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '0.85rem', margin: 0 }}>No recent administrative events recorded. Platform operations are running cleanly.</p>
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
                {recentAudits.slice(0, 5).map((event) => (
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
