/**
 * Lab Management System (LMS) - Specimen & Samples Page (Phase 6 Real Tracking)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FlaskConical, QrCode, Search, CheckCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import clinicalService from '../../services/clinicalService';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

export function SamplesPage() {
  const { user, tenant } = useAuth();
  const tenantId = tenant?.tenantId || user?.tenantId;

  const [samples, setSamples] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSample, setSelectedSample] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

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

  useEffect(() => {
    fetchSamples();
  }, [fetchSamples]);

  const handleUpdateStatus = async (sampleId, updates) => {
    try {
      setActionLoading(true);
      setError(null);
      const res = await clinicalService.updateSampleStatus(tenantId, sampleId, updates);
      if (res.success) {
        setSuccessMsg(`Sample ${res.data.barcode} status updated successfully`);
        fetchSamples();
        if (selectedSample && selectedSample.sampleId === sampleId) {
          setSelectedSample(res.data);
        }
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to transition sample status');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredSamples = samples.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      (s.barcode || '').toLowerCase().includes(term) ||
      (s.patientName || '').toLowerCase().includes(term) ||
      (s.orderNumber || '').toLowerCase().includes(term)
    );
  });

  const getProcessingBadge = (status) => {
    switch (status) {
      case 'completed': return <Badge variant="success">Completed</Badge>;
      case 'in_analysis': return <Badge variant="purple">In Analysis</Badge>;
      case 'rejected': return <Badge variant="danger">Rejected</Badge>;
      default: return <Badge variant="warning">Pending Analysis</Badge>;
    }
  };

  const getCollectionBadge = (status) => {
    switch (status) {
      case 'collected': return <Badge variant="teal">Collected</Badge>;
      case 'rejected': return <Badge variant="danger">Rejected</Badge>;
      default: return <Badge variant="slate">Pending Collection</Badge>;
    }
  };

  return (
    <>
      <PageHeader
        title="Specimen Accessioning & Sample Tracking"
        description="Barcoded biological specimen logging, pre-analytical processing, and laboratory bench routing."
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

      {/* Barcode Search Card */}
      <div className="card" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={16} style={{ color: 'var(--slate-400)' }} />
          <input
            type="text"
            placeholder="Scan or enter specimen barcode (e.g. SMP-...), Patient name, or Order #..."
            className="form-input"
            style={{ border: 'none', padding: '0.35rem 0' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Samples Table */}
      <div className="card">
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary-blue)' }} />
            <p>Loading specimen accession list...</p>
          </div>
        ) : filteredSamples.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <FlaskConical size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--slate-700)' }}>No specimens recorded yet</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Specimens are created automatically when diagnostic requisitions are submitted.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Barcode</th>
                  <th>Order #</th>
                  <th>Patient Name</th>
                  <th>Specimen Type</th>
                  <th>Collection</th>
                  <th>Processing Status</th>
                  <th>Accessioned</th>
                  <th style={{ textAlign: 'right' }}>Bench Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSamples.map((s) => (
                  <tr key={s.sampleId || s._id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-blue)' }}>
                        {s.barcode}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace' }}>{s.orderNumber || 'ORD-GEN'}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{s.patientName}</td>
                    <td>{s.sampleType || 'Whole Blood (EDTA)'}</td>
                    <td>{getCollectionBadge(s.collectionStatus)}</td>
                    <td>{getProcessingBadge(s.processingStatus)}</td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                      {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'Today'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {s.collectionStatus !== 'collected' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleUpdateStatus(s.sampleId, { collectionStatus: 'collected' })}
                            disabled={actionLoading}
                            title="Mark specimen as collected"
                          >
                            Collect
                          </button>
                        )}
                        {s.collectionStatus === 'collected' && s.processingStatus === 'pending' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleUpdateStatus(s.sampleId, { processingStatus: 'in_analysis' })}
                            disabled={actionLoading}
                            title="Send to analyzer"
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
                            title="Complete processing"
                          >
                            Complete
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedSample(s)}
                        >
                          Details
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

      {/* Sample Detail Modal */}
      <Modal
        isOpen={!!selectedSample}
        onClose={() => setSelectedSample(null)}
        title={selectedSample ? `Specimen Details: ${selectedSample.barcode}` : ''}
        footer={
          <button className="btn btn-secondary" onClick={() => setSelectedSample(null)}>
            Close
          </button>
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
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Requisition Order</p>
                <p style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selectedSample.orderNumber}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Patient</p>
                <p style={{ fontWeight: 600 }}>{selectedSample.patientName}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Container Tube</p>
                <p>{selectedSample.container || 'Standard Lavender Top'}</p>
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
