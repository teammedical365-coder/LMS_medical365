/**
 * Lab Management System (LMS) - Patient Comprehensive Profile & Clinical History View
 * 
 * Features:
 * - Full demographic & intake record display (MRN, DOB, Age, Blood Group, Contact, Address, Medical Notes)
 * - Complete clinical history tabs:
 *   1. Diagnostic Requisition Orders (Status, Priority, Tests, Total Amount)
 *   2. Pathology & Diagnostic Reports (Report #, Verification Status, Findings, Release Date)
 *   3. Billing Ledger & Invoices (Invoice #, Total, Paid, Balance, Payment Mode)
 *   4. Accessioned Specimen Samples (Barcode, Specimen Type, Tube Container, Status)
 * - Instant Copy for MRN and Contact details
 * - Quick action to requisition new diagnostic order for this specific patient
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  User,
  Users,
  Copy,
  Check,
  Calendar,
  Phone,
  Mail,
  MapPin,
  HeartPulse,
  Activity,
  ClipboardList,
  FileText,
  CreditCard,
  FlaskConical,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  ExternalLink,
  ShieldCheck,
  Droplet,
  FileCheck,
  Loader2,
  Stethoscope,
  Receipt,
  Eye,
  UserCheck,
} from 'lucide-react';
import Badge from '../../components/common/Badge';

export function PatientProfileView({
  patient,
  onBack,
  onNewOrder,
  patientHistory = { orders: [], reports: [], invoices: [], samples: [], loading: false },
}) {
  const [activeTab, setActiveTab] = useState('orders');
  const [copiedMRN, setCopiedMRN] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  if (!patient) return null;

  const fullName = patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim() || 'Unnamed Patient';

  const getInitials = (name) => {
    if (!name) return 'PT';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const handleCopy = (text, type) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === 'mrn') {
        setCopiedMRN(true);
        setTimeout(() => setCopiedMRN(false), 2000);
      } else if (type === 'phone') {
        setCopiedPhone(true);
        setTimeout(() => setCopiedPhone(false), 2000);
      }
    }
  };

  const { orders = [], reports = [], invoices = [], samples = [], loading: historyLoading } = patientHistory;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Breadcrumb & Top Navigation Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          background: '#ffffff',
          padding: '0.875rem 1.25rem',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.875rem' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
          >
            <ArrowLeft size={15} />
            <span>Back to Patients Directory</span>
          </button>
          <span style={{ color: '#94a3b8' }}>/</span>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Patient File</span>
          <span style={{ color: '#94a3b8' }}>/</span>
          <span style={{ color: '#0f172a', fontWeight: 700 }}>{fullName}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onNewOrder && onNewOrder(patient)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={15} />
            <span>Create Diagnostic Order</span>
          </button>
        </div>
      </div>

      {/* 2. Patient Hero Profile Banner */}
      <div
        className="overview-hero-banner"
        style={{
          background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 45%, #ecfdf5 100%)',
          borderRadius: '16px',
          padding: '1.75rem',
          color: '#0f172a',
          boxShadow: '0 4px 20px -2px rgba(2, 132, 199, 0.08), 0 2px 6px rgba(16, 185, 129, 0.05)',
          position: 'relative',
          overflow: 'hidden',
          border: '1.5px solid #bae6fd',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.25rem', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            {/* Big Avatar */}
            <div className="patient-avatar-lg" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0ea5e9 100%)' }}>
              {getInitials(fullName)}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', fontFamily: 'var(--font-display)' }}>
                  {fullName}
                </h2>
                <Badge variant="teal">Active Patient</Badge>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '6px' }}>
                {/* MRN Chip */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#ffffff', padding: '3px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>MRN:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0284c7' }}>{patient.mrn}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(patient.mrn, 'mrn')}
                    title="Copy MRN"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: copiedMRN ? '#16a34a' : '#94a3b8' }}
                  >
                    {copiedMRN ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>

                {/* Blood Group */}
                {patient.bloodGroup ? (
                  <div className="blood-group-badge">
                    <Droplet size={13} style={{ marginRight: '4px' }} />
                    <span>{patient.bloodGroup}</span>
                  </div>
                ) : (
                  <div className="blood-group-badge" style={{ background: '#f8fafc', color: '#64748b', border: '1px solid #cbd5e1' }}>
                    <Droplet size={13} style={{ marginRight: '4px' }} />
                    <span>Not Specified</span>
                  </div>
                )}

                {/* Age & Gender */}
                <span style={{ fontSize: '0.825rem', color: '#334155', fontWeight: 600 }}>
                  {patient.age ? `${patient.age} yrs` : formatDate(patient.dob)} • <span style={{ textTransform: 'capitalize' }}>{patient.gender}</span>
                </span>

                {/* Registration Date */}
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={13} />
                  <span>Accessioned: {formatDate(patient.createdAt)}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.85)', padding: '10px 16px', borderRadius: '10px', border: '1px solid #bae6fd', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0284c7' }}>{orders.length}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Lab Orders</div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.85)', padding: '10px 16px', borderRadius: '10px', border: '1px solid #bae6fd', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#059669' }}>{reports.length}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Reports</div>
            </div>
            <div style={{ background: 'rgba(255, 255, 255, 0.85)', padding: '10px 16px', borderRadius: '10px', border: '1px solid #bae6fd', textAlign: 'center' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4f46e5' }}>{samples.length}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Specimens</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1.25rem', alignItems: 'start' }}>
        
        {/* Left Column: Full Patient Registration Details */}
        <div
          className="card"
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
            <UserCheck size={18} style={{ color: '#0284c7' }} />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Registration & Demographics
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                Medical Record # (MRN)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0284c7', fontSize: '1.05rem' }}>
                  {patient.mrn}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(patient.mrn, 'mrn')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: copiedMRN ? '#16a34a' : '#94a3b8' }}
                  title="Copy MRN"
                >
                  {copiedMRN ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>Age</span>
                <span style={{ fontWeight: 700, color: '#1e293b' }}>
                  {patient.age ? `${patient.age} years` : 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>Gender</span>
                <span style={{ fontWeight: 700, color: '#1e293b', textTransform: 'capitalize' }}>
                  {patient.gender || 'N/A'}
                </span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>Date of Birth</span>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>
                  {patient.dob || patient.dateOfBirth ? formatDate(patient.dob || patient.dateOfBirth) : 'N/A'}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>Blood Group</span>
                <span className="blood-group-badge">{patient.bloodGroup || 'O+'}</span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>Primary Phone</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={14} style={{ color: '#0284c7' }} />
                <a href={`tel:${patient.phone}`} style={{ fontWeight: 700, color: '#0f172a', textDecoration: 'none' }}>
                  {patient.phone || 'N/A'}
                </a>
                {patient.phone && (
                  <button
                    type="button"
                    onClick={() => handleCopy(patient.phone, 'phone')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: copiedPhone ? '#16a34a' : '#94a3b8' }}
                    title="Copy Phone"
                  >
                    {copiedPhone ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                )}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>Email Address</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={14} style={{ color: '#0284c7' }} />
                <span style={{ color: patient.email ? '#0f172a' : '#94a3b8', fontWeight: patient.email ? 600 : 400 }}>
                  {patient.email || 'None on file'}
                </span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>Residential Address</span>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <MapPin size={14} style={{ color: '#0284c7', marginTop: '3px', flexShrink: 0 }} />
                <span style={{ color: patient.address ? '#334155' : '#94a3b8', lineHeight: 1.4 }}>
                  {patient.address || 'No residential address recorded'}
                </span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>Referring Physician</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Stethoscope size={14} style={{ color: '#0284c7' }} />
                <span style={{ fontWeight: 600, color: '#0f172a' }}>
                  {patient.orderingPhysician || patient.referredBy || (orders.length > 0 && orders[0]?.orderingPhysician) || 'Self / Walk-in'}
                </span>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', marginBottom: '2px' }}>
                Clinical Notes / Medical History
              </span>
              <div
                style={{
                  background: '#f8fafc',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  color: patient.medicalHistory ? '#334155' : '#94a3b8',
                  lineHeight: 1.45,
                  fontSize: '0.8rem',
                }}
              >
                {patient.medicalHistory || 'No pre-existing conditions or clinical notes specified.'}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', fontSize: '0.75rem', color: '#94a3b8' }}>
              <div>Registration Date: <strong style={{ color: '#64748b' }}>{formatDateTime(patient.createdAt)}</strong></div>
            </div>
          </div>
        </div>

        {/* Right Column: Complete Clinical History */}
        <div
          className="card"
          style={{
            background: '#ffffff',
            borderRadius: '14px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
            padding: '1.25rem',
            minHeight: '480px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* History Navigation Tabs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f8fafc',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              marginBottom: '1.25rem',
              overflowX: 'auto',
            }}
          >
            <button
              type="button"
              className={`patient-tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => setActiveTab('orders')}
            >
              <ClipboardList size={15} />
              <span>Diagnostic Orders</span>
              <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', background: activeTab === 'orders' ? '#e0f2fe' : '#e2e8f0', color: activeTab === 'orders' ? '#0284c7' : '#64748b', fontWeight: 700 }}>
                {orders.length}
              </span>
            </button>

            <button
              type="button"
              className={`patient-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
              onClick={() => setActiveTab('reports')}
            >
              <FileCheck size={15} />
              <span>Pathology Reports</span>
              <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', background: activeTab === 'reports' ? '#dcfce7' : '#e2e8f0', color: activeTab === 'reports' ? '#16a34a' : '#64748b', fontWeight: 700 }}>
                {reports.length}
              </span>
            </button>

            <button
              type="button"
              className={`patient-tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
              onClick={() => setActiveTab('invoices')}
            >
              <Receipt size={15} />
              <span>Invoices & Billing</span>
              <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', background: activeTab === 'invoices' ? '#ede9fe' : '#e2e8f0', color: activeTab === 'invoices' ? '#7c3aed' : '#64748b', fontWeight: 700 }}>
                {invoices.length}
              </span>
            </button>

            <button
              type="button"
              className={`patient-tab-btn ${activeTab === 'samples' ? 'active' : ''}`}
              onClick={() => setActiveTab('samples')}
            >
              <FlaskConical size={15} />
              <span>Specimen Samples</span>
              <span style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '10px', background: activeTab === 'samples' ? '#fef3c7' : '#e2e8f0', color: activeTab === 'samples' ? '#d97706' : '#64748b', fontWeight: 700 }}>
                {samples.length}
              </span>
            </button>
          </div>

          {/* Loading Indicator */}
          {historyLoading ? (
            <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
              <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.5rem', color: '#0284c7' }} />
              <p style={{ fontWeight: 500, fontSize: '0.875rem' }}>Loading clinical records from tenant database...</p>
            </div>
          ) : (
            <>
              {/* TAB 1: DIAGNOSTIC ORDERS */}
              {activeTab === 'orders' && (
                <div>
                  {orders.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                      <ClipboardList size={38} style={{ margin: '0 auto 0.75rem', opacity: 0.35, color: '#0284c7' }} />
                      <h4 style={{ margin: '0 0 0.35rem', color: '#1e293b', fontWeight: 700 }}>No Diagnostic Orders Found</h4>
                      <p style={{ fontSize: '0.825rem', color: '#64748b', maxWidth: '380px', margin: '0 auto 1.25rem' }}>
                        This patient does not have any laboratory test requisitions logged yet.
                      </p>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => onNewOrder && onNewOrder(patient)}
                      >
                        <Plus size={14} />
                        <span>Requisition First Diagnostic Order</span>
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                      {orders.map((ord) => {
                        const items = ord.items || [];
                        const statusColors = {
                          pending: { bg: '#fef3c7', text: '#d97706', border: '#fde68a' },
                          processing: { bg: '#e0f2fe', text: '#0284c7', border: '#bae6fd' },
                          completed: { bg: '#dcfce7', text: '#16a34a', border: '#bbf7d0' },
                          cancelled: { bg: '#fee2e2', text: '#dc2626', border: '#fecaca' },
                        };
                        const sc = statusColors[ord.status?.toLowerCase()] || statusColors.pending;

                        return (
                          <div
                            key={ord.orderId || ord._id}
                            style={{
                              border: '1px solid #e2e8f0',
                              borderRadius: '10px',
                              padding: '1rem',
                              background: '#ffffff',
                              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.5rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f172a', fontSize: '0.95rem' }}>
                                  #{ord.orderNumber || ord.orderId}
                                </span>
                                <span style={{ fontSize: '0.72rem', background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, padding: '2px 8px', borderRadius: '6px', fontWeight: 700, textTransform: 'capitalize' }}>
                                  {ord.status || 'Pending'}
                                </span>
                                {ord.priority === 'stat' && (
                                  <span style={{ fontSize: '0.7rem', background: '#fee2e2', color: '#dc2626', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                                    STAT / URGENT
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                {formatDateTime(ord.createdAt)}
                              </span>
                            </div>

                            {/* Test items */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', margin: '0.5rem 0' }}>
                              {items.map((it, idx) => (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: '0.75rem',
                                    background: '#f1f5f9',
                                    color: '#334155',
                                    padding: '3px 8px',
                                    borderRadius: '5px',
                                    fontWeight: 600,
                                    border: '1px solid #e2e8f0',
                                  }}
                                >
                                  {it.testName || it.name || it.testCode}
                                  {it.price ? ` (₹${Number(it.price).toLocaleString()})` : ''}
                                </span>
                              ))}
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f8fafc', paddingTop: '0.5rem', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                              <span style={{ color: '#64748b' }}>
                                Doctor: <strong style={{ color: '#334155' }}>{ord.orderingPhysician || 'Self / Walk-in'}</strong>
                              </span>
                              <div>
                                <span style={{ color: '#64748b' }}>Total: </span>
                                <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>
                                  ₹{Number(ord.totalAmount || 0).toLocaleString()}
                                </strong>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: PATHOLOGY & DIAGNOSTIC REPORTS */}
              {activeTab === 'reports' && (
                <div>
                  {reports.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                      <FileCheck size={38} style={{ margin: '0 auto 0.75rem', opacity: 0.35, color: '#16a34a' }} />
                      <h4 style={{ margin: '0 0 0.35rem', color: '#1e293b', fontWeight: 700 }}>No Diagnostic Reports Generated</h4>
                      <p style={{ fontSize: '0.825rem', color: '#64748b', maxWidth: '380px', margin: '0 auto' }}>
                        Diagnostic reports will appear here once specimens are analyzed and findings signed off by the Consultant Pathologist.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                      {reports.map((rep) => (
                        <div
                          key={rep.reportId || rep._id}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '1rem',
                            background: '#ffffff',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.35rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>
                                #{rep.reportNumber || rep.reportId}
                              </span>
                              <Badge variant={rep.status === 'released' ? 'teal' : rep.status === 'verified' ? 'blue' : 'amber'}>
                                {rep.status ? rep.status.toUpperCase() : 'IN PROGRESS'}
                              </Badge>
                            </div>
                            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                              {formatDateTime(rep.createdAt || rep.releasedAt)}
                            </span>
                          </div>

                          <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.9rem', margin: '4px 0' }}>
                            {rep.testName || 'Diagnostic Panel'}
                          </div>

                          {rep.findings && (
                            <div style={{ background: '#f8fafc', padding: '6px 10px', borderRadius: '6px', fontSize: '0.78rem', color: '#475569', margin: '6px 0', border: '1px solid #e2e8f0' }}>
                              <strong>Findings:</strong> {rep.findings}
                            </div>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.78rem', color: '#64748b' }}>
                            <span>Pathologist Verification: <strong>{rep.verifiedBy || rep.pathologistName || 'Clinical Lead'}</strong></span>
                            {rep.releasedAt && <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Released to Patient</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: INVOICES & BILLING */}
              {activeTab === 'invoices' && (
                <div>
                  {invoices.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                      <Receipt size={38} style={{ margin: '0 auto 0.75rem', opacity: 0.35, color: '#7c3aed' }} />
                      <h4 style={{ margin: '0 0 0.35rem', color: '#1e293b', fontWeight: 700 }}>No Invoices on Record</h4>
                      <p style={{ fontSize: '0.825rem', color: '#64748b', maxWidth: '380px', margin: '0 auto' }}>
                        Invoices and payment receipts will appear here automatically upon diagnostic test accessioning.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                      {invoices.map((inv) => (
                        <div
                          key={inv.invoiceId || inv._id}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '1rem',
                            background: '#ffffff',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '0.35rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0f172a' }}>
                                #{inv.invoiceNumber || inv.invoiceId}
                              </span>
                              <Badge variant={inv.paymentStatus === 'paid' ? 'teal' : inv.paymentStatus === 'partial' ? 'amber' : 'rose'}>
                                {inv.paymentStatus ? inv.paymentStatus.toUpperCase() : 'PENDING'}
                              </Badge>
                            </div>
                            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                              {formatDateTime(inv.createdAt)}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '8px 0', padding: '8px 12px', background: '#f8fafc', borderRadius: '6px', fontSize: '0.85rem' }}>
                            <div>
                              <span style={{ color: '#64748b' }}>Total Billed: </span>
                              <strong style={{ color: '#0f172a' }}>₹{Number(inv.totalAmount || 0).toLocaleString()}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#64748b' }}>Paid: </span>
                              <strong style={{ color: '#16a34a' }}>₹{Number(inv.paidAmount || 0).toLocaleString()}</strong>
                            </div>
                            <div>
                              <span style={{ color: '#64748b' }}>Balance Due: </span>
                              <strong style={{ color: inv.balanceAmount > 0 ? '#dc2626' : '#16a34a' }}>
                                ₹{Number(inv.balanceAmount || 0).toLocaleString()}
                              </strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: SPECIMEN SAMPLES */}
              {activeTab === 'samples' && (
                <div>
                  {samples.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                      <FlaskConical size={38} style={{ margin: '0 auto 0.75rem', opacity: 0.35, color: '#d97706' }} />
                      <h4 style={{ margin: '0 0 0.35rem', color: '#1e293b', fontWeight: 700 }}>No Specimen Samples Logged</h4>
                      <p style={{ fontSize: '0.825rem', color: '#64748b', maxWidth: '380px', margin: '0 auto' }}>
                        Specimen collection tubes and barcodes will appear here once an order is accessioned and phlebotomy draws begin.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                      {samples.map((smp) => (
                        <div
                          key={smp.sampleId || smp._id}
                          style={{
                            border: '1px solid #e2e8f0',
                            borderRadius: '10px',
                            padding: '1rem',
                            background: '#ffffff',
                            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '10px',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#0284c7', fontSize: '0.95rem' }}>
                                {smp.barcode}
                              </span>
                              <Badge variant={smp.collectionStatus === 'received' ? 'teal' : smp.collectionStatus === 'collected' ? 'blue' : 'amber'}>
                                {smp.collectionStatus ? smp.collectionStatus.toUpperCase() : 'PENDING'}
                              </Badge>
                            </div>
                            <div style={{ fontSize: '0.825rem', color: '#475569', marginTop: '4px' }}>
                              Specimen Type: <strong>{smp.specimenType || 'Whole Blood'}</strong> ({smp.container || 'Standard Tube'})
                            </div>
                          </div>
                          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                            {formatDateTime(smp.collectionTime || smp.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatientProfileView;
