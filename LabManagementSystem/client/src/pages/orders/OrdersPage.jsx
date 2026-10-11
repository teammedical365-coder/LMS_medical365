/**
 * Lab Management System (LMS) - Lab Orders Page (Phase 6 Real Clinical Integration)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, PlusCircle, Search, Filter, Eye, Loader2, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import clinicalService from '../../services/clinicalService';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

export function OrdersPage() {
  const { user, tenant } = useAuth();
  const tenantId = tenant?.tenantId || user?.tenantId;

  const [orders, setOrders] = useState([]);
  const [patients, setPatients] = useState([]);
  const [catalogTests, setCatalogTests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterPriority, setFilterPriority] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // New Order Form State
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [orderingPhysician, setOrderingPhysician] = useState('');
  const [priority, setPriority] = useState('routine');
  const [selectedTestCodes, setSelectedTestCodes] = useState([]);

  const fetchOrders = useCallback(async () => {
    if (!tenantId) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await clinicalService.getOrders(tenantId);
      if (res.success && Array.isArray(res.data)) {
        setOrders(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve orders');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  const fetchPrerequisites = useCallback(async () => {
    if (!tenantId) return;
    try {
      const [patRes, catRes] = await Promise.all([
        clinicalService.getPatients(tenantId),
        clinicalService.getTestCatalog(tenantId),
      ]);
      if (patRes.success) setPatients(patRes.data || []);
      if (catRes.success) setCatalogTests(catRes.data || []);
    } catch {
      // non-fatal prerequisite loading
    }
  }, [tenantId]);

  useEffect(() => {
    fetchOrders();
    fetchPrerequisites();
  }, [fetchOrders, fetchPrerequisites]);

  const handleTestToggle = (code) => {
    setSelectedTestCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const calculatedTotal = selectedTestCodes.reduce((sum, code) => {
    const item = catalogTests.find((t) => (t.code || '').toUpperCase() === code.toUpperCase());
    return sum + (item ? Number(item.price) || 0 : 0);
  }, 0);

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) {
      alert('Please select a patient');
      return;
    }
    if (selectedTestCodes.length === 0) {
      alert('Please select at least one test from the catalog');
      return;
    }

    const patient = patients.find((p) => p.patientId === selectedPatientId);
    const testsPayload = selectedTestCodes.map((code) => {
      const t = catalogTests.find((item) => (item.code || '').toUpperCase() === code.toUpperCase());
      return {
        testCode: code,
        testName: t?.name || code,
        price: t ? Number(t.price) || 0 : 0,
      };
    });

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await clinicalService.createOrder(tenantId, {
        patientId: selectedPatientId,
        patientName: patient?.fullName || `${patient?.firstName} ${patient?.lastName}`,
        patientMrn: patient?.mrn,
        orderingPhysician: orderingPhysician || 'Attending Physician',
        priority,
        tests: testsPayload,
      });

      if (res.success) {
        setSuccessMsg(`Order ${res.data.orderNumber} created successfully! (Total: $${res.data.totalAmount})`);
        setIsCreateOpen(false);
        setSelectedPatientId('');
        setSelectedTestCodes([]);
        setOrderingPhysician('');
        fetchOrders();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (filterPriority === 'all') return true;
    return o.priority === filterPriority;
  });

  const getPriorityBadge = (p) => {
    switch (p) {
      case 'stat': return <Badge variant="danger">STAT</Badge>;
      case 'urgent': return <Badge variant="warning">Urgent</Badge>;
      default: return <Badge variant="teal">Routine</Badge>;
    }
  };

  const getOrderStatusBadge = (s) => {
    switch (s) {
      case 'completed': return <Badge variant="success">Completed</Badge>;
      case 'in_analysis': return <Badge variant="purple">In Analysis</Badge>;
      case 'ordered': return <Badge variant="blue">Ordered</Badge>;
      case 'cancelled': return <Badge variant="danger">Cancelled</Badge>;
      default: return <Badge variant="slate">{s}</Badge>;
    }
  };

  const getPaymentStatusBadge = (s) => {
    switch (s) {
      case 'paid': return <Badge variant="success">Paid</Badge>;
      case 'partially_paid': return <Badge variant="warning">Partial</Badge>;
      default: return <Badge variant="danger">Unpaid</Badge>;
    }
  };

  return (
    <>
      <PageHeader
        title="Diagnostic Orders & Requisitions"
        description="Clinical test requisitions, specimen accession linkages, and laboratory workflow prioritization."
        actions={
          <button
            className="btn btn-primary"
            onClick={() => {
              setIsCreateOpen(true);
              fetchPrerequisites();
            }}
          >
            <PlusCircle size={16} />
            <span>Create Order</span>
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

      {/* Filter Bar */}
      <div className="card" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} style={{ color: 'var(--slate-400)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--slate-600)' }}>Priority Filter:</span>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="form-select"
              style={{ width: 'auto', padding: '0.25rem 0.75rem' }}
            >
              <option value="all">All Priorities</option>
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="stat">STAT</option>
            </select>
          </div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
            Showing {filteredOrders.length} order(s)
          </span>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card">
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary-blue)' }} />
            <p>Loading laboratory orders...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <ClipboardList size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--slate-700)' }}>No orders found</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Click "Create Order" to accession a new diagnostic requisition.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Patient / MRN</th>
                  <th>Tests Ordered</th>
                  <th>Priority</th>
                  <th>Order Status</th>
                  <th>Total / Payment</th>
                  <th>Created At</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((ord) => (
                  <tr key={ord.orderId || ord._id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-blue)' }}>
                        {ord.orderNumber}
                      </span>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600 }}>{ord.patientName}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>
                          {ord.patientMrn}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--slate-700)' }}>
                        {ord.items && ord.items.length > 0
                          ? ord.items.map((it) => it.testName || it.testCode).join(', ')
                          : 'General Panel'}
                      </span>
                    </td>
                    <td>{getPriorityBadge(ord.priority)}</td>
                    <td>{getOrderStatusBadge(ord.orderStatus)}</td>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600 }}>${ord.totalAmount?.toFixed(2) || '0.00'}</div>
                        <div>{getPaymentStatusBadge(ord.paymentStatus)}</div>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                      {ord.createdAt ? new Date(ord.createdAt).toLocaleDateString() : 'Today'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedOrder(ord)}
                        title="View Requisition Details"
                      >
                        <Eye size={14} />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      <Modal
        isOpen={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Requisition Details: ${selectedOrder.orderNumber}` : ''}
        footer={
          <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>
            Close
          </button>
        }
      >
        {selectedOrder && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Patient</p>
                <p style={{ fontWeight: 600 }}>{selectedOrder.patientName} ({selectedOrder.patientMrn})</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Ordering Physician</p>
                <p style={{ fontWeight: 600 }}>{selectedOrder.orderingPhysician}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Priority Level</p>
                <div>{getPriorityBadge(selectedOrder.priority)}</div>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Order Status</p>
                <div>{getOrderStatusBadge(selectedOrder.orderStatus)}</div>
              </div>
            </div>

            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '6px' }}>Tests In Requisition</p>
              <div style={{ border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table className="lms-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Test Code</th>
                      <th>Panel Name</th>
                      <th>Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace' }}>{it.testCode}</td>
                        <td>{it.testName}</td>
                        <td>${Number(it.price || 0).toFixed(2)}</td>
                        <td>{it.status === 'completed' ? <Badge variant="success">Completed</Badge> : <Badge variant="slate">{it.status}</Badge>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--slate-50)', borderRadius: 'var(--radius-md)' }}>
              <span>Total Invoice Amount:</span>
              <strong style={{ fontSize: '1rem', color: 'var(--primary-blue)' }}>${Number(selectedOrder.totalAmount || 0).toFixed(2)}</strong>
            </div>
          </div>
        )}
      </Modal>

      {/* New Order Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Diagnostic Laboratory Order"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreateOrder} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Submitting...</span>
                </>
              ) : (
                <span>Submit Requisition (${calculatedTotal.toFixed(2)})</span>
              )}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div className="form-group">
            <label className="form-label">Select Registered Patient *</label>
            <select
              className="form-select"
              required
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
            >
              <option value="">-- Choose a patient --</option>
              {patients.map((p) => (
                <option key={p.patientId} value={p.patientId}>
                  {p.fullName || `${p.firstName} ${p.lastName}`} ({p.mrn})
                </option>
              ))}
            </select>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Ordering Physician</label>
              <input
                type="text"
                className="form-input"
                placeholder="Dr. Eleanor Vance"
                value={orderingPhysician}
                onChange={(e) => setOrderingPhysician(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                className="form-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="stat">STAT (Immediate)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Select Laboratory Panels (from Test Catalog) *</label>
            <div
              style={{
                maxHeight: '180px',
                overflowY: 'auto',
                border: '1px solid var(--slate-200)',
                borderRadius: 'var(--radius-md)',
                padding: '0.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.35rem',
              }}
            >
              {catalogTests.length === 0 ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', padding: '0.5rem' }}>
                  No tests in catalog. Please seed or create tests first.
                </p>
              ) : (
                catalogTests.map((t) => {
                  const isChecked = selectedTestCodes.includes(t.code);
                  return (
                    <label
                      key={t.code}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.4rem 0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        background: isChecked ? 'var(--primary-50)' : 'transparent',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTestToggle(t.code)}
                        />
                        <span style={{ fontWeight: 500 }}>{t.name}</span>
                        <span style={{ color: 'var(--slate-400)', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                          [{t.code}]
                        </span>
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>${Number(t.price).toFixed(2)}</span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div
            style={{
              padding: '0.75rem',
              background: 'var(--slate-100)',
              borderRadius: 'var(--radius-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '0.875rem', color: 'var(--slate-700)' }}>
              Selected Tests: <strong>{selectedTestCodes.length}</strong>
            </span>
            <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary-blue)' }}>
              Total: ${calculatedTotal.toFixed(2)}
            </span>
          </div>
        </form>
      </Modal>
    </>
  );
}

export default OrdersPage;
