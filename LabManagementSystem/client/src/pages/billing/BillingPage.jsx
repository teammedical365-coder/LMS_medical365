/**
 * Lab Management System (LMS) - Laboratory Billing Page (Phase 1 UI Shell)
 */

import React, { useState } from 'react';
import { CreditCard, DollarSign, Receipt, Eye, CheckCircle2, Clock } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import StatCard from '../../components/common/StatCard';
import Modal from '../../components/common/Modal';

export function BillingPage() {
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const mockInvoices = [
    {
      id: 'INV-2026-3011',
      orderId: 'ORD-2026-1049',
      patient: 'Eleanor Vance',
      mrn: 'MRN-9021',
      amount: '$66.00',
      paid: '$0.00',
      balance: '$66.00',
      status: 'pending',
      method: 'Insurance (Aetna)',
      date: '2026-10-10',
    },
    {
      id: 'INV-2026-3010',
      orderId: 'ORD-2026-1048',
      patient: 'Arthur Pendelton',
      mrn: 'MRN-8842',
      amount: '$45.00',
      paid: '$45.00',
      balance: '$0.00',
      status: 'paid',
      method: 'Credit Card (Visa)',
      date: '2026-10-10',
    },
    {
      id: 'INV-2026-3009',
      orderId: 'ORD-2026-1047',
      patient: 'Maria Santos',
      mrn: 'MRN-7731',
      amount: '$35.00',
      paid: '$35.00',
      balance: '$0.00',
      status: 'paid',
      method: 'Cash',
      date: '2026-10-10',
    },
    {
      id: 'INV-2026-3008',
      orderId: 'ORD-2026-1046',
      patient: 'David K. Miller',
      mrn: 'MRN-6512',
      amount: '$32.00',
      paid: '$0.00',
      balance: '$32.00',
      status: 'pending',
      method: 'Direct Patient Billing',
      date: '2026-10-10',
    },
  ];

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid': return <Badge variant="success">Paid in Full</Badge>;
      case 'pending': return <Badge variant="warning">Pending Balance</Badge>;
      default: return <Badge variant="slate">{status}</Badge>;
    }
  };

  return (
    <>
      <PageHeader
        title="Laboratory Billing & Fee Management"
        description="Patient invoice tracking, clinical diagnostic insurance claims, and payment settlement reconciliations."
      />

      <StatusBanner
        type="info"
        badgeText="UI Shell Demonstration"
        message="Billing records and revenue metrics below are simulated UI placeholders. Payment gateway integration and insurer electronic claims will be implemented in Phase 2."
      />

      {/* Billing Metrics */}
      <div className="grid-3">
        <StatCard
          title="Total Invoiced (Today)"
          value="$178.00"
          subtitle="4 Diagnostic requisitions"
          icon={Receipt}
          colorScheme="teal"
          badgeText="Mock"
        />
        <StatCard
          title="Settled Payments"
          value="$80.00"
          subtitle="Direct and card settlements"
          icon={CheckCircle2}
          colorScheme="green"
          badgeText="Mock"
        />
        <StatCard
          title="Outstanding Balance"
          value="$98.00"
          subtitle="Pending insurance / patient copay"
          icon={Clock}
          colorScheme="amber"
          badgeText="Mock"
        />
      </div>

      {/* Invoice Table */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Recent Invoices & Payment Ledger</h2>
          <span className="badge badge-slate">Demonstration Dataset</span>
        </div>

        <div className="table-container">
          <table className="lms-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Order Ref</th>
                <th>Patient / MRN</th>
                <th>Total Fee</th>
                <th>Amount Settled</th>
                <th>Outstanding</th>
                <th>Payment Route</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mockInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--primary-700)' }}>{inv.id}</strong>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{inv.orderId}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontWeight: 600 }}>{inv.patient}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{inv.mrn}</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{inv.amount}</td>
                  <td style={{ color: 'var(--success-700)' }}>{inv.paid}</td>
                  <td style={{ color: inv.balance !== '$0.00' ? 'var(--warning-700)' : 'var(--slate-500)' }}>
                    {inv.balance}
                  </td>
                  <td>{inv.method}</td>
                  <td>{getStatusBadge(inv.status)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      <Eye size={13} />
                      <span>Details</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Detail Modal */}
      <Modal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title={selectedInvoice ? `Invoice: ${selectedInvoice.id}` : ''}
        footer={
          <button className="btn btn-secondary" onClick={() => setSelectedInvoice(null)}>
            Close
          </button>
        }
      >
        {selectedInvoice && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div className="grid-2">
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Billed Patient</p>
                <p style={{ fontWeight: 600 }}>{selectedInvoice.patient}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Medical Record #</p>
                <p>{selectedInvoice.mrn}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Invoice Amount</p>
                <p style={{ fontWeight: 700, color: 'var(--primary-700)', fontSize: '1.1rem' }}>{selectedInvoice.amount}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Status</p>
                <div>{getStatusBadge(selectedInvoice.status)}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default BillingPage;
