/**
 * Lab Management System (LMS) - Specimen & Samples Page (Phase 1 UI Shell)
 */

import React, { useState } from 'react';
import { FlaskConical, QrCode, Search, CheckCircle, Clock, AlertTriangle, Archive } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

export function SamplesPage() {
  const [selectedSample, setSelectedSample] = useState(null);
  const [isAccessionOpen, setIsAccessionOpen] = useState(false);

  const mockSamples = [
    {
      barcode: 'SMP-88019-EDTA',
      patient: 'Eleanor Vance',
      mrn: 'MRN-9021',
      type: 'Whole Blood',
      container: 'Lavender Top (EDTA)',
      collectedAt: '2026-10-10 18:05',
      storage: 'Rack B-04 (Room Temp)',
      status: 'in_analysis',
      volume: '3.0 mL',
    },
    {
      barcode: 'SMP-88020-SST',
      patient: 'Arthur Pendelton',
      mrn: 'MRN-8842',
      type: 'Serum',
      container: 'Gold Top (SST Gel)',
      collectedAt: '2026-10-10 17:40',
      storage: 'Centrifuge Unit 2',
      status: 'centrifuged',
      volume: '4.5 mL',
    },
    {
      barcode: 'SMP-88021-URN',
      patient: 'Clara Oswald',
      mrn: 'MRN-4429',
      type: 'Urine',
      container: 'Sterile Urine Cup',
      collectedAt: '2026-10-10 14:00',
      storage: 'Refrigerator #3 (4°C)',
      status: 'archived',
      volume: '50.0 mL',
    },
    {
      barcode: 'SMP-88022-CIT',
      patient: 'David K. Miller',
      mrn: 'MRN-6512',
      type: 'Plasma',
      container: 'Light Blue Top (Citrate)',
      collectedAt: '2026-10-10 15:30',
      storage: 'Accessioning Station 1',
      status: 'pending_accession',
      volume: '2.5 mL',
    },
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'in_analysis': return <Badge variant="purple">In Analysis</Badge>;
      case 'centrifuged': return <Badge variant="teal">Centrifuged</Badge>;
      case 'archived': return <Badge variant="slate">Archived</Badge>;
      case 'pending_accession': return <Badge variant="warning">Pending Accession</Badge>;
      default: return <Badge variant="slate">{status}</Badge>;
    }
  };

  return (
    <>
      <PageHeader
        title="Specimen Accessioning & Samples"
        description="Barcoded biological specimen logging, pre-analytical processing, and laboratory storage management."
        actions={
          <button className="btn btn-primary" onClick={() => setIsAccessionOpen(true)}>
            <QrCode size={16} />
            <span>Accession Specimen (UI Demo)</span>
          </button>
        }
      />

      <StatusBanner
        type="info"
        badgeText="UI Shell Demonstration"
        message="Specimen tracking data and barcode identifiers shown below are simulated mock entries. Barcode scanner device driver integration will be added in Phase 2."
      />

      {/* Barcode Search Card */}
      <div className="card" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={16} style={{ color: 'var(--slate-400)' }} />
          <input
            type="text"
            placeholder="Scan or enter specimen barcode (e.g. SMP-88019-EDTA)..."
            className="form-input"
            style={{ border: 'none', padding: '0.35rem 0' }}
          />
        </div>
      </div>

      {/* Samples Table */}
      <div className="card">
        <div className="table-container">
          <table className="lms-table">
            <thead>
              <tr>
                <th>Barcode / Tube ID</th>
                <th>Patient / MRN</th>
                <th>Specimen Type</th>
                <th>Container / Tube</th>
                <th>Volume</th>
                <th>Collection Timestamp</th>
                <th>Storage / Location</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {mockSamples.map((s) => (
                <tr key={s.barcode}>
                  <td>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--primary-700)' }}>{s.barcode}</strong>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>{s.patient}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{s.mrn}</span>
                    </div>
                  </td>
                  <td>{s.type}</td>
                  <td>{s.container}</td>
                  <td>{s.volume}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{s.collectedAt}</td>
                  <td>{s.storage}</td>
                  <td>{getStatusBadge(s.status)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedSample(s)}
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Accession Modal (Demo) */}
      <Modal
        isOpen={isAccessionOpen}
        onClose={() => setIsAccessionOpen(false)}
        title="Accession Incoming Specimen (UI Demo)"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAccessionOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                alert('UI Demo Notice: Specimen accessioning workflow will be integrated in Phase 2.');
                setIsAccessionOpen(false);
              }}
            >
              Confirm Accession (Demo)
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <StatusBanner
            type="warning"
            badgeText="Preparation Mode"
            message="Specimen intake pre-analytical checklist."
          />
          <div className="form-group">
            <label className="form-label">Specimen Barcode Tag</label>
            <input type="text" className="form-input" placeholder="SMP-XXXXXXXX" defaultValue="SMP-99201-NEW" />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Tube Integrity Check</label>
              <select className="form-select">
                <option>Acceptable (No hemolysis/clots)</option>
                <option>Hemolyzed (Slight)</option>
                <option>Icteric</option>
                <option>Lipemic</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Storage Allocation</label>
              <input type="text" className="form-input" placeholder="e.g. Rack A-01" defaultValue="Rack A-01" />
            </div>
          </div>
        </div>
      </Modal>

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            <div className="grid-2">
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Patient</p>
                <p style={{ fontWeight: 600 }}>{selectedSample.patient} ({selectedSample.mrn})</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Tube Type</p>
                <p>{selectedSample.container}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Volume</p>
                <p>{selectedSample.volume}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Current Location</p>
                <p>{selectedSample.storage}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default SamplesPage;
