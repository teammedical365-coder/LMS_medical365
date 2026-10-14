/**
 * Lab Management System (LMS) - Specimen & Samples Page (Phase 6 Deepening)
 * 
 * ISO 15189 Clinical Laboratory Compliant:
 * - Multi-Tube Specimen Bench with tube derivation (e.g. Tube 1/2) and test badges
 * - Strict Sequential State Validation: Specimen MUST be received before analysis
 * - Separation of Duties (SoD) Bench Actions Matrix:
 *   - Phlebotomist: Collect, Label, Info ONLY
 *   - Lab Technician: Receive, Analyze (guarded), Reject, Info ONLY (NO Collect, NO primary Label)
 * - Result Entry & Analyte Feeding Modal integration
 * - Consultant Pathologist Review & Sign-Off Queue with digital signature authorization
 * - 50 x 25 mm Code 128 Printable Barcode Labels with preview and thermal print engine
 * - Clinical Specimen Rejection modal with mandatory clinical reasons
 * - Actionable Recollection Queue with replacement tube generation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  FlaskConical, 
  QrCode, 
  Search, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Loader2, 
  Printer, 
  RotateCcw, 
  XCircle, 
  CheckSquare, 
  Layers, 
  Info,
  Calendar,
  Building2,
  Tag,
  FileCheck,
  ShieldCheck,
  CheckCircle2,
  FileText,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import clinicalService from '../../services/clinicalService';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ResultEntryModal from './ResultEntryModal';
import notify from '../../utils/notify';

export function SamplesPage() {
  const { user, tenant } = useAuth();
  const tenantId = tenant?.tenantId || user?.tenantId;

  // Separation of Duties (SoD) Role Alignment
  const userRole = (user?.role || '').toLowerCase();
  const roleDef = user?.roleDefinition || null;
  const userPermissions = user?.permissions || roleDef?.permissions || [];
  const isSuperAdmin = user?.accountType === 'PLATFORM_SUPER_ADMIN';

  const isLabAdmin =
    Boolean(isSuperAdmin) ||
    userRole === 'lab_admin' ||
    userRole === 'lab_director' ||
    userPermissions.includes('*');

  // Phlebotomist / Sample Collector Role Guard
  const isSampleCollector =
    !isLabAdmin &&
    (userRole === 'sample_collection' ||
      userRole === 'phlebotomist' ||
      userRole === 'sample_collector' ||
      userRole === 'phlebotomy' ||
      (userPermissions.includes('samples:collect') &&
        !userPermissions.includes('samples:process') &&
        !userPermissions.includes('samples:receive')));

  // Laboratory Technician (Bench testing & Data Entry)
  const isLabTechnician =
    !isLabAdmin &&
    (userRole === 'lab_technician' ||
      userRole === 'technician' ||
      (userPermissions.includes('samples:process') &&
        !userPermissions.includes('reports:verify')));

  // Consultant Pathologist (Verification & Sign-off)
  const isPathologist =
    isLabAdmin ||
    userRole === 'pathologist' ||
    userRole === 'consultant_pathologist' ||
    userPermissions.includes('reports:verify');

  const [activeTab, setActiveTab] = useState('bench'); // 'bench' | 'recollections' | 'verification'
  const [samples, setSamples] = useState([]);
  const [recollections, setRecollections] = useState([]);
  const [reports, setReports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Result Entry Modal state
  const [resultEntrySample, setResultEntrySample] = useState(null);

  // Pathologist Sign-Off Modal state
  const [signOffReport, setSignOffReport] = useState(null);
  const [signOffStep, setSignOffStep] = useState('review'); // 'review' | 'confirm_reject'
  const [signOffRejectionReason, setSignOffRejectionReason] = useState('');
  const [signOffFindings, setSignOffFindings] = useState('');
  const [signOffNotes, setSignOffNotes] = useState('');
  const [signOffAgreed, setSignOffAgreed] = useState(false);
  const [isSigningOff, setIsSigningOff] = useState(false);
  const [signOffError, setSignOffError] = useState(null);

  // Modals state
  const [selectedSample, setSelectedSample] = useState(null);
  const [labelModalData, setLabelModalData] = useState(null);
  const [isLabelLoading, setIsLabelLoading] = useState(false);
  const [rejectionTargetSample, setRejectionTargetSample] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('Hemolysis');
  const [rejectionNotes, setRejectionNotes] = useState('');

  const fetchSamples = useCallback(async () => {
    if (!tenantId) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await clinicalService.getSamples(tenantId);
      if (res.success && Array.isArray(res.data)) {
        setSamples(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve specimen records');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  const fetchRecollections = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await clinicalService.getRecollectionTasks(tenantId);
      if (res.success && Array.isArray(res.data)) {
        setRecollections(res.data);
      }
    } catch {
      // Non-blocking for recollections
    }
  }, [tenantId]);

  const fetchReports = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await clinicalService.getReports(tenantId);
      if (res.success && Array.isArray(res.data)) {
        setReports(res.data);
      }
    } catch {
      // Non-blocking for reports
    }
  }, [tenantId]);

  useEffect(() => {
    fetchSamples();
    fetchRecollections();
    fetchReports();
  }, [fetchSamples, fetchRecollections, fetchReports]);

  const handleUpdateStatus = async (sampleId, updates) => {
    try {
      setActionLoading(true);
      setError(null);
      const res = await clinicalService.updateSampleStatus(tenantId, sampleId, updates);
      if (res.success) {
        const msg = `Sample ${res.data.barcode} status updated successfully`;
        setSuccessMsg(msg);
        notify.success(msg);
        await fetchSamples();
        await fetchRecollections();
        await fetchReports();
        if (selectedSample && selectedSample.sampleId === sampleId) {
          setSelectedSample(res.data);
        }
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch (err) {
      notify.error(err, { fallback: 'Failed to transition sample status' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenRejection = (sample) => {
    setRejectionTargetSample(sample);
    setRejectionReason('Hemolysis');
    setRejectionNotes('');
  };

  const handleConfirmRejection = async () => {
    if (!rejectionTargetSample) return;
    if (!rejectionReason.trim()) {
      notify.error('A clinical rejection reason is mandatory');
      return;
    }
    try {
      setActionLoading(true);
      setError(null);
      const res = await clinicalService.updateSampleStatus(tenantId, rejectionTargetSample.sampleId, {
        collectionStatus: 'rejected',
        rejectionReason: rejectionReason.trim(),
        rejectionNotes: rejectionNotes.trim(),
      });
      if (res.success) {
        const msg = `Specimen ${rejectionTargetSample.barcode} rejected. Recollection task generated.`;
        setSuccessMsg(msg);
        notify.success(msg);
        setRejectionTargetSample(null);
        await fetchSamples();
        await fetchRecollections();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      notify.error(err, { fallback: 'Failed to reject specimen' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenLabel = async (sample) => {
    try {
      setIsLabelLoading(true);
      const res = await clinicalService.getSampleLabel(tenantId, sample.sampleId);
      if (res.success && res.data) {
        setLabelModalData(res.data);
      }
    } catch (err) {
      notify.error(err, { fallback: 'Failed to generate barcode label' });
    } finally {
      setIsLabelLoading(false);
    }
  };

  const printLabelHtml = (labelData) => {
    if (!labelData) return;
    const printWindow = window.open('', '_blank', 'width=520,height=340');
    if (!printWindow) {
      notify.warning('Please allow popups to print barcode labels');
      return;
    }

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours() % 12 || 12).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
    const realTimeTimestamp = `${day}/${month}/${year} ${hours}:${minutes}:${seconds} ${ampm}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Specimen Label - ${labelData.barcode}</title>
          <style>
            @page {
              size: 60mm 25mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              width: 60mm;
              height: 25mm;
              padding: 1.5mm 2.5mm;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              background: #fff;
              color: #000;
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              overflow: hidden;
            }
            .hdr {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 7.5pt;
              font-weight: 800;
              line-height: 1.1;
              border-bottom: 0.5px solid #000;
              padding-bottom: 0.5mm;
            }
            .hdr-lab {
              text-transform: uppercase;
              letter-spacing: 0.2px;
              max-width: 42mm;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .hdr-tube {
              font-size: 6.5pt;
              background: #000;
              color: #fff;
              padding: 0.2mm 1.5mm;
              border-radius: 1px;
              font-weight: 800;
            }
            .patient-row {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
              font-size: 7.5pt;
              line-height: 1.1;
              margin-top: 0.5mm;
            }
            .patient-name {
              font-weight: 800;
              max-width: 38mm;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .patient-mrn {
              font-family: monospace;
              font-size: 7pt;
              font-weight: 800;
            }
            .barcode-wrap {
              width: 100%;
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 0.3mm 0;
            }
            .barcode-wrap svg {
              width: 100%;
              height: 11mm;
              display: block;
            }
            .ftr {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              font-size: 6pt;
              line-height: 1.1;
              border-top: 0.5px solid #000;
              padding-top: 0.5mm;
            }
            .ftr-tests {
              font-weight: 700;
              max-width: 28mm;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .ftr-date {
              font-family: monospace;
              font-size: 6.5pt;
              font-weight: 800;
              color: #000;
              white-space: nowrap;
            }
          </style>
        </head>
        <body>
          <div class="hdr">
            <span class="hdr-lab">${labelData.labName || 'LABORATORY'}</span>
            <span class="hdr-tube">${labelData.tubeTag || 'Tube 1/1'}</span>
          </div>
          <div class="patient-row">
            <span class="patient-name">${labelData.patientName || 'Patient'}</span>
            <span class="patient-mrn">${labelData.patientMrn || ''}</span>
          </div>
          <div class="barcode-wrap">
            ${labelData.svg}
          </div>
          <div class="ftr">
            <div class="ftr-tests">${labelData.container || 'Specimen'} | ${labelData.testsSummary || ''}</div>
            <div class="ftr-date">${realTimeTimestamp}</div>
          </div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
              setTimeout(function() { window.close(); }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleResolveRecollection = async (taskId) => {
    const notes = prompt('Enter recollection notes (e.g. "Recollected by phlebotomist"):', 'Recollected');
    if (notes === null) return;
    try {
      setActionLoading(true);
      setError(null);
      const res = await clinicalService.resolveRecollectionTask(tenantId, taskId, {
        phlebotomistNotes: notes,
      });
      if (res.success) {
        const msg = `Recollection resolved. New replacement tube ${res.data.replacementBarcode} generated.`;
        setSuccessMsg(msg);
        notify.success(msg);
        await fetchSamples();
        await fetchRecollections();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      notify.error(err, { fallback: 'Failed to resolve recollection task' });
    } finally {
      setActionLoading(false);
    }
  };

  // Result Entry Success Handler
  const handleResultEntrySuccess = async (data) => {
    const msg = `Results recorded for specimen ${resultEntrySample?.barcode}. Pushed to Pathologist Review & Sign-Off Queue.`;
    setSuccessMsg(msg);
    notify.success(msg);
    setResultEntrySample(null);
    await fetchSamples();
    await fetchReports();
    setTimeout(() => setSuccessMsg(null), 4000);
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

  // Pathologist Review Modal Open Handler
  const handleOpenSignOff = (report) => {
    setSignOffReport(report);
    setSignOffStep('review');
    setSignOffRejectionReason('');
    setSignOffFindings(report.findings || 'All analyte test parameters correlated and within expected clinical limits.');
    setSignOffNotes(report.verificationNotes || 'Diagnostic findings correlate clinically. Verified under laboratory quality protocol.');
    setSignOffAgreed(false);
    setSignOffError(null);
  };

  // Pathologist Sign-Off Confirm Handler
  const handleConfirmSignOff = async (e) => {
    if (e) e.preventDefault();
    if (!signOffReport) return;
    const comp = checkReportCompleteness(signOffReport);
    if (!comp.isComplete) {
      setSignOffError(`Cannot authorize report: missing diagnostic results for ${comp.missingItems.join(', ')}.`);
      return;
    }
    if (!signOffAgreed) {
      setSignOffError('Please confirm the pathologist digital authorization statement before signing.');
      return;
    }

    try {
      setIsSigningOff(true);
      setSignOffError(null);
      const res = await clinicalService.approveReport(tenantId, signOffReport.reportId, {
        findings: signOffFindings.trim(),
        verificationNotes: signOffNotes.trim(),
        notes: signOffNotes.trim(),
        verifiedBy: user?.fullName || user?.email || 'Consultant Pathologist',
      });
      if (res.success) {
        const signOffMsg = `Diagnostic Report ${res.data.reportNumber} digitally signed & authorized by Consultant Pathologist.`;
        setSuccessMsg(signOffMsg);
        notify.success(signOffMsg);
        setSignOffReport(null);
        await fetchReports();
        await fetchSamples();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setSignOffError(err.response?.data?.message || err.message || 'Failed to sign off report');
      notify.error(err, { fallback: 'Failed to sign off report' });
    } finally {
      setIsSigningOff(false);
    }
  };

  // Pathologist Sign-Off Rejection Handler
  const handleConfirmSignOffRejection = async (e) => {
    if (e) e.preventDefault();
    if (!signOffReport) return;
    const reason = signOffRejectionReason.trim();
    if (!reason || reason.length < 5) {
      setSignOffError('Please enter a clinical justification for rejecting this report (minimum 5 characters).');
      return;
    }

    try {
      setIsSigningOff(true);
      setSignOffError(null);
      const res = await clinicalService.rejectReport(tenantId, signOffReport.reportId, { reason });
      if (res.success) {
        setSuccessMsg(`Diagnostic Report ${res.data?.reportNumber || signOffReport.reportNumber} rejected and returned for technician revision.`);
        setSignOffReport(null);
        await fetchReports();
        await fetchSamples();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      setSignOffError(err.response?.data?.message || err.message || 'Failed to reject report');
    } finally {
      setIsSigningOff(false);
    }
  };

  const handleScannerEnter = async (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = searchTerm.trim();
      if (!query) return;

      const localMatch = samples.find(
        (s) => s.barcode?.toUpperCase() === query.toUpperCase() || s.sampleId === query
      );
      if (localMatch) {
        setSelectedSample(localMatch);
        notify.success(`Specimen found: ${localMatch.barcode} (${localMatch.patientName})`);
        return;
      }

      try {
        const res = await clinicalService.getSampleById(tenantId, query);
        if (res.data) {
          setSamples((prev) => [res.data, ...prev.filter((s) => s.sampleId !== res.data.sampleId)]);
          setSelectedSample(res.data);
          notify.success(`Specimen found: ${res.data.barcode} (${res.data.patientName})`);
        }
      } catch (err) {
        notify.error(err, { fallback: `Barcode '${query}' not found in laboratory records` });
      }
    }
  };

  // Filtering for Active Bench
  const filteredSamples = samples.filter((s) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (s.barcode || '').toLowerCase().includes(term) ||
      (s.patientName || '').toLowerCase().includes(term) ||
      (s.patientMrn || '').toLowerCase().includes(term) ||
      (s.orderNumber || '').toLowerCase().includes(term) ||
      (s.container || '').toLowerCase().includes(term);

    if (!matchesSearch) return false;
    if (statusFilter === 'PENDING') return s.collectionStatus === 'pending';
    if (statusFilter === 'COLLECTED') return s.collectionStatus === 'collected';
    if (statusFilter === 'RECEIVED') return s.collectionStatus === 'received';
    if (statusFilter === 'REJECTED') return s.collectionStatus === 'rejected';
    return true;
  });

  const pendingRecollectionsCount = recollections.filter((r) => r.status === 'pending').length;

  // Filter reports pending pathologist review
  const pendingVerificationReports = reports.filter(
    (r) => r.status === 'pending_review' || (r.status === 'draft' && Array.isArray(r.items) && r.items.some((it) => it.parameterResults?.length > 0))
  );

  const getCollectionBadge = (status) => {
    switch (status) {
      case 'received': return <Badge variant="blue">Received in Lab</Badge>;
      case 'collected': return <Badge variant="teal">Collected</Badge>;
      case 'rejected': return <Badge variant="danger">Rejected</Badge>;
      default: return <Badge variant="slate">Pending Collection</Badge>;
    }
  };

  const getProcessingBadge = (status) => {
    switch (status) {
      case 'completed': return <Badge variant="success">Completed</Badge>;
      case 'results_entered': return <Badge variant="purple">Pending Verification</Badge>;
      case 'in_analysis': return <Badge variant="purple">In Analysis</Badge>;
      case 'recollection_requested': return <Badge variant="danger">Recollection Requested</Badge>;
      case 'rejected': return <Badge variant="danger">Rejected</Badge>;
      default: return <Badge variant="warning">Pending Analysis</Badge>;
    }
  };

  return (
    <>
      <PageHeader
        title="Specimen Accessioning & Sample Tracking"
        description="Multi-tube specimen derivation, Code 128 barcode labelling, laboratory receipt triage, result entry, and pathologist sign-off."
      />

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

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
        <button
          className={`btn ${activeTab === 'bench' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('bench')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <FlaskConical size={14} />
          Active Specimen Bench ({samples.length})
        </button>

        <button
          className={`btn ${activeTab === 'verification' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('verification')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <FileCheck size={14} />
          Pathologist Verification Queue
          {pendingVerificationReports.length > 0 && (
            <span style={{ 
              background: 'var(--purple-600, #9333ea)', 
              color: '#fff', 
              fontSize: '0.7rem', 
              fontWeight: 700, 
              padding: '1px 6px', 
              borderRadius: '999px' 
            }}>
              {pendingVerificationReports.length}
            </span>
          )}
        </button>

        <button
          className={`btn ${activeTab === 'recollections' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('recollections')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RotateCcw size={14} />
          Recollection Queue
          {pendingRecollectionsCount > 0 && (
            <span style={{ 
              background: 'var(--danger-500, #ef4444)', 
              color: '#fff', 
              fontSize: '0.7rem', 
              fontWeight: 700, 
              padding: '1px 6px', 
              borderRadius: '999px' 
            }}>
              {pendingRecollectionsCount}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'bench' ? (
        <>
          {/* Search & Filter Toolbar */}
          <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '260px' }}>
                <Search size={16} style={{ color: 'var(--slate-400)' }} />
                <input
                  type="text"
                  placeholder="Scan or search barcode (e.g. JPL-100-01, CHN-100-01), MRN, Patient, or Order #..."
                  className="form-input"
                  style={{ border: 'none', padding: '0.35rem 0', width: '100%' }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={handleScannerEnter}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-500)' }}>Filter:</span>
                {['ALL', 'PENDING', 'COLLECTED', 'RECEIVED', 'REJECTED'].map((f) => (
                  <button
                    key={f}
                    className={`btn btn-sm ${statusFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    onClick={() => setStatusFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Specimens Table */}
          <div className="card">
            {isLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
                <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary-blue)' }} />
                <p>Loading specimen accession list...</p>
              </div>
            ) : filteredSamples.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
                <FlaskConical size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
                <p style={{ fontWeight: 600, color: 'var(--slate-700)' }}>No specimens found</p>
                <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  Specimens are derived automatically when diagnostic test requisitions are placed.
                </p>
              </div>
            ) : (
              <div className="table-container">
                <table className="lms-table">
                  <thead>
                    <tr>
                      <th>Barcode & Tube</th>
                      <th>Order & Patient</th>
                      <th>Container / Specimen</th>
                      <th>Required Tests</th>
                      <th>Collection</th>
                      <th>Analysis</th>
                      <th style={{ textAlign: 'right' }}>Bench Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSamples.map((s) => {
                      const tubeTag = s.totalTubes > 1 ? `Tube ${s.tubeIndex || 1}/${s.totalTubes}` : 'Tube 1/1';
                      return (
                        <tr key={s.sampleId || s._id}>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-blue)' }}>
                                {s.barcode}
                              </span>
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <Badge variant="blue" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                                  {tubeTag}
                                </Badge>
                              </div>
                            </div>
                          </td>

                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{s.patientName}</span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>
                                {s.patientMrn ? `MRN: ${s.patientMrn}` : ''} • {s.orderNumber || 'ORD'}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                                {s.container || 'Standard Tube'}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                                {s.sampleType || 'Specimen'}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '200px' }}>
                              {Array.isArray(s.testCodes) && s.testCodes.length > 0 ? (
                                s.testCodes.map((code) => (
                                  <span
                                    key={code}
                                    style={{
                                      fontSize: '0.7rem',
                                      padding: '1px 5px',
                                      borderRadius: '3px',
                                      background: 'var(--slate-100)',
                                      color: 'var(--slate-700)',
                                      fontWeight: 600,
                                      fontFamily: 'monospace'
                                    }}
                                  >
                                    {code}
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)' }}>General</span>
                              )}
                            </div>
                          </td>

                          <td>{getCollectionBadge(s.collectionStatus)}</td>
                          <td>{getProcessingBadge(s.processingStatus)}</td>

                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                              
                              {/* =========================================================================
                                  CASE A: Phlebotomist (isSampleCollector)
                                  Strictly: Collect (if pending), Label, Info ONLY.
                                  Hide: Receive, Analyze, Reject.
                                  ========================================================================= */}
                              {isSampleCollector && (
                                <>
                                  {s.collectionStatus === 'pending' && (
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => handleUpdateStatus(s.sampleId, { collectionStatus: 'collected' })}
                                      disabled={actionLoading}
                                      title="Mark specimen collected by phlebotomist"
                                    >
                                      Collect
                                    </button>
                                  )}
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleOpenLabel(s)}
                                    title="Print 60x25 mm Code 128 barcode label"
                                    style={{ display: 'flex', alignItems: 'center', gap: '3px' }}
                                  >
                                    <Printer size={12} />
                                    Label
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setSelectedSample(s)}
                                    title="View specimen audit trail"
                                  >
                                    Info
                                  </button>
                                </>
                              )}

                              {/* =========================================================================
                                  CASE B: Lab Technician (isLabTechnician)
                                  Allowed ONLY:
                                  1. Receive (when specimen is collected)
                                  2. Analyze (strictly enabled ONLY after receipt; disabled with tooltip before)
                                  3. Reject (with mandatory clinical rejection reason modal)
                                  4. Info (read-only specimen audit trail)
                                  EXPLICITLY REMOVED: Collect and Label!
                                  ========================================================================= */}
                              {isLabTechnician && (
                                <>
                                  {/* 1. Receive */}
                                  {s.collectionStatus === 'collected' && (
                                    <button
                                      className="btn btn-primary btn-sm"
                                      style={{ background: 'var(--primary-600)' }}
                                      onClick={() => handleUpdateStatus(s.sampleId, { collectionStatus: 'received' })}
                                      disabled={actionLoading}
                                      title="Receive & verify specimen at laboratory accessioning desk"
                                    >
                                      Receive
                                    </button>
                                  )}

                                  {/* 2. Analyze: Strict Sequential State Machine */}
                                  {s.collectionStatus === 'received' ? (
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => setResultEntrySample(s)}
                                      disabled={actionLoading || s.processingStatus === 'completed'}
                                      title="Enter test analyte results and push to pathologist sign-off queue"
                                    >
                                      {s.processingStatus === 'results_entered' ? 'Edit Results' : 'Analyze'}
                                    </button>
                                  ) : (
                                    <span
                                      title="Sample must be received in lab before analysis"
                                      style={{ display: 'inline-block', cursor: 'not-allowed' }}
                                    >
                                      <button
                                        className="btn btn-secondary btn-sm"
                                        disabled
                                        style={{ opacity: 0.5, pointerEvents: 'none' }}
                                        title="Sample must be received in lab before analysis"
                                      >
                                        Analyze
                                      </button>
                                    </span>
                                  )}

                                  {/* 3. Reject */}
                                  {s.collectionStatus !== 'rejected' && s.processingStatus !== 'completed' && (
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      style={{ color: 'var(--danger-600, #dc2626)' }}
                                      onClick={() => handleOpenRejection(s)}
                                      disabled={actionLoading}
                                      title="Reject specimen with mandatory clinical reason"
                                    >
                                      Reject
                                    </button>
                                  )}

                                  {/* 4. Info */}
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setSelectedSample(s)}
                                    title="View specimen audit trail"
                                  >
                                    Info
                                  </button>
                                </>
                              )}

                              {/* =========================================================================
                                  CASE C: Lab Admin & Other Supervisory Roles (isLabAdmin or other)
                                  Enforces same strict state validation (Receive before Analyze), but with full oversight.
                                  ========================================================================= */}
                              {!isSampleCollector && !isLabTechnician && (
                                <>
                                  {s.collectionStatus === 'pending' && (
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => handleUpdateStatus(s.sampleId, { collectionStatus: 'collected' })}
                                      disabled={actionLoading}
                                      title="Mark specimen collected"
                                    >
                                      Collect
                                    </button>
                                  )}

                                  {s.collectionStatus === 'collected' && (
                                    <button
                                      className="btn btn-primary btn-sm"
                                      style={{ background: 'var(--primary-600)' }}
                                      onClick={() => handleUpdateStatus(s.sampleId, { collectionStatus: 'received' })}
                                      disabled={actionLoading}
                                      title="Receive & verify specimen at laboratory accessioning desk"
                                    >
                                      Receive
                                    </button>
                                  )}

                                  {s.collectionStatus === 'received' ? (
                                    <button
                                      className="btn btn-primary btn-sm"
                                      onClick={() => setResultEntrySample(s)}
                                      disabled={actionLoading || s.processingStatus === 'completed'}
                                      title="Enter test results and push to pathologist sign-off queue"
                                    >
                                      {s.processingStatus === 'results_entered' ? 'Edit Results' : 'Analyze'}
                                    </button>
                                  ) : (
                                    <span
                                      title="Sample must be received in lab before analysis"
                                      style={{ display: 'inline-block', cursor: 'not-allowed' }}
                                    >
                                      <button
                                        className="btn btn-secondary btn-sm"
                                        disabled
                                        style={{ opacity: 0.5, pointerEvents: 'none' }}
                                        title="Sample must be received in lab before analysis"
                                      >
                                        Analyze
                                      </button>
                                    </span>
                                  )}

                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleOpenLabel(s)}
                                    title="Print 60x25 mm Code 128 barcode label"
                                    style={{ display: 'flex', alignItems: 'center', gap: '3px' }}
                                  >
                                    <Printer size={12} />
                                    Label
                                  </button>

                                  {s.collectionStatus !== 'rejected' && s.processingStatus !== 'completed' && (
                                    <button
                                      className="btn btn-secondary btn-sm"
                                      style={{ color: 'var(--danger-600, #dc2626)' }}
                                      onClick={() => handleOpenRejection(s)}
                                      disabled={actionLoading}
                                      title="Reject specimen with clinical reason"
                                    >
                                      Reject
                                    </button>
                                  )}

                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setSelectedSample(s)}
                                    title="View specimen audit trail"
                                  >
                                    Info
                                  </button>
                                </>
                              )}

                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'verification' ? (
        /* =========================================================================
           TAB 2: Consultant Pathologist Verification & Sign-Off Queue
           ========================================================================= */
        <div className="card">
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--slate-900)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={18} style={{ color: 'var(--primary-blue)' }} />
                Pathologist Review & Digital Sign-Off Queue
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                Cases with entered analytical test results awaiting clinical evaluation, diagnostic remarks, and final digital authorization.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchReports}>
              Refresh Queue
            </button>
          </div>

          {pendingVerificationReports.length === 0 ? (
            <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--slate-500)' }}>
              <CheckCircle2 size={40} style={{ margin: '0 auto 0.75rem', color: 'var(--teal-500)', opacity: 0.9 }} />
              <p style={{ fontWeight: 600, color: 'var(--slate-700)', fontSize: '1rem' }}>Verification Queue All Clear</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.25rem', maxWidth: '420px', margin: '0.25rem auto 0' }}>
                All analyzer test runs have either been verified and signed off by the Consultant Pathologist or are still undergoing bench analysis.
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Report / Order #</th>
                    <th>Patient Name & MRN</th>
                    <th>Diagnostic Panel / Test</th>
                    <th>Reported Parameters</th>
                    <th>Drafted By & Timestamp</th>
                    <th>Clinical Status</th>
                    <th style={{ textAlign: 'right' }}>Authorization</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingVerificationReports.map((rep) => {
                    // Extract parameters from items
                    const allParams = [];
                    (rep.items || []).forEach((it) => {
                      if (Array.isArray(it.parameterResults)) {
                        allParams.push(...it.parameterResults);
                      }
                    });
                    const abnormalCount = allParams.filter((p) => p.isAbnormal).length;

                    return (
                      <tr key={rep.reportId || rep._id}>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-blue)' }}>
                              {rep.reportNumber}
                            </span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>
                              {rep.orderNumber}
                            </span>
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{rep.patientName}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>
                              MRN: {rep.patientMrn || 'N/A'}
                            </span>
                          </div>
                        </td>

                        <td>
                          <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
                            {rep.testName || 'Diagnostic Profile'}
                          </span>
                        </td>

                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                              {allParams.length > 0 ? `${allParams.length} Analytes` : 'Completed'}
                            </span>
                            {abnormalCount > 0 && (
                              <Badge variant="danger" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
                                {abnormalCount} Abnormal
                              </Badge>
                            )}
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                              {rep.draftedBy || 'Lab Technician'}
                            </span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>
                              {rep.createdAt ? new Date(rep.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                        </td>

                        <td>
                          <Badge variant="purple">Pending Review</Badge>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => handleOpenSignOff(rep)}
                          >
                            <ShieldCheck size={13} />
                            Review & Sign-Off
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* =========================================================================
           TAB 3: Actionable Recollection Queue
           ========================================================================= */
        <div className="card">
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--slate-900)' }}>
                Actionable Recollection Queue
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                Specimens rejected during accessioning or analytical testing requiring re-bleeding / re-sampling.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={fetchRecollections}>
              Refresh Queue
            </button>
          </div>

          {recollections.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
              <CheckCircle size={36} style={{ margin: '0 auto 0.5rem', color: 'var(--teal-500)', opacity: 0.8 }} />
              <p style={{ fontWeight: 600, color: 'var(--slate-700)' }}>Zero Pending Recollections</p>
              <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
                All specimens are viable or recollections have been completed.
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="lms-table">
                <thead>
                  <tr>
                    <th>Task ID</th>
                    <th>Patient & Order</th>
                    <th>Rejected Barcode</th>
                    <th>Clinical Rejection Reason</th>
                    <th>Specimen & Container</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Resolution</th>
                  </tr>
                </thead>
                <tbody>
                  {recollections.map((task) => (
                    <tr key={task.taskId || task._id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{task.taskId}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600 }}>{task.patientName}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>
                            {task.patientMrn ? `MRN: ${task.patientMrn} • ` : ''}{task.orderNumber}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', color: 'var(--danger-600, #dc2626)', fontWeight: 600 }}>
                          {task.rejectedBarcode}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--danger-700, #b91c1c)' }}>
                            {task.reason}
                          </span>
                          {task.notes && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                              Notes: {task.notes}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{task.container}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{task.sampleType}</span>
                        </div>
                      </td>
                      <td>
                        {task.status === 'resolved' ? (
                          <Badge variant="success">Resolved</Badge>
                        ) : (
                          <Badge variant="danger">Action Required</Badge>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {task.status === 'pending' ? (
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => handleResolveRecollection(task.taskId)}
                            disabled={actionLoading}
                          >
                            <RotateCcw size={12} />
                            Recollect Specimen
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>
                            Replacement: {task.replacementBarcode || 'Created'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          RESULT ENTRY MODAL (Technician Analyte Feeding Workstation)
          ========================================================================= */}
      <ResultEntryModal
        isOpen={!!resultEntrySample}
        onClose={() => setResultEntrySample(null)}
        sample={resultEntrySample}
        tenantId={tenantId}
        onSuccess={handleResultEntrySuccess}
      />

      {/* =========================================================================
          PATHOLOGIST REVIEW & DIGITAL SIGN-OFF MODAL
          ========================================================================= */}
      <Modal
        isOpen={!!signOffReport}
        onClose={() => setSignOffReport(null)}
        title={signOffReport ? `Pathologist Diagnostic Sign-Off: ${signOffReport.reportNumber}` : 'Pathologist Sign-Off'}
        size="lg"
      >
        {signOffReport && (() => {
          const comp = checkReportCompleteness(signOffReport);
          const hasMissingResults = !comp.isComplete;
          const items = Array.isArray(signOffReport.items) ? signOffReport.items : [];
          const hasAbnormal = items.some(
            (it) => it.isAbnormal || (Array.isArray(it.parameterResults) && it.parameterResults.some((pr) => pr.isAbnormal))
          );

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Report Header Banner */}
              <div style={{
                background: 'var(--slate-50, #f8fafc)',
                border: '1px solid var(--border-color, #e2e8f0)',
                borderRadius: 'var(--radius-md, 8px)',
                padding: '0.875rem 1rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
              }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>Patient Name</span>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{signOffReport.patientName}</div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--slate-500)' }}>
                    MRN: {signOffReport.patientMrn || 'N/A'}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>Diagnostic Panel</span>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--primary-blue)' }}>
                    {signOffReport.testName}
                  </div>
                  <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--slate-500)' }}>
                    Order: {signOffReport.orderNumber}
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>Bench Technician</span>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                    {signOffReport.draftedBy || 'Laboratory Staff'}
                  </div>
                </div>
              </div>

              {/* Status and Clinical Warnings */}
              {signOffError && (
                <div style={{
                  background: 'var(--danger-50, #fef2f2)',
                  border: '1px solid var(--danger-200, #fecaca)',
                  color: 'var(--danger-700, #b91c1c)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md, 8px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.85rem'
                }}>
                  <AlertCircle size={16} />
                  <span>{signOffError}</span>
                </div>
              )}

              {hasMissingResults && (
                <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '8px', padding: '12px', color: '#9a3412', fontSize: '0.8125rem' }}>
                  <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={15} />
                    <span>Incomplete Diagnostic Results — Authorization Disabled</span>
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    One or more tests in this requisition are missing diagnostic results (
                    <strong>{comp.missingItems.join(', ')}</strong>). Pathologist sign-off is blocked until remaining specimen runs are completed.
                  </div>
                </div>
              )}

              {hasAbnormal && !hasMissingResults && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', color: '#991b1b', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span><strong>Pathological Alert:</strong> One or more analyte parameters are outside normal physiological reference ranges. Please evaluate clinical implications before approval.</span>
                </div>
              )}

              {/* VIEW 1: MAIN REVIEW STEP */}
              {signOffStep === 'review' && (
                <form onSubmit={handleConfirmSignOff} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Analyte Results Breakdown */}
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--slate-800)' }}>
                      Fed Parameter Results & Reference Ranges:
                    </h4>
                    <div style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md, 8px)'
                    }}>
                      <table className="lms-table" style={{ margin: 0 }}>
                        <thead style={{ position: 'sticky', top: 0, background: 'var(--slate-100)' }}>
                          <tr>
                            <th>Analyte</th>
                            <th>Observed Result</th>
                            <th>Unit</th>
                            <th>Reference Range</th>
                            <th>Flag</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.flatMap((it, itIdx) => {
                            if (Array.isArray(it.parameterResults) && it.parameterResults.length > 0) {
                              return it.parameterResults.map((pr, prIdx) => {
                                const isBlank = pr.value === undefined || pr.value === null || String(pr.value).trim() === '';
                                return (
                                  <tr key={`${itIdx}-${prIdx}`} style={{ background: pr.isAbnormal ? '#fff5f5' : isBlank ? '#fffbeb' : undefined }}>
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
                              });
                            }
                            const isSingleBlank = it.resultValue === undefined || it.resultValue === null || String(it.resultValue).trim() === '';
                            return (
                              <tr key={itIdx} style={{ background: isSingleBlank ? '#fffbeb' : undefined }}>
                                <td style={{ fontWeight: 600 }}>{it.testName || it.testCode}</td>
                                <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                                  {isSingleBlank ? <span style={{ color: '#c2410c', fontStyle: 'italic' }}>Awaiting result entry</span> : it.resultValue}
                                </td>
                                <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>—</td>
                                <td style={{ fontSize: '0.75rem' }}>{it.referenceRange || 'Standard'}</td>
                                <td>
                                  {isSingleBlank ? (
                                    <Badge variant="warning" style={{ fontSize: '0.65rem' }}>MISSING</Badge>
                                  ) : (
                                    <Badge variant="success" style={{ fontSize: '0.65rem' }}>NORMAL</Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pathologist Clinical Interpretation & Findings */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                      Pathologist Clinical Remarks & Diagnostic Interpretation *
                    </label>
                    <textarea
                      className="form-input"
                      rows={2}
                      style={{ fontSize: '0.8125rem', resize: 'vertical' }}
                      value={signOffFindings}
                      onChange={(e) => setSignOffFindings(e.target.value)}
                      placeholder="Enter diagnostic impression (e.g. Normocytic normochromic blood picture...)"
                      required
                    />
                  </div>

                  {/* Verification Notes */}
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                      Verification Notes / Quality Control Certification (Optional)
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '0.8125rem' }}
                      value={signOffNotes}
                      onChange={(e) => setSignOffNotes(e.target.value)}
                      placeholder="e.g. Microscopic review correlated. Internal QC batch valid."
                    />
                  </div>

                  {/* ISO 15189 Digital Signature Confirmation Checkbox */}
                  <div style={{
                    background: 'var(--primary-50, #eff6ff)',
                    border: '1px solid var(--primary-200, #bfdbfe)',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md, 8px)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}>
                    <input
                      type="checkbox"
                      id="digitalSigCheck"
                      style={{ marginTop: '3px', cursor: 'pointer' }}
                      checked={signOffAgreed}
                      onChange={(e) => setSignOffAgreed(e.target.checked)}
                    />
                    <label htmlFor="digitalSigCheck" style={{ fontSize: '0.8125rem', color: 'var(--primary-900, #1e3a8a)', cursor: 'pointer', lineHeight: 1.4 }}>
                      <strong>Consultant Pathologist Digital Authorization:</strong> I hereby certify under ISO 15189 compliance that I have clinically reviewed, validated, and authorized these analytical test findings for final report issuance.
                    </label>
                  </div>

                  {/* Footer Actions */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setSignOffReport(null)}
                      disabled={isSigningOff}
                    >
                      Cancel
                    </button>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn btn-danger"
                        style={{ background: 'var(--danger-600, #dc2626)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '5px' }}
                        onClick={() => {
                          setSignOffError(null);
                          setSignOffStep('confirm_reject');
                        }}
                        disabled={isSigningOff}
                      >
                        <AlertTriangle size={14} />
                        <span>Reject Report</span>
                      </button>

                      <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={isSigningOff || !signOffAgreed || hasMissingResults}
                        title={hasMissingResults ? `Cannot sign off: Missing results for ${comp.missingItems.join(', ')}` : 'Authorize & Sign-off'}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--purple-700, #7e22ce)', borderColor: 'var(--purple-700)' }}
                      >
                        {isSigningOff ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>Signing Report...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={16} />
                            <span>Authorize & Sign-Off Report</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* VIEW 2: CONFIRM REJECTION STEP */}
              {signOffStep === 'confirm_reject' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '14px', color: '#991b1b' }}>
                    <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem' }}>
                      <AlertTriangle size={18} />
                      <span>Confirm Clinical Rejection & Return for Revision</span>
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.8125rem', lineHeight: 1.5, color: '#7f1d1d' }}>
                      Rejecting this report will return it to the laboratory bench queue for technician rerun or result correction.
                      This rejection justification will be permanently saved to the report's audit trail.
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
                      value={signOffRejectionReason}
                      onChange={(e) => setSignOffRejectionReason(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setSignOffStep('review')}
                      disabled={isSigningOff}
                    >
                      Back to Review
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ background: 'var(--danger-600, #dc2626)', color: 'white', border: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                      onClick={handleConfirmSignOffRejection}
                      disabled={isSigningOff || signOffRejectionReason.trim().length < 5}
                    >
                      {isSigningOff && <Loader2 size={16} className="animate-spin" />}
                      <span>Confirm Clinical Rejection</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </Modal>

      {/* 60 x 25 mm Barcode Label Modal */}
      <Modal
        isOpen={!!labelModalData}
        onClose={() => setLabelModalData(null)}
        title={labelModalData ? `Code 128 Specimen Label: ${labelModalData.barcode}` : 'Barcode Label'}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
              Standard: 60 × 25 mm • Code 128
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={() => setLabelModalData(null)}>
                Close
              </button>
              <button
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => printLabelHtml(labelModalData)}
              >
                <Printer size={14} />
                Print Label (60x25 mm)
              </button>
            </div>
          </div>
        }
      >
        {labelModalData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', textAlign: 'center' }}>
              Thermal roll print preview formatted to physical dimensions of <strong>60 mm × 25 mm</strong>:
            </p>

            {/* Label Visual Simulation Card */}
            <div
              style={{
                width: '380px',
                minHeight: '160px',
                border: '2px solid #000',
                borderRadius: '4px',
                background: '#ffffff',
                color: '#000000',
                padding: '10px 14px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {labelModalData.labName}
                </span>
                <span style={{ fontSize: '0.7rem', background: '#000', color: '#fff', padding: '1px 6px', borderRadius: '2px', fontWeight: 800 }}>
                  {labelModalData.tubeTag}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 800 }}>{labelModalData.patientName}</span>
                <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 800 }}>{labelModalData.patientMrn}</span>
              </div>

              <div
                style={{ margin: '6px 0', width: '100%', display: 'flex', justifyContent: 'center' }}
                dangerouslySetInnerHTML={{ __html: labelModalData.svg }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #000', paddingTop: '4px', fontSize: '0.65rem' }}>
                <div>
                  <div style={{ fontWeight: 800 }}>{labelModalData.container}</div>
                  <div style={{ color: '#222', fontWeight: 600 }}>{labelModalData.testsSummary}</div>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', fontWeight: 800, color: '#000', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                </div>
              </div>
            </div>

            <div style={{ background: 'var(--slate-50)', padding: '0.75rem', borderRadius: '6px', width: '100%', fontSize: '0.75rem', color: 'var(--slate-600)' }}>
              <p><strong>Container:</strong> {labelModalData.container}</p>
              <p><strong>Barcode Value:</strong> {labelModalData.barcode}</p>
              <p><strong>Specimen Type:</strong> {labelModalData.sampleType}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Clinical Rejection Modal */}
      <Modal
        isOpen={!!rejectionTargetSample}
        onClose={() => setRejectionTargetSample(null)}
        title={rejectionTargetSample ? `Reject Specimen: ${rejectionTargetSample.barcode}` : 'Reject Specimen'}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => setRejectionTargetSample(null)} disabled={actionLoading}>
              Cancel
            </button>
            <button
              className="btn btn-danger"
              style={{ background: 'var(--danger-600, #dc2626)', color: 'white', border: 'none' }}
              onClick={handleConfirmRejection}
              disabled={actionLoading}
            >
              {actionLoading ? 'Recording...' : 'Confirm Rejection'}
            </button>
          </div>
        }
      >
        {rejectionTargetSample && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div style={{ 
              background: 'var(--danger-50, #fef2f2)', 
              border: '1px solid var(--danger-200, #fecaca)', 
              borderRadius: '6px', 
              padding: '0.75rem', 
              color: 'var(--danger-800, #991b1b)',
              display: 'flex',
              gap: '8px',
              alignItems: 'flex-start'
            }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ fontWeight: 600 }}>Clinical Rejection Notice</p>
                <p style={{ fontSize: '0.8125rem', marginTop: '2px' }}>
                  Rejecting this specimen will immediately generate an actionable <strong>Recollection Task</strong> for the phlebotomy team to schedule a redraw.
                </p>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '0.8125rem' }}>
                Clinical Rejection Reason *
              </label>
              <select
                className="form-input"
                style={{ width: '100%' }}
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              >
                <option value="Hemolysis">Hemolysis (Grade 2+ or gross)</option>
                <option value="Insufficient Volume (QNS)">Quantity Not Sufficient (QNS)</option>
                <option value="Clotted Specimen">Clotted Specimen (EDTA / Citrate)</option>
                <option value="Incorrect Tube / Anticoagulant">Incorrect Tube / Anticoagulant</option>
                <option value="Unlabeled / Mislabeled Specimen">Unlabeled / Mislabeled Specimen</option>
                <option value="Delayed Transit / Temperature Excursion">Delayed Transit / Temperature Excursion</option>
                <option value="Container Leaking / Damaged">Container Leaking / Broken</option>
                <option value="Lipemic / Icteric Excursion">Grossly Lipemic / Icteric Interference</option>
                <option value="Other Analytical Issue">Other Analytical Rejection</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '4px', fontSize: '0.8125rem' }}>
                Additional Clinical Notes (Optional)
              </label>
              <textarea
                className="form-input"
                style={{ width: '100%', minHeight: '60px' }}
                placeholder="Specific lab technician bench observations..."
                value={rejectionNotes}
                onChange={(e) => setRejectionNotes(e.target.value)}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Sample Detail Modal */}
      <Modal
        isOpen={!!selectedSample}
        onClose={() => setSelectedSample(null)}
        title={selectedSample ? `Specimen Details: ${selectedSample.barcode}` : ''}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            {!isLabTechnician && (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const s = selectedSample;
                  setSelectedSample(null);
                  handleOpenLabel(s);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Printer size={14} /> Print Label
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setSelectedSample(null)} style={{ marginLeft: 'auto' }}>
              Close
            </button>
          </div>
        }
      >
        {selectedSample && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Barcode</p>
                <p style={{ fontWeight: 600, fontFamily: 'monospace', color: 'var(--primary-blue)' }}>
                  {selectedSample.barcode}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Tube Index</p>
                <p style={{ fontWeight: 600 }}>
                  Tube {selectedSample.tubeIndex || 1} of {selectedSample.totalTubes || 1}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Patient MRN & Name</p>
                <p style={{ fontWeight: 600 }}>
                  {selectedSample.patientName} {selectedSample.patientMrn ? `(${selectedSample.patientMrn})` : ''}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Requisition Order</p>
                <p style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selectedSample.orderNumber}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Container Tube</p>
                <p style={{ fontWeight: 600 }}>{selectedSample.container || 'Standard Tube'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Specimen Type</p>
                <p>{selectedSample.sampleType || 'Specimen'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Collection Status</p>
                <div>{getCollectionBadge(selectedSample.collectionStatus)}</div>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Processing Bench Status</p>
                <div>{getProcessingBadge(selectedSample.processingStatus)}</div>
              </div>
            </div>

            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>Tests In This Specimen Tube</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {Array.isArray(selectedSample.testNames) && selectedSample.testNames.length > 0 ? (
                  selectedSample.testNames.map((name, i) => (
                    <span
                      key={i}
                      style={{
                        background: 'var(--slate-100)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 500
                      }}
                    >
                      {name} ({selectedSample.testCodes?.[i] || ''})
                    </span>
                  ))
                ) : (
                  <span>General tests</span>
                )}
              </div>
            </div>

            {selectedSample.collectionStatus === 'rejected' && (
              <div style={{ background: 'var(--danger-50)', padding: '0.75rem', borderRadius: '4px', border: '1px solid var(--danger-200)' }}>
                <p style={{ color: 'var(--danger-700)', fontWeight: 600, fontSize: '0.8125rem' }}>
                  Rejection Reason: {selectedSample.rejectionReason}
                </p>
                {selectedSample.rejectionNotes && (
                  <p style={{ color: 'var(--danger-600)', fontSize: '0.75rem', marginTop: '2px' }}>
                    Notes: {selectedSample.rejectionNotes}
                  </p>
                )}
                {selectedSample.rejectedBy && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--slate-500)', marginTop: '4px' }}>
                    Rejected by {selectedSample.rejectedBy} on {new Date(selectedSample.rejectedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {selectedSample.receivedAt && (
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-600)' }}>
                Received in Lab: <strong>{selectedSample.receivedBy}</strong> on{' '}
                {new Date(selectedSample.receivedAt).toLocaleString()}
              </p>
            )}

            {selectedSample.collectedBy && (
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-600)' }}>
                Collected By: <strong>{selectedSample.collectedBy}</strong> on{' '}
                {new Date(selectedSample.collectedAt).toLocaleString()}
              </p>
            )}

            {selectedSample.verifiedBy && (
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-600)' }}>
                Verified By: <strong>{selectedSample.verifiedBy}</strong> on{' '}
                {new Date(selectedSample.verifiedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

export default SamplesPage;
