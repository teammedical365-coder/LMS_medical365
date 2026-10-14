/**
 * Lab Management System (LMS) - Laboratory Operations & Workstation Overview
 * 
 * Clean Overview Dashboard:
 * 1. Welcome / Time-based greeting banner with tenant branding and role info.
 * 2. Role-scoped live metric stat cards.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  ClipboardList,
  Clock,
  IndianRupee,
  CreditCard,
  FlaskConical,
  TestTube2,
  FileText,
  FileCheck2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Calendar,
  X,
  CheckCircle2,
  ArrowRight,
  UserCheck,
  Stethoscope,
  Activity,
  Cpu,
  Play,
  CheckCircle,
  Tag,
  QrCode,
  FileCheck,
  Loader2,
  Search,
  Receipt,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Microscope,
  Building2,
} from 'lucide-react';
import StatCard from '../../components/common/StatCard';
import Badge from '../../components/common/Badge';
import StatusBanner from '../../components/common/StatusBanner';
import Modal from '../../components/common/Modal';
import ResultEntryModal from '../samples/ResultEntryModal';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import api from '../../services/api';
import clinicalService from '../../services/clinicalService';
import { Link } from 'react-router-dom';

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
  const [pathologistReviewStep, setPathologistReviewStep] = useState('review'); // 'review' | 'confirm_approve' | 'confirm_reject'
  const [pathologistFindings, setPathologistFindings] = useState('');
  const [pathologistRejectionReason, setPathologistRejectionReason] = useState('');
  const [pathologistModalError, setPathologistModalError] = useState(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [isDoctorConfirmed, setIsDoctorConfirmed] = useState(false);
  const [isVerifyingReport, setIsVerifyingReport] = useState(false);

  // Technician Workstation Bench Modal State
  const [technicianBenchModalOpen, setTechnicianBenchModalOpen] = useState(false);
  const [selectedBenchSample, setSelectedBenchSample] = useState(null);
  const [targetProcessingStatus, setTargetProcessingStatus] = useState('in_analysis');
  const [selectedAnalyzer, setSelectedAnalyzer] = useState('Sysmex XN-550 Automated Hematology');
  const [isUpdatingSample, setIsUpdatingSample] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [resultEntrySample, setResultEntrySample] = useState(null);
  const [queueFilter, setQueueFilter] = useState('active'); // 'active' | 'all'
  const [queuePage, setQueuePage] = useState(1);
  const [reportQueueFilter, setReportQueueFilter] = useState('actionable'); // 'actionable' | 'pending' | 'approved' | 'rejected' | 'all'
  const [reportQueuePage, setReportQueuePage] = useState(1);
  const [recentOrdersPage, setRecentOrdersPage] = useState(1);

  const tenantId = user?.tenantId || tenant?.tenantId;
  const userRole = (user?.role || 'lab_admin').toLowerCase();
  const roleDef = user?.roleDefinition || null;
  const rolePermissions = user?.permissions || roleDef?.permissions || [];
  const isLabAdmin =
    userRole === 'lab_admin' ||
    userRole === 'lab_director' ||
    rolePermissions.includes('*') ||
    isSuperAdmin;
  const canRelease =
    isLabAdmin ||
    rolePermissions.includes('*') ||
    rolePermissions.includes('reports:release') ||
    userRole === 'pathologist';

  // Dynamic permission checker helper
  const hasPermission = (required) => {
    if (isLabAdmin) return true;
    if (rolePermissions.includes('*')) return true;
    if (Array.isArray(required)) {
      return required.some((perm) => rolePermissions.includes(perm));
    }
    return rolePermissions.includes(required);
  };

  const isReceptionist =
    userRole === 'receptionist' ||
    userRole === 'front_desk' ||
    userRole === 'clerk' ||
    userRole === 'reception';

  const isBillingClerk =
    userRole === 'billing_clerk' ||
    userRole === 'accountant' ||
    userRole === 'billing';

  const isPathologist =
    !isReceptionist &&
    !isBillingClerk &&
    (userRole === 'pathologist' ||
      userRole === 'report_reviewer' ||
      (!isLabAdmin && hasPermission(['reports:verify'])));

  const isTechnician =
    !isReceptionist &&
    !isBillingClerk &&
    (userRole === 'lab_technician' ||
      userRole === 'technician' ||
      (!isLabAdmin && hasPermission(['samples:process'])));

  const isLabTechnician = isTechnician;

  const isClinicalStaff =
    !isReceptionist &&
    !isBillingClerk &&
    (isLabAdmin || ['lab_admin', 'pathologist', 'lab_technician', 'technician'].includes(userRole));

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

  const metrics = dashboardData?.metrics || {
    todayOrders: 0,
    pendingOrders: 0,
    samplesCollected: 0,
    reportsReleased: 0,
    totalPatients: 0,
    totalOrders: 0,
    pendingCollectionSamples: 0,
    inAnalysisSamples: 0,
    activeQueueSamples: 0,
    pendingReviewReports: 0,
    approvedReports: 0,
    rejectedReports: 0,
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

  // Dynamic Time-Based Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const recentOrders = dashboardData?.recentOrders || [];
  const RECENT_ORDERS_PAGE_SIZE = 5;
  const totalRecentOrdersPages = Math.max(1, Math.ceil(recentOrders.length / RECENT_ORDERS_PAGE_SIZE));
  const currentRecentOrdersPage = Math.min(recentOrdersPage, totalRecentOrdersPages);
  const startOrderIdx = (currentRecentOrdersPage - 1) * RECENT_ORDERS_PAGE_SIZE;
  const displayedRecentOrders = recentOrders.slice(startOrderIdx, startOrderIdx + RECENT_ORDERS_PAGE_SIZE);

  const recentReports = dashboardData?.recentReports || [];
  const recentSamples = dashboardData?.recentSamples || [];

  // Filter and prioritize reports for Pathologist Diagnostic Queue:
  // 1. Pending review / drafts requiring Pathologist Sign-Off first
  // 2. Approved reports awaiting release
  // 3. Rejected reports (corrections)
  // 4. Released reports
  const pendingReportsList = recentReports.filter(
    (r) => r.status === 'draft' || r.status === 'pending_review'
  );
  const approvedReportsList = recentReports.filter((r) => r.status === 'approved');
  const rejectedReportsList = recentReports.filter((r) => r.status === 'rejected');
  const releasedReportsList = recentReports.filter((r) => r.status === 'released');

  const pendingReportsCount = metrics.pendingReviewReports ?? pendingReportsList.length;
  const approvedReportsCount = metrics.approvedReports ?? approvedReportsList.length;
  const rejectedReportsCount = metrics.rejectedReports ?? rejectedReportsList.length;
  const releasedReportsCount = metrics.releasedReports ?? releasedReportsList.length;
  const actionableReportsCount = pendingReportsList.length + approvedReportsList.length;

  const filteredReports = recentReports.filter((r) => {
    if (reportQueueFilter === 'actionable') {
      return r.status === 'draft' || r.status === 'pending_review' || r.status === 'approved';
    }
    if (reportQueueFilter === 'pending') {
      return r.status === 'draft' || r.status === 'pending_review';
    }
    if (reportQueueFilter === 'approved') {
      return r.status === 'approved';
    }
    if (reportQueueFilter === 'rejected') {
      return r.status === 'rejected';
    }
    return true; // 'all'
  });

  const prioritizedReports = [...filteredReports].sort((a, b) => {
    const getStatusWeight = (st) => {
      if (st === 'draft' || st === 'pending_review') return 1;
      if (st === 'approved') return 2;
      if (st === 'rejected') return 3;
      if (st === 'released') return 4;
      return 5;
    };
    const diff = getStatusWeight(a.status) - getStatusWeight(b.status);
    if (diff !== 0) return diff;
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
  });

  const REPORT_QUEUE_PAGE_SIZE = 10;
  const totalReportPages = Math.max(1, Math.ceil(prioritizedReports.length / REPORT_QUEUE_PAGE_SIZE));
  const currentReportPage = Math.min(reportQueuePage, totalReportPages);
  const startReportIndex = (currentReportPage - 1) * REPORT_QUEUE_PAGE_SIZE;
  const displayedReports = prioritizedReports.slice(startReportIndex, startReportIndex + REPORT_QUEUE_PAGE_SIZE);

  // Filter queue: 'active' shows specimens pending receipt, in analysis, or awaiting signoff (excludes completed and rejected)
  const eligibleSamples = recentSamples.filter((s) => {
    if (queueFilter === 'active') {
      return s.processingStatus !== 'completed' && s.collectionStatus !== 'rejected';
    }
    return true;
  });

  const activeQueueCount = recentSamples.filter(
    (s) => s.processingStatus !== 'completed' && s.collectionStatus !== 'rejected'
  ).length;

  const QUEUE_PAGE_SIZE = 10;
  const totalQueuePages = Math.max(1, Math.ceil(eligibleSamples.length / QUEUE_PAGE_SIZE));
  const currentPage = Math.min(queuePage, totalQueuePages);
  const startIndex = (currentPage - 1) * QUEUE_PAGE_SIZE;
  const displayedSamples = eligibleSamples.slice(startIndex, startIndex + QUEUE_PAGE_SIZE);

  // Determine role-tailored view title, description & badge
  const getRoleHeaderInfo = () => {
    const roleDisplayName = roleDef?.name || (user?.role ? user.role.replace(/_/g, ' ') : 'Laboratory Operations');
    let roleDescription = roleDef?.description;

    if (!roleDescription) {
      if (userRole === 'pathologist') {
        roleDescription = 'Clinical Pathology Workstation: Diagnostic specimen interpretation, panic flag triage, and medical sign-off.';
      } else if (userRole === 'lab_technician') {
        roleDescription = 'Analyzer Bench Workstation: Specimen tube triage, instrument batch analysis, and test result entry.';
      } else if (isReceptionist) {
        roleDescription = 'Patient Intake & Billing Reception Desk: Patient registration, test requisitions booking, and fee collection.';
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

  // Handle Comprehensive Pathologist Report Review & Sign-Off
  const handleOpenPathologistModal = (report) => {
    setSelectedReviewReport(report);
    setPathologistReviewStep('review');
    setPathologistFindings(report.findings || 'All analyte test parameters correlated and within expected clinical limits.');
    setVerificationNotes(report.verificationNotes || 'Diagnostic findings correlate clinically. Verified under laboratory quality protocol.');
    setPathologistRejectionReason('');
    setIsDoctorConfirmed(false);
    setPathologistModalError(null);
    setPathologistSignModalOpen(true);
  };

  const userName = user?.fullName || user?.name || user?.username || 'Team';
  const roleDisplayName = roleDef?.name || (user?.role ? user.role.replace(/_/g, ' ') : 'Staff');
  const labName = branding?.displayName || tenant?.name || 'JaipurLab';
  const labCode = tenant?.code || user?.tenantCode || null;

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const handleConfirmPathologistVerification = async (e) => {
    if (e) e.preventDefault();
    if (!selectedReviewReport) return;
    const comp = checkReportCompleteness(selectedReviewReport);
    if (!comp.isComplete) {
      setPathologistModalError(`Cannot verify report: missing diagnostic results for ${comp.missingItems.join(', ')}.`);
      return;
    }
    if (!isDoctorConfirmed) {
      setPathologistModalError('Please confirm the pathologist digital authorization statement before signing.');
      return;
    }

    setIsVerifyingReport(true);
    setPathologistModalError(null);
    try {
      await clinicalService.approveReport(tenantId, selectedReviewReport.reportId || selectedReviewReport.id, {
        findings: pathologistFindings.trim(),
        verificationNotes: verificationNotes.trim(),
        notes: verificationNotes.trim(),
        verifiedBy: user?.fullName || user?.email || 'Consultant Pathologist',
      });
      setSuccessBanner(`Report for order ${selectedReviewReport.orderNumber || selectedReviewReport.orderId} successfully verified & signed.`);
      setPathologistSignModalOpen(false);
      await fetchDashboard();
    } catch (err) {
      setPathologistModalError(err.response?.data?.message || err.message || 'Failed to verify diagnostic report.');
    } finally {
      setIsVerifyingReport(false);
    }
  };

  const handleConfirmPathologistRejection = async (e) => {
    if (e) e.preventDefault();
    if (!selectedReviewReport) return;
    const reason = pathologistRejectionReason.trim();
    if (!reason || reason.length < 5) {
      setPathologistModalError('Please enter a clinical justification for rejecting this report (minimum 5 characters).');
      return;
    }

    setIsVerifyingReport(true);
    setPathologistModalError(null);
    try {
      await clinicalService.rejectReport(tenantId, selectedReviewReport.reportId || selectedReviewReport.id, {
        reason,
      });
      setSuccessBanner(`Report for order ${selectedReviewReport.orderNumber || selectedReviewReport.orderId} rejected and returned to technician queue for revision.`);
      setPathologistSignModalOpen(false);
      await fetchDashboard();
    } catch (err) {
      setPathologistModalError(err.response?.data?.message || err.message || 'Failed to reject diagnostic report.');
    } finally {
      setIsVerifyingReport(false);
    }
  };

  const handleReleaseReport = async (reportId) => {
    if (!reportId) return;
    try {
      setIsVerifyingReport(true);
      const res = await clinicalService.releaseReport(tenantId, reportId);
      if (res.success) {
        setSuccessBanner(`Report ${res.data?.reportNumber || reportId} officially released to patient portal.`);
        await fetchDashboard();
      }
    } catch (err) {
      setPathologistModalError(err.response?.data?.message || err.message || 'Failed to release report.');
    } finally {
      setIsVerifyingReport(false);
    }
  };

  // Handle Quick Technician Analyzer Bench Action
  const handleOpenTechnicianModal = (sample) => {
    setSelectedBenchSample(sample);
    setModalError(null);
    setError(null);
    if (sample.collectionStatus === 'collected') {
      setTargetProcessingStatus('received');
    } else {
      setTargetProcessingStatus('in_analysis');
    }
    setTechnicianBenchModalOpen(true);
  };

  const handleConfirmTechnicianUpdate = async (e) => {
    e.preventDefault();
    if (!selectedBenchSample) return;
    setIsUpdatingSample(true);
    setError(null);
    setModalError(null);
    setSuccessBanner(null);
    try {
      if (targetProcessingStatus === 'received') {
        const res = await clinicalService.updateSampleStatus(tenantId, selectedBenchSample.sampleId || selectedBenchSample.id, {
          collectionStatus: 'received',
          notes: `Specimen received at bench triage on ${selectedAnalyzer}`,
        });
        const barcode = res?.data?.barcode || selectedBenchSample.barcode || selectedBenchSample.sampleId;
        setSuccessBanner(`Specimen ${barcode} received at laboratory bench.`);
      } else {
        const res = await clinicalService.updateSampleStatus(tenantId, selectedBenchSample.sampleId || selectedBenchSample.id, {
          processingStatus: targetProcessingStatus,
          analyzer: selectedAnalyzer,
          notes: `Bench status updated on ${selectedAnalyzer}`,
        });
        const barcode = res?.data?.barcode || selectedBenchSample.barcode || selectedBenchSample.sampleId;
        setSuccessBanner(`Specimen ${barcode} status updated to '${targetProcessingStatus}'.`);
      }
      setTechnicianBenchModalOpen(false);
      setModalError(null);
      await fetchDashboard();
    } catch (err) {
      setSuccessBanner(null);
      const msg = err.response?.data?.message || err.message || 'Failed to update analyzer bench run.';
      setModalError(msg);
      setError(msg);
    } finally {
      setIsUpdatingSample(false);
    }
  };

  // Contextual status-aware bench action for specimen queue
  const renderBenchAction = (sample) => {
    if (sample.collectionStatus === 'rejected' || sample.processingStatus === 'recollection_requested') {
      return (
        <Link
          to="/samples"
          className="btn btn-secondary btn-sm"
          style={{ color: 'var(--danger-600, #dc2626)', borderColor: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
          title="Specimen rejected. View Recollection Queue on Specimen Bench"
        >
          <RotateCcw size={12} />
          <span>Recollection</span>
        </Link>
      );
    }

    if (sample.processingStatus === 'completed') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: '#ecfdf5',
            color: '#047857',
            border: '1px solid #a7f3d0',
          }}
          title="Analytical run completed. Results validated."
        >
          <CheckCircle size={12} />
          <span>Completed</span>
        </span>
      );
    }

    if (sample.processingStatus === 'results_entered') {
      return (
        <button
          onClick={() => setResultEntrySample(sample)}
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem' }}
          title="Review or edit recorded analyte values prior to pathologist sign-off"
        >
          <FileText size={12} />
          <span>Edit Results</span>
        </button>
      );
    }

    if (sample.processingStatus === 'in_analysis') {
      return (
        <button
          onClick={() => setResultEntrySample(sample)}
          className="btn btn-primary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#7c3aed', borderColor: '#6d28d9', fontSize: '0.75rem' }}
          title="Complete instrument run & enter test results to push to Pathologist Sign-Off"
        >
          <Sparkles size={12} />
          <span>Enter Results</span>
        </button>
      );
    }

    // Specimen pending collection by phlebotomist (cannot be received until collected)
    if (sample.collectionStatus === 'pending') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 500,
            background: '#f8fafc',
            color: 'var(--slate-500, #64748b)',
            border: '1px solid var(--slate-200, #e2e8f0)',
          }}
          title="Specimen awaiting collection by phlebotomy before central lab receipt"
        >
          <Clock size={12} />
          <span>Awaiting Collection</span>
        </span>
      );
    }

    // Specimen collected by phlebotomy, eligible for central laboratory receipt triage
    if (sample.collectionStatus === 'collected') {
      return (
        <button
          onClick={() => handleOpenTechnicianModal(sample)}
          className="btn btn-secondary btn-sm"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', borderColor: '#2563eb', color: '#1d4ed8', fontSize: '0.75rem' }}
          title="Receive & verify collected specimen tube at laboratory accessioning desk"
        >
          <CheckCircle2 size={12} />
          <span>Receive at Bench</span>
        </button>
      );
    }

    // Specimen received in lab triage, eligible to load on analyzer instrument
    return (
      <button
        onClick={() => handleOpenTechnicianModal(sample)}
        className="btn btn-primary btn-sm"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem' }}
        title="Assign analyzer instrument and begin analytical run"
      >
        <Cpu size={12} />
        <span>Load on Instrument</span>
      </button>
    );
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

  // Helper to strictly evaluate whether all diagnostic tests in a report have recorded results
  const checkReportCompleteness = (report) => {
    const items = Array.isArray(report?.items) ? report.items : [];
    if (items.length === 0) {
      return { isComplete: false, totalItems: 0, completedCount: 0, missingItems: ['No test items'] };
    }
    const missing = [];
    let completedCount = 0;
    for (const it of items) {
      const hasParams = Array.isArray(it.parameterResults) && it.parameterResults.length > 0;
      if (hasParams) {
        const hasBlank = it.parameterResults.some((p) => p.value === undefined || p.value === null || String(p.value).trim() === '');
        if (!hasBlank) {
          completedCount++;
        } else {
          missing.push(it.testName || it.testCode || it.itemId || 'Test');
        }
      } else {
        const hasSingle = it.resultValue !== undefined && it.resultValue !== null && String(it.resultValue).trim() !== '';
        if (hasSingle) {
          completedCount++;
        } else {
          missing.push(it.testName || it.testCode || it.itemId || 'Test');
        }
      }
    }
    return {
      isComplete: missing.length === 0,
      totalItems: items.length,
      completedCount,
      missingItems: missing,
    };
  };

  // Helper for Clinical Panic / Out of Range Flag
  const getAbnormalFindingFlag = (report) => {
    if (!report) return null;

    if (report.status === 'rejected') {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '0.6875rem',
            fontWeight: 700,
            background: '#fef2f2',
            color: '#b91c1c',
            border: '1px solid #fecaca',
          }}
          title={report.rejectionReason ? `Rejected: ${report.rejectionReason}` : 'Report rejected by pathologist'}
        >
          <AlertTriangle size={11} />
          REJECTED CLINICAL STATE
        </span>
      );
    }

    const comp = checkReportCompleteness(report);
    if (!comp.isComplete) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 8px',
            borderRadius: '9999px',
            fontSize: '0.6875rem',
            fontWeight: 700,
            background: '#fff7ed',
            color: '#c2410c',
            border: '1px solid #fed7aa',
          }}
          title={`Awaiting results for: ${comp.missingItems.join(', ')}`}
        >
          <AlertCircle size={11} />
          INCOMPLETE ({comp.completedCount}/{comp.totalItems} TESTS)
        </span>
      );
    }

    const hasParamAbnormal = Array.isArray(report.items) && report.items.some(
      (it) => it.isAbnormal || (Array.isArray(it.parameterResults) && it.parameterResults.some((p) => p.isAbnormal))
    );
    const raw = (report.findings || report.notes || '').toLowerCase();
    const isCritical = raw.includes('critical') || raw.includes('panic') || raw.includes('severe');
    const isOutOfRange = hasParamAbnormal || raw.includes('elevated') || raw.includes('borderline') || raw.includes('low') || raw.includes('abnormal') || raw.includes('high');

    if (isCritical) {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.6875rem', fontWeight: 700, background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca' }}>
          <AlertTriangle size={11} />
          CRITICAL ABNORMAL
        </span>
      );
    }
    if (isOutOfRange) {
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

    // Dedicated Receptionist & Front Desk Stat Cards
    if (isReceptionist) {
      cards.push(
        <StatCard
          key="patients"
          title="Registered Patients"
          value={metrics.totalPatients}
          subtitle="Total directory profiles"
          icon={Users}
          colorScheme="cyan"
        />
      );
      cards.push(
        <StatCard
          key="today-orders"
          title="Today's Bookings"
          value={todaySummary.todayOrders ?? metrics.todayOrders ?? 0}
          subtitle="Requisitions logged today"
          icon={ClipboardList}
          colorScheme="blue"
        />
      );
      cards.push(
        <StatCard
          key="pending-orders"
          title="Pending Processing"
          value={todaySummary.pendingOrders ?? metrics.pendingOrders ?? 0}
          subtitle="In pipeline or phlebotomy"
          icon={Clock}
          colorScheme="amber"
        />
      );
      cards.push(
        <StatCard
          key="revenue"
          title="Settled Collections"
          value={`₹${(metrics.totalRevenue || 0).toLocaleString()}`}
          subtitle="Recorded receipts"
          icon={IndianRupee}
          colorScheme="teal"
        />
      );
      cards.push(
        <StatCard
          key="outstanding"
          title="Outstanding Ledger"
          value={`₹${(metrics.totalOutstanding || 0).toLocaleString()}`}
          subtitle="Pending patient balance"
          icon={CreditCard}
          colorScheme="orange"
        />
      );
      return cards;
    }

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

    if (!isReceptionist && hasPermission(['samples:view', 'samples:collect', 'samples:process'])) {
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

    if (!isReceptionist && hasPermission(['reports:view', 'reports:create', 'reports:verify', 'reports:release'])) {
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
          value={`₹${(metrics.totalRevenue || 0).toLocaleString()}`}
          subtitle="Recorded receipts"
          icon={CreditCard}
          colorScheme="teal"
        />
      );
      cards.push(
        <StatCard
          key="outstanding"
          title="Outstanding Balance"
          value={`₹${(metrics.totalOutstanding || 0).toLocaleString()}`}
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Welcome / Time-based Pastel Medical Hero Banner */}
      <div
        className="overview-hero-banner overview-hero-banner-flush"
        style={{
          background: 'linear-gradient(135deg, #fdf4ff 0%, #f5f3ff 45%, #eff6ff 100%)',
          borderRadius: '0 0 16px 16px',
          padding: '1.5rem 1.75rem',
          color: '#0f172a',
          boxShadow: '0 4px 20px -2px rgba(124, 58, 237, 0.05), 0 2px 6px rgba(15, 23, 42, 0.03)',
          position: 'relative',
          overflow: 'hidden',
          borderBottom: '1.5px solid #e9d5ff',
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
        }}
      >
        {/* Soft pastel ambient lighting orbs */}
        <div
          style={{
            position: 'absolute',
            top: '-40%',
            right: '-5%',
            width: '360px',
            height: '360px',
            background: 'radial-gradient(circle, rgba(196, 181, 253, 0.35) 0%, rgba(245, 243, 255, 0) 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-40%',
            left: '15%',
            width: '320px',
            height: '320px',
            background: 'radial-gradient(circle, rgba(167, 243, 208, 0.3) 0%, rgba(240, 253, 244, 0) 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div>
            <h1
              style={{
                fontSize: 'clamp(1.4rem, 2.5vw, 1.85rem)',
                fontWeight: 800,
                lineHeight: 1.25,
                margin: '0 0 0.35rem 0',
                letterSpacing: '-0.02em',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  background: 'linear-gradient(135deg, #7c3aed 0%, #9333ea 50%, #a855f7 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {getGreeting()}, {userName}!
              </span>
              <span
                role="img"
                aria-label="wave"
                style={{
                  display: 'inline-block',
                  fontSize: '1.45rem',
                  lineHeight: 1,
                  WebkitTextFillColor: 'initial',
                }}
              >
                👋
              </span>
            </h1>

            <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b', lineHeight: 1.45, maxWidth: '640px' }}>
              Welcome back to {labName}. Here is your live laboratory overview and operational summary today.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', marginLeft: 'auto' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(6px)',
                border: '1px solid #e2e8f0',
                borderRadius: '20px',
                padding: '4px 12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#64748b',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              }}
            >
              <Calendar size={13} style={{ color: '#7c3aed' }} />
              <span>{formattedDate}</span>
            </span>

            <button
              onClick={fetchDashboard}
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
              title="Refresh dashboard metrics"
            >
              <RotateCcw size={14} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Feedback Banner */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span style={{ fontSize: '0.875rem' }}>{error}</span>
          </div>
          <button onClick={() => setError(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#991b1b' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Success Feedback Banner */}
      {successBanner && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle2 size={16} />
            <span style={{ fontSize: '0.875rem' }}>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#166534' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Workstation View Toggle Tabs (For Non-Admin Clinical Staff) */}
      {!isLabAdmin && (isPathologist || isLabTechnician) && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border-subtle)',
            marginBottom: '1.25rem',
            paddingBottom: '2px',
          }}
        >
          {isPathologist && (
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
          )}

          {isLabTechnician && (
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
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. DEDICATED PATHOLOGIST CLINICAL WORKSTATION */}
      {/* ========================================================================= */}
      {!isReceptionist && (workstationView === 'pathologist' || (!isLabAdmin && isPathologist)) && (
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

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '8px 14px', borderRadius: '8px', textAlign: 'center', minWidth: '90px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{pendingReportsCount}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#fecaca', whiteSpace: 'nowrap' }}>Pending Review</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '8px 14px', borderRadius: '8px', textAlign: 'center', minWidth: '90px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{approvedReportsCount}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#fecaca', whiteSpace: 'nowrap' }}>Awaiting Release</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '8px 14px', borderRadius: '8px', textAlign: 'center', minWidth: '90px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{rejectedReportsCount}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#fecaca', whiteSpace: 'nowrap' }}>Rejected</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '8px 14px', borderRadius: '8px', textAlign: 'center', minWidth: '90px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{releasedReportsCount}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#fecaca', whiteSpace: 'nowrap' }}>Released</div>
                </div>
                <div style={{ background: 'rgba(255, 255, 255, 0.15)', padding: '8px 14px', borderRadius: '8px', textAlign: 'center', minWidth: '90px' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{todaySummary.formattedTat || 'N/A'}</div>
                  <div style={{ fontSize: '0.6875rem', color: '#fecaca', whiteSpace: 'nowrap' }}>Avg Review TAT</div>
                </div>
              </div>
            </div>
          </div>

          {/* Pathologist Diagnostic Queue Card */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileCheck size={18} style={{ color: '#b91c1c' }} />
                <h3 className="card-title" style={{ margin: 0 }}>Diagnostic Reports Verification Queue</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontWeight: 500 }}>
                  ({actionableReportsCount} actionable • {recentReports.length} total)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', background: 'var(--slate-100, #f1f5f9)', padding: '2px', borderRadius: '6px' }}>
                  <button
                    type="button"
                    onClick={() => { setReportQueueFilter('actionable'); setReportQueuePage(1); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: reportQueueFilter === 'actionable' ? 700 : 500,
                      borderRadius: '4px',
                      border: 'none',
                      background: reportQueueFilter === 'actionable' ? '#fff' : 'transparent',
                      color: reportQueueFilter === 'actionable' ? '#b91c1c' : 'var(--slate-600)',
                      boxShadow: reportQueueFilter === 'actionable' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Actionable ({actionableReportsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReportQueueFilter('pending'); setReportQueuePage(1); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: reportQueueFilter === 'pending' ? 700 : 500,
                      borderRadius: '4px',
                      border: 'none',
                      background: reportQueueFilter === 'pending' ? '#fff' : 'transparent',
                      color: reportQueueFilter === 'pending' ? '#b91c1c' : 'var(--slate-600)',
                      boxShadow: reportQueueFilter === 'pending' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Pending Sign-Off ({pendingReportsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReportQueueFilter('approved'); setReportQueuePage(1); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: reportQueueFilter === 'approved' ? 700 : 500,
                      borderRadius: '4px',
                      border: 'none',
                      background: reportQueueFilter === 'approved' ? '#fff' : 'transparent',
                      color: reportQueueFilter === 'approved' ? '#0d9488' : 'var(--slate-600)',
                      boxShadow: reportQueueFilter === 'approved' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Awaiting Release ({approvedReportsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setReportQueueFilter('all'); setReportQueuePage(1); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: reportQueueFilter === 'all' ? 700 : 500,
                      borderRadius: '4px',
                      border: 'none',
                      background: reportQueueFilter === 'all' ? '#fff' : 'transparent',
                      color: reportQueueFilter === 'all' ? '#1d4ed8' : 'var(--slate-600)',
                      boxShadow: reportQueueFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    All ({recentReports.length})
                  </button>
                </div>
                <Link to="/reports" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span>Open Diagnostic Reports Portal</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>

            <div className="table-container">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Patient / MRN</th>
                    <th>Diagnostic Panel</th>
                    <th>Clinical Result State</th>
                    <th>Report Workflow Status</th>
                    <th>Priority</th>
                    <th style={{ textAlign: 'right' }}>Physician Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedReports.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-400)' }}>
                        {reportQueueFilter === 'actionable'
                          ? 'No actionable diagnostic reports in verification queue. Excellent work!'
                          : 'No reports found matching the selected filter.'}
                      </td>
                    </tr>
                  ) : (
                    displayedReports.map((report) => {
                      const comp = checkReportCompleteness(report);
                      const isPendingReview = report.status === 'draft' || report.status === 'pending_review';
                      return (
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div>{getAbnormalFindingFlag(report)}</div>
                              {report.status === 'rejected' ? (
                                <span style={{ fontSize: '0.75rem', color: '#991b1b', fontStyle: 'italic' }}>
                                  Rejection note: {report.rejectionReason || 'Returned for correction'}
                                </span>
                              ) : !comp.isComplete ? (
                                <span style={{ fontSize: '0.75rem', color: '#c2410c' }}>
                                  Awaiting: {comp.missingItems.join(', ')}
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.8125rem', color: 'var(--slate-700)' }}>
                                  {report.findings || 'All analyte results verified within reference thresholds.'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {report.status === 'rejected' ? (
                              <Badge variant="danger" icon={AlertTriangle}>Rejected</Badge>
                            ) : report.status === 'released' ? (
                              <Badge variant="success" icon={CheckCircle2}>Released</Badge>
                            ) : report.status === 'approved' ? (
                              <Badge variant="teal">Approved</Badge>
                            ) : report.status === 'pending_review' ? (
                              <Badge variant="purple">Ready for Review</Badge>
                            ) : (
                              <Badge variant="warning">Draft</Badge>
                            )}
                          </td>
                          <td>{getPriorityBadge(report.priority || 'stat')}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                              {isPendingReview ? (
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
                                  title="Open complete clinical review and sign-off workflow"
                                >
                                  <Stethoscope size={13} />
                                  <span>Review & Sign-Off</span>
                                </button>
                              ) : report.status === 'approved' && canRelease ? (
                                <button
                                  onClick={() => handleReleaseReport(report.reportId || report.id)}
                                  className="btn btn-success btn-sm"
                                  style={{
                                    background: 'var(--teal-600, #0d9488)',
                                    borderColor: 'var(--teal-600, #0d9488)',
                                    color: 'white',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                  }}
                                  title="Release approved report to patient portal"
                                >
                                  <CheckCircle2 size={13} />
                                  <span>Release</span>
                                </button>
                              ) : report.status === 'rejected' ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--danger-600, #dc2626)' }}>
                                  <AlertTriangle size={13} />
                                  <span>Rejected</span>
                                </span>
                              ) : report.status === 'approved' ? (
                                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--teal-700, #0f766e)' }}>
                                  Approved
                                </span>
                              ) : report.status === 'released' ? (
                                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--success-700, #15803d)' }}>
                                  Released
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', textTransform: 'capitalize' }}>
                                  {report.status}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleOpenPathologistModal(report)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                title="Inspect full diagnostic report details"
                              >
                                <Eye size={13} />
                                <span>View</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination & Summary Footer */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'var(--slate-50, #f8fafc)', borderTop: '1px solid var(--border-color, #e2e8f0)', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ fontSize: '0.8125rem', color: 'var(--slate-600)' }}>
                Showing <strong>{displayedReports.length}</strong> of <strong>{prioritizedReports.length}</strong> {reportQueueFilter === 'actionable' ? 'actionable reports' : 'reports in queue'}
                {recentReports.length > prioritizedReports.length && (
                  <span style={{ color: 'var(--slate-400)', marginLeft: '6px' }}>
                    ({recentReports.length} total loaded)
                  </span>
                )}
              </div>
              {totalReportPages > 1 && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={currentReportPage <= 1}
                    onClick={() => setReportQueuePage((p) => Math.max(1, p - 1))}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                  >
                    <ChevronLeft size={13} />
                    <span>Prev</span>
                  </button>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                    Page {currentReportPage} of {totalReportPages}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={currentReportPage >= totalReportPages}
                    onClick={() => setReportQueuePage((p) => Math.min(totalReportPages, p + 1))}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                  >
                    <span>Next</span>
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ========================================================================= */}
      {/* 2. DEDICATED LAB TESTING / TECHNICIAN ANALYZER WORKSTATION */}
      {/* ========================================================================= */}
      {!isReceptionist && (workstationView === 'technician' || (!isLabAdmin && isTechnician)) && (
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
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <FlaskConical size={18} style={{ color: '#2563eb' }} />
                <h3 className="card-title" style={{ margin: 0 }}>Specimen Tubes & Analyzer Run Queue</h3>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: '999px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                  {metrics.activeQueueSamples !== undefined && metrics.activeQueueSamples > activeQueueCount
                    ? `${activeQueueCount} in Queue (${metrics.activeQueueSamples} Active in Lab)`
                    : `${activeQueueCount} Active on Bench`}
                </span>
                {recentSamples.length > activeQueueCount && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                    ({recentSamples.length} loaded preview)
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'inline-flex', background: 'var(--slate-100, #f1f5f9)', padding: '2px', borderRadius: '6px' }}>
                  <button
                    type="button"
                    onClick={() => { setQueueFilter('active'); setQueuePage(1); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: queueFilter === 'active' ? 700 : 500,
                      borderRadius: '4px',
                      border: 'none',
                      background: queueFilter === 'active' ? '#fff' : 'transparent',
                      color: queueFilter === 'active' ? '#1d4ed8' : 'var(--slate-600)',
                      boxShadow: queueFilter === 'active' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Active Queue ({activeQueueCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setQueueFilter('all'); setQueuePage(1); }}
                    style={{
                      padding: '4px 10px',
                      fontSize: '0.75rem',
                      fontWeight: queueFilter === 'all' ? 700 : 500,
                      borderRadius: '4px',
                      border: 'none',
                      background: queueFilter === 'all' ? '#fff' : 'transparent',
                      color: queueFilter === 'all' ? '#1d4ed8' : 'var(--slate-600)',
                      boxShadow: queueFilter === 'all' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      cursor: 'pointer',
                    }}
                  >
                    All Tubes ({recentSamples.length})
                  </button>
                </div>
                <Link to="/samples" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span>Open Full Specimen Bench</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
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
                  {displayedSamples.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-400)' }}>
                        {queueFilter === 'active'
                          ? 'No active specimen tubes currently in analyzer queue. All accessioned tubes have completed testing or view All Tubes.'
                          : 'No specimen tubes accessioned yet. Accession new samples via Patient Requisitions.'}
                      </td>
                    </tr>
                  ) : (
                    displayedSamples.map((sample) => (
                      <tr key={sample.sampleId || sample.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <QrCode size={15} style={{ color: 'var(--slate-500)' }} />
                            <strong style={{ fontFamily: 'monospace', color: 'var(--primary-700)' }}>
                              {sample.barcode || sample.sampleId}
                            </strong>
                          </div>
                        </td>
                        <td>{getTubeCapBadge(sample.type || sample.sampleType, sample.testName)}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{sample.patientName || 'Accessioned Patient'}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{sample.patientMrn || sample.orderNumber || sample.orderId}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 500 }}>
                            {sample.testName || sample.testNames?.join(', ') || sample.tests?.join(', ') || 'Diagnostic Panel'}
                          </span>
                        </td>
                        <td>
                          <Badge variant={sample.processingStatus === 'completed' ? 'success' : sample.processingStatus === 'in_analysis' ? 'purple' : sample.processingStatus === 'results_entered' ? 'teal' : 'warning'}>
                            {sample.processingStatus === 'in_analysis' ? 'In Analyzer Run' : sample.processingStatus === 'results_entered' ? 'Pending Sign-Off' : sample.processingStatus || 'Awaiting Run'}
                          </Badge>
                        </td>
                        <td>{getPriorityBadge(sample.priority || 'stat')}</td>
                        <td style={{ textAlign: 'right' }}>
                          {renderBenchAction(sample)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination & Total Count Footer */}
            {eligibleSamples.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-color)', fontSize: '0.8125rem', color: 'var(--slate-600)', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  Showing <strong>{startIndex + 1}</strong> to <strong>{Math.min(startIndex + QUEUE_PAGE_SIZE, eligibleSamples.length)}</strong> of <strong>{eligibleSamples.length}</strong> {queueFilter === 'active' ? 'active queue records' : 'loaded records'}
                  {metrics.activeQueueSamples !== undefined && metrics.activeQueueSamples > eligibleSamples.length && queueFilter === 'active' && (
                    <span style={{ color: 'var(--slate-500)', marginLeft: '6px' }}>
                      (Previewing top {eligibleSamples.length} of {metrics.activeQueueSamples} active in lab — <Link to="/samples" style={{ color: '#2563eb', fontWeight: 600 }}>Open Full Bench</Link>)
                    </span>
                  )}
                </div>
                {totalQueuePages > 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={currentPage <= 1}
                      onClick={() => setQueuePage((p) => Math.max(1, p - 1))}
                      style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      <ChevronLeft size={13} />
                      <span>Prev</span>
                    </button>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      Page {currentPage} of {totalQueuePages}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={currentPage >= totalQueuePages}
                      onClick={() => setQueuePage((p) => Math.min(totalQueuePages, p + 1))}
                      style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      <span>Next</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}



      {/* ========================================================================= */}
      {/* 4. DYNAMIC OPERATIONAL OVERVIEW (Rendered for Permitted Roles) */}
      {/* ========================================================================= */}
      {(workstationView === 'all' || isReceptionist || workstationView === 'receptionist' || (!isPathologist && !isTechnician)) && (
        <>
          {/* Today's Lab Orders Summary Section (Clinical Staff Only) */}
          {isClinicalStaff && !isReceptionist && hasPermission(['orders:view', 'samples:view', 'reports:view']) && (
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
          {isClinicalStaff && !isReceptionist && hasPermission(['samples:view', 'samples:process', 'orders:view', 'reports:view']) && (
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
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ClipboardList size={18} style={{ color: 'var(--primary-600)' }} />
                  <h2 className="card-title">
                    {isReceptionist ? 'Recent Patient Requisitions & Booking Intake' : 'Recent Laboratory Activity'}
                  </h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="badge badge-blue">
                    {recentOrders.length} {recentOrders.length === 1 ? 'Record' : 'Records'}
                  </span>
                  {isReceptionist && (
                    <Link to="/orders" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span>View All Orders</span>
                      <ArrowRight size={13} />
                    </Link>
                  )}
                </div>
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
                      displayedRecentOrders.map((order) => (
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

              {/* Pagination & Summary Footer for Recent Laboratory Activity (5 records per page) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', background: 'var(--slate-50, #f8fafc)', borderTop: '1px solid var(--border-color, #e2e8f0)', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '0.8125rem', color: 'var(--slate-600)' }}>
                  Showing <strong>{recentOrders.length === 0 ? 0 : startOrderIdx + 1}</strong> to <strong>{Math.min(startOrderIdx + RECENT_ORDERS_PAGE_SIZE, recentOrders.length)}</strong> of <strong>{recentOrders.length}</strong> requisitions
                </div>
                {totalRecentOrdersPages > 1 && (
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={currentRecentOrdersPage <= 1}
                      onClick={() => setRecentOrdersPage((p) => Math.max(1, p - 1))}
                      style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      <ChevronLeft size={13} />
                      <span>Prev</span>
                    </button>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      Page {currentRecentOrdersPage} of {totalRecentOrdersPages}
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={currentRecentOrdersPage >= totalRecentOrdersPages}
                      onClick={() => setRecentOrdersPage((p) => Math.min(totalRecentOrdersPages, p + 1))}
                      style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                    >
                      <span>Next</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Pathologist Clinical Sign-Off */}
      {/* ========================================================================= */}
      {pathologistSignModalOpen && selectedReviewReport && (() => {
        const comp = checkReportCompleteness(selectedReviewReport);
        const items = Array.isArray(selectedReviewReport.items) ? selectedReviewReport.items : [];
        const hasAbnormal = items.some(
          (it) => it.isAbnormal || (Array.isArray(it.parameterResults) && it.parameterResults.some((pr) => pr.isAbnormal))
        );

        return (
          <Modal
            isOpen={pathologistSignModalOpen}
            onClose={() => {
              setPathologistSignModalOpen(false);
              setPathologistModalError(null);
            }}
            title={`Diagnostic Report Clinical Review: ${selectedReviewReport.reportNumber || selectedReviewReport.orderNumber || 'Requisition'}`}
            size="lg"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
              {/* Modal Inline Error Alert */}
              {pathologistModalError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.8125rem' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>{pathologistModalError}</span>
                </div>
              )}

              {/* Context Summary Banner */}
              <div style={{ background: '#f8fafc', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px', padding: '12px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>Patient Name</span>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--slate-900)' }}>{selectedReviewReport.patientName}</div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--slate-500)' }}>MRN: {selectedReviewReport.patientMrn || 'N/A'}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>Diagnostic Panel</span>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary-blue, #2563eb)' }}>
                    {selectedReviewReport.tests?.map((t) => t.name || t.testCode).join(', ') || selectedReviewReport.testName || 'Comprehensive Panel'}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--slate-500)' }}>Order: {selectedReviewReport.orderNumber || selectedReviewReport.orderId}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>Drafted By</span>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{selectedReviewReport.draftedBy || 'Laboratory Staff'}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                    Workflow State: <strong style={{ textTransform: 'capitalize' }}>{selectedReviewReport.status}</strong>
                  </div>
                </div>
              </div>

              {/* Clinical Completeness / Warnings */}
              {!comp.isComplete ? (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px', color: '#9a3412', fontSize: '0.8125rem' }}>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={15} />
                    <span>Incomplete Diagnostic Report — Approval Disabled</span>
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    One or more tests in this requisition are missing diagnostic results (
                    <strong>{comp.missingItems.join(', ')}</strong>). Pathologist approval is blocked until remaining specimen runs are completed.
                  </div>
                </div>
              ) : hasAbnormal ? (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', color: '#991b1b', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span><strong>Pathological Alert:</strong> One or more analyte parameters are outside normal physiological reference ranges. Please evaluate clinical implications before approval.</span>
                </div>
              ) : (
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '10px 12px', color: '#047857', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={15} style={{ flexShrink: 0 }} />
                  <span><strong>All Analytes Complete:</strong> All required parameters recorded and verified within laboratory reference limits.</span>
                </div>
              )}

              {/* VIEW 1: MAIN REVIEW VIEW */}
              {pathologistReviewStep === 'review' && (
                <>
                  {/* Parameter Results Table */}
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--slate-800)' }}>
                      Verified Diagnostic Test Results & Analyte Parameters ({items.length} Test{items.length === 1 ? '' : 's'}):
                    </h4>
                    <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px' }}>
                      {items.length === 0 ? (
                        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.8125rem' }}>
                          No test items attached to this report requisition.
                        </div>
                      ) : (
                        items.map((it, idx) => (
                          <div key={idx} style={{ borderBottom: idx < items.length - 1 ? '1px solid var(--border-color, #e2e8f0)' : 'none' }}>
                            <div style={{ padding: '6px 12px', background: 'var(--slate-100, #f1f5f9)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--slate-700)', display: 'flex', justifyContent: 'space-between' }}>
                              <span>{it.testName || it.testCode}</span>
                              {it.isAbnormal && <span style={{ color: '#dc2626', fontSize: '0.75rem', fontWeight: 700 }}>ABNORMAL FINDING</span>}
                            </div>
                            {Array.isArray(it.parameterResults) && it.parameterResults.length > 0 ? (
                              <table className="lms-table" style={{ margin: 0, fontSize: '0.8125rem' }}>
                                <thead>
                                  <tr>
                                    <th>Parameter / Analyte</th>
                                    <th>Observed Result</th>
                                    <th>Unit</th>
                                    <th>Reference Range</th>
                                    <th>Clinical Flag</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {it.parameterResults.map((pr, pidx) => {
                                    const isBlank = pr.value === undefined || pr.value === null || String(pr.value).trim() === '';
                                    return (
                                      <tr key={pidx} style={{ background: pr.isAbnormal ? '#fff5f5' : isBlank ? '#fffbeb' : undefined }}>
                                        <td style={{ fontWeight: 600 }}>{pr.name || pr.parameterCode}</td>
                                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: pr.isAbnormal ? '#dc2626' : undefined }}>
                                          {isBlank ? <span style={{ color: '#c2410c', fontStyle: 'italic' }}>Missing result</span> : pr.value}
                                        </td>
                                        <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{pr.unit || '—'}</td>
                                        <td style={{ fontSize: '0.75rem' }}>{pr.referenceRange || 'Standard'}</td>
                                        <td>
                                          {isBlank ? (
                                            <Badge variant="warning" style={{ fontSize: '0.65rem' }}>MISSING</Badge>
                                          ) : pr.isAbnormal ? (
                                            <Badge variant="danger" style={{ fontSize: '0.65rem' }}>ABNORMAL</Badge>
                                          ) : (
                                            <Badge variant="success" style={{ fontSize: '0.65rem' }}>NORMAL</Badge>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            ) : (
                              <div style={{ padding: '8px 12px', fontSize: '0.8125rem', color: 'var(--slate-700)' }}>
                                Result:{' '}
                                {it.resultValue && String(it.resultValue).trim() !== '' ? (
                                  <strong>{it.resultValue}</strong>
                                ) : (
                                  <span style={{ color: '#c2410c', fontStyle: 'italic' }}>Awaiting analytical result entry</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Findings */}
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                      Pathologist Clinical Findings & Interpretation *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={pathologistFindings}
                      onChange={(e) => setPathologistFindings(e.target.value)}
                      className="form-control"
                      style={{ fontSize: '0.8125rem' }}
                      placeholder="Enter clinical impression (e.g. Normocytic normochromic blood picture...)"
                    />
                  </div>

                  {/* Verification Notes */}
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                      Pathologist Quality Notes & Accreditation Certification (Optional)
                    </label>
                    <input
                      type="text"
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      className="form-control"
                      style={{ fontSize: '0.8125rem' }}
                      placeholder="Enter verification notes or quality remarks..."
                    />
                  </div>

                  {/* Footer Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setPathologistSignModalOpen(false);
                        setPathologistModalError(null);
                      }}
                      disabled={isVerifyingReport}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setPathologistSignModalOpen(false)}
                      disabled={isVerifyingReport}
                    >
                      Close
                    </button>

                    {selectedReviewReport.status === 'draft' || selectedReviewReport.status === 'pending_review' ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ background: 'var(--danger-600, #dc2626)', color: 'white', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                          onClick={() => {
                            setPathologistModalError(null);
                            setPathologistReviewStep('confirm_reject');
                          }}
                          disabled={isVerifyingReport}
                        >
                          <AlertTriangle size={14} />
                          <span>Reject Report</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary"
                          style={{ background: '#b91c1c', borderColor: '#991b1b', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          onClick={() => {
                            setPathologistModalError(null);
                            setPathologistReviewStep('confirm_approve');
                          }}
                          disabled={isVerifyingReport || !comp.isComplete}
                          title={!comp.isComplete ? `Cannot approve: Missing results for ${comp.missingItems.join(', ')}` : 'Proceed to sign-off confirmation'}
                        >
                          <ShieldCheck size={14} />
                          <span>Approve & Sign Report</span>
                        </button>
                      </div>
                    ) : selectedReviewReport.status === 'approved' ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--teal-700, #0f766e)' }}>
                          Verified & Approved
                        </span>
                        {canRelease && (
                          <button
                            type="button"
                            className="btn btn-success"
                            style={{ background: 'var(--teal-600, #0d9488)', borderColor: 'var(--teal-600, #0d9488)', color: 'white', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                            onClick={async () => {
                              setPathologistSignModalOpen(false);
                              await handleReleaseReport(selectedReviewReport.reportId || selectedReviewReport.id);
                            }}
                            disabled={isVerifyingReport}
                          >
                            <CheckCircle2 size={14} />
                            <span>Release to Patient Portal</span>
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--slate-600)' }}>
                        Status: <strong style={{ textTransform: 'capitalize' }}>{selectedReviewReport.status}</strong>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* VIEW 2: CONFIRM APPROVAL STEP */}
              {pathologistReviewStep === 'confirm_approve' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '14px', color: '#1e40af' }}>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem' }}>
                      <ShieldCheck size={18} />
                      <span>Confirm Pathologist Approval & Sign-Off</span>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.8125rem', lineHeight: 1.5, color: '#1e3a8a' }}>
                      You are about to authorize and digitally sign report <strong>{selectedReviewReport.reportNumber || selectedReviewReport.orderNumber}</strong> for patient <strong>{selectedReviewReport.patientName}</strong>.
                      This decision moves the requisition into <strong>Approved</strong> status, locking verified analyte parameters under ISO 15189 accreditation standards.
                    </div>
                  </div>

                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', fontSize: '0.8125rem', cursor: 'pointer', color: 'var(--slate-800)', background: 'var(--slate-50)', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                    <input
                      type="checkbox"
                      required
                      checked={isDoctorConfirmed}
                      onChange={(e) => setIsDoctorConfirmed(e.target.checked)}
                      style={{ marginTop: '2px' }}
                    />
                    <span>
                      <strong>Consultant Pathologist Authorization:</strong> I certify that I have thoroughly inspected all analyte values, reviewed pathological out-of-range alerts, verified clinical correlation, and hereby authorize report issuance.
                    </span>
                  </label>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setPathologistReviewStep('review')}
                      disabled={isVerifyingReport}
                    >
                      Back to Review
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ background: '#b91c1c', borderColor: '#991b1b', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={handleConfirmPathologistVerification}
                      disabled={!isDoctorConfirmed || isVerifyingReport}
                    >
                      {isVerifyingReport && <Loader2 size={14} className="animate-spin" />}
                      <span>Confirm & Sign Report</span>
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW 3: CONFIRM REJECTION STEP */}
              {pathologistReviewStep === 'confirm_reject' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '14px', color: '#991b1b' }}>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem' }}>
                      <AlertTriangle size={18} />
                      <span>Confirm Clinical Rejection & Return for Revision</span>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.8125rem', lineHeight: 1.5, color: '#7f1d1d' }}>
                      Rejecting this report will return it to the laboratory bench queue for technician rerun or result correction.
                      This rejection justification will be permanently saved to the report's audit trail and displayed on the technician bench.
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8125rem' }}>
                      Clinical Rejection Justification * (minimum 5 characters)
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={pathologistRejectionReason}
                      onChange={(e) => setPathologistRejectionReason(e.target.value)}
                      className="form-control"
                      style={{ fontSize: '0.8125rem' }}
                      placeholder="e.g. Inconsistent potassium analyzer readout; gross hemolysis suspected. Redraw or repeat bench analysis required."
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setPathologistReviewStep('review')}
                      disabled={isVerifyingReport}
                    >
                      Back to Review
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ background: 'var(--danger-600, #dc2626)', color: 'white', border: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      onClick={handleConfirmPathologistRejection}
                      disabled={isVerifyingReport || pathologistRejectionReason.trim().length < 5}
                    >
                      {isVerifyingReport && <Loader2 size={14} className="animate-spin" />}
                      <span>Confirm Clinical Rejection</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODAL: Technician Analyzer Bench Action */}
      {/* ========================================================================= */}
      {technicianBenchModalOpen && selectedBenchSample && (
        <Modal
          isOpen={technicianBenchModalOpen}
          onClose={() => {
            setTechnicianBenchModalOpen(false);
            setModalError(null);
          }}
          title={`Analyzer Bench Run: ${selectedBenchSample.barcode || selectedBenchSample.sampleId}`}
          size="md"
        >
          <form onSubmit={handleConfirmTechnicianUpdate}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Modal Inline Error Alert */}
              {modalError && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.8125rem' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                  <span>{modalError}</span>
                </div>
              )}

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e40af' }}>
                    Barcode: {selectedBenchSample.barcode || selectedBenchSample.sampleId}
                  </span>
                  {getTubeCapBadge(selectedBenchSample.type || selectedBenchSample.sampleType, selectedBenchSample.testName)}
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
                  {selectedBenchSample?.collectionStatus === 'collected' && (
                    <option value="received">Receive at Bench (Central Lab Triage)</option>
                  )}
                  {selectedBenchSample?.collectionStatus === 'received' && (
                    <option value="in_analysis">
                      Loaded on Instrument (In Analyzer Run)
                    </option>
                  )}
                </select>
              </div>

              {selectedBenchSample?.processingStatus === 'in_analysis' && (
                <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '6px', padding: '10px 12px', fontSize: '0.8125rem', color: '#5b21b6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span>Instrument run is in progress. Ready to enter test results?</span>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setTechnicianBenchModalOpen(false);
                        setModalError(null);
                        setResultEntrySample(selectedBenchSample);
                      }}
                      style={{ background: '#7c3aed', borderColor: '#6d28d9', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Sparkles size={12} />
                      <span>Open Result Entry</span>
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setTechnicianBenchModalOpen(false);
                    setModalError(null);
                  }}
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

      {/* Result Entry Modal for Direct Analyte Feeding */}
      {resultEntrySample && (
        <ResultEntryModal
          isOpen={Boolean(resultEntrySample)}
          onClose={() => setResultEntrySample(null)}
          sample={resultEntrySample}
          tenantId={tenantId}
          onSuccess={async () => {
            setSuccessBanner(`Results recorded for specimen ${resultEntrySample.barcode || resultEntrySample.sampleId}. Pushed to Pathologist Review.`);
            setResultEntrySample(null);
            await fetchDashboard();
          }}
        />
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
    </div>
  );
}

export default DashboardPage;
