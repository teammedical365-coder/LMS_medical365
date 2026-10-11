/**
 * Lab Management System (LMS) - Lab Orders Page (Phase 6 Real Clinical Integration)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, PlusCircle, Search, Filter, Eye, Loader2, CheckCircle2, Clock, AlertTriangle, Edit2, Layers } from 'lucide-react';
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

  // Result Entry State (Single Item)
  const [resultItem, setResultItem] = useState(null);
  const [paramInputs, setParamInputs] = useState({});
  const [singleResultInput, setSingleResultInput] = useState('');
  const [isSavingResult, setIsSavingResult] = useState(false);

  // Batch Result Entry State
  const [isBatchOpen, setIsBatchOpen] = useState(false);
  const [batchInputs, setBatchInputs] = useState({});
  const [batchErrors, setBatchErrors] = useState({});
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  const canEnterResults =
    user?.role === 'lab_technician' ||
    user?.role === 'lab_admin' ||
    user?.permissions?.includes('samples:process') ||
    user?.permissions?.includes('*');

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

  const openResultEntry = (it) => {
    setResultItem(it);
    const initialInputs = {};
    if (Array.isArray(it.parameters) && it.parameters.length > 0) {
      it.parameters.forEach((p) => {
        const existing = it.parameterResults?.find(
          (pr) => pr.parameterCode?.toUpperCase() === p.parameterCode?.toUpperCase()
        );
        initialInputs[p.parameterCode] =
          existing !== undefined && existing.value !== undefined
            ? existing.value
            : p.resultType === 'OPTIONS' && p.options?.[0]
            ? p.options[0]
            : '';
      });
    }
    setParamInputs(initialInputs);
    setSingleResultInput(it.resultValue || '');
  };

  const handleSaveResult = async (e) => {
    e.preventDefault();
    if (!resultItem || !selectedOrder) return;

    try {
      setIsSavingResult(true);
      setError(null);

      let payload = {};
      if (Array.isArray(resultItem.parameters) && resultItem.parameters.length > 0) {
        payload.parameterResults = resultItem.parameters.map((p) => ({
          parameterCode: p.parameterCode,
          name: p.name,
          resultType: p.resultType,
          value: paramInputs[p.parameterCode] ?? '',
          unit: p.unit || '',
        }));
      } else {
        payload.resultValue = singleResultInput;
      }

      const res = await clinicalService.recordOrderItemResult(
        tenantId,
        selectedOrder.orderId,
        resultItem.itemId || resultItem.testCode,
        payload
      );

      if (res.success) {
        setSuccessMsg(`Diagnostic results recorded for ${resultItem.testName}`);
        setResultItem(null);
        await fetchOrders();
        if (res.data) {
          setSelectedOrder(res.data);
        }
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record test results');
    } finally {
      setIsSavingResult(false);
    }
  };

  const openBatchResultEntry = () => {
    if (!selectedOrder || !Array.isArray(selectedOrder.items)) return;
    const initial = {};
    selectedOrder.items.forEach((it) => {
      const itemKey = it.itemId || it.testCode;
      if (Array.isArray(it.parameters) && it.parameters.length > 0) {
        const pVals = {};
        it.parameters.forEach((p) => {
          const existing = it.parameterResults?.find(
            (pr) => pr.parameterCode?.toUpperCase() === p.parameterCode?.toUpperCase()
          );
          pVals[p.parameterCode] =
            existing !== undefined && existing.value !== undefined
              ? existing.value
              : p.resultType === 'OPTIONS' && p.options?.[0]
              ? p.options[0]
              : '';
        });
        initial[itemKey] = { type: 'parameters', values: pVals };
      } else {
        initial[itemKey] = { type: 'single', value: it.resultValue || '' };
      }
    });
    setBatchInputs(initial);
    setBatchErrors({});
    setIsBatchOpen(true);
  };

  const updateBatchParamValue = (itemKey, paramCode, val) => {
    setBatchInputs((prev) => {
      const current = prev[itemKey] || { type: 'parameters', values: {} };
      return {
        ...prev,
        [itemKey]: {
          ...current,
          values: {
            ...current.values,
            [paramCode]: val,
          },
        },
      };
    });
  };

  const updateBatchSingleValue = (itemKey, val) => {
    setBatchInputs((prev) => {
      const current = prev[itemKey] || { type: 'single', value: '' };
      return {
        ...prev,
        [itemKey]: {
          ...current,
          value: val,
        },
      };
    });
  };

  const handleSaveBatchResults = async (e) => {
    e.preventDefault();
    if (!selectedOrder || !selectedOrder.items?.length) return;

    setIsSavingBatch(true);
    setBatchErrors({});
    setError(null);

    const errors = {};
    const payloads = [];

    // 1. Client-side input validation per test item and parameter
    for (const it of selectedOrder.items) {
      const itemKey = it.itemId || it.testCode;
      const itemInput = batchInputs[itemKey];

      if (!itemInput) continue;

      if (itemInput.type === 'parameters') {
        const paramPayloads = [];
        let itemHasErr = false;

        for (const p of it.parameters || []) {
          const val = itemInput.values?.[p.parameterCode];
          const pType = p.resultType || 'TEXT';

          if (val === undefined || val === null || String(val).trim() === '') {
            errors[itemKey] = `Value required for parameter '${p.name || p.parameterCode}' in ${it.testName}`;
            itemHasErr = true;
            break;
          }

          if (pType === 'NUMERIC') {
            if (isNaN(Number(val))) {
              errors[itemKey] = `Numeric value required for parameter '${p.name || p.parameterCode}' in ${it.testName}`;
              itemHasErr = true;
              break;
            }
            paramPayloads.push({
              parameterCode: p.parameterCode,
              name: p.name,
              resultType: 'NUMERIC',
              value: Number(val),
              unit: p.unit || '',
            });
          } else if (pType === 'OPTIONS') {
            const validOpts = Array.isArray(p.options) ? p.options : [];
            const matched = validOpts.find((o) => o.trim().toUpperCase() === String(val).trim().toUpperCase());
            if (!matched) {
              errors[itemKey] = `Invalid option '${val}' for '${p.name || p.parameterCode}'. Allowed: ${validOpts.join(', ')}`;
              itemHasErr = true;
              break;
            }
            paramPayloads.push({
              parameterCode: p.parameterCode,
              name: p.name,
              resultType: 'OPTIONS',
              value: matched,
              unit: p.unit || '',
            });
          } else {
            paramPayloads.push({
              parameterCode: p.parameterCode,
              name: p.name,
              resultType: 'TEXT',
              value: String(val).trim(),
              unit: p.unit || '',
            });
          }
        }

        if (!itemHasErr) {
          payloads.push({ itemKey, it, payload: { parameterResults: paramPayloads } });
        }
      } else {
        const sVal = itemInput.value;
        if (!sVal || String(sVal).trim() === '') {
          errors[itemKey] = `Result value required for ${it.testName}`;
        } else {
          payloads.push({ itemKey, it, payload: { resultValue: String(sVal).trim() } });
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      setBatchErrors(errors);
      setIsSavingBatch(false);
      return;
    }

    // 2. Submit results using existing API endpoint per item
    let successCount = 0;
    let failCount = 0;
    let latestOrder = selectedOrder;

    for (const { itemKey, it, payload } of payloads) {
      try {
        const res = await clinicalService.recordOrderItemResult(
          tenantId,
          selectedOrder.orderId,
          itemKey,
          payload
        );
        if (res.success) {
          successCount++;
          if (res.data) latestOrder = res.data;
        } else {
          failCount++;
          errors[itemKey] = res.message || `Failed to record results for ${it.testName}`;
        }
      } catch (err) {
        failCount++;
        errors[itemKey] = err.response?.data?.message || err.message || `Error saving results for ${it.testName}`;
      }
    }

    await fetchOrders();
    if (latestOrder) {
      setSelectedOrder(latestOrder);
    }

    if (failCount > 0) {
      setBatchErrors(errors);
      setIsSavingBatch(false);
      setError(`Saved ${successCount} test(s), but ${failCount} test(s) failed. Check highlighted errors.`);
    } else {
      setIsSavingBatch(false);
      setIsBatchOpen(false);
      setSuccessMsg(`All ${successCount} test panel results saved successfully for requisition ${selectedOrder.orderNumber}`);
      setTimeout(() => setSuccessMsg(null), 4000);
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
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
            {canEnterResults && selectedOrder?.items?.length > 0 ? (
              <button
                className="btn btn-primary btn-sm"
                onClick={openBatchResultEntry}
                title="Enter results for all tests in this requisition at once"
              >
                <Layers size={14} />
                <span>Enter All Results ({selectedOrder.items.length})</span>
              </button>
            ) : <div />}
            <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>
              Close
            </button>
          </div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', margin: 0, fontWeight: 600 }}>Tests In Requisition</p>
                {canEnterResults && selectedOrder.items?.length > 0 && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={openBatchResultEntry}
                    title="Enter results for all tests in this requisition at once"
                  >
                    <Layers size={13} />
                    <span>Enter All Results</span>
                  </button>
                )}
              </div>
              <div style={{ border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <table className="lms-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Test Code</th>
                      <th>Panel Name</th>
                      <th>Price</th>
                      <th>Status</th>
                      <th>Diagnostic Results</th>
                      {canEnterResults && <th style={{ textAlign: 'right' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace' }}>{it.testCode}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{it.testName}</div>
                          {Array.isArray(it.parameters) && it.parameters.length > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                              {it.parameters.length} structured {it.parameters.length === 1 ? 'parameter' : 'parameters'}
                            </div>
                          )}
                        </td>
                        <td>${Number(it.price || 0).toFixed(2)}</td>
                        <td>{it.status === 'completed' ? <Badge variant="success">Completed</Badge> : <Badge variant="slate">{it.status}</Badge>}</td>
                        <td>
                          {Array.isArray(it.parameterResults) && it.parameterResults.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem' }}>
                              {it.parameterResults.map((pr, pidx) => (
                                <div
                                  key={pidx}
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '2px 6px',
                                    background: pr.isAbnormal ? '#fff1f2' : 'var(--slate-50)',
                                    borderRadius: '4px',
                                    border: `1px solid ${pr.isAbnormal ? '#fecdd3' : 'var(--slate-200)'}`,
                                  }}
                                >
                                  <span>
                                    <strong>{pr.name || pr.parameterCode}:</strong> {String(pr.value)} {pr.unit}
                                  </span>
                                  <span style={{ color: pr.isAbnormal ? '#e11d48' : '#059669', fontWeight: 600 }}>
                                    {pr.isAbnormal ? 'ABNORMAL' : 'Normal'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : it.resultValue ? (
                            <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                              {it.resultValue}
                              {it.isAbnormal && <Badge variant="danger" style={{ marginLeft: '4px' }}>Abnormal</Badge>}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--slate-400)', fontStyle: 'italic' }}>
                              Awaiting result entry
                            </span>
                          )}
                        </td>
                        {canEnterResults && (
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => openResultEntry(it)}
                              title="Enter / update test parameters"
                            >
                              <Edit2 size={12} />
                              <span>{it.parameterResults?.length || it.resultValue ? 'Edit Results' : 'Enter Results'}</span>
                            </button>
                          </td>
                        )}
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

      {/* Parameter Result Entry Modal */}
      <Modal
        isOpen={!!resultItem}
        onClose={() => setResultItem(null)}
        title={resultItem ? `Diagnostic Result Entry: ${resultItem.testName} (${resultItem.testCode})` : ''}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setResultItem(null)} disabled={isSavingResult}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveResult} disabled={isSavingResult}>
              {isSavingResult ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving Results...</span>
                </>
              ) : (
                <span>Save Diagnostic Results</span>
              )}
            </button>
          </>
        }
      >
        {resultItem && (
          <form onSubmit={handleSaveResult} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--slate-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8125rem' }}>
                <div>Patient: <strong>{selectedOrder?.patientName}</strong> ({selectedOrder?.patientMrn})</div>
                <div>Requisition: <strong>{selectedOrder?.orderNumber}</strong></div>
                <div>Test Panel: <strong>{resultItem.testName}</strong></div>
                <div>Test Code: <span style={{ fontFamily: 'monospace' }}>{resultItem.testCode}</span></div>
              </div>
            </div>

            {Array.isArray(resultItem.parameters) && resultItem.parameters.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <p style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--slate-700)', margin: 0 }}>
                  Enter Values for Configured Test Parameters ({resultItem.parameters.length}):
                </p>
                {resultItem.parameters.map((param, pIdx) => {
                  const pType = param.resultType || 'TEXT';
                  let refDisplay = '';
                  if (param.referenceRanges && param.referenceRanges.length > 0) {
                    const r = param.referenceRanges[0];
                    if (r.lowNormal !== undefined && r.highNormal !== undefined) {
                      refDisplay = `${r.lowNormal} - ${r.highNormal} ${param.unit || ''}`.trim();
                    } else if (r.notes) {
                      refDisplay = r.notes;
                    }
                  }

                  return (
                    <div
                      key={pIdx}
                      style={{
                        padding: '0.75rem',
                        border: '1px solid var(--slate-200)',
                        borderRadius: 'var(--radius-md)',
                        background: '#fff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.4rem',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ color: 'var(--slate-800)' }}>{param.name}</strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', fontFamily: 'monospace', marginLeft: '6px' }}>
                            ({param.parameterCode})
                          </span>
                        </div>
                        <Badge variant={pType === 'NUMERIC' ? 'blue' : pType === 'OPTIONS' ? 'purple' : 'teal'}>
                          {pType}
                        </Badge>
                      </div>

                      {refDisplay && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                          Reference Range: <span style={{ fontWeight: 500, color: 'var(--slate-700)' }}>{refDisplay}</span>
                        </div>
                      )}

                      <div style={{ marginTop: '4px' }}>
                        {pType === 'NUMERIC' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="number"
                              step="any"
                              className="form-input"
                              required
                              placeholder={`Enter numeric value ${param.unit ? `(${param.unit})` : ''}`}
                              value={paramInputs[param.parameterCode] ?? ''}
                              onChange={(e) => setParamInputs({ ...paramInputs, [param.parameterCode]: e.target.value })}
                            />
                            {param.unit && (
                              <span style={{ fontWeight: 600, color: 'var(--slate-600)', minWidth: '40px' }}>
                                {param.unit}
                              </span>
                            )}
                          </div>
                        ) : pType === 'OPTIONS' ? (
                          <select
                            className="form-select"
                            required
                            value={paramInputs[param.parameterCode] ?? ''}
                            onChange={(e) => setParamInputs({ ...paramInputs, [param.parameterCode]: e.target.value })}
                          >
                            <option value="">-- Select Configured Option --</option>
                            {param.options?.map((opt, oIdx) => (
                              <option key={oIdx} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            className="form-input"
                            required
                            placeholder="Enter qualitative result text"
                            value={paramInputs[param.parameterCode] ?? ''}
                            onChange={(e) => setParamInputs({ ...paramInputs, [param.parameterCode]: e.target.value })}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="form-group">
                <label className="form-label">Single Test Result Value *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  placeholder="e.g. 14.5 g/dL or Negative"
                  value={singleResultInput}
                  onChange={(e) => setSingleResultInput(e.target.value)}
                />
              </div>
            )}
          </form>
        )}
      </Modal>

      {/* Batch Result Entry Modal */}
      <Modal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
        title={selectedOrder ? `Batch Diagnostic Results Entry: Requisition ${selectedOrder.orderNumber}` : ''}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsBatchOpen(false)} disabled={isSavingBatch}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveBatchResults} disabled={isSavingBatch}>
              {isSavingBatch ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving All Results...</span>
                </>
              ) : (
                <span>Save All Entered Results</span>
              )}
            </button>
          </>
        }
      >
        {selectedOrder && (
          <form onSubmit={handleSaveBatchResults} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--slate-50)', borderRadius: 'var(--radius-md)', border: '1px solid var(--slate-200)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8125rem' }}>
                <div>Patient: <strong>{selectedOrder.patientName}</strong> ({selectedOrder.patientMrn})</div>
                <div>Requisition: <strong>{selectedOrder.orderNumber}</strong></div>
                <div>Physician: <strong>{selectedOrder.orderingPhysician}</strong></div>
                <div>Total Ordered Tests: <strong>{selectedOrder.items?.length || 0}</strong></div>
              </div>
            </div>

            {Object.keys(batchErrors).length > 0 && (
              <div style={{ padding: '0.625rem 0.875rem', background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 'var(--radius-md)', color: '#be123c', fontSize: '0.8125rem' }}>
                <strong>Validation Notice:</strong> Some parameter results failed validation. Please correct the highlighted entries below.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '55vh', overflowY: 'auto', paddingRight: '4px' }}>
              {selectedOrder.items?.map((it, idx) => {
                const itemKey = it.itemId || it.testCode;
                const itemErr = batchErrors[itemKey];
                const inputState = batchInputs[itemKey];

                return (
                  <div
                    key={idx}
                    style={{
                      border: `1px solid ${itemErr ? '#fda4af' : 'var(--slate-200)'}`,
                      borderRadius: 'var(--radius-md)',
                      background: itemErr ? '#fff5f5' : '#fff',
                      padding: '0.875rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.625rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--slate-100)', paddingBottom: '0.5rem' }}>
                      <div>
                        <span style={{ fontWeight: 600, color: 'var(--slate-800)', fontSize: '0.9rem' }}>
                          {idx + 1}. {it.testName}
                        </span>
                        <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--slate-500)', marginLeft: '8px' }}>
                          ({it.testCode})
                        </span>
                      </div>
                      <div>
                        {it.status === 'completed' ? (
                          <Badge variant="success">Completed</Badge>
                        ) : (
                          <Badge variant="warning">Pending Results</Badge>
                        )}
                      </div>
                    </div>

                    {itemErr && (
                      <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 500 }}>
                        ⚠️ {itemErr}
                      </div>
                    )}

                    {Array.isArray(it.parameters) && it.parameters.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                        {it.parameters.map((param, pIdx) => {
                          const pType = param.resultType || 'TEXT';
                          let refDisplay = '';
                          if (param.referenceRanges && param.referenceRanges.length > 0) {
                            const r = param.referenceRanges[0];
                            if (r.lowNormal !== undefined && r.highNormal !== undefined) {
                              refDisplay = `${r.lowNormal} - ${r.highNormal} ${param.unit || ''}`.trim();
                            } else if (r.notes) {
                              refDisplay = r.notes;
                            }
                          }

                          const prevSaved = it.parameterResults?.find(
                            (pr) => pr.parameterCode?.toUpperCase() === param.parameterCode?.toUpperCase()
                          );

                          const currentVal = inputState?.values?.[param.parameterCode] ?? '';

                          return (
                            <div
                              key={pIdx}
                              style={{
                                padding: '0.625rem',
                                background: 'var(--slate-50)',
                                border: '1px solid var(--slate-200)',
                                borderRadius: 'var(--radius-sm)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.35rem',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <span style={{ fontWeight: 600, color: 'var(--slate-700)', fontSize: '0.8125rem' }}>
                                    {param.name}
                                  </span>
                                  <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontFamily: 'monospace', marginLeft: '6px' }}>
                                    ({param.parameterCode})
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  {prevSaved !== undefined && (
                                    <span style={{ fontSize: '0.7rem', color: '#0d9488', background: '#f0fdfa', padding: '1px 6px', borderRadius: '4px', border: '1px solid #99f6e4' }}>
                                      Saved: {String(prevSaved.value)} {prevSaved.unit || ''}
                                    </span>
                                  )}
                                  <Badge variant={pType === 'NUMERIC' ? 'blue' : pType === 'OPTIONS' ? 'purple' : 'teal'}>
                                    {pType}
                                  </Badge>
                                </div>
                              </div>

                              {refDisplay && (
                                <div style={{ fontSize: '0.725rem', color: 'var(--slate-500)' }}>
                                  Configured Range: <span style={{ fontWeight: 500, color: 'var(--slate-700)' }}>{refDisplay}</span>
                                </div>
                              )}

                              <div>
                                {pType === 'NUMERIC' ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                      type="number"
                                      step="any"
                                      className="form-input"
                                      required
                                      placeholder={`Enter numeric value ${param.unit ? `(${param.unit})` : ''}`}
                                      value={currentVal}
                                      onChange={(e) => updateBatchParamValue(itemKey, param.parameterCode, e.target.value)}
                                    />
                                    {param.unit && (
                                      <span style={{ fontWeight: 600, color: 'var(--slate-600)', minWidth: '40px', fontSize: '0.8125rem' }}>
                                        {param.unit}
                                      </span>
                                    )}
                                  </div>
                                ) : pType === 'OPTIONS' ? (
                                  <select
                                    className="form-select"
                                    required
                                    value={currentVal}
                                    onChange={(e) => updateBatchParamValue(itemKey, param.parameterCode, e.target.value)}
                                  >
                                    <option value="">-- Select Configured Option --</option>
                                    {param.options?.map((opt, oIdx) => (
                                      <option key={oIdx} value={opt}>
                                        {opt}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    className="form-input"
                                    required
                                    placeholder="Enter qualitative result text"
                                    value={currentVal}
                                    onChange={(e) => updateBatchParamValue(itemKey, param.parameterCode, e.target.value)}
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="form-group" style={{ margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <label className="form-label" style={{ margin: 0, fontSize: '0.75rem' }}>Single Test Result Value *</label>
                          {it.resultValue && (
                            <span style={{ fontSize: '0.7rem', color: '#0d9488' }}>
                              Saved: {it.resultValue}
                            </span>
                          )}
                        </div>
                        <input
                          type="text"
                          className="form-input"
                          required
                          placeholder="e.g. Negative or Normal"
                          value={inputState?.value ?? ''}
                          onChange={(e) => updateBatchSingleValue(itemKey, e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </form>
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
