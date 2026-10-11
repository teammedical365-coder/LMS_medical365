/**
 * Lab Management System (LMS) - Lab Orders Page (Phase 1 UI Shell)
 */

import React, { useState } from 'react';
import { ClipboardList, PlusCircle, Search, Filter, Eye } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

export function OrdersPage() {
  const [filterPriority, setFilterPriority] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const mockOrders = [
    {
      id: 'ORD-2026-1049',
      patient: 'Eleanor Vance',
      mrn: 'MRN-9021',
      tests: ['Complete Blood Count (CBC)', 'Lipid Panel'],
      sampleType: 'Whole Blood (EDTA)',
      priority: 'stat',
      status: 'in_analysis',
      date: '2026-10-10 18:20',
      physician: 'Dr. Marcus Vance',
    },
    {
      id: 'ORD-2026-1048',
      patient: 'Arthur Pendelton',
      mrn: 'MRN-8842',
      tests: ['Comprehensive Metabolic Panel (CMP)'],
      sampleType: 'Serum (SST)',
      priority: 'urgent',
      status: 'awaiting_verification',
      date: '2026-10-10 17:55',
      physician: 'Dr. Rebecca Croft',
    },
    {
      id: 'ORD-2026-1047',
      patient: 'Maria Santos',
      mrn: 'MRN-7731',
      tests: ['Thyroid Stimulating Hormone (TSH)'],
      sampleType: 'Serum',
      priority: 'routine',
      status: 'released',
      date: '2026-10-10 16:30',
      physician: 'Dr. Nathan Drake',
    },
    {
      id: 'ORD-2026-1046',
      patient: 'David K. Miller',
      mrn: 'MRN-6512',
      tests: ['HbA1c Glycated Hemoglobin'],
      sampleType: 'Whole Blood',
      priority: 'routine',
      status: 'samples_pending',
      date: '2026-10-10 15:40',
      physician: 'Dr. Evelyn Chen',
    },
    {
      id: 'ORD-2026-1045',
      patient: 'Clara Oswald',
      mrn: 'MRN-4429',
      tests: ['Urinalysis with Microscopic Exam'],
      sampleType: 'Clean Catch Urine',
      priority: 'routine',
      status: 'released',
      date: '2026-10-10 14:10',
      physician: 'Dr. John Smith',
    },
  ];

  const filteredOrders = filterPriority === 'all'
    ? mockOrders
    : mockOrders.filter((o) => o.priority === filterPriority);

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'stat': return <Badge variant="danger">STAT</Badge>;
      case 'urgent': return <Badge variant="warning">Urgent</Badge>;
      default: return <Badge variant="slate">Routine</Badge>;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'in_analysis': return <Badge variant="purple">In Analysis</Badge>;
      case 'awaiting_verification': return <Badge variant="warning">Verification</Badge>;
      case 'released': return <Badge variant="success">Released</Badge>;
      case 'samples_pending': return <Badge variant="teal">Sample Pending</Badge>;
      default: return <Badge variant="slate">{status}</Badge>;
    }
  };

  return (
    <>
      <PageHeader
        title="Lab Requisitions & Orders"
        description="Comprehensive diagnostic order tracking from requisition intake through analytical completion."
        actions={
          <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
            <PlusCircle size={16} />
            <span>New Lab Order (UI Demo)</span>
          </button>
        }
      />

      <StatusBanner
        type="info"
        badgeText="UI Shell Demonstration"
        message="Laboratory orders listed below represent mock demonstration records. Order lifecycle state machines and HL7/FHIR integrations will be provisioned in Phase 2."
      />

      {/* Filter Toolbar */}
      <div className="card" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            {['all', 'stat', 'urgent', 'routine'].map((p) => (
              <button
                key={p}
                onClick={() => setFilterPriority(p)}
                className={`btn btn-sm ${filterPriority === p ? 'btn-primary' : 'btn-secondary'}`}
                style={{ textTransform: 'capitalize' }}
              >
                {p === 'all' ? 'All Orders' : p}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
            Showing {filteredOrders.length} records
          </span>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card">
        <div className="table-container">
          <table className="lms-table">
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Patient / MRN</th>
                <th>Diagnostic Tests</th>
                <th>Priority</th>
                <th>Specimen</th>
                <th>Status</th>
                <th>Date / Time</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--primary-700)' }}>{o.id}</strong>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>{o.patient}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{o.mrn}</span>
                    </div>
                  </td>
                  <td>{o.tests.join(', ')}</td>
                  <td>{getPriorityBadge(o.priority)}</td>
                  <td>{o.sampleType}</td>
                  <td>{getStatusBadge(o.status)}</td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{o.date}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedOrder(o)}
                    >
                      <Eye size={13} />
                      <span>View</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Order Details: ${selectedOrder.id}` : ''}
        footer={
          <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>
            Close
          </button>
        }
      >
        {selectedOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <StatusBanner
              type="info"
              badgeText="Phase 1 Mock View"
              message="Demonstration modal displaying requisition details."
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Patient</p>
                <p style={{ fontWeight: 600 }}>{selectedOrder.patient} ({selectedOrder.mrn})</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Ordering Physician</p>
                <p style={{ fontWeight: 600 }}>{selectedOrder.physician}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Specimen Container</p>
                <p>{selectedOrder.sampleType}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Priority Level</p>
                <div>{getPriorityBadge(selectedOrder.priority)}</div>
              </div>
            </div>
            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>Tests Ordered</p>
              <ul style={{ paddingLeft: '1.25rem', color: 'var(--slate-700)' }}>
                {selectedOrder.tests.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Modal>

      {/* New Order Modal (Demo) */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Diagnostic Order (UI Demo)"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                alert('UI Demo Notice: Order creation pipeline will be active in Phase 2.');
                setIsCreateOpen(false);
              }}
            >
              Submit Requisition (Demo)
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <StatusBanner
            type="warning"
            badgeText="Preparation Mode"
            message="Demonstration requisition entry form."
          />
          <div className="form-group">
            <label className="form-label">Select Patient</label>
            <select className="form-select">
              <option>Eleanor Vance (MRN-9021)</option>
              <option>Arthur Pendelton (MRN-8842)</option>
              <option>Maria Santos (MRN-7731)</option>
            </select>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Ordering Physician</label>
              <input type="text" className="form-input" placeholder="Dr. Name" />
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-select">
                <option>Routine</option>
                <option>Urgent</option>
                <option>STAT (Immediate)</option>
              </select>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default OrdersPage;
