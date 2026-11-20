/**
 * Lab Management System (LMS) - Diagnostic Reports Page (Phase 6 Real Verification Workflow)
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { FileText, CheckCircle2, AlertTriangle, AlertCircle, Eye, Printer, Download, PlusCircle, Loader2, ShieldCheck, Search, X, RotateCcw, Send } from 'lucide-react';
import QRCode from 'qrcode';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import clinicalService from '../../services/clinicalService';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ConfirmModal from '../../components/common/ConfirmModal';
import notify from '../../utils/notify';
import { classifyResult, isGenericReferenceRange } from '../../utils/clinicalClassification';
import { generateBarcodeSvg } from '../../utils/barcode128';

function renderResultFlagBadge(pr) {
  const isBlank = pr.value === undefined || pr.value === null || String(pr.value).trim() === '';
  if (isBlank) {
    return <Badge variant="warning">Missing</Badge>;
  }
  const evalResult = classifyResult(pr.value, pr);
  const isAbnormal = Boolean(pr.isAbnormal || evalResult?.isAbnormal);
  const flag = (pr.flag && pr.flag !== 'NORMAL')
    ? pr.flag
    : (evalResult && evalResult.flag !== 'UNCLASSIFIED')
      ? evalResult.flag
      : isAbnormal
        ? 'ABNORMAL'
        : (pr.flag === 'NORMAL' && !isAbnormal)
          ? 'NORMAL'
          : evalResult?.flag || 'UNCLASSIFIED';

  switch (flag) {
    case 'CRITICAL_LOW':
    case 'CRITICAL_HIGH':
      return <Badge variant="danger" icon={AlertCircle}>CRITICAL</Badge>;
    case 'LOW':
      return <Badge variant="warning">LOW</Badge>;
    case 'HIGH':
      return <Badge variant="danger">HIGH</Badge>;
    case 'ABNORMAL':
      return <Badge variant="danger">Abnormal</Badge>;
    case 'NORMAL':
      return <Badge variant="success">Normal</Badge>;
    case 'UNCLASSIFIED':
    default:
      return <Badge variant="secondary">{isAbnormal ? 'Abnormal' : 'Review'}</Badge>;
  }
}

function getPrintFlagDisplay(pr) {
  const isBlank = pr.value === undefined || pr.value === null || String(pr.value).trim() === '';
  if (isBlank) return { text: 'MISSING', isAbnormal: false, color: '#d97706', bg: '#fef3c7' };
  const evalResult = classifyResult(pr.value, pr);
  const isAbnormal = Boolean(pr.isAbnormal || evalResult?.isAbnormal);
  const flag = (pr.flag && pr.flag !== 'NORMAL')
    ? pr.flag
    : (evalResult && evalResult.flag !== 'UNCLASSIFIED')
      ? evalResult.flag
      : isAbnormal
        ? 'ABNORMAL'
        : (pr.flag === 'NORMAL' && !isAbnormal)
          ? 'NORMAL'
          : evalResult?.flag || 'UNCLASSIFIED';

  switch (flag) {
    case 'CRITICAL_LOW':
      return { text: 'CRIT LOW', isAbnormal: true, color: '#dc2626', bg: '#fee2e2' };
    case 'CRITICAL_HIGH':
      return { text: 'CRIT HIGH', isAbnormal: true, color: '#dc2626', bg: '#fee2e2' };
    case 'LOW':
      return { text: 'LOW', isAbnormal: true, color: '#b45309', bg: '#fef3c7' };
    case 'HIGH':
      return { text: 'HIGH', isAbnormal: true, color: '#dc2626', bg: '#fee2e2' };
    case 'ABNORMAL':
      return { text: 'ABNORMAL', isAbnormal: true, color: '#dc2626', bg: '#fee2e2' };
    case 'NORMAL':
      return { text: 'NORMAL', isAbnormal: false, color: '#16a34a', bg: '#dcfce7' };
    case 'UNCLASSIFIED':
    default:
      return { text: isAbnormal ? 'ABNORMAL' : 'REVIEW', isAbnormal, color: '#475569', bg: '#f1f5f9' };
  }
}

function resolveParamInterval(pr) {
  if (pr.referenceRange && !isGenericReferenceRange(pr.referenceRange)) {
    return pr.referenceRange;
  }
  const evalResult = classifyResult(pr.value, pr);
  if (evalResult?.referenceRangeDisplay && !isGenericReferenceRange(evalResult.referenceRangeDisplay)) {
    return evalResult.referenceRangeDisplay;
  }
  if (pr.lowNormal !== null && pr.highNormal !== null && pr.lowNormal !== undefined && pr.highNormal !== undefined && pr.lowNormal !== '' && pr.highNormal !== '') {
    return `${pr.lowNormal} - ${pr.highNormal}`;
  }
  if (pr.highNormal !== null && pr.highNormal !== undefined && pr.highNormal !== '') {
    return `< ${pr.highNormal}`;
  }
  if (pr.lowNormal !== null && pr.lowNormal !== undefined && pr.lowNormal !== '') {
    return `> ${pr.lowNormal}`;
  }
  return '—';
}

/**
 * Formats a Pathologist's name properly for the diagnostic report header/footer.
 * Prevents raw email addresses from appearing and ensures formal 'Dr. <Name>' title.
 */
export function formatPathologistName(raw) {
  if (!raw || typeof raw !== 'string') return 'Dr. Pathologist';
  let str = raw.trim();
  if (!str) return 'Dr. Pathologist';

  if (str.includes('@')) {
    const userPart = str.split('@')[0];
    str = userPart.replace(/[._\-+]/g, ' ').replace(/\d+/g, '').trim();
  }

  const lower = str.toLowerCase();
  if (
    lower === 'consultant pathologist' ||
    lower === 'pathologist' ||
    lower === 'director & chief pathologist' ||
    lower === 'pathologist / director' ||
    lower === 'lab pathologist'
  ) {
    return 'Dr. Pathologist';
  }

  const words = str
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  if (words.length === 0) return 'Dr. Pathologist';

  let formatted = words.join(' ');
  if (/^dr\.?\s+/i.test(formatted)) {
    formatted = formatted.replace(/^dr\.?\s+/i, 'Dr. ');
  } else if (/^doctor\s+/i.test(formatted)) {
    formatted = formatted.replace(/^doctor\s+/i, 'Dr. ');
  } else {
    formatted = `Dr. ${formatted}`;
  }

  return formatted;
}

/**
 * Formats timestamps cleanly for clinical report display.
 * Returns null if missing/invalid to allow hiding optional fields.
 */
export function formatReportDateTime(rawDate) {
  if (!rawDate) return null;
  try {
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return null;
  }
}

