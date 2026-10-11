/**
 * Lab Management System (LMS) - Specimen & Samples Page (Phase 6 Deepening)
 * 
 * Features:
 * - Multi-Tube Specimen Bench with tube indicators (e.g. Tube 1/2) and test badges
 * - Central Receipt / Triage Workflow (pending -> collected -> received -> in_analysis -> completed)
 * - 50 x 25 mm Code 128 Printable Barcode Labels with preview and thermal print engine
 * - Clinical Specimen Rejection modal with mandatory reasons (Hemolysis, QNS, Clotted, etc.)
 * - Actionable Recollection Queue with one-click resolution and replacement tube generation
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
  Tag
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import clinicalService from '../../services/clinicalService';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

export function SamplesPage() {
  const { user, tenant } = useAuth();
  const tenantId = tenant?.tenantId || user?.tenantId;

  const [activeTab, setActiveTab] = useState('bench'); // 'bench' | 'recollections'
  const [samples, setSamples] = useState([]);
  const [recollections, setRecollections] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

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

  useEffect(() => {
    fetchSamples();
    fetchRecollections();
  }, [fetchSamples, fetchRecollections]);

  const handleUpdateStatus = async (sampleId, updates) => {
    try {
      setActionLoading(true);
      setError(null);
      const res = await clinicalService.updateSampleStatus(tenantId, sampleId, updates);
      if (res.success) {
        setSuccessMsg(`Sample ${res.data.barcode} status updated successfully`);
        await fetchSamples();
        await fetchRecollections();
        if (selectedSample && selectedSample.sampleId === sampleId) {
          setSelectedSample(res.data);
        }
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to transition sample status');
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
      alert('A clinical rejection reason is mandatory');
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
        setSuccessMsg(`Specimen ${rejectionTargetSample.barcode} rejected. Recollection task generated.`);
        setRejectionTargetSample(null);
        await fetchSamples();
        await fetchRecollections();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject specimen');
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
      alert(err.response?.data?.message || 'Failed to generate barcode label');
    } finally {
      setIsLabelLoading(false);
    }
  };

  const printLabelHtml = (labelData) => {
    if (!labelData) return;
    const printWindow = window.open('', '_blank', 'width=460,height=320');
    if (!printWindow) {
      alert('Please allow popups to print barcode labels');
      return;
    }
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Specimen Label - ${labelData.barcode}</title>
          <style>
            @page {
              size: 50mm 25mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              width: 50mm;
              height: 25mm;
              padding: 1.5mm 2mm;
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
              font-size: 7pt;
              font-weight: 700;
              line-height: 1.1;
              border-bottom: 0.5px solid #000;
              padding-bottom: 0.5mm;
            }
            .hdr-lab {
              text-transform: uppercase;
              letter-spacing: 0.2px;
              max-width: 34mm;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .hdr-tube {
              font-size: 6.5pt;
              background: #000;
              color: #fff;
              padding: 0.2mm 1mm;
              border-radius: 1px;
              font-weight: 800;
            }
            .patient-row {
              display: flex;
              justify-content: space-between;
              align-items: baseline;
              font-size: 7pt;
              line-height: 1.1;
              margin-top: 0.5mm;
            }
            .patient-name {
              font-weight: 700;
              max-width: 32mm;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .patient-mrn {
              font-family: monospace;
              font-size: 6.5pt;
              font-weight: 700;
            }
            .barcode-wrap {
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 0.3mm 0;
            }
            .barcode-wrap svg {
              width: 44mm;
              height: 11mm;
              display: block;
            }
            .ftr {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              font-size: 5.5pt;
              line-height: 1;
              border-top: 0.5px solid #ccc;
              padding-top: 0.5mm;
            }
            .ftr-tests {
              font-weight: 600;
              max-width: 30mm;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .ftr-date {
              font-family: monospace;
              font-size: 5pt;
              color: #333;
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
            <div class="ftr-date">${labelData.collectionDate || ''}</div>
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
        setSuccessMsg(`Recollection resolved. New replacement tube ${res.data.replacementBarcode} generated.`);
        await fetchSamples();
        await fetchRecollections();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to resolve recollection task');
    } finally {
      setActionLoading(false);
    }
  };

  // Filtering
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
        description="Multi-tube specimen derivation, Code 128 barcode labelling, laboratory receipt triage, and recollection management."
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
      <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          className={`btn ${activeTab === 'bench' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('bench')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <FlaskConical size={14} />
          Active Specimen Bench ({samples.length})
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
                  placeholder="Scan or search barcode (BAR-...), MRN, Patient, or Order #..."
                  className="form-input"
                  style={{ border: 'none', padding: '0.35rem 0', width: '100%' }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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
                            <div style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {/* 1. Collection Progression */}
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

                              {/* 2. Central Receipt / Triage Queue */}
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

                              {/* 3. Analysis */}
                              {(s.collectionStatus === 'received' || s.collectionStatus === 'collected') && 
                               s.processingStatus === 'pending' && (
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleUpdateStatus(s.sampleId, { processingStatus: 'in_analysis' })}
                                  disabled={actionLoading}
                                  title="Send specimen to analyzer bench"
                                >
                                  Analyze
                                </button>
                              )}

                              {s.processingStatus === 'in_analysis' && (
                                <button
                                  className="btn btn-success btn-sm"
                                  style={{ background: 'var(--teal-600)', color: 'white', border: 'none' }}
                                  onClick={() => handleUpdateStatus(s.sampleId, { processingStatus: 'completed' })}
                                  disabled={actionLoading}
                                  title="Mark bench processing completed"
                                >
                                  Complete
                                </button>
                              )}

                              {/* 4. Print Label */}
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenLabel(s)}
                                title="Print 50x25 mm Code 128 barcode label"
                                style={{ display: 'flex', alignItems: 'center', gap: '3px' }}
                              >
                                <Printer size={12} />
                                Label
                              </button>

                              {/* 5. Rejection Action */}
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
                              >
                                Info
                              </button>
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
      ) : (
        /* Recollection Queue Tab */
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

      {/* 50 x 25 mm Barcode Label Modal */}
      <Modal
        isOpen={!!labelModalData}
        onClose={() => setLabelModalData(null)}
        title={labelModalData ? `Code 128 Specimen Label: ${labelModalData.barcode}` : 'Barcode Label'}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
              Standard: 50 × 25 mm • Code 128
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
                Print Label (50x25 mm)
              </button>
            </div>
          </div>
        }
      >
        {labelModalData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', textAlign: 'center' }}>
              Thermal roll print preview formatted to physical dimensions of <strong>50 mm × 25 mm</strong>:
            </p>

            {/* Label Visual Simulation Card */}
            <div
              style={{
                width: '320px',
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
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #000', paddingBottom: '3px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {labelModalData.labName}
                </span>
                <span style={{ fontSize: '0.7rem', background: '#000', color: '#fff', padding: '1px 6px', borderRadius: '2px', fontWeight: 700 }}>
                  {labelModalData.tubeTag}
                </span>
              </div>

              {/* Patient info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{labelModalData.patientName}</span>
                <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 700 }}>{labelModalData.patientMrn}</span>
              </div>

              {/* Code 128 Barcode Vector SVG */}
              <div
                style={{ margin: '6px auto', display: 'flex', justifyContent: 'center' }}
                dangerouslySetInnerHTML={{ __html: labelModalData.svg }}
              />

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #ccc', paddingTop: '4px', fontSize: '0.65rem' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{labelModalData.container}</div>
                  <div style={{ color: '#444' }}>{labelModalData.testsSummary}</div>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', color: '#555', textAlign: 'right' }}>
                  {labelModalData.collectionDate}
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
            <button className="btn btn-secondary" onClick={() => setSelectedSample(null)}>
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
