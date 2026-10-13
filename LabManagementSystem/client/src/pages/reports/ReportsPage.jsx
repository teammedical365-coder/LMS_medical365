/**
 * Lab Management System (LMS) - Diagnostic Reports Page (Phase 6 Real Verification Workflow)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, CheckCircle2, AlertTriangle, Eye, Printer, Download, PlusCircle, Loader2, ShieldCheck } from 'lucide-react';
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

export function ReportsPage() {
  const { user, tenant } = useAuth();
  const { currentTenant, branding } = useTenant();
  const tenantId = tenant?.tenantId || user?.tenantId;

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
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verificationFindings, setVerificationFindings] = useState('');
  const [verifyError, setVerifyError] = useState(null);

  // Rejection Modal State
  const [rejectModalReport, setRejectModalReport] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectError, setRejectError] = useState(null);

  // Print & QR Code State
  const [printReport, setPrintReport] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  // Batch Selection States
  const [selectedReleaseIds, setSelectedReleaseIds] = useState(new Set());
  const [selectedDownloadIds, setSelectedDownloadIds] = useState(new Set());
  const [filterStatus, setFilterStatus] = useState('all');

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

  const toggleSelectRelease = (reportId) => {
    setSelectedReleaseIds((prev) => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  };

  const toggleSelectAllApproved = () => {
    if (selectedReleaseIds.size === approvedReports.length && approvedReports.length > 0) {
      setSelectedReleaseIds(new Set());
    } else {
      setSelectedReleaseIds(new Set(approvedReports.map((r) => r.reportId)));
    }
  };

  const toggleSelectDownload = (reportId) => {
    setSelectedDownloadIds((prev) => {
      const next = new Set(prev);
      if (next.has(reportId)) next.delete(reportId);
      else next.add(reportId);
      return next;
    });
  };

  const toggleSelectAllReleased = () => {
    if (selectedDownloadIds.size === releasedReports.length && releasedReports.length > 0) {
      setSelectedDownloadIds(new Set());
    } else {
      setSelectedDownloadIds(new Set(releasedReports.map((r) => r.reportId)));
    }
  };

  const [releaseConfirmModal, setReleaseConfirmModal] = useState({
    isOpen: false,
    isBatch: false,
    reportId: null,
    reportNumber: '',
    count: 0,
  });

  const handleOpenBatchRelease = () => {
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
      const res = await clinicalService.batchReleaseReports(tenantId, Array.from(selectedReleaseIds));
      if (res.success) {
        const { releasedCount, failedCount } = res.data;
        notify.success('Report released successfully.');
        setSuccessMsg(
          `Batch Release Completed: ${releasedCount} report(s) released successfully${failedCount > 0 ? `, ${failedCount} failed` : ''}`
        );
        setSelectedReleaseIds(new Set());
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
    if (selectedDownloadIds.size === 0) return;

    try {
      setActionLoading(true);
      setError(null);
      const res = await clinicalService.batchDownloadReports(tenantId, Array.from(selectedDownloadIds));
      if (res.success) {
        const { totalRequested, downloadedCount, failedCount, results } = res.data;
        if (downloadedCount === 0) {
          setError(`No eligible released reports could be prepared for export (${failedCount} failed eligibility checks).`);
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
        findings: findings || 'Microscopic and analyzer examination findings within acceptable reference range.',
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
    setVerificationFindings(r.findings || '');
    setVerificationNotes(r.verificationNotes || '');
    setVerifyError(null);
  };

  const handleConfirmVerification = async (e) => {
    if (e) e.preventDefault();
    if (!verifyReport) return;

    try {
      setActionLoading(true);
      setVerifyError(null);
      const res = await clinicalService.approveReport(tenantId, verifyReport.reportId, {
        findings: verificationFindings,
        verificationNotes,
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
    setRejectError(null);
  };

  const handleConfirmReject = async (e) => {
    if (e) e.preventDefault();
    if (!rejectModalReport) return;
    const trimmed = rejectionReason.trim();
    if (!trimmed || trimmed.length < 5) {
      setRejectError('Please provide a clinical justification for rejecting this report (minimum 5 characters)');
      return;
    }

    try {
      setActionLoading(true);
      setRejectError(null);
      const res = await clinicalService.rejectReport(tenantId, rejectModalReport.reportId, { reason: trimmed });
      if (res.success) {
        setSuccessMsg(`Report ${res.data?.reportNumber || rejectModalReport.reportNumber} rejected and returned for technician correction`);
        setRejectModalReport(null);
        if (verifyReport) setVerifyReport(null);
        await fetchReports();
        if (selectedReport && selectedReport.reportId === rejectModalReport.reportId) {
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

  const handleApprove = async (reportId) => {
    try {
      setActionLoading(true);
      const res = await clinicalService.approveReport(tenantId, reportId);
      if (res.success) {
        notify.success('Changes saved successfully.');
        setSuccessMsg(`Report ${res.data.reportNumber} verified and approved`);
        fetchReports();
        if (selectedReport && selectedReport.reportId === reportId) {
          setSelectedReport(res.data);
        }
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      notify.error(err, { fallback: 'Failed to approve report' });
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

  const openPrintModal = (r) => {
    if (!r) return;
    if (r.status !== 'released') {
      notify.warning(`Report ${r.reportNumber} is currently in '${r.status}' state. Official print layouts with public authenticity QR verification are only generated for officially Released reports.`);
      return;
    }
    setPrintReport(r);
    if (r.verificationToken) {
      const verifyUrl = `${window.location.origin}/verify/${r.verificationToken}`;
      QRCode.toDataURL(verifyUrl, { width: 140, margin: 1, errorCorrectionLevel: 'M' })
        .then((url) => setQrCodeDataUrl(url))
        .catch((err) => {
          console.error('Failed to generate verification QR code', err);
          setQrCodeDataUrl('');
        });
    } else {
      setQrCodeDataUrl('');
    }
  };

  const handleDownloadPdf = async (r) => {
    if (!r) return;
    if (r.status !== 'released') {
      notify.warning(`Report ${r.reportNumber} is currently in '${r.status}' state. Official PDF download is strictly permitted only for finalized and Released reports.`);
      return;
    }

    try {
      // 1. Authorize download through backend endpoint
      await clinicalService.downloadReport(tenantId, r.reportId);
    } catch (err) {
      notify.error(err, { fallback: 'Unauthorized to download this report' });
      return;
    }

    // 2. Open printable view with QR code and A4 layout
    openPrintModal(r);

    // 3. Set sanitized safe title for browser "Save as PDF"
    const cleanNum = String(r.reportNumber || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeTitle = `Diagnostic_Report_${cleanNum}`;
    const prevTitle = document.title;
    document.title = safeTitle;

    setTimeout(() => {
      window.print();
      setTimeout(() => {
        document.title = prevTitle;
      }, 1200);
    }, 350);
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
      {/* Haldi (Turmeric) Themed Banner for Diagnostic Pathology Reports */}
      <div
        className="reports-hero-banner"
        style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 55%, #fef9c3 100%)',
          border: '1px solid #fde68a',
          borderRadius: '14px',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.25rem',
          boxShadow: '0 2px 10px rgba(217, 119, 6, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', zIndex: 1 }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: '#fef3c7',
              border: '1.5px solid #fcd34d',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#b45309',
              boxShadow: '0 2px 5px rgba(217, 119, 6, 0.12)',
              flexShrink: 0,
            }}
          >
            <FileText size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1
                style={{
                  fontSize: '1.35rem',
                  fontWeight: 800,
                  color: '#78350f',
                  margin: 0,
                  letterSpacing: '-0.02em',
                }}
              >
                Diagnostic Pathology Reports
              </h1>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  background: '#fde68a',
                  color: '#92400e',
                  border: '1px solid #fcd34d',
                }}
              >
                Verification & Sign-off
              </span>
            </div>
            <p
              style={{
                fontSize: '0.825rem',
                color: '#92400e',
                margin: '3px 0 0',
                fontWeight: 500,
              }}
            >
              Pathologist clinical result verification, diagnostic findings sign-off, and official report release.
            </p>
          </div>
        </div>

        {/* Action Controls (Draft Report removed as requested) */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', zIndex: 1 }}>
          {releasedReports.length > 0 && (
            <button
              className="btn btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#ffffff',
                borderColor: '#fde68a',
                color: '#78350f',
                fontWeight: 600,
              }}
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
              style={{
                background: 'var(--teal-600)',
                borderColor: 'var(--teal-600)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 700,
              }}
              disabled={selectedReleaseIds.size === 0 || actionLoading}
              onClick={handleOpenBatchRelease}
              title="Batch release selected approved reports"
            >
              <CheckCircle2 size={16} />
              <span>Release Selected ({selectedReleaseIds.size})</span>
            </button>
          )}
        </div>
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
                onClick={() => setFilterStatus(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {releasedReports.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                onClick={toggleSelectAllReleased}
              >
                {selectedDownloadIds.size === releasedReports.length ? 'Clear Released' : `Select All Released (${releasedReports.length})`}
              </button>
            )}
            {canRelease && approvedReports.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                onClick={toggleSelectAllApproved}
              >
                {selectedReleaseIds.size === approvedReports.length ? 'Clear Approved' : `Select All Approved (${approvedReports.length})`}
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
              Click "Draft Report" to initiate clinical findings for an order.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="lms-table">
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={
                        filterStatus === 'released'
                          ? releasedReports.length > 0 && selectedDownloadIds.size === releasedReports.length
                          : filterStatus === 'approved'
                          ? approvedReports.length > 0 && selectedReleaseIds.size === approvedReports.length
                          : releasedReports.length > 0 && selectedDownloadIds.size === releasedReports.length
                      }
                      onChange={() => {
                        if (filterStatus === 'approved') toggleSelectAllApproved();
                        else toggleSelectAllReleased();
                      }}
                      disabled={reports.length === 0}
                      title="Toggle select all eligible reports"
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
                {(filterStatus === 'all'
                  ? reports
                  : filterStatus === 'draft'
                  ? reports.filter((r) => r.status === 'draft' || r.status === 'pending_review')
                  : reports.filter((r) => r.status === filterStatus)).map((r) => (
                  <tr key={r.reportId || r._id}>
                    <td style={{ textAlign: 'center' }}>
                      {r.status === 'released' ? (
                        <input
                          type="checkbox"
                          checked={selectedDownloadIds.has(r.reportId)}
                          onChange={() => toggleSelectDownload(r.reportId)}
                          title={`Select ${r.reportNumber} for batch PDF download`}
                        />
                      ) : r.status === 'approved' ? (
                        canRelease ? (
                          <input
                            type="checkbox"
                            checked={selectedReleaseIds.has(r.reportId)}
                            onChange={() => toggleSelectRelease(r.reportId)}
                            title={`Select ${r.reportNumber} for batch release`}
                          />
                        ) : (
                          <input
                            type="checkbox"
                            disabled
                            title="Permission required to batch release"
                            style={{ opacity: 0.25, cursor: 'not-allowed' }}
                          />
                        )
                      ) : (
                        <input
                          type="checkbox"
                          disabled
                          title="Only released reports can be downloaded, and approved reports released"
                          style={{ opacity: 0.25, cursor: 'not-allowed' }}
                        />
                      )}
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
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => openVerifyModal(r)}
                              disabled={actionLoading}
                              title="Pathologist clinical review and verification"
                            >
                              <ShieldCheck size={14} />
                              <span>Review & Verify</span>
                            </button>
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
                            {it.parameterResults.map((pr, pidx) => (
                              <tr key={pidx} style={{ background: pr.isAbnormal ? '#fff1f2' : undefined }}>
                                <td style={{ fontWeight: 500 }}>{pr.name || pr.parameterCode}</td>
                                <td style={{ fontWeight: 600, color: pr.isAbnormal ? '#e11d48' : 'inherit' }}>
                                  {String(pr.value)} {pr.unit}
                                </td>
                                <td style={{ color: 'var(--slate-500)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                  {pr.referenceRange || 'N/A'}
                                </td>
                                <td>
                                  {pr.isAbnormal ? (
                                    <Badge variant="danger">Abnormal</Badge>
                                  ) : (
                                    <Badge variant="success">Normal</Badge>
                                  )}
                                </td>
                              </tr>
                            ))}
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
        onClose={() => setVerifyReport(null)}
        title={verifyReport ? `Review & Verify Pathology Report: ${verifyReport.reportNumber}` : ''}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setVerifyReport(null)} disabled={actionLoading}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              style={{ background: 'var(--danger-600, #dc2626)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => {
                const rep = verifyReport;
                setVerifyReport(null);
                openRejectModal(rep);
              }}
              disabled={actionLoading}
              title="Reject report with clinical justification"
            >
              <AlertTriangle size={15} />
              <span>Reject Report</span>
            </button>
            <button
              className="btn btn-primary"
              onClick={handleConfirmVerification}
              disabled={
                actionLoading ||
                !verifyReport?.items ||
                verifyReport.items.length === 0 ||
                verifyReport.items.some(
                  (it) => (!it.parameterResults || it.parameterResults.length === 0) && (!it.resultValue || String(it.resultValue).trim() === '')
                )
              }
            >
              {actionLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Verifying Report...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>Confirm Verification & Sign-off</span>
                </>
              )}
            </button>
          </>
        }
      >
        {verifyReport && (() => {
          const items = Array.isArray(verifyReport.items) ? verifyReport.items : [];
          const hasMissingResults =
            items.length === 0 ||
            items.some(
              (it) => (!it.parameterResults || it.parameterResults.length === 0) && (!it.resultValue || String(it.resultValue).trim() === '')
            );
          const hasAbnormal = items.some(
            (it) => it.isAbnormal || it.parameterResults?.some((pr) => pr.isAbnormal)
          );

          return (
            <form onSubmit={handleConfirmVerification} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
              {/* Patient / Requisition Context Banner */}
              <div style={{ padding: '0.75rem', background: 'var(--slate-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8125rem' }}>
                  <div>Patient: <strong>{verifyReport.patientName}</strong> ({verifyReport.patientMrn})</div>
                  <div>Requisition: <strong>{verifyReport.orderNumber}</strong></div>
                  <div>Diagnostic Panel: <strong>{verifyReport.testName}</strong></div>
                  <div>Drafted By: <strong>{verifyReport.draftedBy}</strong></div>
                </div>
              </div>

              {/* Status and Clinical Warnings */}
              {verifyError && (
                <div style={{ padding: '0.625rem 0.875rem', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 'var(--radius-md)', color: '#be123c', fontSize: '0.8125rem' }}>
                  <strong>Verification Error:</strong> {verifyError}
                </div>
              )}

              {hasMissingResults && (
                <div style={{ padding: '0.625rem 0.875rem', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 'var(--radius-md)', color: '#be123c', fontSize: '0.8125rem' }}>
                  <strong>Incomplete Clinical Data:</strong> One or more tests in this requisition are missing diagnostic results. Pathologist verification is disabled until all results are entered.
                </div>
              )}

              {hasAbnormal && !hasMissingResults && (
                <div style={{ padding: '0.625rem 0.875rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-md)', color: '#b45309', fontSize: '0.8125rem' }}>
                  <strong>Pathological Alert:</strong> One or more analyte parameters are outside normal physiological reference ranges. Please evaluate clinical implications before approval.
                </div>
              )}

              {/* Structured Parameter Inspection Table */}
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '6px', fontWeight: 600 }}>
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
                            {it.parameterResults.map((pr, pidx) => (
                              <tr key={pidx} style={{ background: pr.isAbnormal ? '#fff1f2' : undefined }}>
                                <td style={{ fontWeight: 500 }}>{pr.name || pr.parameterCode}</td>
                                <td style={{ fontWeight: 600, color: pr.isAbnormal ? '#e11d48' : 'inherit' }}>
                                  {String(pr.value)} {pr.unit}
                                </td>
                                <td style={{ color: 'var(--slate-500)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                  {pr.referenceRange || 'N/A'}
                                </td>
                                <td>
                                  {pr.isAbnormal ? (
                                    <Badge variant="danger">Abnormal</Badge>
                                  ) : (
                                    <Badge variant="success">Normal</Badge>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ padding: '8px 12px', fontSize: '0.8125rem', color: 'var(--slate-600)' }}>
                          Result: <strong>{it.resultValue || 'Awaiting entry'}</strong>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Pathologist Clinical Interpretation */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Diagnostic Findings & Clinical Interpretation *</label>
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
                <label className="form-label">Pathologist Sign-off / Verification Notes (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Findings verified and approved. Cleared for release."
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                />
              </div>

              <div style={{ padding: '0.5rem 0.75rem', background: 'var(--slate-100)', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', color: 'var(--slate-600)' }}>
                <span>Verified By: <strong>{user?.fullName || user?.email || 'Pathologist'}</strong> (Pathology Consultant). </span>
                <span style={{ color: 'var(--slate-500)' }}>Verification moves report to Approved status. Official report release remains a separate step.</span>
              </div>
            </form>
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
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--slate-600)' }}>
              Standard A4 Clinical Report with Digitally Signed Verification QR Code.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-primary"
                onClick={() => window.print()}
              >
                <Printer size={15} />
                <span>Print Official Report</span>
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => handleDownloadPdf(printReport)}
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
                  padding: 10mm 15mm !important;
                  background: #ffffff !important;
                  color: #000000 !important;
                  box-shadow: none !important;
                  border: none !important;
                  z-index: 999999 !important;
                }
                .no-print {
                  display: none !important;
                }
                @page {
                  size: A4 portrait;
                  margin: 10mm;
                }
              }
            `}</style>

            <div
              id="official-report-printable"
              style={{
                background: '#ffffff',
                color: '#0f172a',
                padding: '24px',
                border: '1px solid var(--slate-300)',
                borderRadius: '8px',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: '0.875rem',
              }}
            >
              {/* Header with Lab Branding */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  paddingBottom: '16px',
                  borderBottom: '2px solid #0f172a',
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.375rem', fontWeight: 800, color: '#0f172a' }}>
                    {branding?.displayName || currentTenant?.name || 'Medical365 Reference Laboratory'}
                  </h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.8125rem', color: '#475569' }}>
                    Accredited Department of Clinical Pathology & Diagnostics
                  </p>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                    Quality Management Standard ISO 15189 Compliant
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      display: 'inline-block',
                      background: '#0f172a',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      letterSpacing: '0.5px',
                    }}
                  >
                    OFFICIAL DIAGNOSTIC REPORT
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '0.8125rem', color: '#0f172a', fontWeight: 600 }}>
                    Status: <span style={{ color: '#16a34a' }}>RELEASED</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Released: {printReport.releasedAt ? new Date(printReport.releasedAt).toLocaleString() : 'Recent'}
                  </div>
                </div>
              </div>

              {/* Patient & Requisition Demographics */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '12px',
                  padding: '12px 16px',
                  background: '#f8fafc',
                  borderBottom: '1px solid #cbd5e1',
                  margin: '12px 0 16px 0',
                  borderRadius: '4px',
                }}
              >
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase' }}>Patient Name</span>
                  <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{printReport.patientName}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase' }}>Patient MRN</span>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{printReport.patientMrn}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase' }}>Report Identifier</span>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#0369a1' }}>{printReport.reportNumber}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase' }}>Requisition Order</span>
                  <div style={{ fontWeight: 600, fontFamily: 'monospace' }}>{printReport.orderNumber}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase' }}>Diagnostic Investigation</span>
                  <div style={{ fontWeight: 600 }}>{printReport.testName}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', textTransform: 'uppercase' }}>Release Date</span>
                  <div style={{ fontWeight: 600 }}>
                    {printReport.releasedAt ? new Date(printReport.releasedAt).toLocaleDateString() : new Date().toLocaleDateString()}
                  </div>
                </div>
              </div>

              {/* Parameter & Analyte Results Section */}
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', borderBottom: '1px solid #0f172a', paddingBottom: '4px', marginBottom: '8px' }}>
                  CLINICAL LABORATORY INVESTIGATION RESULTS
                </div>

                {printReport.items && printReport.items.length > 0 ? (
                  printReport.items.map((it, idx) => (
                    <div key={idx} style={{ marginBottom: '12px', pageBreakInside: 'avoid' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.8125rem', background: '#f1f5f9', padding: '4px 8px', marginBottom: '4px' }}>
                        {it.testName} ({it.testCode})
                      </div>

                      {Array.isArray(it.parameterResults) && it.parameterResults.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#475569' }}>
                              <th style={{ padding: '4px 8px', width: '35%' }}>Analyte / Parameter</th>
                              <th style={{ padding: '4px 8px', width: '20%' }}>Observed Result</th>
                              <th style={{ padding: '4px 8px', width: '15%' }}>Units</th>
                              <th style={{ padding: '4px 8px', width: '20%' }}>Reference Range</th>
                              <th style={{ padding: '4px 8px', width: '10%' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {it.parameterResults.map((pr, pIdx) => (
                              <tr
                                key={pIdx}
                                style={{
                                  borderBottom: '1px dotted #e2e8f0',
                                  background: pr.abnormalFlag ? '#fef2f2' : 'transparent',
                                }}
                              >
                                <td style={{ padding: '4px 8px', fontWeight: 500 }}>{pr.parameterName}</td>
                                <td
                                  style={{
                                    padding: '4px 8px',
                                    fontWeight: 700,
                                    color: pr.abnormalFlag ? '#dc2626' : '#0f172a',
                                  }}
                                >
                                  {pr.value}
                                </td>
                                <td style={{ padding: '4px 8px', color: '#64748b' }}>{pr.unit || '—'}</td>
                                <td style={{ padding: '4px 8px', color: '#475569' }}>{pr.referenceRange || 'Standard'}</td>
                                <td style={{ padding: '4px 8px' }}>
                                  {pr.abnormalFlag ? (
                                    <span style={{ color: '#dc2626', fontWeight: 700, fontSize: '0.75rem' }}>
                                      {pr.flagType || 'HIGH'}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#16a34a', fontSize: '0.75rem' }}>NORMAL</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div style={{ padding: '4px 8px', fontSize: '0.8125rem' }}>
                          Result Value: <strong>{it.resultValue || 'Completed'}</strong>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '8px', color: '#64748b' }}>No test parameters recorded.</div>
                )}
              </div>

              {/* Pathologist Findings & Notes */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  pageBreakInside: 'avoid',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#0f172a', marginBottom: '4px' }}>
                  CLINICAL IMPRESSION & INTERPRETATION
                </div>
                <div style={{ fontSize: '0.8125rem', color: '#334155', lineHeight: '1.4' }}>
                  {printReport.findings || 'Specimen processed normally without pathological flags.'}
                </div>
                {printReport.verificationNotes && (
                  <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                    Pathologist Sign-off Note: {printReport.verificationNotes}
                  </div>
                )}
              </div>

              {/* Sign-Off & Verification Footer */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid #cbd5e1',
                  marginBottom: '16px',
                  pageBreakInside: 'avoid',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Reviewing & Verifying Pathologist:</div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                    {printReport.reviewedBy || 'Consultant Pathologist, FRCPath'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Verified on:{' '}
                    {printReport.verifiedAt ? new Date(printReport.verifiedAt).toLocaleString() : 'Recorded'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Authorizing Laboratory Officer:</div>
                  <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                    {printReport.releasedBy || 'Laboratory Director'}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Released on:{' '}
                    {printReport.releasedAt ? new Date(printReport.releasedAt).toLocaleString() : 'Recorded'}
                  </div>
                </div>
              </div>

              {/* Digital QR Code Authenticity Section */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '12px 16px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  pageBreakInside: 'avoid',
                }}
              >
                {qrCodeDataUrl ? (
                  <img
                    src={qrCodeDataUrl}
                    alt="Authenticity QR Code"
                    style={{ width: '84px', height: '84px', flexShrink: 0, borderRadius: '4px' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '84px',
                      height: '84px',
                      background: '#e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6875rem',
                      textAlign: 'center',
                      color: '#64748b',
                    }}
                  >
                    Verification QR
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#0f172a' }}>
                    DIGITAL VERIFICATION & AUDIT TRAIL
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '2px' }}>
                    Scan QR code or visit public verification portal to validate the authenticity of this official report.
                  </div>
                  <div
                    style={{
                      fontSize: '0.6875rem',
                      fontFamily: 'monospace',
                      color: '#0369a1',
                      marginTop: '4px',
                      wordBreak: 'break-all',
                    }}
                  >
                    {printReport.verificationToken
                      ? `${window.location.origin}/verify/${printReport.verificationToken}`
                      : 'Verified Report'}
                  </div>
                </div>
              </div>

              <div
                style={{
                  textAlign: 'center',
                  marginTop: '12px',
                  fontSize: '0.6875rem',
                  color: '#94a3b8',
                }}
              >
                *** End of Official Diagnostic Pathology Report — Confidential Medical Record ***
              </div>
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
                setSelectedDownloadIds(new Set());
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
