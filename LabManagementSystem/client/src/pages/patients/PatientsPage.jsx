/**
 * Lab Management System (LMS) - Patients Page (Phase 6 Real Clinical Accessioning)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Search, Eye, Filter, Calendar, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import clinicalService from '../../services/clinicalService';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

export function PatientsPage() {
  const { user, tenant } = useAuth();
  const tenantId = tenant?.tenantId || user?.tenantId;

  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: 'female',
    phone: '',
    email: '',
    bloodGroup: 'O+',
    address: '',
  });

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

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      alert('First name and last name are required');
      return;
    }
    try {
      setIsSubmitting(true);
      setError(null);
      const res = await clinicalService.createPatient(tenantId, formData);
      if (res.success) {
        setSuccessMsg(`Patient ${res.data.fullName || res.data.firstName} registered with MRN: ${res.data.mrn}`);
        setIsRegisterOpen(false);
        setFormData({
          firstName: '',
          lastName: '',
          dateOfBirth: '',
          gender: 'female',
          phone: '',
          email: '',
          bloodGroup: 'O+',
          address: '',
        });
        fetchPatients();
        setTimeout(() => setSuccessMsg(null), 4000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to register patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Patients Directory"
        description="Patient demographic indexing and accession history for diagnostic requisitioning."
        actions={
          <button className="btn btn-primary" onClick={() => setIsRegisterOpen(true)}>
            <UserPlus size={16} />
            <span>Register Patient</span>
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

      {/* Search Bar */}
      <div className="card" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Search size={16} style={{ color: 'var(--slate-400)' }} />
          <input
            type="text"
            placeholder="Search patients by Name, MRN, or Phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="form-input"
            style={{ border: 'none', padding: '0.35rem 0' }}
          />
        </div>
      </div>

      {/* Patients Table */}
      <div className="card">
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary-blue)' }} />
            <p>Loading patient records from tenant database...</p>
          </div>
        ) : patients.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <Users size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--slate-700)' }}>No patient records found</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              {searchTerm ? 'Try adjusting your search criteria.' : 'Click "Register Patient" to add the first patient.'}
            </p>
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
                  <th>Registration Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.patientId || p._id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-blue)' }}>
                        {p.mrn}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{p.fullName || `${p.firstName} ${p.lastName}`}</td>
                    <td>{p.dateOfBirth ? new Date(p.dateOfBirth).toLocaleDateString() : 'N/A'}</td>
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

      {/* Patient Detail Modal */}
      <Modal
        isOpen={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        title={selectedPatient ? `Patient File: ${selectedPatient.fullName || selectedPatient.firstName}` : ''}
        footer={
          <button className="btn btn-secondary" onClick={() => setSelectedPatient(null)}>
            Close File
          </button>
        }
      >
        {selectedPatient && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Medical Record # (MRN)</p>
                <p style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '1rem', color: 'var(--primary-blue)' }}>
                  {selectedPatient.mrn}
                </p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Blood Group</p>
                <p style={{ fontWeight: 600 }}>{selectedPatient.bloodGroup || 'N/A'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Email Address</p>
                <p>{selectedPatient.email || 'N/A'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Phone</p>
                <p>{selectedPatient.phone || 'N/A'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Date of Birth</p>
                <p>{selectedPatient.dateOfBirth ? new Date(selectedPatient.dateOfBirth).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Gender</p>
                <p style={{ textTransform: 'capitalize' }}>{selectedPatient.gender}</p>
              </div>
            </div>
            {selectedPatient.address && (
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Home Address</p>
                <p>{selectedPatient.address}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Patient Registration Modal */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Register New Patient Profile"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsRegisterOpen(false)} disabled={isSubmitting}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleRegisterSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Patient</span>
              )}
            </button>
          </>
        }
      >
        <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">First Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. John"
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
                placeholder="e.g. Doe"
                required
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input
                type="date"
                className="form-input"
                value={formData.dateOfBirth}
                onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select
                className="form-select"
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Contact Phone</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+1 (555) 000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
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
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="form-input"
              placeholder="patient@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Home Address</label>
            <input
              type="text"
              className="form-input"
              placeholder="123 Health Ave, Suite 100"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </>
  );
}

export default PatientsPage;
