/**
 * Lab Management System (LMS) - Laboratory Operations & Clinical Workstation Dashboard
 * 
 * Dynamically tailored to the staff user's active role & granted permissions:
 * - Lab Administrator: Full multi-department operations, revenue, staff directory, and clinical workstations.
 * - Pathologist: Professional Clinical Diagnostic Sign-Off Workstation with triage, abnormal/panic flags, and 1-click verification.
 * - Lab Testing / Technician: Professional Analyzer Bench Workstation with multi-tube queues, instrument status, and bench runs.
 * - Other Roles: Dynamically renders only the metrics, summary, pipeline, and records corresponding to granted permissions.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ClipboardList,
  FlaskConical,
  TestTube2,
  FileCheck2,
  FileText,
  CreditCard,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Microscope,
  ShieldCheck,
  Building2,
  Sparkles,
  Calendar,
  Timer,
  ArrowRight,
  UserCheck,
  Stethoscope,
  Activity,
  Cpu,
  Play,
  CheckCircle,
  Tag,
  RotateCcw,
  QrCode,
  FileCheck,
  Loader2,
  Layers,
  Search,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import Badge from '../../components/common/Badge';
import StatusBanner from '../../components/common/StatusBanner';
import Modal from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import api from '../../services/api';
import clinicalService from '../../services/clinicalService';

export function DashboardPage() {
  const { user, isSuperAdmin } = useAuth();
  const { tenant, branding } = useTenant();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Workstation view toggle (All Operations | Pathologist Workstation | Analyzer Bench)
  const [workstationView, setWorkstationView] = useState('auto');

  // Pathologist Workstation Sign-Off Modal State
  const [pathologistSignModalOpen, setPathologistSignModalOpen] = useState(false);
  const [selectedReviewReport, setSelectedReviewReport] = useState(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [isDoctorConfirmed, setIsDoctorConfirmed] = useState(false);
  const [isVerifyingReport, setIsVerifyingReport] = useState(false);

  // Technician Workstation Bench Modal State
  const [technicianBenchModalOpen, setTechnicianBenchModalOpen] = useState(false);
  const [selectedBenchSample, setSelectedBenchSample] = useState(null);
  const [targetProcessingStatus, setTargetProcessingStatus] = useState('in_analysis');
  const [selectedAnalyzer, setSelectedAnalyzer] = useState('Sysmex XN-550 Automated Hematology');
  const [isUpdatingSample, setIsUpdatingSample] = useState(false);

  const tenantId = user?.tenantId || tenant?.tenantId;
  const userRole = (user?.role || 'lab_admin').toLowerCase();
  const roleDef = user?.roleDefinition || null;
  const rolePermissions = user?.permissions || roleDef?.permissions || [];
  const isLabAdmin =
    userRole === 'lab_admin' ||
    userRole === 'lab_director' ||
    rolePermissions.includes('*') ||
    isSuperAdmin;

  // Dynamic permission checker helper
  const hasPermission = (required) => {
    if (isLabAdmin) return true;
    if (rolePermissions.includes('*')) return true;
    if (Array.isArray(required)) {
      return required.some((perm) => rolePermissions.includes(perm));
    }
    return rolePermissions.includes(required);
  };

  const isPathologist =
    userRole === 'pathologist' ||
    userRole === 'report_reviewer' ||
    hasPermission(['reports:verify', 'reports:create']);

  const isTechnician =
    userRole === 'lab_technician' ||
    userRole === 'technician' ||
    hasPermission(['samples:process', 'samples:collect']);

  const isClinicalStaff =
    isLabAdmin ||
    ['lab_admin', 'pathologist', 'lab_technician', 'technician'].includes(userRole);

  const fetchDashboard = useCallback(async () => {
    if (!tenantId || isSuperAdmin) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const res = await api.get(`/tenants/${tenantId}/dashboard-summary`, {
        params: { timezone: clientTimezone },
      });
      if (res.data?.success) {
        setDashboardData(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve live dashboard summary');
      console.warn('Dashboard summary live fetch fallback:', err.message);
    } finally {
      setLoading(false);
    }
  }, [tenantId, isSuperAdmin]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Set default view based on role
  useEffect(() => {
    if (userRole === 'pathologist') {
      setWorkstationView('pathologist');
    } else if (userRole === 'lab_technician') {
      setWorkstationView('technician');
    } else {
      setWorkstationView('all');
    }
  }, [userRole]);

  const metrics = dashboardData?.metrics || {
    todayOrders: 0,
    pendingOrders: 0,
    samplesCollected: 0,
    reportsReleased: 0,
    totalPatients: 0,
    totalOrders: 0,
    pendingCollectionSamples: 0,
    inAnalysisSamples: 0,
    pendingReviewReports: 0,
    releasedReports: 0,
    totalRevenue: 0,
    totalOutstanding: 0,
  };

  const todaySummary = dashboardData?.todaySummary || {
    todayOrders: metrics.todayOrders ?? 0,
    pendingOrders: metrics.pendingOrders ?? 0,
    samplesCollected: metrics.samplesCollected ?? 0,
    reportsReleased: metrics.reportsReleased ?? 0,
    averageTatMinutes: metrics.averageTatMinutes ?? null,
    formattedTat: metrics.formattedTat || 'N/A',
    tatReportCount: metrics.tatReportCount ?? 0,
    date: new Date().toLocaleDateString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  const recentOrders = dashboardData?.recentOrders || [];
  const recentReports = dashboardData?.recentReports || [];
  const recentSamples = dashboardData?.recentSamples || [];

  // Determine role-tailored view title, description & badge
  const getRoleHeaderInfo = () => {
    const roleDisplayName = roleDef?.name || (user?.role ? user.role.replace(/_/g, ' ') : 'Laboratory Operations');
    let roleDescription = roleDef?.description;

    if (!roleDescription) {
      if (userRole === 'pathologist') {
        roleDescription = 'Clinical Pathology Workstation: Diagnostic specimen interpretation, panic flag triage, and medical sign-off.';
      } else if (userRole === 'lab_technician') {
        roleDescription = 'Analyzer Bench Workstation: Specimen tube triage, instrument batch analysis, and test result entry.';
      } else if (isLabAdmin) {
        roleDescription = 'Comprehensive laboratory administration, multi-department throughput, and clinical workflow control.';
      } else {
        roleDescription = `Role-scoped clinical and operational workspace for ${roleDisplayName}.`;
      }
    }

    const labName = branding?.displayName || tenant?.name || 'Laboratory';

    return {
      title: `${labName} • ${roleDisplayName}`,
      description: roleDescription,
      badge: roleDisplayName,
    };
  };

  const headerInfo = getRoleHeaderInfo();

  // Handle Quick Pathologist Report Sign-Off
  const handleOpenPathologistModal = (report) => {
    setSelectedReviewReport(report);
    setVerificationNotes('Diagnostic findings correlate clinically. Verified under laboratory quality protocol.');
    setIsDoctorConfirmed(false);
    setPathologistSignModalOpen(true);
  };

  const handleConfirmPathologistVerification = async (e) => {
    e.preventDefault();
    if (!selectedReviewReport) return;
    setIsVerifyingReport(true);
    setError(null);
    try {
      await clinicalService.approveReport(tenantId, selectedReviewReport.reportId || selectedReviewReport.id, {
        notes: verificationNotes,
        verifiedBy: user?.fullName || 'Consultant Pathologist',
      });
      setSuccessBanner(`Report for order ${selectedReviewReport.orderNumber || selectedReviewReport.orderId} successfully verified & signed.`);
      setPathologistSignModalOpen(false);
      await fetchDashboard();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to verify diagnostic report.');
    } finally {
      setIsVerifyingReport(false);
    }
  };

  // Handle Quick Technician Analyzer Bench Action
  const handleOpenTechnicianModal = (sample) => {
    setSelectedBenchSample(sample);
    setTargetProcessingStatus(sample.processingStatus === 'in_analysis' ? 'completed' : 'in_analysis');
    setTechnicianBenchModalOpen(true);
  };

  const handleConfirmTechnicianUpdate = async (e) => {
    e.preventDefault();
    if (!selectedBenchSample) return;
    setIsUpdatingSample(true);
    setError(null);
    try {
      await clinicalService.updateSampleStatus(tenantId, selectedBenchSample.sampleId || selectedBenchSample.id, {
        processingStatus: targetProcessingStatus,
        analyzer: selectedAnalyzer,
        notes: `Bench status updated on ${selectedAnalyzer}`,
      });
      setSuccessBanner(`Specimen ${selectedBenchSample.barcode || selectedBenchSample.sampleId} status updated to '${targetProcessingStatus}'.`);
      setTechnicianBenchModalOpen(false);
      await fetchDashboard();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to update analyzer bench run.');
    } finally {
      setIsUpdatingSample(false);
    }
  };

  // Helper for tube color codes
  const getTubeCapBadge = (type = '', sampleName = '') => {
    const t = (type || sampleName || '').toLowerCase();
    if (t.includes('edta') || t.includes('whole_blood') || t.includes('blood') || t.includes('cbc')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: '#f5f3ff', color: '#6d28d9', border: '1px solid #ddd6fe' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#7c3aed' }} />
          Lavender (EDTA)
        </span>
      );
    }
    if (t.includes('serum') || t.includes('chemistry') || t.includes('lipid') || t.includes('lft')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: '#fefce8', color: '#a16207', border: '1px solid #fef08a' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#eab308' }} />
          Gold / Red (SST)
        </span>
      );
    }
    if (t.includes('citrate') || t.includes('coag') || t.includes('pt') || t.includes('inr')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2563eb' }} />
          Light Blue (Citrate)
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0' }}>
        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#94a3b8' }} />
        Standard Specimen
      </span>
    );
  };

  // Helper for Clinical Panic / Out of Range Flag
  const getAbnormalFindingFlag = (report) => {
    const raw = (report.findings || report.notes || '').toLowerCase();
    if (raw.includes('critical') || raw.includes('panic') || raw.includes('high') || raw.includes('severe')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 700, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
          <AlertTriangle size={11} />
          CRITICAL ABNORMAL
        </span>
      );
    }
    if (raw.includes('elevated') || raw.includes('borderline') || raw.includes('low') || raw.includes('abnormal')) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600, background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
          OUT OF RANGE
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 600, background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
        <CheckCircle size={11} />
        NORMAL LIMITS
      </span>
    );
  };

  // Role-specific Metric Cards dynamically tailored to granted permissions
  const renderRoleCards = () => {
    const cards = [];

    if (hasPermission('users:view')) {
      cards.push(
        <StatCard
          key="staff"
          title="Total Staff"
          value={metrics.totalStaff ?? dashboardData?.staff?.length ?? 0}
          subtitle="Registered team members"
          icon={Users}
          colorScheme="blue"
        />
      );
    }

    if (hasPermission('patients:view')) {
      cards.push(
        <StatCard
          key="patients"
          title="Total Registered Patients"
          value={metrics.totalPatients}
          subtitle="Accessioned directory profiles"
          icon={Users}
          colorScheme="cyan"
        />
      );
    }

    if (hasPermission('orders:view')) {
      cards.push(
        <StatCard
          key="orders"
          title="Total Lab Orders"
          value={metrics.totalOrders}
          subtitle="Requisitions logged"
          icon={ClipboardList}
          colorScheme="purple"
        />
      );
      cards.push(
        <StatCard
          key="today-pending-orders"
          title="Pending Orders"
          value={todaySummary.pendingOrders ?? metrics.pendingOrders ?? 0}
          subtitle="Awaiting sample or processing"
          icon={Clock}
          colorScheme="amber"
        />
      );
    }

    if (hasPermission(['samples:view', 'samples:collect', 'samples:process'])) {
      cards.push(
        <StatCard
          key="pending-samples"
          title="Samples Awaiting Draw"
          value={metrics.pendingCollectionSamples}
          subtitle="Pending phlebotomy intake"
          icon={FlaskConical}
          colorScheme="amber"
        />
      );
      cards.push(
        <StatCard
          key="analysis-samples"
          title="In Analyzer Analysis"
          value={metrics.inAnalysisSamples}
          subtitle="Active instrument runs"
          icon={TestTube2}
          colorScheme="purple"
        />
      );
    }

    if (hasPermission(['reports:view', 'reports:create', 'reports:verify', 'reports:release'])) {
      cards.push(
        <StatCard
          key="pending-reports"
          title="Pending Sign-off"
          value={metrics.pendingReviewReports}
          subtitle="Pathologist review queue"
          icon={FileText}
          colorScheme="red"
        />
      );
      cards.push(
        <StatCard
          key="released-reports"
          title="Released Reports"
          value={metrics.releasedReports}
          subtitle="Signed diagnostic findings"
          icon={FileCheck2}
          colorScheme="green"
        />
      );
    }

    if (hasPermission('billing:view')) {
      cards.push(
        <StatCard
          key="revenue"
          title="Settled Revenue"
          value={`$${metrics.totalRevenue.toLocaleString()}`}
          subtitle="Recorded receipts"
          icon={CreditCard}
          colorScheme="teal"
        />
      );
      cards.push(
        <StatCard
          key="outstanding"
          title="Outstanding Balance"
          value={`$${metrics.totalOutstanding.toLocaleString()}`}
          subtitle="Accounts receivable"
          icon={AlertTriangle}
          colorScheme="slate"
        />
      );
    }

    return cards;
  };

  const workflowSteps = [
    { name: '1. Order Entry', count: `${metrics.totalOrders} Orders`, status: 'completed' },
    { name: '2. Phlebotomy', count: `${metrics.pendingCollectionSamples} Pending`, status: 'current' },
    { name: '3. Analysis', count: `${metrics.inAnalysisSamples} In Progress`, status: 'current' },
    { name: '4. Pathologist Review', count: `${metrics.pendingReviewReports} Queue`, status: 'pending' },
    { name: '5. Diagnostic Release', count: `${metrics.releasedReports} Released`, status: 'completed' },
  ];

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'stat':
        return <Badge variant="danger">STAT</Badge>;
      case 'urgent':
        return <Badge variant="warning">Urgent</Badge>;
      default:
        return <Badge variant="slate">Routine</Badge>;
    }
  };

  return (
    <>
      <PageHeader
        title={headerInfo.title}
        description={headerInfo.description}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {hasPermission(['patients:create', 'orders:create']) && (
              <Link
                to="/patients?register=true"
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Users size={14} />
                <span>New Patient Intake & Order</span>
              </Link>
            )}
            {hasPermission(['samples:collect', 'samples:process']) && (
              <Link
                to="/samples"
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <FlaskConical size={14} />
                <span>Specimens Bench</span>
              </Link>
            )}
            {hasPermission(['reports:create', 'reports:verify']) && (
              <Link
                to="/reports"
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <FileText size={14} />
                <span>Pathology Reports</span>
              </Link>
            )}
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                background: 'var(--mint-bg)',
                color: 'var(--mint-text)',
                border: '1px solid var(--mint-200)',
              }}
            >
              <ShieldCheck size={14} />
              <span>{headerInfo.badge}</span>
            </span>
          </div>
        }
      />

      {/* Tenant Context Notice */}
      <StatusBanner
        type="info"
        badgeText={`Tenant: ${tenant?.code || 'ACTIVE'}`}
        message={`Operations scoped strictly to ${branding?.displayName || tenant?.name || 'this laboratory'}. Cross-tenant interference is blocked at the database tier.`}
      />

      {/* Feedback Banners */}
      {error && (
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span style={{ fontSize: '0.875rem' }}>{error}</span>
          </div>
          <button onClick={() => setError(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#991b1b' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {successBanner && (
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span style={{ fontSize: '0.875rem' }}>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#166534' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Lab Admin Workstation Selector Tabs */}
      {isLabAdmin && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '1.25rem',
            paddingBottom: '2px',
          }}
        >
          <button
            onClick={() => setWorkstationView('all')}
            style={{
              padding: '8px 16px',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              color: workstationView === 'all' ? 'var(--primary-blue)' : 'var(--slate-500)',
              borderBottom: workstationView === 'all' ? '2px solid var(--primary-blue)' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Layers size={16} />
            <span>Executive Laboratory Overview</span>
          </button>

          <button
            onClick={() => setWorkstationView('pathologist')}
            style={{
              padding: '8px 16px',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              color: workstationView === 'pathologist' ? '#b91c1c' : 'var(--slate-500)',
              borderBottom: workstationView === 'pathologist' ? '2px solid #b91c1c' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Stethoscope size={16} />
            <span>Pathologist Sign-Off Queue ({metrics.pendingReviewReports})</span>
          </button>

          <button
            onClick={() => setWorkstationView('technician')}
            style={{
              padding: '8px 16px',
              fontSize: '0.875rem',
              fontWeight: 600,
              border: 'none',
              background: 'none',
              color: workstationView === 'technician' ? '#2563eb' : 'var(--slate-500)',
              borderBottom: workstationView === 'technician' ? '2px solid #2563eb' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <FlaskConical size={16} />
            <span>Analyzer Testing Bench ({metrics.inAnalysisSamples})</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. DEDICATED PATHOLOGIST CLINICAL WORKSTATION */}
      {/* ========================================================================= */}
      {(workstationView === 'pathologist' || (!isLabAdmin && isPathologist)) && (
        <section style={{ marginBottom: '1.75rem' }}>
          {/* Pathologist KPI Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              color: 'white',
              marginBottom: '1.25rem',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Stethoscope size={22} style={{ color: '#fecaca' }} />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'white' }}>
                    Consultant Pathologist Diagnostic Workstation
                  </h2>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#fecaca', margin: 0, maxWidth: '650px' }}>
                  Physician verification queue for specimen findings, abnormal panic values, and diagnostic report sign-off.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.375rem', fontWeight: 700 }}>{metrics.pendingReviewReports}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#fecaca' }}>Awaiting Sign-Off</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.375rem', fontWeight: 700 }}>{todaySummary.reportsReleased}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#fecaca' }}>Verified Today</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.375rem', fontWeight: 700 }}>{todaySummary.formattedTat || 'N/A'}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#fecaca' }}>Avg Review TAT</div>
                </div>
              </div>
            </div>
          </div>

          {/* Pathologist Diagnostic Queue Card */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCheck size={18} style={{ color: '#b91c1c' }} />
                <h3 className="card-title">Diagnostic Reports Verification Queue</h3>
              </div>
              <Link to="/reports" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span>Open Diagnostic Reports Portal</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            <div className="table-container">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Patient / MRN</th>
                    <th>Diagnostic Panel</th>
                    <th>Clinical Interpretation & Findings</th>
                    <th>Status Flag</th>
                    <th>Priority</th>
                    <th style={{ textAlign: 'right' }}>Physician Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReports.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-400)' }}>
                        No pending diagnostic reports in verification queue. Excellent work!
                      </td>
                    </tr>
                  ) : (
                    recentReports.map((report) => (
                      <tr key={report.reportId || report.id}>
                        <td>
                          <strong style={{ fontFamily: 'monospace', color: 'var(--primary-700)' }}>
                            {report.orderNumber || report.orderId || 'ORD-REQ'}
                          </strong>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{report.patientName}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{report.patientMrn || 'MRN-RECORD'}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>
                            {report.tests?.map((t) => t.name || t.testCode).join(', ') || report.testName || 'Comprehensive Clinical Panel'}
                          </span>
                        </td>
                        <td style={{ maxWidth: '280px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--slate-700)' }}>
                              {report.findings || 'Raw instrument findings compiled. Awaiting pathologist signature.'}
                            </span>
                            {getAbnormalFindingFlag(report)}
                          </div>
                        </td>
                        <td>
                          <Badge variant={report.status === 'released' ? 'success' : report.status === 'approved' ? 'teal' : 'warning'}>
                            {report.status || 'Draft Findings'}
                          </Badge>
                        </td>
                        <td>{getPriorityBadge(report.priority || 'stat')}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => handleOpenPathologistModal(report)}
                            className="btn btn-primary btn-sm"
                            style={{
                              background: '#b91c1c',
                              borderColor: '#991b1b',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <Stethoscope size={13} />
                            <span>Review & Sign-Off</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 2. DEDICATED LAB TESTING / TECHNICIAN ANALYZER WORKSTATION */}
      {/* ========================================================================= */}
      {(workstationView === 'technician' || (!isLabAdmin && isTechnician)) && (
        <section style={{ marginBottom: '1.75rem' }}>
          {/* Analyzer Bench Status Header Bar */}
          <div
            style={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
              borderRadius: 'var(--radius-lg)',
              padding: '1.5rem',
              color: 'white',
              marginBottom: '1.25rem',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Cpu size={22} style={{ color: '#bfdbfe' }} />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'white' }}>
                    Laboratory Testing & Analyzer Bench Workstation
                  </h2>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#bfdbfe', margin: 0, maxWidth: '650px' }}>
                  Specimen accessioning, tube color triage, automated analyzer loading, and bench result recording.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.375rem', fontWeight: 700 }}>{metrics.inAnalysisSamples}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#bfdbfe' }}>Active on Analyzers</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.375rem', fontWeight: 700 }}>{metrics.pendingCollectionSamples}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#bfdbfe' }}>Awaiting Intake</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '8px 16px', borderRadius: '8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.375rem', fontWeight: 700 }}>3 Online</div>
                  <div style={{ fontSize: '0.6875rem', color: '#bfdbfe' }}>Instruments Ready</div>
                </div>
              </div>
            </div>

            {/* Instrument Status Strip */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <span style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }} />
                Sysmex XN-550 Hematology: <strong>OPERATIONAL</strong>
              </span>
              <span style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }} />
                Roche Cobas Pure Chemistry: <strong>OPERATIONAL</strong>
              </span>
              <span style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.1)', padding: '4px 10px', borderRadius: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} />
                Stago STA Compact Coagulation: <strong>READY</strong>
              </span>
            </div>
          </div>

          {/* Specimen Tube Queue Card */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FlaskConical size={18} style={{ color: '#2563eb' }} />
                <h3 className="card-title">Specimen Tubes & Analyzer Run Queue</h3>
              </div>
              <Link to="/samples" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span>Open Full Specimen Bench</span>
                <ArrowRight size={13} />
              </Link>
            </div>

            <div className="table-container">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Tube Barcode</th>
                    <th>Tube Type & Cap</th>
                    <th>Patient Demographics</th>
                    <th>Assigned Test Panel</th>
                    <th>Bench Stage</th>
                    <th>Priority</th>
                    <th style={{ textAlign: 'right' }}>Bench Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSamples.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-400)' }}>
                        No specimen tubes currently in analyzer queue. Accession new samples via Patient Requisitions.
                      </td>
                    </tr>
                  ) : (
                    recentSamples.map((sample) => (
                      <tr key={sample.sampleId || sample.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <QrCode size={15} style={{ color: 'var(--slate-500)' }} />
                            <strong style={{ fontFamily: 'monospace', color: 'var(--primary-700)' }}>
                              {sample.barcode || sample.sampleId}
                            </strong>
                          </div>
                        </td>
                        <td>{getTubeCapBadge(sample.type, sample.testName)}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{sample.patientName || 'Accessioned Patient'}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{sample.patientMrn || sample.orderId}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>
                            {sample.testName || sample.tests?.join(', ') || 'Complete Metabolic Profile'}
                          </span>
                        </td>
                        <td>
                          <Badge variant={sample.processingStatus === 'completed' ? 'success' : sample.processingStatus === 'in_analysis' ? 'purple' : 'warning'}>
                            {sample.processingStatus === 'in_analysis' ? 'In Analyzer Run' : sample.processingStatus || 'Awaiting Run'}
                          </Badge>
                        </td>
                        <td>{getPriorityBadge(sample.priority || 'stat')}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={() => handleOpenTechnicianModal(sample)}
                            className="btn btn-primary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Cpu size={13} />
                            <span>Load / Run Analyzer</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 3. DYNAMIC OPERATIONAL OVERVIEW (Rendered for Lab Admin & Permitted Roles) */}
      {/* ========================================================================= */}
      {(workstationView === 'all' || (!isPathologist && !isTechnician)) && (
        <>
          {/* Today's Lab Orders Summary Section (Clinical Staff Only) */}
          {isClinicalStaff && hasPermission(['orders:view', 'samples:view', 'reports:view']) && (
            <section style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={18} style={{ color: 'var(--primary-blue)' }} />
                  <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--slate-800)', margin: 0 }}>
                    Today's Lab Orders Summary
                  </h2>
                </div>
                {todaySummary?.date && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>
                    Calendar Day: {todaySummary.date} {todaySummary.timeZone ? `(${todaySummary.timeZone})` : ''}
                  </span>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '1.25rem' }}>
                <StatCard
                  title="Today's Total Orders"
                  value={loading ? '...' : (todaySummary.todayOrders ?? 0)}
                  subtitle="Requisitions logged today"
                  icon={ClipboardList}
                  colorScheme="blue"
                />
                <StatCard
                  title="Pending Orders"
                  value={loading ? '...' : (todaySummary.pendingOrders ?? 0)}
                  subtitle="Ordered / in progress today"
                  icon={Clock}
                  colorScheme="amber"
                />
                <StatCard
                  title="Samples Collected"
                  value={loading ? '...' : (todaySummary.samplesCollected ?? 0)}
                  subtitle="Specimens drawn today"
                  icon={FlaskConical}
                  colorScheme="teal"
                />
                <StatCard
                  title="Reports Released"
                  value={loading ? '...' : (todaySummary.reportsReleased ?? 0)}
                  subtitle="Diagnostic releases today"
                  icon={CheckCircle2}
                  colorScheme="green"
                />
                <StatCard
                  title="Average Report TAT Today"
                  value={loading ? '...' : (todaySummary.formattedTat || 'N/A')}
                  subtitle={
                    todaySummary.tatReportCount > 0
                      ? `Across ${todaySummary.tatReportCount} released report${todaySummary.tatReportCount === 1 ? '' : 's'}`
                      : 'No released reports with valid timestamps'
                  }
                  icon={Timer}
                  colorScheme="purple"
                />
              </div>
            </section>
          )}

          {/* Role-Specific Dynamic Metrics Grid */}
          <section style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '1.25rem' }}>
              {renderRoleCards()}
            </div>
          </section>

          {/* Laboratory Workflow Pipeline Summary (Clinical Staff Only) */}
          {isClinicalStaff && hasPermission(['samples:view', 'samples:process', 'orders:view', 'reports:view']) && (
            <section className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Microscope size={18} style={{ color: 'var(--primary-600)' }} />
                  <h2 className="card-title">Laboratory Specimen Pipeline</h2>
                </div>
                <span className="badge badge-teal">Live Tenant Pipeline</span>
              </div>

              <div className="workflow-pipeline">
                {workflowSteps.map((step) => (
                  <div
                    key={step.name}
                    className={`workflow-step ${step.status === 'completed' ? 'completed' : ''} ${step.status === 'current' ? 'current' : ''}`}
                  >
                    <div className="workflow-icon-bubble">
                      {step.status === 'completed' ? (
                        <CheckCircle2 size={20} />
                      ) : step.status === 'current' ? (
                        <FlaskConical size={20} />
                      ) : (
                        <Clock size={20} />
                      )}
                    </div>
                    <span className="workflow-step-name">{step.name}</span>
                    <span className="workflow-step-count">{step.count}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Recent Requisitions Activity Table */}
          {hasPermission('orders:view') && (
            <section className="card" style={{ marginBottom: '1.5rem' }}>
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ClipboardList size={18} style={{ color: 'var(--primary-600)' }} />
                  <h2 className="card-title">Recent Laboratory Activity</h2>
                </div>
                <span className="badge badge-blue">
                  {recentOrders.length} {recentOrders.length === 1 ? 'Record' : 'Records'}
                </span>
              </div>

              <div className="table-container">
                <table className="lms-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Patient / MRN</th>
                      <th>Diagnostic Tests</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--slate-500)' }}>
                          No recent orders in this laboratory yet. Use the sidebar to create new requisitions.
                        </td>
                      </tr>
                    ) : (
                      recentOrders.map((order) => (
                        <tr key={order.orderId || order.orderNumber}>
                          <td>
                            <strong style={{ color: 'var(--primary-700)', fontFamily: 'monospace' }}>
                              {order.orderNumber}
                            </strong>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600 }}>{order.patientName}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{order.patientMrn}</span>
                            </div>
                          </td>
                          <td style={{ maxWidth: '240px' }}>
                            {order.tests?.map((t) => t.name || t.testCode).join(', ') || 'Diagnostic Panel'}
                          </td>
                          <td>{getPriorityBadge(order.priority)}</td>
                          <td>
                            <Badge variant={order.status === 'released' ? 'success' : order.status === 'in_analysis' ? 'purple' : 'warning'}>
                              {order.status || 'Active'}
                            </Badge>
                          </td>
                          <td>
                            <span className={`badge ${order.paymentStatus === 'paid' ? 'badge-success' : 'badge-warning'}`}>
                              {order.paymentStatus || 'unpaid'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="btn btn-secondary btn-sm"
                              title="Inspect order details"
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Laboratory Staff Directory Section */}
          {hasPermission('users:view') && (
            <section className="card">
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={18} style={{ color: 'var(--primary-blue, #2563eb)' }} />
                  <h2 className="card-title">
                    Laboratory Staff & Team Directory ({dashboardData?.staff?.length || 0})
                  </h2>
                </div>
                <Link to="/users" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span>Manage Staff Members</span>
                  <ArrowRight size={13} />
                </Link>
              </div>

              <div className="table-container">
                <table className="lms-table">
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>Email</th>
                      <th>Assigned Role</th>
                      <th>Department / Phone</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!dashboardData?.staff || dashboardData.staff.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--slate-500)' }}>
                          No staff members registered for this laboratory yet.
                        </td>
                      </tr>
                    ) : (
                      dashboardData.staff.map((member) => (
                        <tr key={member.userId || member.email}>
                          <td>
                            <span style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{member.fullName}</span>
                          </td>
                          <td>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--slate-600)' }}>{member.email}</span>
                          </td>
                          <td>
                            <Badge variant={member.role === 'lab_admin' ? 'blue' : 'purple'}>
                              {member.role ? member.role.replace(/_/g, ' ') : 'Staff'}
                            </Badge>
                          </td>
                          <td>{member.department || 'Diagnostic Operations'}</td>
                          <td>
                            <Badge variant={member.isActive ? 'success' : 'slate'}>
                              {member.isActive ? 'Active' : 'Deactivated'}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Pathologist Clinical Sign-Off */}
      {/* ========================================================================= */}
      {pathologistSignModalOpen && selectedReviewReport && (
        <Modal
          isOpen={pathologistSignModalOpen}
          onClose={() => setPathologistSignModalOpen(false)}
          title={`Pathologist Verification & Digital Sign-Off`}
          size="md"
        >
          <form onSubmit={handleConfirmPathologistVerification}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#991b1b' }}>
                    Order: {selectedReviewReport.orderNumber || selectedReviewReport.orderId}
                  </span>
                  {getAbnormalFindingFlag(selectedReviewReport)}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#7f1d1d' }}>
                  <strong>Patient:</strong> {selectedReviewReport.patientName} ({selectedReviewReport.patientMrn || 'MRN-RECORD'})
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#7f1d1d', marginTop: '4px' }}>
                  <strong>Panel:</strong> {selectedReviewReport.tests?.map((t) => t.name).join(', ') || selectedReviewReport.testName || 'Diagnostic Panel'}
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Findings Preview</label>
                <div style={{ padding: '8px 12px', background: 'var(--slate-50)', border: '1px solid var(--border-subtle)', borderRadius: '6px', fontSize: '0.8125rem', color: 'var(--slate-800)' }}>
                  {selectedReviewReport.findings || 'Raw analyzer readings verified within reference boundaries. Morphology clear.'}
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Pathologist Clinical Notes & Impression</label>
                <textarea
                  rows={3}
                  required
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  className="form-control"
                  placeholder="Enter clinical interpretation, follow-up recommendations, or signature impression..."
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.8125rem', cursor: 'pointer', color: 'var(--slate-800)' }}>
                <input
                  type="checkbox"
                  required
                  checked={isDoctorConfirmed}
                  onChange={(e) => setIsDoctorConfirmed(e.target.checked)}
                  style={{ marginTop: '2px' }}
                />
                <span>
                  I confirm that as a certified medical pathologist, I have verified these diagnostic findings, inspected abnormal flags, and authorize release under laboratory accreditation standards.
                </span>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setPathologistSignModalOpen(false)}
                  disabled={isVerifyingReport}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isDoctorConfirmed || isVerifyingReport}
                  className="btn btn-primary"
                  style={{ background: '#b91c1c', borderColor: '#991b1b', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {isVerifyingReport && <Loader2 size={14} className="animate-spin" />}
                  <span>Sign & Release Report</span>
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Technician Analyzer Bench Action */}
      {/* ========================================================================= */}
      {technicianBenchModalOpen && selectedBenchSample && (
        <Modal
          isOpen={technicianBenchModalOpen}
          onClose={() => setTechnicianBenchModalOpen(false)}
          title={`Analyzer Bench Run: ${selectedBenchSample.barcode || selectedBenchSample.sampleId}`}
          size="md"
        >
          <form onSubmit={handleConfirmTechnicianUpdate}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e40af' }}>
                    Barcode: {selectedBenchSample.barcode || selectedBenchSample.sampleId}
                  </span>
                  {getTubeCapBadge(selectedBenchSample.type, selectedBenchSample.testName)}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#1e3a8a' }}>
                  <strong>Patient:</strong> {selectedBenchSample.patientName || 'Specimen Intake'}
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#1e3a8a', marginTop: '4px' }}>
                  <strong>Target Test:</strong> {selectedBenchSample.testName || 'Comprehensive Assay'}
                </div>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Assigned Analyzer Instrument</label>
                <select
                  value={selectedAnalyzer}
                  onChange={(e) => setSelectedAnalyzer(e.target.value)}
                  className="form-control"
                >
                  <option value="Sysmex XN-550 Automated Hematology">Sysmex XN-550 Automated Hematology</option>
                  <option value="Roche Cobas Pure Chemistry System">Roche Cobas Pure Chemistry System</option>
                  <option value="Stago STA Compact Max Coagulation">Stago STA Compact Max Coagulation</option>
                  <option value="Manual Microscopy / Urinalysis Bench">Manual Microscopy / Urinalysis Bench</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Target Bench Stage</label>
                <select
                  value={targetProcessingStatus}
                  onChange={(e) => setTargetProcessingStatus(e.target.value)}
                  className="form-control"
                >
                  <option value="received">Received at Bench (Triage Complete)</option>
                  <option value="in_analysis">Loaded on Instrument (In Analyzer Run)</option>
                  <option value="completed">Run Completed (Results Drafted)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setTechnicianBenchModalOpen(false)}
                  disabled={isUpdatingSample}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingSample}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {isUpdatingSample && <Loader2 size={14} className="animate-spin" />}
                  <span>Update Analyzer Status</span>
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Inspect Order Modal */}
      {selectedOrder && (
        <Modal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          title={`Order Requisition: ${selectedOrder.orderNumber}`}
          footer={
            <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>
              Close
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div className="grid-2">
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Patient Profile</p>
                <p style={{ fontWeight: 600 }}>{selectedOrder.patientName}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{selectedOrder.patientMrn}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Priority & Status</p>
                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                  {getPriorityBadge(selectedOrder.priority)}
                  <Badge variant={selectedOrder.status === 'released' ? 'success' : 'purple'}>
                    {selectedOrder.status}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>Diagnostic Tests</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {selectedOrder.tests?.map((t, idx) => (
                  <span key={idx} style={{ background: 'var(--slate-100)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                    {t.name || t.testCode}
                  </span>
                )) || <span>Diagnostic panel</span>}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default DashboardPage;
