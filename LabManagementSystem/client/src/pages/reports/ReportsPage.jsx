/**
 * Lab Management System (LMS) - Diagnostic Reports Page (Phase 6 Real Verification Workflow)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, CheckCircle2, AlertTriangle, Eye, Printer, Download, PlusCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import clinicalService from '../../services/clinicalService';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

export function ReportsPage() {
  const { user, tenant } = useAuth();
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

  const isPathologist = user?.role === 'pathologist' || user?.role === 'lab_admin' || user?.permissions?.includes('reports:verify') || user?.permissions?.includes('*');
  const canRelease = user?.role === 'pathologist' || user?.role === 'lab_admin' || user?.permissions?.includes('reports:release') || user?.permissions?.includes('*');

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
      alert('Please select an order');
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
        setSuccessMsg(`Draft report ${res.data.reportNumber} generated successfully`);
        setIsDraftOpen(false);
        setSelectedOrderId('');
        setFindings('');
        fetchReports();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to draft report');
    } finally {
      setActionLoading(false);
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
        setSuccessMsg(`Report ${res.data.reportNumber} finalized and released to patient portal`);
        fetchReports();
        if (selectedReport && selectedReport.reportId === reportId) {
          setSelectedReport(res.data);
        }
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to release report');
    } finally {
      setActionLoading(false);
    }
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
          <button
            className="btn btn-primary"
            onClick={() => {
              setIsDraftOpen(true);
              fetchOrdersForDraft();
            }}
          >
            <PlusCircle size={16} />
            <span>Draft Report</span>
          </button>
        }
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

      {/* Reports Table */}
      <div className="card">
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
                {reports.map((r) => (
                  <tr key={r.reportId || r._id}>
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
                        {r.status === 'draft' && isPathologist && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleApprove(r.reportId)}
                            disabled={actionLoading}
                            title="Pathologist verification"
                          >
                            Approve
                          </button>
                        )}
                        {r.status === 'approved' && canRelease && (
                          <button
                            className="btn btn-success btn-sm"
                            style={{ background: 'var(--teal-600)', color: 'white', border: 'none' }}
                            onClick={() => handleRelease(r.reportId)}
                            disabled={actionLoading}
                            title="Publish and release official report"
                          >
                            Release
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
        footer={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => alert(`Printing report ${selectedReport?.reportNumber}...`)}
            >
              <Printer size={14} />
              <span>Print</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setSelectedReport(null)}>
              Close
            </button>
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
    </>
  );
}

export default ReportsPage;
