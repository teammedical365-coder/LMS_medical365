/**
 * Lab Management System (LMS) - Patients Page & Unified Clinical Intake
 * 
 * Combines patient registration, diagnostic test requisitioning,
 * live catalog pricing, and front-desk payment collection into a single,
 * high-efficiency reception workflow.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Users,
  UserPlus,
  Search,
  Eye,
  Filter,
  Calendar,
  Loader2,
  AlertCircle,
  CheckCircle2,
  TestTube2,
  CreditCard,
  Plus,
  Trash2,
  ClipboardList,
  Clock,
  Sparkles,
  ShieldCheck,
  Check,
  Receipt,
  FileText,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import clinicalService from '../../services/clinicalService';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

const INITIAL_FORM_STATE = {
  firstName: '',
  lastName: '',
  age: '',
  dateOfBirth: '',
  gender: 'female',
  phone: '',
  email: '',
  bloodGroup: 'O+',
  address: '',
  orderingPhysician: 'Self / Walk-in',
  medicalHistory: '',
  priority: 'routine',
  paidAmount: '',
  paymentMethod: 'cash',
  paymentReference: '',
};

export function PatientsPage() {
  const { user, tenant } = useAuth();
  const tenantId = tenant?.tenantId || user?.tenantId;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Patient Directory State
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Catalog State for Test Pricing
  const [catalogTests, setCatalogTests] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Intake Form & Modal State
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [includeOrder, setIncludeOrder] = useState(true);
  const [selectedTests, setSelectedTests] = useState([]);
  const [testSearchTerm, setTestSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inspection & Success Modal States
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [intakeSuccessResult, setIntakeSuccessResult] = useState(null);

  // Check if URL specifies register parameter (e.g. from Dashboard quick link)
  useEffect(() => {
    if (searchParams.get('register') === 'true' || searchParams.get('new') === 'true') {
      setIsRegisterOpen(true);
      // Clean query parameter from URL without page reload
      searchParams.delete('register');
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Fetch Patients List
  const fetchPatients = useCallback(async () => {
    if (!tenantId) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await clinicalService.getPatients(tenantId, { search: searchTerm });
      if (res.success && Array.isArray(res.data)) {
        setPatients(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve patient records');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, searchTerm]);

  // Fetch Laboratory Test Catalog with rates set by Lab Admin
  const fetchTestCatalog = useCallback(async () => {
    if (!tenantId) return;
    try {
      setCatalogLoading(true);
      const res = await clinicalService.getTestCatalog(tenantId);
      if (res.success && Array.isArray(res.data)) {
        setCatalogTests(res.data);
      }
    } catch (err) {
      console.warn('Test catalog fetch error:', err);
    } finally {
      setCatalogLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  useEffect(() => {
    if (isRegisterOpen && catalogTests.length === 0) {
      fetchTestCatalog();
    }
  }, [isRegisterOpen, catalogTests.length, fetchTestCatalog]);

  // Unique departments from test catalog
  const departments = useMemo(() => {
    const set = new Set();
    catalogTests.forEach((t) => {
      if (t.department) set.add(t.department);
      else if (t.category) set.add(t.category);
    });
    return ['All', ...Array.from(set)];
  }, [catalogTests]);

  // Filtered catalog tests based on search and department
  const filteredCatalogTests = useMemo(() => {
    return catalogTests.filter((test) => {
      const matchDept =
        selectedDept === 'All' ||
        test.department?.toLowerCase() === selectedDept.toLowerCase() ||
        test.category?.toLowerCase() === selectedDept.toLowerCase();

      if (!matchDept) return false;

      if (!testSearchTerm.trim()) return true;
      const s = testSearchTerm.toLowerCase();
      return (
        test.name?.toLowerCase().includes(s) ||
        test.code?.toLowerCase().includes(s) ||
        test.specimenType?.toLowerCase().includes(s) ||
        test.department?.toLowerCase().includes(s)
      );
    });
  }, [catalogTests, selectedDept, testSearchTerm]);

  // Calculate order subtotal from selected tests
  const subtotal = useMemo(() => {
    return selectedTests.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
  }, [selectedTests]);

  // Calculate net payable and balance
  const currentPaidAmount = useMemo(() => {
    if (formData.paidAmount === '' || formData.paidAmount === null || formData.paidAmount === undefined) {
      return subtotal;
    }
    const val = Number(formData.paidAmount);
    return isNaN(val) ? 0 : val;
  }, [formData.paidAmount, subtotal]);

  const balanceDue = useMemo(() => {
    return Math.max(0, subtotal - currentPaidAmount);
  }, [subtotal, currentPaidAmount]);

  // Auto-sync age and date of birth
  const handleAgeChange = (val) => {
    const ageNum = parseInt(val, 10);
    if (!isNaN(ageNum) && ageNum > 0 && ageNum < 130) {
      const approxYear = new Date().getFullYear() - ageNum;
      const estimatedDob = `${approxYear}-01-01`;
      setFormData((prev) => ({
        ...prev,
        age: val,
        dateOfBirth: estimatedDob,
      }));
    } else {
      setFormData((prev) => ({ ...prev, age: val }));
    }
  };

  const handleDobChange = (dobVal) => {
    if (dobVal) {
      const birth = new Date(dobVal);
      const today = new Date();
      let diff = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
        diff--;
      }
      setFormData((prev) => ({
        ...prev,
        dateOfBirth: dobVal,
        age: diff >= 0 ? String(diff) : prev.age,
      }));
    } else {
      setFormData((prev) => ({ ...prev, dateOfBirth: dobVal }));
    }
  };

  // Toggle Test Selection
  const handleToggleTest = (test) => {
    const exists = selectedTests.some(
      (t) => (t.code || '').toUpperCase() === (test.code || '').toUpperCase()
    );

    let nextSelected;
    if (exists) {
      nextSelected = selectedTests.filter(
        (t) => (t.code || '').toUpperCase() !== (test.code || '').toUpperCase()
      );
    } else {
      nextSelected = [...selectedTests, test];
    }
    setSelectedTests(nextSelected);

    // If paid amount was equal to previous subtotal or untouched, update to new subtotal
    const newSubtotal = nextSelected.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
    setFormData((prev) => {
      if (prev.paidAmount === '' || Number(prev.paidAmount) === subtotal) {
        return { ...prev, paidAmount: String(newSubtotal) };
      }
      return prev;
    });
  };

  const handleRemoveTest = (code) => {
    const nextSelected = selectedTests.filter(
      (t) => (t.code || '').toUpperCase() !== (code || '').toUpperCase()
    );
    setSelectedTests(nextSelected);
    const newSubtotal = nextSelected.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
    setFormData((prev) => {
      if (prev.paidAmount === '' || Number(prev.paidAmount) === subtotal) {
        return { ...prev, paidAmount: String(newSubtotal) };
      }
      return prev;
    });
  };

  // Quick payment helper
  const handleSetQuickPay = (type) => {
    if (type === 'full') {
      setFormData((prev) => ({ ...prev, paidAmount: String(subtotal) }));
    } else if (type === 'half') {
      setFormData((prev) => ({ ...prev, paidAmount: String(Math.round(subtotal / 2)) }));
    } else if (type === 'zero') {
      setFormData((prev) => ({ ...prev, paidAmount: '0' }));
    }
  };

  // Unified Registration & Order Submission
  const handleUnifiedSubmit = async (e) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      alert('Patient first and last names are required');
      return;
    }

    if (!formData.dateOfBirth && !formData.age) {
      alert('Please specify either Date of Birth or Patient Age');
      return;
    }

    if (includeOrder && selectedTests.length === 0) {
      const proceedWithoutTests = window.confirm(
        'No diagnostic tests are selected. Do you want to save the patient profile only?'
      );
      if (!proceedWithoutTests) return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        dateOfBirth: formData.dateOfBirth,
        age: formData.age,
        gender: formData.gender,
        phone: formData.phone?.trim() || null,
        email: formData.email?.trim() || null,
        bloodGroup: formData.bloodGroup,
        address: formData.address?.trim() || null,
        orderingPhysician: formData.orderingPhysician?.trim() || 'Attending Physician',
        medicalHistory: formData.medicalHistory?.trim() || null,
        priority: formData.priority,
        items: includeOrder
          ? selectedTests.map((t) => ({
              testCode: t.code,
              testName: t.name,
              price: Number(t.price) || 0,
              specimenType: t.specimenType,
              container: t.container,
              parameters: t.parameters || [],
            }))
          : [],
        paidAmount: includeOrder ? currentPaidAmount : 0,
        paymentMethod: formData.paymentMethod || 'cash',
        paymentReference: formData.paymentReference?.trim() || null,
      };

      const res = await clinicalService.registerPatientWithOrder(tenantId, payload);

      if (res.success) {
        setIsRegisterOpen(false);
        setIntakeSuccessResult(res.data);
        setSuccessMsg(
          `Intake complete for ${res.data.patient.fullName} (MRN: ${res.data.patient.mrn})` +
            (res.data.order ? ` — Order #${res.data.order.orderNumber} created!` : '')
        );

        // Reset form
        setFormData(INITIAL_FORM_STATE);
        setSelectedTests([]);
        setTestSearchTerm('');
        fetchPatients();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to complete patient intake');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Patients Accessioning & Diagnostic Intake"
        description="Accession incoming patients, select diagnostic tests with automated catalog pricing, and collect intake payments."
        actions={
          <button className="btn btn-primary" onClick={() => setIsRegisterOpen(true)}>
            <UserPlus size={16} />
            <span>New Patient Intake & Order</span>
          </button>
        }
      />

      {successMsg && (
        <div style={{ marginBottom: '1.25rem' }}>
          <StatusBanner type="success" badgeText="Success" message={successMsg} />
        </div>
      )}

      {error && (
        <div style={{ marginBottom: '1.25rem' }}>
          <StatusBanner type="danger" badgeText="Error" message={error} />
        </div>
      )}

      {/* Directory Search & Filter Bar */}
      <div className="card" style={{ padding: '0.875rem 1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '260px' }}>
            <Search size={18} style={{ color: 'var(--slate-400)' }} />
            <input
              type="text"
              placeholder="Search directory by Patient Name, MRN, or Phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ border: 'none', padding: '0.4rem 0', width: '100%' }}
            />
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchPatients}
            title="Refresh directory list"
          >
            <RefreshCw size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Patients Table */}
      <div className="card">
        {isLoading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary-blue)' }} />
            <p style={{ fontWeight: 500 }}>Loading patient records from tenant database...</p>
          </div>
        ) : patients.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <Users size={40} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
            <p style={{ fontWeight: 600, color: 'var(--slate-700)', fontSize: '1.05rem' }}>No patient records found</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.35rem', color: 'var(--slate-500)' }}>
              {searchTerm ? 'Try adjusting your search criteria.' : 'Click "New Patient Intake & Order" to register the first patient.'}
            </p>
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: '1rem' }}
              onClick={() => setIsRegisterOpen(true)}
            >
              <UserPlus size={15} />
              <span>Register Patient Now</span>
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>MRN</th>
                  <th>Patient Name</th>
                  <th>DOB / Age</th>
                  <th>Gender</th>
                  <th>Phone</th>
                  <th>Blood Group</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.patientId || p._id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-blue)' }}>
                        {p.mrn}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.fullName || `${p.firstName} ${p.lastName}`}</td>
                    <td>
                      {p.age ? (
                        <span>{p.age} yrs</span>
                      ) : p.dateOfBirth || p.dob ? (
                        new Date(p.dateOfBirth || p.dob).toLocaleDateString()
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td>
                      <span style={{ textTransform: 'capitalize' }}>{p.gender}</span>
                    </td>
                    <td>{p.phone || 'N/A'}</td>
                    <td>
                      <Badge variant="teal">{p.bloodGroup || 'O+'}</Badge>
                    </td>
                    <td style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'Today'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedPatient(p)}
                        title="View Demographic Record"
                      >
                        <Eye size={14} />
                        <span>View Profile</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* =========================================================================
          UNIFIED PATIENT REGISTRATION, REQUISITION & BILLING MODAL
          ========================================================================= */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Patient Accessioning & Diagnostic Order Intake"
        maxWidth="880px"
        footer={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {includeOrder && selectedTests.length > 0 && (
                <div style={{ fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--slate-500)' }}>Total Charges: </span>
                  <strong style={{ fontSize: '1.05rem', color: 'var(--primary-blue)' }}>
                    ₹{subtotal.toLocaleString()}
                  </strong>
                  {balanceDue > 0 ? (
                    <span style={{ marginLeft: '8px', color: 'var(--warning-700)', fontWeight: 600 }}>
                      (Due: ₹{balanceDue.toLocaleString()})
                    </span>
                  ) : (
                    <span style={{ marginLeft: '8px', color: 'var(--success-700)', fontWeight: 600 }}>
                      (Fully Paid)
                    </span>
                  )}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsRegisterOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUnifiedSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Processing Intake...</span>
                  </>
                ) : includeOrder && selectedTests.length > 0 ? (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Register & Create Order (₹{subtotal.toLocaleString()})</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={16} />
                    <span>Save Patient Profile Only</span>
                  </>
                )}
              </button>
            </div>
          </div>
        }
      >
        <form onSubmit={handleUnifiedSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* SECTION 1: Patient Demographics */}
          <div style={{
            background: 'var(--slate-50)',
            border: '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
              <Users size={18} style={{ color: 'var(--primary-blue)' }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--slate-800)' }}>
                1. Patient Identity & Demographics
              </h3>
            </div>

            <div className="grid-2" style={{ gap: '0.875rem' }}>
              <div className="form-group">
                <label className="form-label">First Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ramesh"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Last Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Kumar"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                />
              </div>
            </div>

            <div className="grid-2" style={{ gap: '0.875rem', marginTop: '0.75rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '0.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Age (Yrs)</label>
                  <input
                    type="number"
                    min="0"
                    max="125"
                    className="form-input"
                    placeholder="e.g. 32"
                    value={formData.age}
                    onChange={(e) => handleAgeChange(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    className="form-input"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleDobChange(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                <div className="form-group">
                  <label className="form-label">Gender *</label>
                  <select
                    className="form-select"
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Blood Group</label>
                  <select
                    className="form-select"
                    value={formData.bloodGroup}
                    onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="grid-2" style={{ gap: '0.875rem', marginTop: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Mobile / Phone Number</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address (Optional)</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="patient@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="grid-2" style={{ gap: '0.875rem', marginTop: '0.75rem' }}>
              <div className="form-group">
                <label className="form-label">Referred By / Doctor</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Dr. A. Sharma or Self / Walk-in"
                  value={formData.orderingPhysician}
                  onChange={(e) => setFormData({ ...formData, orderingPhysician: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Home Address / City</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Flat 402, Gandhi Road, City"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* SECTION 2: Diagnostic Test Requisition & Catalog Pricing */}
          <div style={{
            background: 'white',
            border: '1px solid var(--slate-200)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TestTube2 size={18} style={{ color: 'var(--medical-teal)' }} />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--slate-800)' }}>
                  2. Diagnostic Test Requisition & Rates
                </h3>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 600, color: 'var(--primary-blue)' }}>
                <input
                  type="checkbox"
                  checked={includeOrder}
                  onChange={(e) => setIncludeOrder(e.target.checked)}
                  style={{ accentColor: 'var(--primary-blue)' }}
                />
                <span>Include Test Order in Intake</span>
              </label>
            </div>

            {includeOrder && (
              <>
                {/* Priority Selection */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', padding: '0.6rem 0.8rem', background: 'var(--slate-50)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--slate-700)' }}>Order Priority:</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {['routine', 'urgent', 'stat'].map((prio) => (
                      <button
                        key={prio}
                        type="button"
                        onClick={() => setFormData({ ...formData, priority: prio })}
                        className={`btn btn-sm ${formData.priority === prio ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                          textTransform: 'capitalize',
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.6rem',
                          background: formData.priority === prio ? (prio === 'stat' ? '#dc2626' : prio === 'urgent' ? '#ea580c' : 'var(--primary-blue)') : 'white',
                          borderColor: formData.priority === prio ? 'transparent' : 'var(--slate-300)',
                        }}
                      >
                        {prio === 'stat' ? 'STAT (Emergency)' : prio}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Catalog Search & Department Filters */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--slate-400)' }} />
                      <input
                        type="text"
                        placeholder="Search tests by name, code (e.g., CBC, Lipid, Thyroid, Glucose, Urine)..."
                        className="form-input"
                        style={{ paddingLeft: '32px' }}
                        value={testSearchTerm}
                        onChange={(e) => setTestSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Department Pills */}
                  {departments.length > 1 && (
                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                      {departments.map((dept) => (
                        <button
                          key={dept}
                          type="button"
                          onClick={() => setSelectedDept(dept)}
                          style={{
                            fontSize: '0.72rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '9999px',
                            border: '1px solid',
                            borderColor: selectedDept === dept ? 'var(--primary-blue)' : 'var(--slate-200)',
                            background: selectedDept === dept ? 'var(--primary-blue-light)' : 'white',
                            color: selectedDept === dept ? 'var(--primary-blue)' : 'var(--slate-600)',
                            cursor: 'pointer',
                            fontWeight: selectedDept === dept ? 600 : 400,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {dept}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Available Tests Grid with Auto-Pricing from Lab Admin */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-500)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Available Catalog Tests ({filteredCatalogTests.length} tests • Rates configured by Lab Administrator):
                  </p>
                  
                  {catalogLoading ? (
                    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--slate-500)' }}>
                      <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 0.25rem' }} />
                      <span style={{ fontSize: '0.8125rem' }}>Loading test rates from catalog...</span>
                    </div>
                  ) : filteredCatalogTests.length === 0 ? (
                    <div style={{ padding: '1.25rem', textAlign: 'center', background: 'var(--slate-50)', borderRadius: 'var(--radius-sm)', color: 'var(--slate-500)', fontSize: '0.8125rem' }}>
                      No tests found matching "{testSearchTerm}". Tests can be configured in the Test Catalog by the Lab Admin.
                    </div>
                  ) : (
                    <div style={{
                      maxHeight: '190px',
                      overflowY: 'auto',
                      border: '1px solid var(--slate-200)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--slate-50)',
                      padding: '0.4rem',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                      gap: '0.4rem',
                    }}>
                      {filteredCatalogTests.map((t) => {
                        const isSelected = selectedTests.some(
                          (item) => (item.code || '').toUpperCase() === (t.code || '').toUpperCase()
                        );
                        return (
                          <div
                            key={t.code || t._id}
                            onClick={() => handleToggleTest(t)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.5rem 0.65rem',
                              borderRadius: 'var(--radius-sm)',
                              background: isSelected ? 'var(--mint-bg)' : 'white',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--mint-500)' : 'var(--slate-200)',
                              cursor: 'pointer',
                              transition: 'all 0.1s ease',
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '70%' }}>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: isSelected ? 'var(--mint-700)' : 'var(--slate-800)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {t.name}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)' }}>
                                {t.code} • {t.specimenType || 'Serum'}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontWeight: 700, fontSize: '0.875rem', color: isSelected ? 'var(--mint-700)' : 'var(--primary-blue)' }}>
                                ₹{Number(t.price || 0).toLocaleString()}
                              </span>
                              {isSelected ? (
                                <Check size={14} style={{ color: 'var(--mint-600)' }} />
                              ) : (
                                <Plus size={14} style={{ color: 'var(--slate-400)' }} />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Selected Tests Requisition Summary Table */}
                <div style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.875rem',
                  background: 'white',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--slate-700)' }}>
                      Requisition Tests ({selectedTests.length} Selected):
                    </span>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--primary-blue)' }}>
                      Subtotal: ₹{subtotal.toLocaleString()}
                    </span>
                  </div>

                  {selectedTests.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--slate-400)', fontStyle: 'italic' }}>
                      No tests selected yet. Click any test above to add it to this patient's requisition order.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {selectedTests.map((st) => (
                        <div
                          key={st.code}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: 'var(--slate-50)',
                            border: '1px solid var(--slate-300)',
                            borderRadius: '9999px',
                            padding: '0.25rem 0.75rem',
                            fontSize: '0.8125rem',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{st.name}</span>
                          <span style={{ fontWeight: 700, color: 'var(--primary-blue)' }}>
                            ₹{Number(st.price || 0).toLocaleString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTest(st.code)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--slate-400)',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title="Remove test"
                          >
                            <Trash2 size={13} style={{ color: '#ef4444' }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* SECTION 3: Billing & Instant Payment Collection */}
          {includeOrder && selectedTests.length > 0 && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 'var(--radius-md)',
              padding: '1.25rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
                <CreditCard size={18} style={{ color: 'var(--primary-blue)' }} />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: 'var(--slate-800)' }}>
                  3. Reception Billing & Payment Collection
                </h3>
              </div>

              {/* Ledger Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem', marginBottom: '1rem' }}>
                <div style={{ background: 'white', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--slate-200)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>Total Requisition</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-900)', marginTop: '2px' }}>
                    ₹{subtotal.toLocaleString()}
                  </div>
                </div>

                <div style={{ background: 'white', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--slate-200)' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', textTransform: 'uppercase', fontWeight: 600 }}>Amount Paid Now</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--mint-600)', marginTop: '2px' }}>
                    ₹{currentPaidAmount.toLocaleString()}
                  </div>
                </div>

                <div style={{
                  background: balanceDue > 0 ? '#fffbeb' : '#f0fdf4',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid',
                  borderColor: balanceDue > 0 ? '#fde68a' : '#bbf7d0',
                }}>
                  <span style={{ fontSize: '0.72rem', color: balanceDue > 0 ? '#b45309' : '#15803d', textTransform: 'uppercase', fontWeight: 600 }}>
                    {balanceDue > 0 ? 'Balance Due' : 'Status'}
                  </span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: balanceDue > 0 ? '#b45309' : '#15803d', marginTop: '2px' }}>
                    {balanceDue > 0 ? `₹${balanceDue.toLocaleString()}` : 'Fully Settled'}
                  </div>
                </div>
              </div>

              {/* Payment Details Inputs */}
              <div className="grid-2" style={{ gap: '0.875rem' }}>
                <div className="form-group">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label className="form-label" style={{ margin: 0 }}>Amount Collected (₹)</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        type="button"
                        onClick={() => handleSetQuickPay('full')}
                        style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'white', border: '1px solid var(--slate-300)', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Full (₹{subtotal})
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetQuickPay('zero')}
                        style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'white', border: '1px solid var(--slate-300)', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Unpaid (₹0)
                      </button>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={subtotal}
                    className="form-input"
                    value={formData.paidAmount}
                    onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                    placeholder={`e.g. ${subtotal}`}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Payment Mode</label>
                  <select
                    className="form-select"
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  >
                    <option value="cash">Cash Counter</option>
                    <option value="upi">UPI / QR Code (GPay, PhonePe, Paytm)</option>
                    <option value="card">Debit / Credit Card (POS Machine)</option>
                    <option value="online">Net Banking / Online Transfer</option>
                    <option value="cheque">Cheque / Demand Draft</option>
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '0.75rem' }}>
                <label className="form-label">Payment Reference / UTR Number (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. UPI UTR # 4238917263, Card Auth Code, or Receipt #"
                  value={formData.paymentReference}
                  onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                />
              </div>
            </div>
          )}
        </form>
      </Modal>

      {/* =========================================================================
          INTAKE SUCCESS RECEIPT MODAL
          ========================================================================= */}
      <Modal
        isOpen={!!intakeSuccessResult}
        onClose={() => setIntakeSuccessResult(null)}
        title="Intake & Requisition Receipt"
        maxWidth="680px"
        footer={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setIntakeSuccessResult(null);
                setIsRegisterOpen(true);
              }}
            >
              <UserPlus size={15} />
              <span>Accession Next Patient</span>
            </button>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setIntakeSuccessResult(null)}
              >
                Close Receipt
              </button>
              {intakeSuccessResult?.order && (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setIntakeSuccessResult(null);
                    navigate('/orders');
                  }}
                >
                  <ArrowRight size={15} />
                  <span>View in Orders Queue</span>
                </button>
              )}
            </div>
          </div>
        }
      >
        {intakeSuccessResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Header Success Badge */}
            <div style={{
              background: 'var(--mint-bg)',
              border: '1px solid var(--mint-200)',
              borderRadius: 'var(--radius-md)',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <CheckCircle2 size={28} style={{ color: 'var(--mint-600)', flexShrink: 0 }} />
              <div>
                <h4 style={{ margin: 0, color: 'var(--mint-text)', fontWeight: 700, fontSize: '1rem' }}>
                  Patient Accessioned & Requisition Generated!
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.8125rem', color: 'var(--slate-600)' }}>
                  Records synchronized with tenant database: MRN{' '}
                  <strong style={{ color: 'var(--primary-blue)', fontFamily: 'monospace' }}>
                    {intakeSuccessResult.patient?.mrn}
                  </strong>
                  {intakeSuccessResult.order && ` • Order #${intakeSuccessResult.order?.orderNumber}`}
                </p>
              </div>
            </div>

            {/* Patient & Order Details Card */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              background: 'var(--slate-50)',
              padding: '1rem',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
            }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', textTransform: 'uppercase' }}>Patient Name</span>
                <p style={{ margin: '2px 0 0', fontWeight: 600, color: 'var(--slate-900)' }}>
                  {intakeSuccessResult.patient?.fullName}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', textTransform: 'uppercase' }}>Medical Record # (MRN)</span>
                <p style={{ margin: '2px 0 0', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary-blue)' }}>
                  {intakeSuccessResult.patient?.mrn}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', textTransform: 'uppercase' }}>Gender & Blood Group</span>
                <p style={{ margin: '2px 0 0', textTransform: 'capitalize' }}>
                  {intakeSuccessResult.patient?.gender} • {intakeSuccessResult.patient?.bloodGroup || 'O+'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', textTransform: 'uppercase' }}>Contact Phone</span>
                <p style={{ margin: '2px 0 0' }}>{intakeSuccessResult.patient?.phone || 'N/A'}</p>
              </div>

              {intakeSuccessResult.order && (
                <>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', textTransform: 'uppercase' }}>Laboratory Order #</span>
                    <p style={{ margin: '2px 0 0', fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary-700)' }}>
                      {intakeSuccessResult.order?.orderNumber}
                    </p>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--slate-500)', textTransform: 'uppercase' }}>Ordering Physician</span>
                    <p style={{ margin: '2px 0 0' }}>{intakeSuccessResult.order?.orderingPhysician || 'Attending Physician'}</p>
                  </div>
                </>
              )}
            </div>

            {/* Test Requisition & Financial Receipt */}
            {intakeSuccessResult.order && (
              <div>
                <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--slate-700)' }}>
                  Requisitioned Diagnostic Tests:
                </h5>
                <div style={{ border: '1px solid var(--slate-200)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                  <table className="lms-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Test Code</th>
                        <th>Test Name</th>
                        <th>Specimen Container</th>
                        <th style={{ textAlign: 'right' }}>Catalog Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intakeSuccessResult.order?.items?.map((it) => (
                        <tr key={it.itemId || it.testCode}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-blue)' }}>{it.testCode}</td>
                          <td style={{ fontWeight: 600 }}>{it.testName}</td>
                          <td>{it.container || it.specimenType || 'Standard Tube'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{Number(it.price || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary */}
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: 'var(--slate-50)',
                  borderRadius: 'var(--radius-sm)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.875rem',
                }}>
                  <div>
                    <span style={{ color: 'var(--slate-500)' }}>Payment Mode: </span>
                    <strong style={{ textTransform: 'uppercase' }}>
                      {intakeSuccessResult.invoice?.payments?.[0]?.method || 'Cash'}
                    </strong>
                    {intakeSuccessResult.invoice?.payments?.[0]?.reference && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginLeft: '6px' }}>
                        (Ref: {intakeSuccessResult.invoice.payments[0].reference})
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div>
                      <span style={{ color: 'var(--slate-500)' }}>Total: </span>
                      <strong style={{ color: 'var(--slate-800)' }}>
                        ₹{Number(intakeSuccessResult.order?.totalAmount || 0).toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--slate-500)' }}>Paid: </span>
                      <strong style={{ color: 'var(--mint-600)' }}>
                        ₹{Number(intakeSuccessResult.order?.paidAmount || 0).toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--slate-500)' }}>Balance Due: </span>
                      <strong style={{ color: intakeSuccessResult.order?.balance > 0 ? '#b45309' : 'var(--mint-600)' }}>
                        ₹{Number(intakeSuccessResult.order?.balance || 0).toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* =========================================================================
          VIEW EXISTING PATIENT FILE MODAL
          ========================================================================= */}
      <Modal
        isOpen={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        title={selectedPatient ? `Patient Profile: ${selectedPatient.fullName || selectedPatient.firstName}` : ''}
        footer={
          <button className="btn btn-secondary" onClick={() => setSelectedPatient(null)}>
            Close Profile
          </button>
        }
      >
        {selectedPatient && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Medical Record # (MRN)</p>
                <p style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '1.05rem', color: 'var(--primary-blue)' }}>
                  {selectedPatient.mrn}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Blood Group</p>
                <p style={{ fontWeight: 600 }}>{selectedPatient.bloodGroup || 'O+'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Age / DOB</p>
                <p>
                  {selectedPatient.age
                    ? `${selectedPatient.age} years`
                    : selectedPatient.dateOfBirth || selectedPatient.dob
                    ? new Date(selectedPatient.dateOfBirth || selectedPatient.dob).toLocaleDateString()
                    : 'N/A'}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Gender</p>
                <p style={{ textTransform: 'capitalize' }}>{selectedPatient.gender}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Phone</p>
                <p>{selectedPatient.phone || 'N/A'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Email Address</p>
                <p>{selectedPatient.email || 'N/A'}</p>
              </div>
            </div>
            {selectedPatient.address && (
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Home Address</p>
                <p>{selectedPatient.address}</p>
              </div>
            )}
            {selectedPatient.medicalHistory && (
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Clinical History</p>
                <p>{selectedPatient.medicalHistory}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

export default PatientsPage;
