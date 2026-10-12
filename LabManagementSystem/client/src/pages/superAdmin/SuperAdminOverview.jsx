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
  Server,
  Shield,
  PlusCircle,
  Database,
  ArrowRight,
  RefreshCw,
  Activity,
  Layers,
  ExternalLink,
  Copy,
  ChevronRight,
  Sparkles,
  Users,
  Mail,
  Lock,
  Globe,
  X,
  Check,
  Eye,
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
  const [selectedLabId, setSelectedLabId] = useState(null);
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
      const labs = labsData?.laboratories || overviewData?.recentLaboratories || [];
      setLaboratories(labs);
      // Select the first laboratory by default if available and none selected
      if (labs.length > 0 && !selectedLabId) {
        setSelectedLabId(labs[0].tenantId || labs[0].id);
      }
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
  const selectedLab = laboratories.find((l) => (l.tenantId || l.id) === selectedLabId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Cool Medical Tech Overview Banner */}
      <div
        className="overview-hero-banner"
        style={{
          background: 'linear-gradient(135deg, #091e3a 0%, #103766 50%, #0369a1 100%)',
          borderRadius: 'var(--radius-lg, 14px)',
          padding: '1.5rem 1.75rem',
          color: 'white',
          boxShadow: '0 10px 25px -5px rgba(2, 132, 199, 0.25), 0 4px 12px rgba(15, 23, 42, 0.2)',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(56, 189, 248, 0.25)',
        }}
      >
        {/* Cool radial glow overlay */}
        <div
          style={{
            position: 'absolute',
            top: '-60%',
            right: '-10%',
            width: '380px',
            height: '380px',
            background: 'radial-gradient(circle, rgba(56, 189, 248, 0.22) 0%, rgba(3, 105, 161, 0) 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div style={{ maxWidth: '640px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                borderRadius: '9999px',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#7dd3fc',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: '0.65rem',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#10b981',
                  boxShadow: '0 0 8px #10b981',
                  display: 'inline-block',
                }}
              />
              Platform Super Admin • Live Control Center
            </div>

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
              Laboratory Network &{' '}
              <span
                style={{
                  background: 'linear-gradient(90deg, #38bdf8, #67e8f9)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Multi-Tenant Operations
              </span>
            </h1>

            <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.45, maxWidth: '580px' }}>
              Real-time platform governance over operational medical laboratories, dedicated white-label portals, isolated tenant databases, and security compliance.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={fetchOverview}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '0.55rem 0.95rem',
                borderRadius: 'var(--radius-md, 8px)',
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')}
              title="Refresh overview metrics"
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>

            <Link
              to="/super-admin/laboratories"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '0.55rem 1.1rem',
                borderRadius: 'var(--radius-md, 8px)',
                background: 'linear-gradient(135deg, #0284c7, #06b6d4)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.8125rem',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(6, 182, 212, 0.35)',
                textDecoration: 'none',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <Building2 size={15} />
              <span>Laboratories Registry</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics (Compact & Sleek) */}
      <section>
        <div className="overview-stats-grid">
          <StatCard
            title="Total Laboratories"
            value={metrics?.totalLaboratories || laboratories.length || 0}
            subtitle="Registered facilities"
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
            subtitle="DB connectivity"
            icon={Database}
            colorScheme="teal"
            badgeText="Normal"
          />
        </div>
      </section>

      {/* Interactive Registered Laboratories Section (Name Cards + Click for Details) */}
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
              Click any laboratory card to view dedicated portal, database status, and admin details.
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Laboratory Name Cards Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '0.75rem',
              }}
            >
              {laboratories.map((lab) => {
                const labKey = lab.tenantId || lab.id;
                const isSelected = selectedLabId === labKey;
                const portalUrl = `${originUrl}/lab/${lab.code.toLowerCase()}`;

                return (
                  <div
                    key={labKey}
                    onClick={() => setSelectedLabId(isSelected ? null : labKey)}
                    style={{
                      background: isSelected ? '#f0f9ff' : '#ffffff',
                      border: `1.5px solid ${isSelected ? '#0284c7' : 'var(--border-subtle, #e2e8f0)'}`,
                      borderRadius: 'var(--radius-md, 10px)',
                      padding: '0.85rem 1rem',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      boxShadow: isSelected
                        ? '0 4px 12px rgba(2, 132, 199, 0.15)'
                        : '0 1px 3px rgba(15, 23, 42, 0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = '#93c5fd';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--border-subtle, #e2e8f0)';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '8px',
                          backgroundColor: isSelected ? '#0284c7' : '#eff6ff',
                          color: isSelected ? '#ffffff' : '#2563eb',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '0.9rem',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {(lab.name || 'L').charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            color: isSelected ? '#0369a1' : 'var(--text-main, #0f172a)',
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                          title={lab.name}
                        >
                          {lab.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span
                            style={{
                              fontFamily: 'monospace',
                              fontWeight: 700,
                              fontSize: '0.7rem',
                              color: 'var(--slate-600)',
                              background: '#f1f5f9',
                              padding: '1px 5px',
                              borderRadius: '4px',
                            }}
                          >
                            {lab.code}
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--slate-400)' }}>•</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)' }}>
                            {lab.staffCount ?? lab.staff?.length ?? 1} Staff
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                      {getStatusBadge(lab.status)}
                      <span style={{ fontSize: '0.68rem', color: isSelected ? '#0284c7' : 'var(--slate-400)', fontWeight: 600 }}>
                        {isSelected ? 'Selected' : 'Details →'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Selected Laboratory Detail Card (Appears when clicked!) */}
            {selectedLab && (
              <div
                style={{
                  background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
                  border: '1.5px solid #0284c7',
                  borderRadius: 'var(--radius-lg, 12px)',
                  padding: '1.25rem',
                  boxShadow: '0 8px 20px -4px rgba(2, 132, 199, 0.12)',
                  animation: 'modalIn 0.2s ease-out',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #0284c7, #2563eb)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1.1rem',
                        boxShadow: '0 4px 10px rgba(37, 99, 235, 0.25)',
                      }}
                    >
                      {(selectedLab.name || 'L').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          {selectedLab.name}
                        </h3>
                        <span
                          style={{
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            padding: '2px 8px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            borderRadius: '4px',
                            fontSize: '0.775rem',
                            border: '1px solid #bfdbfe',
                          }}
                        >
                          {selectedLab.code}
                        </span>
                        {getStatusBadge(selectedLab.status)}
                      </div>
                      <p style={{ margin: '3px 0 0 0', fontSize: '0.785rem', color: 'var(--slate-500)' }}>
                        Tenant ID: <code style={{ color: 'var(--slate-700)' }}>{selectedLab.tenantId || selectedLab.id}</code>
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => setSelectedLabId(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--slate-400)',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px',
                    }}
                    title="Close details"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* 4 Detail Info Cards */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: '0.75rem',
                    marginBottom: '1rem',
                  }}
                >
                  {/* Whitelabel Portal Link */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Globe size={15} style={{ color: '#0284c7' }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-600)', textTransform: 'uppercase' }}>
                        Dedicated Login Portal
                      </span>
                    </div>
                    <code
                      style={{
                        display: 'block',
                        fontSize: '0.75rem',
                        color: '#0284c7',
                        background: '#f0f9ff',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        marginBottom: '8px',
                        wordBreak: 'break-all',
                      }}
                    >
                      {`${originUrl}/lab/${selectedLab.code.toLowerCase()}`}
                    </code>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => copyToClipboard(`${originUrl}/lab/${selectedLab.code.toLowerCase()}`, selectedLab.code)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                      >
                        {copiedCode === selectedLab.code ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                        <span>{copiedCode === selectedLab.code ? 'Copied' : 'Copy Link'}</span>
                      </button>
                      <a
                        href={`${originUrl}/lab/${selectedLab.code.toLowerCase()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.72rem', color: '#0284c7' }}
                      >
                        <ExternalLink size={12} />
                        <span>Open Portal</span>
                      </a>
                    </div>
                  </div>

                  {/* Administrator Credentials */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Shield size={15} style={{ color: '#7c3aed' }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-600)', textTransform: 'uppercase' }}>
                        Lab Administrator
                      </span>
                    </div>
                    {selectedLab.adminUser ? (
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--slate-800)' }}>
                          {selectedLab.adminUser.fullName}
                        </div>
                        <div style={{ fontSize: '0.775rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                          {selectedLab.adminUser.email}
                        </div>
                        <span className="badge badge-purple" style={{ marginTop: '6px', fontSize: '0.68rem' }}>
                          Primary Admin
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                        Default Administrator provisioned
                      </div>
                    )}
                  </div>

                  {/* Tenant Database Info */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '0.85rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Database size={15} style={{ color: '#059669' }} />
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-600)', textTransform: 'uppercase' }}>
                        Dedicated DB
                      </span>
                    </div>
                    <code
                      style={{
                        display: 'block',
                        fontSize: '0.75rem',
                        color: 'var(--slate-700)',
                        background: '#f8fafc',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        marginBottom: '6px',
                        wordBreak: 'break-all',
                      }}
                    >
                      {selectedLab.database?.name || `lms_lab_${selectedLab.tenantId}`}
                    </code>
                    <Badge variant={selectedLab.database?.provisioningStatus === 'READY' ? 'teal' : 'blue'}>
                      {selectedLab.database?.provisioningStatus === 'READY' ? 'Ready & Online' : 'Active'}
                    </Badge>
                  </div>

                  {/* Staff & Settings Quick Access */}
                  <div
                    style={{
                      background: '#ffffff',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '0.85rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                        <Users size={15} style={{ color: '#ea580c' }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--slate-600)', textTransform: 'uppercase' }}>
                          Staff Team
                        </span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--slate-800)' }}>
                        {(selectedLab.staffCount ?? selectedLab.staff?.length ?? 0)} Staff Members
                      </div>
                    </div>

                    <Link
                      to={`/super-admin/laboratories/${selectedLab.tenantId || selectedLab.id}`}
                      className="btn btn-primary btn-sm"
                      style={{ marginTop: '8px', width: '100%', justifyContent: 'center' }}
                    >
                      <span>Manage Laboratory Settings</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>
              </div>
            )}
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