export function ReportsPage() {
  const { user, tenant } = useAuth();
  const { tenant: contextTenant, branding } = useTenant();
  const currentTenant = contextTenant || tenant;
  const tenantId = currentTenant?.tenantId || user?.tenantId;

  const [reports, setReports] = useState([]);
  const [orders, setOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [isDraftOpen, setIsDraftOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Form State
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [findings, setFindings] = useState('');

  // Verification Modal State
  const [verifyReport, setVerifyReport] = useState(null);
  const [verifyReviewStep, setVerifyReviewStep] = useState('review'); // 'review' | 'confirm_approve' | 'confirm_reject'
  const [isDoctorConfirmed, setIsDoctorConfirmed] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verificationFindings, setVerificationFindings] = useState('');
  const [verifyError, setVerifyError] = useState(null);

  // Rejection Modal State
  const [rejectModalReport, setRejectModalReport] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionType, setRejectionType] = useState('recollection');
  const [rejectError, setRejectError] = useState(null);

  // Report Revision & Correction State (Pathologist Rejection -> Technician Revision Workflow)
  const [correctionReport, setCorrectionReport] = useState(null);
  const [correctionItems, setCorrectionItems] = useState([]);
  const [correctionFindings, setCorrectionFindings] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [correctionError, setCorrectionError] = useState(null);
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

  // Print & QR Code State
  const [printReport, setPrintReport] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  // Code 128 Barcode Vector SVG memo for print/PDF export
  const barcodeSvgHtml = useMemo(() => {
    if (!printReport) return '';
    const rawBarcode = printReport.barcode || printReport.orderNumber || '';
    if (!rawBarcode) return '';
    return generateBarcodeSvg(rawBarcode, {
      barHeight: 24,
      moduleWidth: 1.05,
      quietZoneModules: 2,
      showText: true,
    });
  }, [printReport]);

  // Search & Batch Selection State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReportIds, setSelectedReportIds] = useState(new Set());
  const [filterStatus, setFilterStatus] = useState('all');

  // Release Confirmation Modal State
  const [releaseConfirmModal, setReleaseConfirmModal] = useState({
    isOpen: false,
    isBatch: false,
    reportId: null,
    reportNumber: '',
    count: 0,
  });

  // Batch PDF Export Modal State
  const [isBatchExportOpen, setIsBatchExportOpen] = useState(false);
  const [batchExportQueue, setBatchExportQueue] = useState([]);
  const [batchExportedSet, setBatchExportedSet] = useState(new Set());
  const [batchExportCurrentIndex, setBatchExportCurrentIndex] = useState(0);
  const [batchExportSummary, setBatchExportSummary] = useState(null);

  const isPathologist = user?.role === 'pathologist' || user?.role === 'lab_admin' || user?.permissions?.includes('reports:verify') || user?.permissions?.includes('*');
  const canRelease = user?.role === 'pathologist' || user?.role === 'lab_admin' || user?.permissions?.includes('reports:release') || user?.permissions?.includes('*');

  const approvedReports = reports.filter((r) => r.status === 'approved');
  const releasedReports = reports.filter((r) => r.status === 'released');
  const draftReports = reports.filter((r) => r.status === 'draft' || r.status === 'pending_review');
  const rejectedReports = reports.filter((r) => r.status === 'rejected');

  const visibleReports = useMemo(() => {
    // 1. Filter by Status Tab
    const statusFiltered = filterStatus === 'all'
      ? reports
      : filterStatus === 'draft'
      ? reports.filter((r) => r.status === 'draft' || r.status === 'pending_review')
      : reports.filter((r) => r.status === filterStatus);

    // 2. Filter by Search Query
    if (!searchTerm.trim()) return statusFiltered;
    const q = searchTerm.toLowerCase().trim();

    return statusFiltered.filter((r) => {
      const reportNum = (r.reportNumber || '').toLowerCase();
      const orderNum = (r.orderNumber || '').toLowerCase();
      const patName = (r.patientName || '').toLowerCase();
      const patMrn = (r.patientMrn || '').toLowerCase();
      const tName = (r.testName || '').toLowerCase();
      const drafted = (r.draftedBy || '').toLowerCase();
      const verified = (r.verifiedBy || '').toLowerCase();
      const status = (r.status || '').toLowerCase();
      const itemNames = Array.isArray(r.items)
        ? r.items.map((it) => `${it.testName || ''} ${it.name || ''} ${it.testCode || ''}`).join(' ').toLowerCase()
        : '';

      return (
        reportNum.includes(q) ||
        orderNum.includes(q) ||
        patName.includes(q) ||
        patMrn.includes(q) ||
        tName.includes(q) ||
        drafted.includes(q) ||
        verified.includes(q) ||
        status.includes(q) ||
        itemNames.includes(q)
      );
    });
  }, [reports, filterStatus, searchTerm]);

  const visibleReleasedReports = visibleReports.filter((r) => r.status === 'released');

  // Calculate eligible selected report counts for respective bulk operations
  const eligibleDownloadReports = reports.filter(
    (r) => selectedReportIds.has(r.reportId) && r.status === 'released'
  );
  const eligibleDownloadCount = eligibleDownloadReports.length;

  const eligibleReleaseReports = reports.filter(
    (r) => selectedReportIds.has(r.reportId) && r.status === 'approved'
  );
  const eligibleReleaseCount = eligibleReleaseReports.length;

  const selectedReleaseIds = new Set(eligibleReleaseReports.map((r) => r.reportId));
  const selectedDownloadIds = new Set(eligibleDownloadReports.map((r) => r.reportId));

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

  const handleFilterChange = (tabId) => {
    setFilterStatus(tabId);
    setSelectedReportIds(new Set());
  };

  const toggleSelectReport = (reportId) => {
    setSelectedReportIds((prev) => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  };

  // Select All Released toggle for the table header checkbox
  const toggleSelectAllReleasedVisible = () => {
    if (visibleReleasedReports.length === 0) return;
    const allReleasedSelected = visibleReleasedReports.every((r) => selectedReportIds.has(r.reportId));
    setSelectedReportIds((prev) => {
      const next = new Set(prev);
      if (allReleasedSelected) {
        visibleReleasedReports.forEach((r) => next.delete(r.reportId));
      } else {
        visibleReleasedReports.forEach((r) => next.add(r.reportId));
      }
      return next;
    });
  };

  const toggleSelectAllReleased = () => {
    const allReleasedSelected = releasedReports.length > 0 && releasedReports.every((r) => selectedReportIds.has(r.reportId));
    setSelectedReportIds((prev) => {
      const next = new Set(prev);
      if (allReleasedSelected) {
        releasedReports.forEach((r) => next.delete(r.reportId));
      } else {
        releasedReports.forEach((r) => next.add(r.reportId));
      }
      return next;
    });
  };

  const toggleSelectAllApproved = () => {
    const allApprovedSelected = approvedReports.length > 0 && approvedReports.every((r) => selectedReportIds.has(r.reportId));
    setSelectedReportIds((prev) => {
      const next = new Set(prev);
      if (allApprovedSelected) {
        approvedReports.forEach((r) => next.delete(r.reportId));
      } else {
        approvedReports.forEach((r) => next.add(r.reportId));
      }
      return next;
    });
  };

  const handleBatchRelease = () => {
    if (selectedReleaseIds.size === 0) {
      notify.warning('Please select at least one approved report to release.');
      return;
    }
    setReleaseConfirmModal({
      isOpen: true,
      isBatch: true,
      count: selectedReleaseIds.size,
      reportId: null,
      reportNumber: '',
    });
  };

  const handleOpenSingleRelease = (r) => {
    setReleaseConfirmModal({
      isOpen: true,
      isBatch: false,
      count: 1,
      reportId: r.reportId,
      reportNumber: r.reportNumber || 'Report',
    });
  };

  const handleConfirmReleaseAction = async () => {
    if (releaseConfirmModal.isBatch) {
      await executeBatchRelease();
    } else if (releaseConfirmModal.reportId) {
      await executeSingleRelease(releaseConfirmModal.reportId);
    }
  };

  const executeBatchRelease = async () => {
    try {
      setActionLoading(true);
      setError(null);
      const targetIds = Array.from(selectedReleaseIds);
      const res = await clinicalService.batchReleaseReports(tenantId, targetIds);
      if (res.success) {
        const { releasedCount, failedCount } = res.data;
        notify.success('Report released successfully.');
        setSuccessMsg(
          `Batch Release Completed: ${releasedCount} report(s) released successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}`
        );
        setSelectedReportIds(new Set());
        setReleaseConfirmModal((prev) => ({ ...prev, isOpen: false }));
        fetchReports();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      notify.error(err, { fallback: 'Failed to batch release reports' });
      setError(err.response?.data?.message || 'Failed to batch release reports');
    } finally {
      setActionLoading(false);
    }
  };

  const executeSingleRelease = async (reportId) => {
    try {
      setActionLoading(true);
      const res = await clinicalService.releaseReport(tenantId, reportId);
      if (res.success) {
        notify.success('Report released successfully.');
        setSuccessMsg(`Report ${res.data.reportNumber} finalized and released to patient portal`);
        setReleaseConfirmModal((prev) => ({ ...prev, isOpen: false }));
        fetchReports();
        if (selectedReport && selectedReport.reportId === reportId) {
          setSelectedReport(res.data);
        }
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      notify.error(err, { fallback: 'Failed to release report' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartBatchDownload = async () => {
    if (selectedReportIds.size === 0) return;

    // 1. Re-validate eligibility against current reports state
    const selected = reports.filter((r) => selectedReportIds.has(r.reportId));
    const eligible = selected.filter((r) => r.status === 'released');
    const ineligible = selected.filter((r) => r.status !== 'released');

    if (eligible.length === 0) {
      const reasons = ineligible
        .map((r) => `${r.reportNumber || r.reportId} (${r.status})`)
        .join(', ');
      setError(
        `Cannot download PDFs: No eligible released reports selected. ${
          reasons ? `Selected report(s) are not in released status: ${reasons}. ` : ''
        }Official PDF download is strictly permitted only for released reports.`
      );
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      // Submit ONLY eligible released report IDs to the backend
      const eligibleIds = eligible.map((r) => r.reportId);
      const res = await clinicalService.batchDownloadReports(tenantId, eligibleIds);
      if (res.success) {
        const { totalRequested, downloadedCount, failedCount, results } = res.data;
        if (downloadedCount === 0) {
          const failedItems = Array.isArray(results) ? results.filter((r) => !r.success) : [];
          const failureDetails = failedItems
            .map((r) => `${r.reportNumber || r.reportId}: ${r.error || 'Failed eligibility verification'}`)
            .join('; ');
          setError(
            failureDetails ||
              `No eligible released reports could be prepared for export (${failedCount} failed eligibility checks).`
          );
          return;
        }

        const eligibleMap = new Map(results.filter((r) => r.success).map((r) => [r.reportId, r]));
        const queue = reports.filter((r) => eligibleMap.has(r.reportId));

        setBatchExportQueue(queue);
        setBatchExportedSet(new Set());
        setBatchExportCurrentIndex(0);
        setBatchExportSummary({
          total: queue.length,
          failedCount,
          results,
        });
        setIsBatchExportOpen(true);

        if (ineligible.length > 0) {
          setSuccessMsg(
            `Prepared ${queue.length} released report(s) for PDF export. (${ineligible.length} unreleased report(s) were excluded from download).`
          );
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to authorize batch PDF export');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExportItem = async (reportItem) => {
    if (!reportItem) return;
    await handleDownloadPdf(reportItem);
    setBatchExportedSet((prev) => new Set([...prev, reportItem.reportId]));
  };

  const handleExportCurrentAndAdvance = async () => {
    const current = batchExportQueue[batchExportCurrentIndex];
    if (!current) return;
    await handleExportItem(current);
    if (batchExportCurrentIndex < batchExportQueue.length - 1) {
      setBatchExportCurrentIndex((prev) => prev + 1);
    }
  };

  const fetchReports = useCallback(async () => {
    if (!tenantId) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await clinicalService.getReports(tenantId);
      if (res.success && Array.isArray(res.data)) {
        setReports(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve diagnostic reports');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  const fetchOrdersForDraft = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await clinicalService.getOrders(tenantId);
      if (res.success && Array.isArray(res.data)) {
        setOrders(res.data);
      }
    } catch {
      // non-fatal
    }
  }, [tenantId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleCreateDraft = async (e) => {
    e.preventDefault();
    if (!selectedOrderId) {
      notify.error('Please select an order');
      return;
    }
    const order = orders.find((o) => o.orderId === selectedOrderId || o.orderNumber === selectedOrderId);
    try {
      setActionLoading(true);
      setError(null);
      const res = await clinicalService.createReport(tenantId, {
        orderId: selectedOrderId,
        orderNumber: order?.orderNumber,
        patientName: order?.patientName,
        patientMrn: order?.patientMrn,
        testName: order?.items?.[0]?.testName || 'Comprehensive Laboratory Panel',
        findings: findings.trim() || 'Awaiting analytical results and pathologist clinical impression.',
      });
      if (res.success) {
        notify.success('Changes saved successfully.');
        setSuccessMsg(`Draft report ${res.data.reportNumber} generated successfully`);
        setIsDraftOpen(false);
        setSelectedOrderId('');
        setFindings('');
        fetchReports();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      notify.error(err, { fallback: 'Failed to draft report' });
    } finally {
      setActionLoading(false);
    }
  };

  const openVerifyModal = (r) => {
    setVerifyReport(r);
    setVerifyReviewStep('review');
    setVerificationFindings(r.findings || '');
    setVerificationNotes(r.verificationNotes || 'Diagnostic findings correlate clinically. Verified under laboratory quality protocol.');
    setRejectionReason('');
    setRejectionType('recollection');
    setIsDoctorConfirmed(false);
    setVerifyError(null);
  };

  const handleConfirmVerification = async (e) => {
    if (e) e.preventDefault();
    if (!verifyReport) return;
    const comp = checkReportCompleteness(verifyReport);
    if (!comp.isComplete) {
      setVerifyError(`Cannot verify report: missing diagnostic results for ${comp.missingItems.join(', ')}.`);
      return;
    }
    if (!isDoctorConfirmed) {
      setVerifyError('Please confirm the pathologist digital authorization statement before signing.');
      return;
    }

    try {
      setActionLoading(true);
      setVerifyError(null);
      const res = await clinicalService.approveReport(tenantId, verifyReport.reportId, {
        findings: verificationFindings.trim(),
        verificationNotes: verificationNotes.trim(),
        notes: verificationNotes.trim(),
        verifiedBy: user?.fullName || user?.email || 'Consultant Pathologist',
      });
      if (res.success) {
        setSuccessMsg(`Report ${res.data.reportNumber} reviewed and verified by Pathologist`);
        setVerifyReport(null);
        await fetchReports();
        if (selectedReport && selectedReport.reportId === verifyReport.reportId) {
          setSelectedReport(res.data);
        }
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to verify report';
      setVerifyError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectModal = (r) => {
    setRejectModalReport(r);
    setRejectionReason('');
    setRejectionType('recollection');
    setRejectError(null);
  };

  const handleConfirmReject = async (e) => {
    if (e) e.preventDefault();
    const target = verifyReport || rejectModalReport;
    if (!target) return;
    const trimmed = rejectionReason.trim();
    if (!trimmed || trimmed.length < 5) {
      const msg = 'Please provide a clinical justification for rejecting this report (minimum 5 characters)';
      setRejectError(msg);
      setVerifyError(msg);
      return;
    }

    try {
      setActionLoading(true);
      setRejectError(null);
      setVerifyError(null);
      const isRecollection = rejectionType === 'recollection';
      const res = await clinicalService.rejectReport(tenantId, target.reportId, {
        reason: trimmed,
        rejectionType,
        requiresRecollection: isRecollection,
      });
      if (res.success) {
        const msg = isRecollection
          ? `Report ${res.data?.reportNumber || target.reportNumber} rejected. Actionable Recollection Task generated in Phlebotomy queue.`
          : `Report ${res.data?.reportNumber || target.reportNumber} rejected and returned for technician bench revision`;
        setSuccessMsg(msg);
        setRejectModalReport(null);
        setVerifyReport(null);
        await fetchReports();
        if (selectedReport && selectedReport.reportId === target.reportId) {
          setSelectedReport(res.data);
        }
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch (err) {
      setRejectError(err.response?.data?.message || err.message || 'Failed to reject report');
    } finally {
      setActionLoading(false);
    }
  };

  const openCorrectionModal = (report) => {
    if (!report) return;
    setCorrectionReport(report);
    const clonedItems = Array.isArray(report.items)
      ? JSON.parse(JSON.stringify(report.items))
      : [];
    setCorrectionItems(clonedItems);
    setCorrectionFindings(report.findings || '');
    setCorrectionNotes(report.notes || '');
    setCorrectionError(null);
  };

  const handleCorrectionValueChange = (itemIdx, paramIdx, field, val) => {
    setCorrectionItems((prev) => {
      const next = [...prev];
      const targetItem = { ...next[itemIdx] };
      if (paramIdx !== null && paramIdx !== undefined && Array.isArray(targetItem.parameterResults)) {
        const nextParams = [...targetItem.parameterResults];
        nextParams[paramIdx] = {
          ...nextParams[paramIdx],
          [field]: val,
        };
        targetItem.parameterResults = nextParams;
      } else {
        targetItem[field] = val;
      }
      next[itemIdx] = targetItem;
      return next;
    });
  };

  const handleConfirmCorrection = async (e) => {
    if (e) e.preventDefault();
    if (!correctionReport || !tenantId) return;

    try {
      setIsSubmittingCorrection(true);
      setCorrectionError(null);

      const payload = {
        items: correctionItems,
        findings: correctionFindings,
        notes: correctionNotes,
      };

      const res = await clinicalService.updateReport(tenantId, correctionReport.reportId, payload);
      if (res.success) {
        notify.success(`Report ${correctionReport.reportNumber} updated and re-submitted to Pathologist for review!`);
        setCorrectionReport(null);
        await fetchReports();
      } else {
        setCorrectionError(res.message || 'Failed to resubmit report');
      }
    } catch (err) {
      setCorrectionError(err.response?.data?.message || err.message || 'Failed to update and resubmit report');
    } finally {
      setIsSubmittingCorrection(false);
    }
  };

  const handleApprove = async (reportId) => {
    try {
      setActionLoading(true);
      const res = await clinicalService.approveReport(tenantId, reportId);
      if (res.success) {
        setSuccessMsg(`Report ${res.data.reportNumber} verified and approved`);
        fetchReports();
        if (selectedReport && selectedReport.reportId === reportId) {
          setSelectedReport(res.data);
        }
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve report');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRelease = async (reportId) => {
    try {
      setActionLoading(true);
      const res = await clinicalService.releaseReport(tenantId, reportId);
      if (res.success) {
        notify.success('Report released successfully.');
        setSuccessMsg(`Report ${res.data.reportNumber} finalized and released to patient portal`);
        fetchReports();
        if (selectedReport && selectedReport.reportId === reportId) {
          setSelectedReport(res.data);
        }
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      notify.error(err, { fallback: 'Failed to release report' });
    } finally {
      setActionLoading(false);
    }
  };

  const openPrintModal = async (r) => {
    if (!r) return null;
    if (r.status !== 'released') {
      notify.warning(`Report ${r.reportNumber} is currently in '${r.status}' state. Official print layouts with public authenticity QR verification are only generated for officially Released reports.`);
      return null;
    }
    let enriched = r;
    try {
      const res = await clinicalService.downloadReport(tenantId, r.reportId);
      if (res?.data) {
        enriched = res.data;
      }
    } catch {
      // non-fatal
    }
    setPrintReport(enriched);
    const initialToken = enriched.verificationToken || r.verificationToken;
    if (initialToken) {
      const verifyUrl = `${window.location.origin}/verify/${initialToken}`;
      QRCode.toDataURL(verifyUrl, { width: 140, margin: 1, errorCorrectionLevel: 'M' })
        .then((url) => setQrCodeDataUrl(url))
        .catch(() => setQrCodeDataUrl(''));
    } else {
      setQrCodeDataUrl('');
    }
    return enriched;
  };

  const executeReportPrint = async (reportData) => {
    if (!reportData) return;

    // 1. Generate Code 128 vector barcode
    const rawBarcode = reportData.barcode || reportData.orderNumber || reportData.reportNumber || '';
    const barcodeSvg = rawBarcode
      ? generateBarcodeSvg(rawBarcode, {
          barHeight: 28,
          moduleWidth: 1.15,
          quietZoneModules: 2,
          showText: true,
        })
      : '';

    // 2. Generate QR Code if token present
    let qrData = qrCodeDataUrl;
    const token = reportData.verificationToken;
    if (!qrData && token) {
      try {
        const verifyUrl = `${window.location.origin}/verify/${token}`;
        qrData = await QRCode.toDataURL(verifyUrl, { width: 110, margin: 1, errorCorrectionLevel: 'M' });
      } catch {
        qrData = '';
      }
    }

    const safeTitle = `Diagnostic_Report_${String(reportData.reportNumber || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const labName = (reportData.labName && reportData.labName !== 'Diagnostic Laboratory')
      ? reportData.labName
      : (branding?.displayName || currentTenant?.name || reportData.labName || 'Chonexa Lab');
    const logoUrl = branding?.logoUrl || currentTenant?.branding?.logoUrl || reportData.branding?.logoUrl || '';
    const tagline = reportData.tagline || branding?.tagline || '';
    const doctorName = formatPathologistName(reportData.releasedBy || reportData.reviewedBy);
    const referDoctor = (reportData.physicianName && reportData.physicianName !== '—')
      ? reportData.physicianName
      : (reportData.referralDoctor || reportData.referredBy || reportData.orderingPhysician || 'Self / Direct');
    const patientAgeGender = [reportData.patientAge ? `${reportData.patientAge} Y` : '', reportData.patientGender].filter(Boolean).join(' / ') || '—';

    // Group items by department
    const depts = (reportData.items || []).reduce((acc, it) => {
      const d = (it.department || reportData.department || 'Clinical Pathology').toUpperCase();
      if (!acc[d]) acc[d] = [];
      acc[d].push(it);
      return acc;
    }, {});

    let testTablesHtml = '';
    for (const [deptName, deptItems] of Object.entries(depts)) {
      testTablesHtml += `
        <div style="margin-bottom: 12px; page-break-inside: avoid;">
          <div style="text-align: center; font-weight: 800; font-size: 8.5pt; color: #0f172a; background: #f8fafc; border-top: 1px solid #0f172a; border-bottom: 1px solid #0f172a; padding: 4px 6px; margin: 8px 0 4px 0; letter-spacing: 0.8px; text-transform: uppercase;">
            Department of ${deptName}
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 8pt; table-layout: fixed;">
            <thead>
              <tr style="border-bottom: 1.2px solid #0f172a; text-align: left;">
                <th style="padding: 4px 6px; width: 40%; font-weight: 700; color: #0f172a;">Test / Investigation Name</th>
                <th style="padding: 4px 6px; width: 20%; font-weight: 700; text-align: center; color: #0f172a;">Result</th>
                <th style="padding: 4px 6px; width: 15%; font-weight: 700; color: #0f172a;">Unit</th>
                <th style="padding: 4px 6px; width: 25%; font-weight: 700; color: #0f172a;">Biological Ref. Interval</th>
              </tr>
            </thead>
            <tbody>
      `;

      for (const it of deptItems) {
        testTablesHtml += `
          <tr>
            <td colspan="4" style="padding: 6px 6px 2px 6px; font-weight: 800; color: #0f172a; text-decoration: underline; font-size: 8.2pt;">
              ${it.testName} ${it.testCode ? `(${it.testCode})` : ''}
            </td>
          </tr>
        `;

        const params = Array.isArray(it.parameterResults) && it.parameterResults.length > 0 ? it.parameterResults : [];
        if (params.length > 0) {
          for (const pr of params) {
            const isBlank = pr.value === undefined || pr.value === null || String(pr.value).trim() === '';
            const paramName = pr.name || pr.parameterName || pr.parameterCode;
            const intervalText = resolveParamInterval(pr);
            const methodHtml = pr.method ? `<div style="font-size: 6.8pt; color: #64748b; font-style: italic;">Method: ${pr.method}</div>` : '';

            // User requirement: Do NOT show HIGH/LOW on print
            testTablesHtml += `
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 3.5px 6px 3.5px 14px; color: #0f172a; font-weight: 600; word-break: break-word;">
                  ${paramName}
                  ${methodHtml}
                </td>
                <td style="padding: 3.5px 6px; text-align: center; font-weight: 700; color: #0f172a; font-size: 8.2pt;">
                  ${isBlank ? '<span style="color: #64748b; font-style: italic; font-weight: normal;">Pending</span>' : String(pr.value)}
                </td>
                <td style="padding: 3.5px 6px; color: #334155;">${pr.unit || '—'}</td>
                <td style="padding: 3.5px 6px; color: #0f172a;">${intervalText}</td>
              </tr>
            `;
          }
        } else {
          const methodHtml = it.method ? `<div style="font-size: 6.8pt; color: #64748b; font-style: italic;">Method: ${it.method}</div>` : '';
          testTablesHtml += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
              <td style="padding: 3.5px 6px 3.5px 14px; color: #0f172a; font-weight: 600; word-break: break-word;">
                ${it.testName}
                ${methodHtml}
              </td>
              <td style="padding: 3.5px 6px; text-align: center; font-weight: 700; color: #0f172a; font-size: 8.2pt;">
                ${it.resultValue || 'Completed'}
              </td>
              <td style="padding: 3.5px 6px; color: #334155;">${it.unit || '—'}</td>
              <td style="padding: 3.5px 6px; color: #0f172a;">${resolveParamInterval(it)}</td>
            </tr>
          `;
        }

        if (it.comments || it.clinicalNotes) {
          testTablesHtml += `
            <tr>
              <td colspan="4" style="padding: 2px 6px 4px 14px; font-size: 7.2pt; color: #475569;">
                <strong>Clinical Comment:</strong> ${it.comments || it.clinicalNotes}
              </td>
            </tr>
          `;
        }
      }

      testTablesHtml += `
            </tbody>
          </table>
        </div>
      `;
    }

    const printDocHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${safeTitle}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 12mm 10mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 8.5pt;
      line-height: 1.35;
    }
  </style>
</head>
<body>
  <div style="width: 100%; background: #ffffff;">
    <!-- 1. Header: Left = Original Lab Name & Logo, Center = DIAGNOSTIC PATHOLOGY REPORT (1 line), Right = Barcode + Ref (No Date) -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
      <tr>
        <td style="width: 30%; vertical-align: middle; text-align: left;">
          <div style="display: flex; align-items: center; gap: 10px;">
            ${logoUrl ? `<img src="${logoUrl}" style="max-height: 44px; max-width: 120px; object-fit: contain;" alt="" />` : ''}
            <div>
              <div style="font-size: 1.25rem; font-weight: 800; color: #0f172a; letter-spacing: -0.3px; line-height: 1.2; text-transform: uppercase;">
                ${labName}
              </div>
              ${tagline ? `<div style="font-size: 0.7rem; font-style: italic; color: #64748b; margin-top: 1px;">${tagline}</div>` : ''}
            </div>
          </div>
        </td>
        <td style="width: 44%; vertical-align: middle; text-align: center;">
          <div style="font-size: 0.95rem; font-weight: 800; color: #0f172a; letter-spacing: 0.5px; text-transform: uppercase; white-space: nowrap; line-height: 1.2;">
            DIAGNOSTIC PATHOLOGY REPORT
          </div>
        </td>
        <td style="width: 26%; vertical-align: middle; text-align: right;">
          <div style="display: inline-block; text-align: right;">
            ${barcodeSvg ? `<div style="width: 165px; margin-left: auto;">${barcodeSvg}</div>` : `<div style="font-family: monospace; font-weight: 700; font-size: 8.5pt;">${rawBarcode}</div>`}
            <div style="font-size: 0.75rem; font-weight: 700; color: #334155; font-family: monospace; margin-top: 2px;">
              Ref: ${reportData.reportNumber}
            </div>
          </div>
        </td>
      </tr>
    </table>

    <div style="border-bottom: 1.5px solid #0f172a; margin: 4px 0 8px 0;"></div>

    <!-- 2. Banner: Patient Details, Doctor, Refer By Doctor -->
    <div style="border: 1.2px solid #334155; border-radius: 4px; padding: 6px 10px; margin-bottom: 10px; background: #ffffff;">
      <table style="width: 100%; border-collapse: collapse; font-size: 7.7pt;">
        <tr>
          <td style="width: 110px; color: #475569; font-weight: 700; padding: 2.5px 4px;">Patient Name</td>
          <td style="color: #0f172a; font-weight: 800; font-size: 8.2pt; padding: 2.5px 4px;">: ${reportData.patientName || '—'}</td>
          <td style="width: 110px; color: #475569; font-weight: 700; padding: 2.5px 4px;">Order / Lab No</td>
          <td style="color: #0f172a; font-weight: 600; padding: 2.5px 4px;">: ${reportData.orderNumber || reportData.barcode || '—'}</td>
        </tr>
        <tr>
          <td style="width: 110px; color: #475569; font-weight: 700; padding: 2.5px 4px;">Patient MRN</td>
          <td style="color: #0f172a; font-weight: 700; font-family: monospace; padding: 2.5px 4px;">: ${reportData.patientMrn || '—'}</td>
          <td style="width: 110px; color: #475569; font-weight: 700; padding: 2.5px 4px;">Sample / Specimen</td>
          <td style="color: #0f172a; font-weight: 600; padding: 2.5px 4px;">: ${reportData.specimenType || 'Specimen'}</td>
        </tr>
        <tr>
          <td style="width: 110px; color: #475569; font-weight: 700; padding: 2.5px 4px;">Age / Gender</td>
          <td style="color: #0f172a; font-weight: 600; padding: 2.5px 4px;">: ${patientAgeGender}</td>
          <td style="width: 110px; color: #475569; font-weight: 700; padding: 2.5px 4px;">Collected On</td>
          <td style="color: #0f172a; font-weight: 600; padding: 2.5px 4px;">: ${formatReportDateTime(reportData.collectedAt) || '—'}</td>
        </tr>
        <tr>
          <td style="width: 110px; color: #475569; font-weight: 700; padding: 2.5px 4px;">Doctor / Consult</td>
          <td style="color: #0f172a; font-weight: 600; padding: 2.5px 4px;">: ${doctorName}</td>
          <td style="width: 110px; color: #475569; font-weight: 700; padding: 2.5px 4px;">Received On</td>
          <td style="color: #0f172a; font-weight: 600; padding: 2.5px 4px;">: ${formatReportDateTime(reportData.receivedAt) || '—'}</td>
        </tr>
        <tr>
          <td style="width: 110px; color: #475569; font-weight: 700; padding: 2.5px 4px;">Refer By Doctor</td>
          <td style="color: #0f172a; font-weight: 700; padding: 2.5px 4px;">: <strong>${referDoctor}</strong>${reportData.referralHospital && reportData.referralHospital !== '—' ? ` (${reportData.referralHospital})` : ''}</td>
          <td style="width: 110px; color: #475569; font-weight: 700; padding: 2.5px 4px;">Reported On</td>
          <td style="color: #0f172a; font-weight: 700; padding: 2.5px 4px;">: ${formatReportDateTime(reportData.releasedAt || reportData.verifiedAt || new Date())}</td>
        </tr>
      </table>
    </div>

    <!-- 3. Test Results Table (Grouped by Department, NO HIGH/LOW LABELS) -->
    ${testTablesHtml}

    <!-- 4. Footer: Consultant Pathologist Digital Sign-off with dedicated signature space -->
    <div style="border-top: 1.2px solid #0f172a; padding-top: 8px; margin-top: 16px; display: flex; justify-content: space-between; align-items: flex-end; page-break-inside: avoid;">
      <div style="font-size: 6.8pt; color: #94a3b8; font-style: italic; max-width: 340px;">
        * Computer generated diagnostic medical report. Valid without physical signature if digitally verified.
      </div>
      <div style="text-align: right; min-width: 210px;">
        <!-- Dedicated physical signing / stamp space -->
        <div style="height: 48px;"></div>
        <div style="border-bottom: 1.2px solid #334155; width: 200px; margin-bottom: 4px; margin-left: auto;"></div>
        <div style="font-size: 9.5pt; font-weight: 800; color: #0f172a;">${doctorName}</div>
        <div style="font-size: 7.2pt; color: #475569; font-weight: 600;">Consultant Pathologist & Laboratory Director</div>
        <div style="font-size: 6.8pt; color: #64748b; margin-top: 2px;">Digitally Verified: ${formatReportDateTime(reportData.releasedAt || reportData.verifiedAt || new Date())}</div>
      </div>
    </div>

    <div style="text-align: center; font-size: 6.8pt; color: #94a3b8; margin-top: 8px; letter-spacing: 1.5px; font-weight: 700;">
      *** END OF DIAGNOSTIC REPORT ***
    </div>
  </div>
</body>
</html>`;

    let printIframe = document.getElementById('report-print-iframe');
    if (printIframe) {
      try { document.body.removeChild(printIframe); } catch {}
    }
    printIframe = document.createElement('iframe');
    printIframe.id = 'report-print-iframe';
    printIframe.style.position = 'fixed';
    printIframe.style.right = '0';
    printIframe.style.bottom = '0';
    printIframe.style.width = '0';
    printIframe.style.height = '0';
    printIframe.style.border = '0';
    printIframe.style.visibility = 'hidden';
    document.body.appendChild(printIframe);

    const frameDoc = printIframe.contentWindow.document;
    frameDoc.open();
    frameDoc.write(printDocHtml);
    frameDoc.close();

    setTimeout(() => {
      try {
        printIframe.contentWindow.focus();
        printIframe.contentWindow.print();
      } catch (e) {
        console.error('Print iframe error:', e);
        window.print();
      }
    }, 350);
  };

  const handleDownloadPdf = async (r) => {
    if (!r) return;
    if (r.status !== 'released') {
      notify.warning(`Report ${r.reportNumber} is currently in '${r.status}' state. Official PDF download is strictly permitted only for finalized and Released reports.`);
      return;
    }

    let reportToPrint = r;
    try {
      const res = await clinicalService.downloadReport(tenantId, r.reportId);
      if (res?.data) {
        reportToPrint = res.data;
      }
    } catch (err) {
      notify.error(err, { fallback: 'Unauthorized to download this report' });
      return;
    }

    // Open print preview modal
    await openPrintModal(reportToPrint);

    // Trigger iframe printing engine
    await executeReportPrint(reportToPrint);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'released': return <Badge variant="success" icon={CheckCircle2}>Released</Badge>;
      case 'approved': return <Badge variant="teal">Verified / Approved</Badge>;
      case 'rejected': return <Badge variant="danger" icon={AlertTriangle}>Rejected</Badge>;
      default: return <Badge variant="warning">Draft Pending Review</Badge>;
    }
  };

  return (
    <>
      <PageHeader
        title="Diagnostic Pathology Reports"
        description="Pathologist clinical result verification, diagnostic findings sign-off, and official report release."
        actions={
          (releasedReports.length > 0 || (canRelease && approvedReports.length > 0)) ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {releasedReports.length > 0 && (
                <button
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  disabled={selectedDownloadIds.size === 0 || actionLoading}
                  onClick={handleStartBatchDownload}
                  title="Batch export selected released reports as PDFs"
                >
                  <Download size={16} />
                  <span>Download Selected PDFs ({selectedDownloadIds.size})</span>
                </button>
              )}
              {canRelease && approvedReports.length > 0 && (
                <button
                  className="btn btn-primary"
                  style={{ background: 'var(--teal-600)', borderColor: 'var(--teal-600)', display: 'flex', alignItems: 'center', gap: '6px' }}
                  disabled={selectedReleaseIds.size === 0 || actionLoading}
                  onClick={handleBatchRelease}
                  title="Batch release selected approved reports"
                >
                  <CheckCircle2 size={16} />
                  <span>Release Selected ({selectedReleaseIds.size})</span>
                </button>
              )}
            </div>
          ) : null
        }
      />

      {/* Real-time Search Bar Directly Below Header */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          marginBottom: '1.25rem',
          borderRadius: '12px',
          border: '1px solid var(--slate-200)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          background: '#ffffff',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px', position: 'relative' }}>
          <Search size={18} style={{ color: '#94a3b8', position: 'absolute', left: '14px', pointerEvents: 'none' }} />
          <input
            type="text"
            id="report-search-input"
            placeholder="Search reports by Report #, Order #, Patient Name, MRN, Diagnostic Panel, or Doctor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
            style={{
              paddingLeft: '40px',
              paddingRight: searchTerm ? '38px' : '14px',
              borderRadius: '8px',
              fontSize: '0.875rem',
              width: '100%',
              borderColor: searchTerm ? 'var(--primary-blue, #2563eb)' : '#cbd5e1',
            }}
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
              }}
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {searchTerm && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: 'var(--slate-600)' }}>
            <span>
              Found <strong>{visibleReports.length}</strong> {visibleReports.length === 1 ? 'matching report' : 'matching reports'}
            </span>
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="btn btn-sm btn-secondary"
              style={{ fontSize: '0.75rem', padding: '3px 8px' }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {successMsg && (
        <div style={{ marginBottom: '1rem' }}>
          <StatusBanner type="success" badgeText="Success" message={successMsg} />
        </div>
      )}

      {error && (
        <div style={{ marginBottom: '1rem' }}>
          <StatusBanner type="danger" badgeText="Error" message={error} />
        </div>
      )}

      {/* Reports Table Card */}
      <div className="card">
        {/* Status Filter & Selection Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', padding: '12px 16px', borderBottom: '1px solid var(--slate-200)', background: 'var(--slate-50)' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--slate-600)' }}>Filter:</span>
            {[
              { id: 'all', label: `All Reports (${reports.length})` },
              { id: 'released', label: `Released (${releasedReports.length})` },
              { id: 'approved', label: `Approved (${approvedReports.length})` },
              { id: 'draft', label: `Pending Review (${draftReports.length})` },
              { id: 'rejected', label: `Rejected (${rejectedReports.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`btn btn-sm ${filterStatus === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: '14px' }}
                onClick={() => handleFilterChange(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {selectedReportIds.size > 0 && eligibleDownloadCount === 0 && (
              <span
                style={{
                  fontSize: '0.75rem',
                  color: '#b45309',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  background: '#fffbeb',
                  border: '1px solid #fef3c7',
                  borderRadius: '6px',
                }}
              >
                <AlertCircle size={13} />
                <span>Select released reports to download PDFs</span>
              </span>
            )}
            {releasedReports.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                onClick={toggleSelectAllReleased}
              >
                {releasedReports.length > 0 && releasedReports.every((r) => selectedReportIds.has(r.reportId)) ? 'Clear Released' : `Select All Released (${releasedReports.length})`}
              </button>
            )}
            {canRelease && approvedReports.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                onClick={toggleSelectAllApproved}
              >
                {approvedReports.length > 0 && approvedReports.every((r) => selectedReportIds.has(r.reportId)) ? 'Clear Approved' : `Select All Approved (${approvedReports.length})`}
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary-blue)' }} />
            <p>Loading pathology reports...</p>
          </div>
        ) : reports.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <FileText size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--slate-700)' }}>No diagnostic reports generated</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              No diagnostic reports in the system.
            </p>
          </div>
        ) : visibleReports.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <FileText size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--slate-700)' }}>No matching reports found</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {searchTerm ? `No reports match "${searchTerm}".` : 'No reports found for the selected filter tab.'}
            </p>
            {searchTerm && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '0.75rem' }}
                onClick={() => setSearchTerm('')}
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="table-container">
            <table className="lms-table">
              <thead>
                <tr>
                  <th style={{ width: '48px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={visibleReleasedReports.length > 0 && visibleReleasedReports.every((r) => selectedReportIds.has(r.reportId))}
                      onChange={toggleSelectAllReleasedVisible}
                      disabled={visibleReleasedReports.length === 0}
                      title={
                        visibleReleasedReports.length === 0
                          ? 'No released reports in current view'
                          : visibleReleasedReports.every((r) => selectedReportIds.has(r.reportId))
                          ? 'Clear selection of released reports'
                          : `Select All Released (${visibleReleasedReports.length} eligible)`
                      }
                    />
                  </th>
                  <th>Report #</th>
                  <th>Order #</th>
                  <th>Patient / MRN</th>
                  <th>Diagnostic Panel</th>
                  <th>Verification Status</th>
                  <th>Drafted By</th>
                  <th>Timestamp</th>
                  <th style={{ textAlign: 'right' }}>Workflow Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleReports.map((r) => (
                  <tr key={r.reportId || r._id}>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <input
                          type="checkbox"
                          checked={selectedReportIds.has(r.reportId)}
                          onChange={() => toggleSelectReport(r.reportId)}
                          disabled={r.status !== 'released' && !(canRelease && r.status === 'approved')}
                          title={
                            r.status === 'released'
                              ? `Select ${r.reportNumber} for PDF download`
                              : r.status === 'approved' && canRelease
                              ? `Select ${r.reportNumber} for batch release (Ineligible for PDF download until released)`
                              : `Cannot select ${r.reportNumber}: Report status is '${r.status}'. Only released reports can be downloaded as PDF.`
                          }
                        />
                        {r.status !== 'released' && (
                          <span
                            title={
                              r.status === 'approved'
                                ? 'Verified & Approved: Eligible for Release, ineligible for PDF download until released'
                                : `Ineligible for PDF download: Report status is '${r.status}'. Official download requires 'released'.`
                            }
                            style={{
                              fontSize: '0.625rem',
                              fontWeight: 600,
                              color: r.status === 'approved' ? 'var(--teal-700, #0f766e)' : 'var(--slate-500)',
                              background: r.status === 'approved' ? 'var(--teal-50, #f0fdf4)' : 'var(--slate-100)',
                              border: `1px solid ${r.status === 'approved' ? 'var(--teal-200, #99f6e4)' : 'var(--slate-200)'}`,
                              borderRadius: '3px',
                              padding: '1px 3px',
                              lineHeight: 1,
                              whiteSpace: 'nowrap',
                              cursor: 'help',
                            }}
                          >
                            {r.status === 'approved' ? 'Release only' : 'Ineligible'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-blue)' }}>
                        {r.reportNumber}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace' }}>{r.orderNumber || 'ORD-GEN'}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.patientName}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>
                        {r.patientMrn}
                      </div>
                    </td>
                    <td>{r.testName}</td>
                    <td>{getStatusBadge(r.status)}</td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--slate-600)' }}>{r.draftedBy}</td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'Today'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {(r.status === 'draft' || r.status === 'pending_review') && isPathologist && (
                          <>
                            {(() => {
                              const comp = checkReportCompleteness(r);
                              return (
                                <button
                                  className={comp.isComplete ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                                  onClick={() => openVerifyModal(r)}
                                  disabled={actionLoading}
                                  title={comp.isComplete ? 'Pathologist clinical review and verification' : `Review incomplete report (Missing: ${comp.missingItems.join(', ')})`}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                                >
                                  {comp.isComplete ? <ShieldCheck size={14} /> : <AlertTriangle size={14} style={{ color: '#c2410c' }} />}
                                  <span>{comp.isComplete ? 'Review & Sign-Off' : `Review & Sign-Off (${comp.completedCount}/${comp.totalItems})`}</span>
                                </button>
                              );
                            })()}
                            <button
                              className="btn btn-danger btn-sm"
                              style={{ background: 'var(--danger-600, #dc2626)', color: 'white', border: 'none' }}
                              onClick={() => openRejectModal(r)}
                              disabled={actionLoading}
                              title="Pathologist clinical rejection with justification"
                            >
                              <AlertTriangle size={14} />
                              <span>Reject</span>
                            </button>
                          </>
                        )}
                        {r.status === 'approved' && canRelease && (
                          <button
                            className="btn btn-success btn-sm"
                            style={{ background: 'var(--teal-600)', color: 'white', border: 'none' }}
                            onClick={() => handleOpenSingleRelease(r)}
                            disabled={actionLoading}
                            title="Publish and release official report"
                          >
                            Release
                          </button>
                        )}
                        {r.status === 'released' && (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => openPrintModal(r)}
                              title="Print official report with QR verification"
                            >
                              <Printer size={14} />
                              <span>Print</span>
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleDownloadPdf(r)}
                              title="Download official report as PDF"
                            >
                              <Download size={14} />
                              <span>PDF</span>
                            </button>
                          </>
                        )}
                        {r.status === 'rejected' && (
                          <button
                            className="btn btn-warning btn-sm"
                            style={{ background: 'var(--amber-500, #f59e0b)', color: '#0f172a', fontWeight: 600, border: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                            onClick={() => openCorrectionModal(r)}
                            disabled={actionLoading}
                            title="Pathologist returned report for correction. Click to revise findings and resubmit."
                          >
                            <RotateCcw size={14} />
                            <span>Revise & Resubmit</span>
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedReport(r)}
                        >
                          <Eye size={14} />
                          <span>View</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Report Preview Modal */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={selectedReport ? `Diagnostic Report: ${selectedReport.reportNumber}` : ''}
        size="xl"
        maxWidth="960px"
        dialogStyle={{
          maxWidth: '960px',
          width: '95vw',
        }}
        bodyStyle={{
          padding: '24px',
          maxHeight: 'calc(88vh - 120px)',
          overflowY: 'auto',
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div>
              {(selectedReport?.status === 'draft' || selectedReport?.status === 'pending_review') && isPathologist && (
                <div style={{ display: 'inline-flex', gap: '8px' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => openVerifyModal(selectedReport)}
                    disabled={actionLoading}
                    title="Open pathologist review & verification modal"
                  >
                    <ShieldCheck size={14} />
                    <span>Review & Verify Results</span>
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ background: 'var(--danger-600, #dc2626)', color: 'white', border: 'none' }}
                    onClick={() => openRejectModal(selectedReport)}
                    disabled={actionLoading}
                    title="Reject report with clinical justification"
                  >
                    <AlertTriangle size={14} />
                    <span>Reject</span>
                  </button>
                </div>
              )}
              {selectedReport?.status === 'rejected' && (
                <button
                  className="btn btn-warning btn-sm"
                  style={{ background: 'var(--amber-500, #f59e0b)', color: '#0f172a', fontWeight: 600, border: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  onClick={() => {
                    const rep = selectedReport;
                    setSelectedReport(null);
                    openCorrectionModal(rep);
                  }}
                  title="Open revision editor to correct and resubmit report to Pathologist"
                >
                  <RotateCcw size={14} />
                  <span>Revise & Resubmit to Pathologist</span>
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedReport?.status === 'released' ? (
                <>
                  <button
                    className="btn btn-primary"
                    onClick={() => openPrintModal(selectedReport)}
                    title="Print official A4 laboratory report with verification QR"
                  >
                    <Printer size={14} />
                    <span>Print Official Report</span>
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleDownloadPdf(selectedReport)}
                    title="Download official PDF report"
                  >
                    <Download size={14} />
                    <span>Download PDF</span>
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-secondary"
                  onClick={() => openPrintModal(selectedReport)}
                  title="Draft reports cannot be printed as official records"
                  style={{ opacity: 0.7 }}
                >
                  <Printer size={14} />
                  <span>Print (Released Only)</span>
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setSelectedReport(null)}>
                Close
              </button>
            </div>
          </div>
        }
      >
        {selectedReport && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--slate-200)' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Patient</p>
                <p style={{ fontWeight: 600 }}>{selectedReport.patientName} ({selectedReport.patientMrn})</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Requisition Order #</p>
                <p style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selectedReport.orderNumber}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Diagnostic Panel</p>
                <p style={{ fontWeight: 600 }}>{selectedReport.testName}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Report Workflow State</p>
                <div>{getStatusBadge(selectedReport.status)}</div>
              </div>
            </div>

            {/* Rejection Decision Banner & Audit Trail */}
            {selectedReport.status === 'rejected' && (
              <div style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#991b1b' }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} />
                  <span>Report Rejected by Pathologist: Returned for Correction</span>
                </div>
                <div style={{ marginTop: '4px', fontSize: '0.8125rem' }}>
                  <strong>Rejection Justification:</strong> {selectedReport.rejectionReason}
                </div>
                {Array.isArray(selectedReport.rejectionHistory) && selectedReport.rejectionHistory.length > 0 && (
                  <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#7f1d1d', borderTop: '1px dashed #fca5a5', paddingTop: '6px' }}>
                    <strong>Rejection Audit History ({selectedReport.rejectionHistory.length}):</strong>
                    <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                      {selectedReport.rejectionHistory.map((h, hidx) => (
                        <li key={hidx}>
                          "{h.reason}" — by <em>{h.rejectedBy}</em> on {new Date(h.rejectedAt).toLocaleString()}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Structured Analyte & Parameter Results */}
            {selectedReport.items && selectedReport.items.length > 0 && (
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '6px' }}>
                  Verified Diagnostic Test Results & Analyte Parameters
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {selectedReport.items.map((it, idx) => (
                    <div key={idx} style={{ border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                      <div style={{ padding: '6px 12px', background: 'var(--slate-100)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--slate-700)' }}>
                        {it.testName} ({it.testCode})
                      </div>
                      {Array.isArray(it.parameterResults) && it.parameterResults.length > 0 ? (
                        <table className="lms-table" style={{ margin: 0, fontSize: '0.8125rem' }}>
                          <thead>
                            <tr>
                              <th>Parameter / Analyte</th>
                              <th>Observed Result</th>
                              <th>Reference Range</th>
                              <th>Clinical Flag</th>
                            </tr>
                          </thead>
                          <tbody>
                            {it.parameterResults.map((pr, pidx) => {
                              const isBlank = pr.value === undefined || pr.value === null || String(pr.value).trim() === '';
                              const evalResult = !isBlank ? classifyResult(pr.value, pr) : null;
                              const isAbnormal = pr.isAbnormal !== undefined ? pr.isAbnormal : (evalResult?.isAbnormal || false);
                              return (
                                <tr key={pidx} style={{ background: isAbnormal ? '#fff1f2' : isBlank ? '#fffbeb' : undefined }}>
                                  <td style={{ fontWeight: 500 }}>{pr.name || pr.parameterName || pr.parameterCode}</td>
                                  <td style={{ fontWeight: 600, color: isAbnormal ? '#e11d48' : isBlank ? '#c2410c' : 'inherit' }}>
                                    {isBlank ? <span style={{ fontStyle: 'italic', fontWeight: 500 }}>Missing result</span> : `${pr.value}${pr.unit ? ' ' + pr.unit : ''}`}
                                  </td>
                                  <td style={{ color: 'var(--slate-500)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                    {pr.referenceRange || 'N/A'}
                                  </td>
                                  <td>
                                    {renderResultFlagBadge(pr)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ padding: '8px 12px', fontSize: '0.8125rem', color: 'var(--slate-600)' }}>
                          Result: <strong>{it.resultValue || 'Awaiting results entry'}</strong>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>Pathologist Clinical Findings</p>
              <div
                style={{
                  padding: '0.75rem 1rem',
                  background: 'var(--slate-50)',
                  border: '1px solid var(--slate-200)',
                  borderRadius: 'var(--radius-md)',
                  fontFamily: 'inherit',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {selectedReport.findings}
              </div>
            </div>

            <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>Drafted By: <strong>{selectedReport.draftedBy}</strong></div>
              {selectedReport.reviewedBy && <div>Verified By: <strong>{selectedReport.reviewedBy}</strong></div>}
              {selectedReport.releasedBy && (
                <div>Released By: <strong>{selectedReport.releasedBy}</strong> on {new Date(selectedReport.releasedAt).toLocaleString()}</div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* New Draft Modal */}
      <Modal
        isOpen={isDraftOpen}
        onClose={() => setIsDraftOpen(false)}
        title="Draft Diagnostic Pathology Report"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsDraftOpen(false)} disabled={actionLoading}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreateDraft} disabled={actionLoading}>
              {actionLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Draft Report</span>
              )}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateDraft} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div className="form-group">
            <label className="form-label">Select Requisition Order *</label>
            <select
              className="form-select"
              required
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(e.target.value)}
            >
              <option value="">-- Choose an order --</option>
              {orders.map((o) => (
                <option key={o.orderId} value={o.orderId}>
                  {o.orderNumber} — {o.patientName} ({o.items?.map((it) => it.testCode).join(', ')})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Clinical Findings & Interpretation *</label>
            <textarea
              className="form-input"
              rows={4}
              required
              placeholder="Enter diagnostic findings, reference range evaluations, and clinical impressions..."
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Pathologist Review & Verification Modal */}
      <Modal
        isOpen={!!verifyReport}
        onClose={() => {
          setVerifyReport(null);
          setVerifyError(null);
        }}
        title={verifyReport ? `Diagnostic Pathology Review: ${verifyReport.reportNumber}` : 'Report Review'}
        size="lg"
      >
        {verifyReport && (() => {
          const comp = checkReportCompleteness(verifyReport);
          const items = Array.isArray(verifyReport.items) ? verifyReport.items : [];
          const hasMissingResults = !comp.isComplete;
          const hasAbnormal = items.some(
            (it) => it.isAbnormal || (Array.isArray(it.parameterResults) && it.parameterResults.some((pr) => {
              if (pr.isAbnormal) return true;
              if (pr.flag && pr.flag !== 'NORMAL') return true;
              if (pr.value !== undefined && pr.value !== null && String(pr.value).trim() !== '') {
                return classifyResult(pr.value, pr).isAbnormal;
              }
              return false;
            }))
          );

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
              {/* Patient / Requisition Context Banner */}
              <div style={{ padding: '0.875rem', background: 'var(--slate-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>Patient</span>
                  <div style={{ fontWeight: 700 }}>{verifyReport.patientName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>MRN: {verifyReport.patientMrn}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>Requisition Order</span>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary-blue)' }}>{verifyReport.orderNumber}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Report: {verifyReport.reportNumber}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>Diagnostic Panel</span>
                  <div style={{ fontWeight: 600 }}>{verifyReport.testName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Drafted by: {verifyReport.draftedBy}</div>
                </div>
              </div>

              {/* Status and Clinical Warnings */}
              {verifyError && (
                <div style={{ padding: '0.625rem 0.875rem', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 'var(--radius-md)', color: '#be123c', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span><strong>Verification Error:</strong> {verifyError}</span>
                </div>
              )}

              {hasMissingResults && (
                <div style={{ padding: '0.625rem 0.875rem', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 'var(--radius-md)', color: '#9a3412', fontSize: '0.8125rem' }}>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={15} />
                    <span>Incomplete Clinical Results — Approval Disabled</span>
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    One or more tests in this requisition are missing diagnostic results (
                    <strong>{comp.missingItems.join(', ')}</strong>). Pathologist approval is blocked until all test results are recorded.
                  </div>
                </div>
              )}

              {hasAbnormal && !hasMissingResults && (
                <div style={{ padding: '0.625rem 0.875rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', color: '#b45309', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span><strong>Pathological Alert:</strong> One or more analyte parameters are outside normal physiological reference ranges. Please evaluate clinical implications before approval.</span>
                </div>
              )}

              {/* VIEW 1: MAIN REPORT REVIEW */}
              {verifyReviewStep === 'review' && (
                <>
                  {/* Structured Parameter Inspection Table */}
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--slate-600)', marginBottom: '6px', fontWeight: 700 }}>
                      Diagnostic Parameter Results Review ({items.length} Test{items.length === 1 ? '' : 's'})
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '35vh', overflowY: 'auto' }}>
                      {items.map((it, idx) => (
                        <div key={idx} style={{ border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                          <div style={{ padding: '6px 12px', background: 'var(--slate-100)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--slate-700)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{it.testName} ({it.testCode})</span>
                            {it.isAbnormal && <span style={{ color: '#e11d48', fontSize: '0.75rem', fontWeight: 700 }}>ABNORMAL FINDING</span>}
                          </div>
                          {Array.isArray(it.parameterResults) && it.parameterResults.length > 0 ? (
                            <table className="lms-table" style={{ margin: 0, fontSize: '0.8125rem' }}>
                              <thead>
                                <tr>
                                  <th>Parameter / Analyte</th>
                                  <th>Observed Result</th>
                                  <th>Reference Range</th>
                                  <th>Clinical Flag</th>
                                </tr>
                              </thead>
                              <tbody>
                                {it.parameterResults.map((pr, pidx) => {
                                  const isBlank = pr.value === undefined || pr.value === null || String(pr.value).trim() === '';
                                  const evalResult = !isBlank ? classifyResult(pr.value, pr) : null;
                                  const isAbnormal = pr.isAbnormal !== undefined ? pr.isAbnormal : (evalResult?.isAbnormal || false);
                                  return (
                                    <tr key={pidx} style={{ background: isAbnormal ? '#fff1f2' : isBlank ? '#fffbeb' : undefined }}>
                                      <td style={{ fontWeight: 500 }}>{pr.name || pr.parameterName || pr.parameterCode}</td>
                                      <td style={{ fontWeight: 600, color: isAbnormal ? '#e11d48' : isBlank ? '#c2410c' : 'inherit' }}>
                                        {isBlank ? <span style={{ fontStyle: 'italic', fontWeight: 500 }}>Missing result</span> : `${pr.value}${pr.unit ? ' ' + pr.unit : ''}`}
                                      </td>
                                      <td style={{ color: 'var(--slate-500)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                        {pr.referenceRange || 'N/A'}
                                      </td>
                                      <td>
                                        {renderResultFlagBadge(pr)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          ) : (
                            <div style={{ padding: '8px 12px', fontSize: '0.8125rem', color: 'var(--slate-600)' }}>
                              Result:{' '}
                              {it.resultValue && String(it.resultValue).trim() !== '' ? (
                                <strong>{it.resultValue}</strong>
                              ) : (
                                <span style={{ color: '#c2410c', fontStyle: 'italic' }}>Awaiting analytical result entry</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pathologist Clinical Interpretation */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Diagnostic Findings & Clinical Interpretation *</label>
                    <textarea
                      className="form-input"
                      rows={3}
                      required
                      placeholder="Enter or refine clinical impressions, morphology notes, or differential diagnoses..."
                      value={verificationFindings}
                      onChange={(e) => setVerificationFindings(e.target.value)}
                    />
                  </div>

                  {/* Pathologist Verification Notes */}
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontWeight: 600 }}>Pathologist Sign-off / Verification Notes (Optional)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Findings verified and approved under ISO 15189."
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                    />
                  </div>

                  <div style={{ padding: '0.5rem 0.75rem', background: 'var(--slate-100)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--slate-600)' }}>
                    <span>Verified By: <strong>{user?.fullName || user?.email || 'Pathologist'}</strong> (Pathology Consultant). </span>
                    <span style={{ color: 'var(--slate-500)' }}>Verification moves report to Approved status. Official report release remains a separate step.</span>
                  </div>

                  {/* Review Footer Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <button className="btn btn-secondary" onClick={() => setVerifyReport(null)} disabled={actionLoading}>
                      Cancel
                    </button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ background: 'var(--danger-600, #dc2626)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                        onClick={() => {
                          setVerifyError(null);
                          setVerifyReviewStep('confirm_reject');
                        }}
                        disabled={actionLoading}
                        title="Reject report with clinical justification"
                      >
                        <AlertTriangle size={15} />
                        <span>Reject Report</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          setVerifyError(null);
                          setVerifyReviewStep('confirm_approve');
                        }}
                        disabled={actionLoading || !comp.isComplete}
                        title={!comp.isComplete ? `Cannot approve: Missing results for ${comp.missingItems.join(', ')}` : 'Proceed to sign-off confirmation'}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        <ShieldCheck size={16} />
                        <span>Approve & Sign-Off</span>
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* VIEW 2: CONFIRM APPROVAL STEP */}
              {verifyReviewStep === 'confirm_approve' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '14px', color: '#1e40af' }}>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem' }}>
                      <ShieldCheck size={18} />
                      <span>Confirm Pathologist Approval & Sign-Off</span>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.8125rem', lineHeight: 1.5, color: '#1e3a8a' }}>
                      You are about to authorize and digitally sign report <strong>{verifyReport.reportNumber}</strong> for patient <strong>{verifyReport.patientName}</strong>.
                      This decision transitions the requisition into <strong>Approved</strong> status, locking verified analyte parameters under ISO 15189 accreditation standards.
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
                      <strong>Consultant Pathologist Authorization:</strong> I certify that I have clinically reviewed, validated, and authorized these analytical test findings for final report issuance under laboratory quality protocol.
                    </span>
                  </label>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setVerifyReviewStep('review')}
                      disabled={actionLoading}
                    >
                      Back to Review
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleConfirmVerification}
                      disabled={actionLoading || !isDoctorConfirmed}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      {actionLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Signing...</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck size={16} />
                          <span>Confirm Verification & Sign-off</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW 3: CONFIRM REJECTION STEP */}
              {verifyReviewStep === 'confirm_reject' && (
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

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: 0 }}>
                      Rejection Routing & Action Required *
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: rejectionType === 'recollection' ? '2px solid #dc2626' : '1px solid var(--border-color)',
                        background: rejectionType === 'recollection' ? '#fef2f2' : 'var(--bg-surface)',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="radio"
                          name="verifyRejectionType"
                          value="recollection"
                          checked={rejectionType === 'recollection'}
                          onChange={() => setRejectionType('recollection')}
                          style={{ marginTop: '2px' }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: rejectionType === 'recollection' ? '#991b1b' : 'inherit' }}>
                            Specimen Recollection
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                            Marks specimen rejected & creates task in Phlebotomy Recollection Queue.
                          </div>
                        </div>
                      </label>

                      <label style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        padding: '10px 12px',
                        borderRadius: '6px',
                        border: rejectionType === 'correction' ? '2px solid #d97706' : '1px solid var(--border-color)',
                        background: rejectionType === 'correction' ? '#fffbeb' : 'var(--bg-surface)',
                        cursor: 'pointer'
                      }}>
                        <input
                          type="radio"
                          name="verifyRejectionType"
                          value="correction"
                          checked={rejectionType === 'correction'}
                          onChange={() => setRejectionType('correction')}
                          style={{ marginTop: '2px' }}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: rejectionType === 'correction' ? '#92400e' : 'inherit' }}>
                            Technician Bench Revision
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                            Re-opens results for bench re-entry/correction without redraw.
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8125rem' }}>
                      Clinical Rejection Justification * (minimum 5 characters)
                    </label>
                    <textarea
                      rows={3}
                      required
                      className="form-input"
                      style={{ fontSize: '0.8125rem' }}
                      placeholder="e.g. Inconsistent potassium readout; gross hemolysis suspected. Redraw or repeat bench analysis required."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setVerifyReviewStep('review')}
                      disabled={actionLoading}
                    >
                      Back to Review
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ background: 'var(--danger-600, #dc2626)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={handleConfirmReject}
                      disabled={actionLoading || rejectionReason.trim().length < 5}
                    >
                      {actionLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span>Rejecting...</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={16} />
                          <span>Confirm Clinical Rejection</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* Pathologist Report Rejection Modal */}
      <Modal
        isOpen={!!rejectModalReport}
        onClose={() => setRejectModalReport(null)}
        title={rejectModalReport ? `Reject Pathology Report: ${rejectModalReport.reportNumber}` : ''}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setRejectModalReport(null)} disabled={actionLoading}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              style={{ background: 'var(--danger-600, #dc2626)', color: 'white', border: 'none' }}
              onClick={handleConfirmReject}
              disabled={actionLoading || !rejectionReason.trim()}
            >
              {actionLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Rejecting...</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={16} />
                  <span>Confirm Clinical Rejection</span>
                </>
              )}
            </button>
          </>
        }
      >
        {rejectModalReport && (
          <form onSubmit={handleConfirmReject} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', color: '#991b1b', fontSize: '0.8125rem' }}>
              <strong>Notice:</strong> Rejecting this report will return it to the laboratory bench queue for technician correction. The rejection reason and decision timestamp will be permanently logged in the report audit trail.
            </div>

            {rejectError && (
              <div style={{ padding: '0.625rem 0.875rem', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 'var(--radius-md)', color: '#be123c', fontSize: '0.8125rem' }}>
                <strong>Error:</strong> {rejectError}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8125rem', padding: '0.5rem', background: 'var(--slate-50)', borderRadius: 'var(--radius-md)' }}>
              <div>Patient: <strong>{rejectModalReport.patientName}</strong></div>
              <div>Requisition: <strong>{rejectModalReport.orderNumber}</strong></div>
              <div>Test Panel: <strong>{rejectModalReport.testName}</strong></div>
              <div>Drafted By: <strong>{rejectModalReport.draftedBy}</strong></div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: 0 }}>
                Rejection Routing & Action Required *
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: rejectionType === 'recollection' ? '2px solid #dc2626' : '1px solid var(--border-color)',
                  background: rejectionType === 'recollection' ? '#fef2f2' : 'var(--bg-surface)',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="modalRejectionType"
                    value="recollection"
                    checked={rejectionType === 'recollection'}
                    onChange={() => setRejectionType('recollection')}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: rejectionType === 'recollection' ? '#991b1b' : 'inherit' }}>
                      Specimen Recollection
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                      Marks specimen rejected & creates task in Phlebotomy Recollection Queue.
                    </div>
                  </div>
                </label>

                <label style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: rejectionType === 'correction' ? '2px solid #d97706' : '1px solid var(--border-color)',
                  background: rejectionType === 'correction' ? '#fffbeb' : 'var(--bg-surface)',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="modalRejectionType"
                    value="correction"
                    checked={rejectionType === 'correction'}
                    onChange={() => setRejectionType('correction')}
                    style={{ marginTop: '2px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: rejectionType === 'correction' ? '#92400e' : 'inherit' }}>
                      Technician Bench Revision
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '2px' }}>
                      Re-opens results for bench re-entry/correction without redraw.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Clinical Rejection Reason & Corrective Instructions *</label>
              <textarea
                className="form-input"
                rows={4}
                required
                placeholder="Specify clinical reasons for rejection (e.g. questionable morphology, contradictory analyte values, requirement for re-dilution or technician repeat run)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '4px' }}>
                Minimum 5 characters required. This justification is permanently recorded and visible to technicians.
              </span>
            </div>
          </form>
        )}
      </Modal>

      {/* Official Released Report Print Modal & A4 Printable Layout */}
      <Modal
        isOpen={!!printReport}
        onClose={() => setPrintReport(null)}
        title={printReport ? `Official Report Print Preview: ${printReport.reportNumber}` : ''}
        size="xl"
        maxWidth="1020px"
        dialogStyle={{
          maxWidth: '1020px',
          width: '96vw',
        }}
        bodyStyle={{
          padding: '20px 24px',
          maxHeight: 'calc(88vh - 120px)',
          overflowY: 'auto',
          overflowX: 'auto',
          background: '#f8fafc',
        }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--slate-600)' }}>
              Standard A4 Clinical Report with Digitally Signed Verification QR Code.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-primary"
                onClick={() => executeReportPrint(printReport)}
              >
                <Printer size={15} />
                <span>Print Official Report</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => executeReportPrint(printReport)}
                title="Download as PDF with sanitized filename"
              >
                <Download size={15} />
                <span>Download PDF</span>
              </button>
              <button className="btn btn-secondary" onClick={() => setPrintReport(null)}>
                Close Preview
              </button>
            </div>
          </div>
        }
      >
        {printReport && (
          <div>
            <style>{`
              @media print {
                html, body {
                  overflow: visible !important;
                  height: auto !important;
                  background: #ffffff !important;
                }
                .modal-backdrop, .modal-dialog {
                  position: static !important;
                  display: block !important;
                  overflow: visible !important;
                  max-width: 100% !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                  background: transparent !important;
                }
                .modal-header, .modal-footer, button, nav, aside {
                  display: none !important;
                }
                body * {
                  visibility: hidden !important;
                }
                #official-report-printable, #official-report-printable * {
                  visibility: visible !important;
                }
                #official-report-printable {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 8mm 12mm !important;
                  background: #ffffff !important;
                  color: #0f172a !important;
                  box-shadow: none !important;
                  border: none !important;
                  z-index: 999999 !important;
                  font-size: 8.5pt !important;
                }
                .no-print {
                  display: none !important;
                }
                @page {
                  size: A4 portrait;
                  margin: 8mm 10mm;
                }
                thead {
                  display: table-header-group;
                }
                tfoot {
                  display: table-footer-group;
                }
                tr {
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
                .page-break-inside-avoid {
                  page-break-inside: avoid;
                  break-inside: avoid;
                }
              }
            `}</style>

            <div
              id="official-report-printable"
              style={{
                background: '#ffffff',
                color: '#0f172a',
                padding: '24px 28px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                fontSize: '0.8125rem',
                lineHeight: 1.4,
                boxSizing: 'border-box',
                maxWidth: '940px',
                minWidth: '700px',
                margin: '0 auto',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}
            >
              {/* 1. Header: Left = Lab Name & Logo, Right = Barcode */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingBottom: '8px',
                  minHeight: '52px',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                {/* Top-Left: Reserved Area for Laboratory Logo & Name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1 1 240px' }}>
                  {Boolean(branding?.logoUrl || currentTenant?.branding?.logoUrl || printReport.branding?.logoUrl) && (
                    <img
                      src={branding?.logoUrl || currentTenant?.branding?.logoUrl || printReport.branding?.logoUrl}
                      alt=""
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      style={{ maxHeight: '44px', maxWidth: '120px', objectFit: 'contain', display: 'block' }}
                    />
                  )}
                  <div>
                    <div style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.3px', lineHeight: 1.2, textTransform: 'uppercase' }}>
                      {(printReport.labName && printReport.labName !== 'Diagnostic Laboratory') ? printReport.labName : (branding?.displayName || currentTenant?.name || printReport.labName || 'Chonexa Lab')}
                    </div>
                    {(printReport.tagline || branding?.tagline) && (
                      <div style={{ fontSize: '0.7rem', fontStyle: 'italic', color: '#64748b', marginTop: '1px' }}>
                        {printReport.tagline || branding?.tagline}
                      </div>
                    )}
                  </div>
                </div>

                {/* Top-Center: Centered DIAGNOSTIC PATHOLOGY REPORT */}
                <div style={{ flex: '0 0 auto', textAlign: 'center', padding: '0 8px' }}>
                  <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', letterSpacing: '0.5px', textTransform: 'uppercase', lineHeight: 1.2 }}>
                    DIAGNOSTIC PATHOLOGY REPORT
                  </div>
                </div>

                {/* Top-Right: Barcode & Ref */}
                <div style={{ flex: '0 0 190px', textAlign: 'right' }}>
                  <div style={{ display: 'inline-block', textAlign: 'right' }}>
                    {barcodeSvgHtml ? (
                      <div style={{ display: 'inline-block', width: '165px', textAlign: 'right' }}>
                        <div dangerouslySetInnerHTML={{ __html: barcodeSvgHtml }} style={{ width: '100%', height: '34px' }} />
                      </div>
                    ) : (
                      <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>
                        {printReport.barcode || printReport.orderNumber || printReport.reportNumber}
                      </div>
                    )}
                    <div style={{ fontSize: '0.75rem', color: '#334155', fontWeight: 700, fontFamily: 'monospace', marginTop: '2px' }}>
                      Ref: {printReport.reportNumber}
                    </div>
                  </div>
                </div>
              </div>

              {/* Header Thin Divider */}
              <div style={{ borderBottom: '1.5px solid #0f172a', margin: '4px 0 10px 0' }} />

              {/* 2. Banner with Patient, Doctor & Referral Details */}
              <div
                style={{
                  border: '1.2px solid #334155',
                  borderRadius: '4px',
                  padding: '10px 14px',
                  margin: '8px 0 14px 0',
                  fontSize: '0.7813rem',
                  color: '#0f172a',
                  display: 'grid',
                  gridTemplateColumns: 'minmax(280px, 1.15fr) minmax(260px, 0.85fr)',
                  gap: '6px 20px',
                  background: '#ffffff',
                }}
              >
                {/* Left Column: Patient Details, Doctor, Refer By Doctor */}
                <div>
                  {/* Patient Name */}
                  <div style={{ display: 'flex', marginBottom: '3px', alignItems: 'baseline' }}>
                    <span style={{ minWidth: '115px', fontWeight: 700, color: '#334155', flexShrink: 0 }}>Patient Name</span>
                    <span style={{ fontWeight: 800, color: '#0f172a', wordBreak: 'break-word' }}>: {printReport.patientName || '—'}</span>
                  </div>

                  {/* Patient MRN */}
                  <div style={{ display: 'flex', marginBottom: '3px', alignItems: 'baseline' }}>
                    <span style={{ minWidth: '115px', fontWeight: 700, color: '#334155', flexShrink: 0 }}>Patient MRN</span>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace', wordBreak: 'break-word' }}>: {printReport.patientMrn || '—'}</span>
                  </div>

                  {/* Age / Gender */}
                  <div style={{ display: 'flex', marginBottom: '3px', alignItems: 'baseline' }}>
                    <span style={{ minWidth: '115px', fontWeight: 700, color: '#334155', flexShrink: 0 }}>Age / Gender</span>
                    <span style={{ wordBreak: 'break-word' }}>: {[printReport.patientAge ? `${printReport.patientAge} Y` : '', printReport.patientGender].filter(Boolean).join(' / ') || '—'}</span>
                  </div>

                  {/* Doctor / Consultant (Pathologist) */}
                  <div style={{ display: 'flex', marginBottom: '3px', alignItems: 'baseline' }}>
                    <span style={{ minWidth: '115px', fontWeight: 700, color: '#334155', flexShrink: 0 }}>Doctor / Consult</span>
                    <span style={{ fontWeight: 600, wordBreak: 'break-word' }}>: {formatPathologistName(printReport.releasedBy || printReport.reviewedBy)}</span>
                  </div>

                  {/* Refer By Doctor */}
                  <div style={{ display: 'flex', marginBottom: '3px', alignItems: 'baseline' }}>
                    <span style={{ minWidth: '115px', fontWeight: 700, color: '#334155', flexShrink: 0 }}>Refer By Doctor</span>
                    <span style={{ fontWeight: 700, color: '#0f172a', wordBreak: 'break-word' }}>
                      : {(printReport.physicianName && printReport.physicianName !== '—') ? printReport.physicianName : (printReport.referralDoctor || printReport.referredBy || printReport.orderingPhysician || 'Self / Direct')}
                      {printReport.referralHospital && printReport.referralHospital !== '—' ? ` (${printReport.referralHospital})` : ''}
                    </span>
                  </div>
                </div>

                {/* Right Column: Order No, Sample, Dates */}
                <div>
                  {/* Lab / Order Number */}
                  <div style={{ display: 'flex', marginBottom: '3px', alignItems: 'baseline' }}>
                    <span style={{ minWidth: '120px', fontWeight: 700, color: '#334155', flexShrink: 0 }}>Order / Lab No</span>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace', wordBreak: 'break-word' }}>: {printReport.orderNumber || printReport.barcode || '—'}</span>
                  </div>

                  {/* Specimen / Sample */}
                  <div style={{ display: 'flex', marginBottom: '3px', alignItems: 'baseline' }}>
                    <span style={{ minWidth: '120px', fontWeight: 700, color: '#334155', flexShrink: 0 }}>Sample / Specimen</span>
                    <span style={{ wordBreak: 'break-word' }}>: {printReport.specimenType || 'Specimen'}</span>
                  </div>

                  {/* Collected Date */}
                  <div style={{ display: 'flex', marginBottom: '3px', alignItems: 'baseline' }}>
                    <span style={{ minWidth: '120px', fontWeight: 700, color: '#334155', flexShrink: 0 }}>Collected On</span>
                    <span style={{ wordBreak: 'break-word' }}>: {formatReportDateTime(printReport.collectedAt) || '—'}</span>
                  </div>

                  {/* Received Date */}
                  <div style={{ display: 'flex', marginBottom: '3px', alignItems: 'baseline' }}>
                    <span style={{ minWidth: '120px', fontWeight: 700, color: '#334155', flexShrink: 0 }}>Received On</span>
                    <span style={{ wordBreak: 'break-word' }}>: {formatReportDateTime(printReport.receivedAt) || '—'}</span>
                  </div>

                  {/* Reported Date */}
                  <div style={{ display: 'flex', marginBottom: '3px', alignItems: 'baseline' }}>
                    <span style={{ minWidth: '120px', fontWeight: 700, color: '#334155', flexShrink: 0 }}>Reported On</span>
                    <span style={{ fontWeight: 700, wordBreak: 'break-word' }}>: {formatReportDateTime(printReport.releasedAt || printReport.verifiedAt || new Date())}</span>
                  </div>
                </div>
              </div>

              {/* 4. Test Results Layout Grouped by Department */}
              {Object.entries(
                (printReport.items || []).reduce((acc, it) => {
                  const dept = (it.department || printReport.department || 'Clinical Pathology').toUpperCase();
                  if (!acc[dept]) acc[dept] = [];
                  acc[dept].push(it);
                  return acc;
                }, {})
              ).map(([deptName, deptItems], deptIdx) => (
                <div key={deptIdx} style={{ marginBottom: '16px', pageBreakInside: 'avoid' }}>
                  {/* Department Banner Header */}
                  <div
                    style={{
                      textAlign: 'center',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      color: '#0f172a',
                      backgroundColor: '#f8fafc',
                      borderTop: '1px solid #0f172a',
                      borderBottom: '1px solid #0f172a',
                      padding: '4px 8px',
                      margin: '10px 0 6px 0',
                      letterSpacing: '0.8px',
                      textTransform: 'uppercase',
                    }}
                  >
                    Department of {deptName}
                  </div>

                  {/* Clean 4-Column Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.7813rem', tableLayout: 'fixed' }}>
                    <thead>
                      <tr style={{ borderBottom: '1.5px solid #0f172a', textAlign: 'left', color: '#0f172a' }}>
                        <th style={{ padding: '6px 8px', width: '38%', fontWeight: 700 }}>Test Name</th>
                        <th style={{ padding: '6px 8px', width: '22%', fontWeight: 700, textAlign: 'center' }}>Result</th>
                        <th style={{ padding: '6px 8px', width: '15%', fontWeight: 700 }}>Unit</th>
                        <th style={{ padding: '6px 8px', width: '25%', fontWeight: 700 }}>Biological Ref. Interval</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deptItems.map((it, itIdx) => {
                        const hasParams = Array.isArray(it.parameterResults) && it.parameterResults.length > 0;
                        return (
                          <React.Fragment key={itIdx}>
                            {/* Test Panel Header */}
                            <tr>
                              <td colSpan="4" style={{ fontWeight: 800, padding: '7px 8px 3px 8px', fontSize: '0.8125rem', color: '#0f172a', textDecoration: 'underline' }}>
                                {it.testName} {it.testCode ? `(${it.testCode})` : ''}
                              </td>
                            </tr>

                            {hasParams ? (
                              it.parameterResults.map((pr, pIdx) => {
                                const flagInfo = getPrintFlagDisplay(pr);
                                const isBlank = pr.value === undefined || pr.value === null || String(pr.value).trim() === '';
                                const paramName = pr.name || pr.parameterName || pr.parameterCode;
                                const intervalText = resolveParamInterval(pr);

                                return (
                                  <tr
                                    key={pIdx}
                                    style={{
                                      borderBottom: '1px solid #f1f5f9',
                                    }}
                                  >
                                    <td style={{ padding: '4px 8px 4px 18px', color: '#0f172a', wordBreak: 'break-word' }}>
                                      <div style={{ fontWeight: 600 }}>{paramName}</div>
                                      {pr.method && (
                                        <div style={{ fontSize: '0.675rem', color: '#64748b', fontStyle: 'italic' }}>Method: {pr.method}</div>
                                      )}
                                    </td>
                                    <td style={{ padding: '4px 8px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                      {isBlank ? (
                                        <span style={{ color: '#d97706', fontStyle: 'italic', fontWeight: 500 }}>Pending</span>
                                      ) : (
                                        <span style={{ fontWeight: 600, color: '#0f172a' }}>
                                          {String(pr.value)}
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '4px 8px', color: '#334155' }}>{pr.unit || '—'}</td>
                                    <td style={{ padding: '4px 8px', color: '#0f172a' }}>{intervalText}</td>
                                  </tr>
                                );
                              })
                            ) : (
                              <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '4px 8px 4px 18px', color: '#0f172a', fontWeight: 600, wordBreak: 'break-word' }}>
                                  {it.testName}
                                  {it.method && <div style={{ fontSize: '0.675rem', color: '#64748b', fontStyle: 'italic' }}>Method: {it.method}</div>}
                                </td>
                                <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 600, color: '#0f172a' }}>
                                  {it.resultValue || 'Completed'}
                                </td>
                                <td style={{ padding: '4px 8px', color: '#334155' }}>{it.unit || '—'}</td>
                                <td style={{ padding: '4px 8px', color: '#0f172a' }}>{resolveParamInterval(it)}</td>
                              </tr>
                            )}

                            {/* Method / Comment */}
                            {(it.comments || it.clinicalNotes) && (
                              <tr>
                                <td colSpan="4" style={{ padding: '3px 8px 6px 18px', fontSize: '0.72rem', color: '#475569' }}>
                                  <strong>Clinical Comment:</strong> {it.comments || it.clinicalNotes}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Authorized Pathologist Signature with dedicated signing space */}
              <div
                className="page-break-inside-avoid"
                style={{
                  marginTop: '24px',
                  paddingTop: '8px',
                  borderTop: '1.5px solid #0f172a',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  fontSize: '0.7rem',
                  color: '#475569',
                }}
              >
                {/* Left: General note */}
                <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontStyle: 'italic', maxWidth: '340px' }}>
                  * Computer generated diagnostic medical report. Valid without physical signature if digitally verified.
                </div>

                {/* Right: Pathologist Signature with dedicated physical signing space */}
                <div style={{ textAlign: 'right', minWidth: '210px' }}>
                  {/* Space reserved for physical signature & stamp */}
                  <div style={{ height: '48px' }} />
                  <div style={{ borderBottom: '1.2px solid #334155', width: '200px', marginBottom: '4px', marginLeft: 'auto' }} />
                  <div style={{ fontWeight: 800, fontSize: '0.825rem', color: '#0f172a' }}>
                    {formatPathologistName(printReport.releasedBy || printReport.reviewedBy)}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#475569' }}>
                    Consultant Pathologist & Laboratory Director
                  </div>
                  <div style={{ fontSize: '0.675rem', color: '#64748b', marginTop: '1px' }}>
                    Digitally Verified: {formatReportDateTime(printReport.releasedAt || printReport.verifiedAt || new Date())}
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'center', fontSize: '0.68rem', color: '#94a3b8', marginTop: '8px', letterSpacing: '1.5px', fontWeight: 700 }}>
                *** END OF DIAGNOSTIC REPORT ***
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Report Revision & Resubmission Modal (Technician / Staff Correction Flow) */}
      <Modal
        isOpen={!!correctionReport}
        onClose={() => !isSubmittingCorrection && setCorrectionReport(null)}
        title={correctionReport ? `Revise & Resubmit Report: ${correctionReport.reportNumber}` : ''}
        size="xl"
        maxWidth="920px"
        dialogStyle={{ maxWidth: '920px', width: '95vw' }}
        bodyStyle={{ padding: '20px 24px', maxHeight: 'calc(88vh - 120px)', overflowY: 'auto' }}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
              Saving revision will update results and re-route this report back to Pathologist review queue.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCorrectionReport(null)}
                disabled={isSubmittingCorrection}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmCorrection}
                disabled={isSubmittingCorrection}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {isSubmittingCorrection ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                <span>{isSubmittingCorrection ? 'Resubmitting...' : 'Save Revision & Resubmit to Pathologist'}</span>
              </button>
            </div>
          </div>
        }
      >
        {correctionReport && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Prominent Pathologist Clinical Rejection Banner */}
            <div
              style={{
                padding: '12px 16px',
                background: '#fff1f2',
                border: '1.5px solid #fecdd3',
                borderRadius: '8px',
                color: '#9f1239',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9375rem' }}>
                <AlertTriangle size={18} style={{ color: '#e11d48' }} />
                <span>Pathologist Returned Report for Revision</span>
              </div>
              <div style={{ marginTop: '6px', fontSize: '0.875rem', lineHeight: 1.5 }}>
                <strong>Rejection Reason / Required Correction:</strong>
                <p style={{ margin: '4px 0 0 0', padding: '6px 10px', background: '#ffe4e6', borderRadius: '4px', fontStyle: 'italic', color: '#881337' }}>
                  "{correctionReport.rejectionReason || 'Clinical findings/values require verification'}"
                </p>
              </div>
              <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#be123c', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                <span><strong>Rejected By:</strong> {correctionReport.rejectedBy || 'Pathologist'}</span>
                {correctionReport.rejectedAt && (
                  <span><strong>Rejected On:</strong> {new Date(correctionReport.rejectedAt).toLocaleString()}</span>
                )}
              </div>
            </div>

            {/* Patient & Order Meta Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                padding: '12px',
                background: 'var(--slate-50, #f8fafc)',
                borderRadius: '6px',
                border: '1px solid var(--slate-200, #e2e8f0)',
                fontSize: '0.8125rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--slate-500)', display: 'block', fontSize: '0.75rem' }}>Patient Name</span>
                <strong>{correctionReport.patientName || '—'}</strong>
                <span style={{ color: 'var(--slate-500)', fontSize: '0.75rem', marginLeft: '6px' }}>({correctionReport.patientMrn})</span>
              </div>
              <div>
                <span style={{ color: 'var(--slate-500)', display: 'block', fontSize: '0.75rem' }}>Order / Lab No</span>
                <strong style={{ fontFamily: 'monospace' }}>{correctionReport.orderNumber || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--slate-500)', display: 'block', fontSize: '0.75rem' }}>Test / Panel</span>
                <strong>{correctionReport.testName || '—'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--slate-500)', display: 'block', fontSize: '0.75rem' }}>Current Status</span>
                <Badge variant="danger" icon={AlertTriangle}>Rejected (Needs Revision)</Badge>
              </div>
            </div>

            {/* Error Message if Resubmission Fails */}
            {correctionError && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '6px', color: '#b91c1c', fontSize: '0.8125rem' }}>
                <strong>Error:</strong> {correctionError}
              </div>
            )}

            {/* Editable Analyte / Parameter Results List */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.875rem', marginBottom: '8px', color: 'var(--slate-800)' }}>
                Correct Analyte Results & Values:
              </label>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {correctionItems.map((item, itemIdx) => (
                  <div
                    key={itemIdx}
                    style={{
                      border: '1px solid var(--slate-200, #e2e8f0)',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      background: '#ffffff',
                    }}
                  >
                    <div
                      style={{
                        padding: '8px 12px',
                        background: 'var(--slate-100, #f1f5f9)',
                        fontWeight: 600,
                        fontSize: '0.8125rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>{item.testName} {item.testCode ? `(${item.testCode})` : ''}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{item.department || 'Clinical Pathology'}</span>
                    </div>

                    {Array.isArray(item.parameterResults) && item.parameterResults.length > 0 ? (
                      <table className="lms-table" style={{ margin: 0, fontSize: '0.8125rem' }}>
                        <thead>
                          <tr style={{ background: '#f8fafc' }}>
                            <th style={{ width: '35%' }}>Parameter</th>
                            <th style={{ width: '25%' }}>Corrected Value</th>
                            <th style={{ width: '15%' }}>Unit</th>
                            <th style={{ width: '25%' }}>Ref. Interval</th>
                          </tr>
                        </thead>
                        <tbody>
                          {item.parameterResults.map((pr, pIdx) => (
                            <tr key={pIdx}>
                              <td style={{ fontWeight: 500 }}>
                                <div>{pr.name || pr.parameterName || pr.parameterCode}</div>
                                {pr.method && <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Method: {pr.method}</span>}
                              </td>
                              <td>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  style={{
                                    padding: '4px 8px',
                                    fontSize: '0.8125rem',
                                    fontWeight: 600,
                                    border: '1.5px solid #94a3b8',
                                    borderRadius: '4px',
                                    width: '100%',
                                  }}
                                  value={pr.value ?? ''}
                                  onChange={(e) => handleCorrectionValueChange(itemIdx, pIdx, 'value', e.target.value)}
                                  placeholder="Enter value..."
                                />
                              </td>
                              <td style={{ color: 'var(--slate-600)' }}>{pr.unit || '—'}</td>
                              <td style={{ color: 'var(--slate-600)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                                {resolveParamInterval(pr)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Test Result:</span>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          style={{
                            maxWidth: '300px',
                            padding: '4px 8px',
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            border: '1.5px solid #94a3b8',
                            borderRadius: '4px',
                          }}
                          value={item.resultValue ?? ''}
                          onChange={(e) => handleCorrectionValueChange(itemIdx, null, 'resultValue', e.target.value)}
                          placeholder="Enter result..."
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Clinical Findings / Notes */}
            <div>
              <label style={{ display: 'block', fontWeight: 700, fontSize: '0.875rem', marginBottom: '4px', color: 'var(--slate-800)' }}>
                Updated Findings / Revision Explanation for Pathologist:
              </label>
              <textarea
                className="form-control"
                rows={3}
                style={{ width: '100%', padding: '8px 10px', fontSize: '0.8125rem', borderRadius: '4px', border: '1.5px solid #94a3b8' }}
                value={correctionFindings}
                onChange={(e) => setCorrectionFindings(e.target.value)}
                placeholder="Explain the changes made (e.g. repeated test, calibrated analyte, corrected typo)..."
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Batch PDF Export Manager Modal */}
      <Modal
        isOpen={isBatchExportOpen}
        onClose={() => setIsBatchExportOpen(false)}
        title="Official Diagnostic Report — Batch PDF Export Manager"
        maxWidth="850px"
      >
        <div style={{ padding: '4px' }}>
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #bae6fd' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0369a1', fontWeight: 600, fontSize: '0.875rem' }}>
              <ShieldCheck size={18} />
              <span>Authorized Batch Report PDF Export ({batchExportQueue.length} Released Reports)</span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: '0.8125rem', color: '#0c4a6e', lineHeight: 1.45 }}>
              All selected reports have been authorized and validated for official export. Because LMS uses high-fidelity client-side print-to-PDF formatting to preserve embedded vector QR verification tokens and tenant signatures, reports are processed sequentially.
            </p>
          </div>

          {/* Progress Indicator */}
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'var(--slate-50)', borderRadius: '8px', border: '1px solid var(--slate-200)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--slate-700)' }}>Export Progress</span>
              <span style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>
                {batchExportedSet.size} of {batchExportQueue.length} Completed
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', background: 'var(--slate-200)', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(batchExportedSet.size / (batchExportQueue.length || 1)) * 100}%`,
                  height: '100%',
                  background: 'var(--teal-600)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>

          {/* Sequential Action Helper */}
          {batchExportQueue.length > 0 && batchExportedSet.size < batchExportQueue.length && (
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#ecfdf5', borderRadius: '8px', border: '1px solid #a7f3d0' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#065f46' }}>
                  Next Report: {batchExportQueue[batchExportCurrentIndex]?.reportNumber} ({batchExportQueue[batchExportCurrentIndex]?.patientName})
                </div>
                <div style={{ fontSize: '0.75rem', color: '#047857' }}>
                  Click to open print preview and trigger your browser's Print-to-PDF dialog.
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ background: '#059669', borderColor: '#059669', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={handleExportCurrentAndAdvance}
              >
                <Printer size={15} />
                <span>Export Report {batchExportCurrentIndex + 1} of {batchExportQueue.length}</span>
              </button>
            </div>
          )}

          {/* Queue Table */}
          <div className="table-container" style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid var(--slate-200)', borderRadius: '6px' }}>
            <table className="lms-table" style={{ fontSize: '0.8125rem' }}>
              <thead>
                <tr>
                  <th>Report #</th>
                  <th>Patient / MRN</th>
                  <th>Diagnostic Test</th>
                  <th>Sanitized Filename</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {batchExportQueue.map((item, idx) => {
                  const isDone = batchExportedSet.has(item.reportId);
                  const cleanNum = String(item.reportNumber || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
                  const filename = `Report_${cleanNum}.pdf`;

                  return (
                    <tr key={item.reportId} style={{ background: idx === batchExportCurrentIndex && !isDone ? '#f0fdf4' : 'transparent' }}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-blue)' }}>
                        {item.reportNumber}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.patientName}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>
                          {item.patientMrn}
                        </div>
                      </td>
                      <td>{item.testName}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--slate-600)' }}>
                        {filename}
                      </td>
                      <td>
                        {isDone ? (
                          <Badge variant="success" icon={CheckCircle2}>Exported</Badge>
                        ) : (
                          <Badge variant="teal">Ready</Badge>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          style={{ padding: '3px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          onClick={() => handleExportItem(item)}
                        >
                          <Download size={13} />
                          <span>{isDone ? 'Re-export' : 'Export PDF'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setIsBatchExportOpen(false);
                setSelectedReportIds(new Set());
              }}
            >
              Done & Close
            </button>
          </div>
        </div>
      </Modal>

      {/* Reusable Confirm Release Modal */}
      <ConfirmModal
        isOpen={releaseConfirmModal.isOpen}
        onClose={() => setReleaseConfirmModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmReleaseAction}
        title={releaseConfirmModal.isBatch ? "Confirm Batch Report Release" : `Release Report ${releaseConfirmModal.reportNumber}`}
        message={
          releaseConfirmModal.isBatch ? (
            <span>
              Are you sure you want to release <strong>{releaseConfirmModal.count} approved report(s)</strong> to the patient portal?
              Once released, official diagnostic records become available for patient viewing and authenticated QR verification.
            </span>
          ) : (
            <span>
              Are you sure you want to release official diagnostic report <strong>{releaseConfirmModal.reportNumber}</strong> to the patient portal?
              Once released, official diagnostic records become available for patient viewing and authenticated QR verification.
            </span>
          )
        }
        confirmText="Release to Patient Portal"
        cancelText="Cancel"
        variant="primary"
        isLoading={actionLoading}
      />
    </>
  );
}

export default ReportsPage;
