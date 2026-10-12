/**
 * Lab Management System (LMS) - Laboratory Billing Page (Phase 6 Real Billing Ledger)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { CreditCard, IndianRupee, Receipt, Eye, CheckCircle2, Clock, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import clinicalService from '../../services/clinicalService';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import StatCard from '../../components/common/StatCard';
import Modal from '../../components/common/Modal';

export function BillingPage() {
  const { user, tenant } = useAuth();
  const tenantId = tenant?.tenantId || user?.tenantId;

  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentInvoice, setPaymentInvoice] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('credit_card');
  const [paymentReference, setPaymentReference] = useState('');

  const fetchBillingData = useCallback(async () => {
    if (!tenantId) return;
    try {
      setIsLoading(true);
      setError(null);
      const [invRes, sumRes] = await Promise.all([
        clinicalService.getInvoices(tenantId),
        clinicalService.getBillingSummary(tenantId).catch(() => ({ success: false })),
      ]);
      if (invRes.success && Array.isArray(invRes.data)) {
        setInvoices(invRes.data);
      }
      if (sumRes.success && sumRes.data) {
        setSummary(sumRes.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve billing records');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchBillingData();
  }, [fetchBillingData]);

  const handleOpenPayment = (inv) => {
    setPaymentInvoice(inv);
    setPaymentAmount(inv.balance?.toFixed(2) || '0.00');
    setPaymentMethod('credit_card');
    setPaymentReference(`TXN-${Date.now().toString().slice(-6)}`);
  };

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentInvoice) return;
    const num = Number(paymentAmount);
    if (!num || num <= 0) {
      alert('Please enter a valid payment amount greater than zero');
      return;
    }
    if (num > paymentInvoice.balance) {
      alert(`Amount (₹${num.toFixed(2)}) cannot exceed outstanding balance (₹${paymentInvoice.balance.toFixed(2)})`);
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      const res = await clinicalService.recordPayment(tenantId, paymentInvoice.invoiceId, {
        amount: num,
        method: paymentMethod,
        reference: paymentReference,
      });

      if (res.success) {
        setSuccessMsg(`Payment of ₹${num.toFixed(2)} recorded on invoice ${paymentInvoice.invoiceNumber}`);
        setPaymentInvoice(null);
        fetchBillingData();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record payment');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid': return <Badge variant="success">Paid in Full</Badge>;
      case 'partially_paid': return <Badge variant="warning">Partial</Badge>;
      default: return <Badge variant="danger">Unpaid</Badge>;
    }
  };

  const totalInvoiced = invoices.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);
  const totalSettled = invoices.reduce((s, i) => s + (Number(i.paidAmount) || 0), 0);
  const totalOutstanding = invoices.reduce((s, i) => s + (Number(i.balance) || 0), 0);

  return (
    <>
      <PageHeader
        title="Laboratory Billing & Fee Management"
        description="Patient invoice tracking, payment settlements, revenue collection, and outstanding ledger reconciliation."
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

      {/* Billing Metrics */}
      <div className="grid-3">
        <StatCard
          title="Total Invoiced"
          value={`₹${(summary?.totalInvoiced || totalInvoiced).toFixed(2)}`}
          subtitle={`${invoices.length} Requisition Invoices`}
          icon={Receipt}
          colorScheme="blue"
        />
        <StatCard
          title="Settled Revenue"
          value={`₹${(summary?.totalRevenue || totalSettled).toFixed(2)}`}
          subtitle="Processed Collections"
          icon={IndianRupee}
          colorScheme="teal"
        />
        <StatCard
          title="Outstanding Balance"
          value={`₹${(summary?.totalOutstanding || totalOutstanding).toFixed(2)}`}
          subtitle="Pending Collection"
          icon={CreditCard}
          colorScheme="orange"
        />
      </div>

      {/* Invoices Table */}
      <div className="card">
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary-blue)' }} />
            <p>Loading invoice ledger...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <Receipt size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--slate-700)' }}>No invoices generated yet</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Invoices are automatically created when new orders are submitted.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Order #</th>
                  <th>Patient Name</th>
                  <th>Total Amount</th>
                  <th>Paid Amount</th>
                  <th>Outstanding Balance</th>
                  <th>Payment Status</th>
                  <th>Invoice Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.invoiceId || inv._id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-blue)' }}>
                        {inv.invoiceNumber}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace' }}>{inv.orderNumber || 'ORD-GEN'}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{inv.patientName}</td>
                    <td>₹{Number(inv.totalAmount || 0).toFixed(2)}</td>
                    <td>₹{Number(inv.paidAmount || 0).toFixed(2)}</td>
                    <td style={{ fontWeight: 600, color: inv.balance > 0 ? 'var(--danger-600)' : 'var(--teal-600)' }}>
                      ₹{Number(inv.balance || 0).toFixed(2)}
                    </td>
                    <td>{getStatusBadge(inv.status)}</td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                      {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : 'Today'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        {inv.status !== 'paid' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleOpenPayment(inv)}
                          >
                            Collect Payment
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedInvoice(inv)}
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

      {/* Invoice Detail Modal */}
      <Modal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title={selectedInvoice ? `Invoice: ${selectedInvoice.invoiceNumber}` : ''}
        footer={
          <button className="btn btn-secondary" onClick={() => setSelectedInvoice(null)}>
            Close
          </button>
        }
      >
        {selectedInvoice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--slate-200)' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Patient</p>
                <p style={{ fontWeight: 600 }}>{selectedInvoice.patientName}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Requisition Order #</p>
                <p style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selectedInvoice.orderNumber}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Total Invoiced</p>
                <p style={{ fontWeight: 600 }}>₹{Number(selectedInvoice.totalAmount || 0).toFixed(2)}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Outstanding Balance</p>
                <p style={{ fontWeight: 700, color: 'var(--danger-600)' }}>₹{Number(selectedInvoice.balance || 0).toFixed(2)}</p>
              </div>
            </div>

            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '6px' }}>Payment Transactions</p>
              {selectedInvoice.payments && selectedInvoice.payments.length > 0 ? (
                <div style={{ border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table className="lms-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Method</th>
                        <th>Reference</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.payments.map((p, idx) => (
                        <tr key={idx}>
                          <td>{new Date(p.paidAt).toLocaleDateString()}</td>
                          <td style={{ textTransform: 'capitalize' }}>{p.method}</td>
                          <td style={{ fontFamily: 'monospace' }}>{p.reference || 'N/A'}</td>
                          <td style={{ fontWeight: 600, color: 'var(--teal-600)' }}>+₹{Number(p.amount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', fontStyle: 'italic' }}>
                  No payments recorded yet for this invoice.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        isOpen={!!paymentInvoice}
        onClose={() => setPaymentInvoice(null)}
        title={paymentInvoice ? `Record Payment: ${paymentInvoice.invoiceNumber}` : ''}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setPaymentInvoice(null)} disabled={actionLoading}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleRecordPaymentSubmit} disabled={actionLoading}>
              {actionLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <span>Confirm Payment (₹{Number(paymentAmount || 0).toFixed(2)})</span>
              )}
            </button>
          </>
        }
      >
        {paymentInvoice && (
          <form onSubmit={handleRecordPaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--slate-50)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Outstanding Balance:</span>
              <strong style={{ color: 'var(--danger-600)' }}>₹{paymentInvoice.balance?.toFixed(2)}</strong>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Amount (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={paymentInvoice.balance}
                className="form-input"
                required
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Payment Method *</label>
              <select
                className="form-select"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <option value="credit_card">Credit / Debit Card</option>
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Wire Transfer</option>
                <option value="insurance">Insurance Claim</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Transaction Reference #</label>
              <input
                type="text"
                className="form-input"
                placeholder="TXN-902148"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export default BillingPage;
