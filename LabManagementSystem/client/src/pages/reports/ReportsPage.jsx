/**
 * Lab Management System (LMS) - Diagnostic Reports Page (Phase 1 UI Shell)
 */

import React, { useState } from 'react';
import { FileText, CheckCircle2, AlertTriangle, Eye, Printer, Download } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

export function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState(null);

  const mockReports = [
    {
      id: 'REP-2026-8901',
      orderId: 'ORD-2026-1049',
      patient: 'Eleanor Vance',
      mrn: 'MRN-9021',
      panel: 'Complete Blood Count (CBC)',
      verifiedBy: 'Pending Pathologist Review',
      status: 'awaiting_verification',
      date: '2026-10-10 18:25',
      hasCritical: false,
    },
    {
      id: 'REP-2026-8900',
      orderId: 'ORD-2026-1048',
      patient: 'Arthur Pendelton',
      mrn: 'MRN-8842',
      panel: 'Comprehensive Metabolic Panel (CMP)',
      verifiedBy: 'Dr. Sarah Lin, MD',
      status: 'released',
      date: '2026-10-10 17:50',
      hasCritical: true,
    },
    {
      id: 'REP-2026-8899',
      orderId: 'ORD-2026-1047',
      patient: 'Maria Santos',
      mrn: 'MRN-7731',
      panel: 'Thyroid Stimulating Hormone (TSH)',
      verifiedBy: 'Dr. Sarah Lin, MD',
      status: 'released',
      date: '2026-10-10 16:45',
      hasCritical: false,
    },
    {
      id: 'REP-2026-8898',
      orderId: 'ORD-2026-1045',
      patient: 'Clara Oswald',
      mrn: 'MRN-4429',
      panel: 'Complete Urinalysis',
      verifiedBy: 'Dr. Nathan Drake, MD',
      status: 'released',
      date: '2026-10-10 14:30',
      hasCritical: false,
    },
  ];

  const getStatusBadge = (status, hasCritical) => {
    if (hasCritical) {
      return <Badge variant="danger" icon={AlertTriangle}>Critical Released</Badge>;
    }
    if (status === 'released') {
      return <Badge variant="success" icon={CheckCircle2}>Verified & Released</Badge>;
    }
    return <Badge variant="warning">Awaiting Verification</Badge>;
  };

  return (
    <>
      <PageHeader
        title="Diagnostic Reports & Verifications"
        description="Pathologist clinical result verification, critical alert routing, and patient laboratory report generation."
      />

      <StatusBanner
        type="info"
        badgeText="UI Shell Demonstration"
        message="Laboratory reports listed below represent simulated diagnostic records. Digital signatures and automated PDF/HL7 report generation will be activated in Phase 2."
      />

      {/* Reports Table */}
      <div className="card">
        <div className="table-container">
          <table className="lms-table">
            <thead>
              <tr>
                <th>Report #</th>
                <th>Patient / MRN</th>
                <th>Diagnostic Panel</th>
                <th>Signing Pathologist</th>
                <th>Generated Timestamp</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockReports.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--primary-700)' }}>{r.id}</strong>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>{r.patient}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{r.mrn}</span>
                    </div>
                  </td>
                  <td>{r.panel}</td>
                  <td>{r.verifiedBy}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{r.date}</td>
                  <td>{getStatusBadge(r.status, r.hasCritical)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedReport(r)}
                    >
                      <Eye size={13} />
                      <span>Preview</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Report Preview Modal */}
      <Modal
        isOpen={!!selectedReport}
        onClose={() => setSelectedReport(null)}
        title={selectedReport ? `Diagnostic Report Preview: ${selectedReport.id}` : ''}
        maxWidth="680px"
        footer={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => alert('UI Demo: Print formatted PDF will be generated in Phase 2.')}
            >
              <Printer size={14} />
              <span>Print (Demo)</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setSelectedReport(null)}>
              Close
            </button>
          </div>
        }
      >
        {selectedReport && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '1rem', background: 'var(--slate-50)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', color: 'var(--slate-900)' }}>CENTRAL DIAGNOSTICS LABORATORY</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Accredited Reference Laboratory • CLIA #99D102948</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{selectedReport.id}</span>
                  <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Order: {selectedReport.orderId}</p>
                </div>
              </div>

              <div className="grid-2" style={{ fontSize: '0.8125rem', marginBottom: '0.75rem' }}>
                <div>Patient: <strong>{selectedReport.patient}</strong> ({selectedReport.mrn})</div>
                <div>Status: {getStatusBadge(selectedReport.status, selectedReport.hasCritical)}</div>
              </div>

              <table className="lms-table" style={{ background: 'white', border: '1px solid var(--border-subtle)' }}>
                <thead>
                  <tr>
                    <th>Analyte</th>
                    <th>Result</th>
                    <th>Ref Interval</th>
                    <th>Units</th>
                    <th>Flag</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Glucose, Serum</td>
                    <td><strong style={{ color: selectedReport.hasCritical ? 'var(--danger-600)' : 'inherit' }}>{selectedReport.hasCritical ? '240' : '92'}</strong></td>
                    <td>70 - 99</td>
                    <td>mg/dL</td>
                    <td>{selectedReport.hasCritical ? <Badge variant="danger">HIGH CRITICAL</Badge> : <Badge variant="success">NORMAL</Badge>}</td>
                  </tr>
                  <tr>
                    <td>Potassium</td>
                    <td><strong>4.2</strong></td>
                    <td>3.5 - 5.1</td>
                    <td>mmol/L</td>
                    <td><Badge variant="success">NORMAL</Badge></td>
                  </tr>
                  <tr>
                    <td>Sodium</td>
                    <td><strong>140</strong></td>
                    <td>136 - 145</td>
                    <td>mmol/L</td>
                    <td><Badge variant="success">NORMAL</Badge></td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                Signed electronically by: <strong>{selectedReport.verifiedBy}</strong>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default ReportsPage;
