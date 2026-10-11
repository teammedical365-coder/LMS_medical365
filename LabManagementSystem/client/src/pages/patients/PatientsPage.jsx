/**
 * Lab Management System (LMS) - Patients Page (Phase 1 UI Shell)
 */

import React, { useState } from 'react';
import { Users, UserPlus, Search, Eye, Filter, Calendar } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

export function PatientsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);

  const mockPatients = [
    {
      mrn: 'MRN-9021',
      name: 'Eleanor Vance',
      dob: '1984-06-14',
      age: '42',
      gender: 'Female',
      phone: '+1 (555) 234-8901',
      activeOrders: 2,
      lastVisit: 'Today',
      email: 'e.vance@example.com',
      bloodType: 'A+',
    },
    {
      mrn: 'MRN-8842',
      name: 'Arthur Pendelton',
      dob: '1962-11-20',
      age: '63',
      gender: 'Male',
      phone: '+1 (555) 345-9012',
      activeOrders: 1,
      lastVisit: 'Today',
      email: 'a.pendelton@example.com',
      bloodType: 'O+',
    },
    {
      mrn: 'MRN-7731',
      name: 'Maria Santos',
      dob: '1991-03-05',
      age: '35',
      gender: 'Female',
      phone: '+1 (555) 456-0123',
      activeOrders: 0,
      lastVisit: 'Yesterday',
      email: 'm.santos@example.com',
      bloodType: 'B-',
    },
    {
      mrn: 'MRN-6512',
      name: 'David K. Miller',
      dob: '1975-08-19',
      age: '51',
      gender: 'Male',
      phone: '+1 (555) 567-1234',
      activeOrders: 1,
      lastVisit: '2 days ago',
      email: 'd.miller@example.com',
      bloodType: 'AB+',
    },
    {
      mrn: 'MRN-4429',
      name: 'Clara Oswald',
      dob: '1995-12-01',
      age: '30',
      gender: 'Female',
      phone: '+1 (555) 678-2345',
      activeOrders: 0,
      lastVisit: '1 week ago',
      email: 'c.oswald@example.com',
      bloodType: 'O-',
    },
  ];

  const filteredPatients = mockPatients.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.mrn.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <PageHeader
        title="Patients Directory"
        description="Patient demographic indexing and accession history for diagnostic requisitioning."
        actions={
          <button className="btn btn-primary" onClick={() => setIsRegisterOpen(true)}>
            <UserPlus size={16} />
            <span>Register Patient (UI Demo)</span>
          </button>
        }
      />

      <StatusBanner
        type="info"
        badgeText="UI Shell Demonstration"
        message="Patient records below are simulated mock entries. Real database persistence and biometric/MRN generation will be implemented in Phase 2."
      />

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ color: 'var(--slate-400)' }} />
            <input
              type="text"
              placeholder="Filter by patient name or MRN number..."
              className="form-input"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', padding: '0.35rem 0' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--slate-500)' }}>
            <Filter size={14} />
            <span>Showing {filteredPatients.length} of {mockPatients.length} mock patients</span>
          </div>
        </div>
      </div>

      {/* Patient Table */}
      <div className="card">
        <div className="table-container">
          <table className="lms-table">
            <thead>
              <tr>
                <th>MRN Number</th>
                <th>Full Name</th>
                <th>Age / Gender</th>
                <th>Date of Birth</th>
                <th>Contact Phone</th>
                <th>Active Orders</th>
                <th>Last Activity</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatients.map((p) => (
                <tr key={p.mrn}>
                  <td>
                    <strong style={{ fontFamily: 'monospace', color: 'var(--primary-700)' }}>{p.mrn}</strong>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>{p.name}</span>
                  </td>
                  <td>{p.age} yrs / {p.gender}</td>
                  <td>{p.dob}</td>
                  <td>{p.phone}</td>
                  <td>
                    {p.activeOrders > 0 ? (
                      <Badge variant="teal">{p.activeOrders} Active</Badge>
                    ) : (
                      <Badge variant="slate">0 Active</Badge>
                    )}
                  </td>
                  <td style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{p.lastVisit}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedPatient(p)}
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

      {/* Patient Details Modal */}
      <Modal
        isOpen={!!selectedPatient}
        onClose={() => setSelectedPatient(null)}
        title={selectedPatient ? `Patient File: ${selectedPatient.name}` : ''}
        footer={
          <button className="btn btn-secondary" onClick={() => setSelectedPatient(null)}>
            Close File
          </button>
        }
      >
        {selectedPatient && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <StatusBanner
              type="info"
              badgeText="UI Shell Only"
              message="Demographic card preview. Full EHR history will be wired up during Phase 2."
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>MRN</p>
                <p style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selectedPatient.mrn}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Blood Group</p>
                <p style={{ fontWeight: 600 }}>{selectedPatient.bloodType}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Email Address</p>
                <p>{selectedPatient.email}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Phone</p>
                <p>{selectedPatient.phone}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Patient Registration Modal (Demo) */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        title="Register New Patient (UI Placeholder)"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsRegisterOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                alert('UI Placeholder Notice: Patient database writing is scheduled for Phase 2.');
                setIsRegisterOpen(false);
              }}
            >
              Save Patient (Demo)
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <StatusBanner
            type="warning"
            badgeText="Preparation Mode"
            message="Form fields below illustrate the Phase 2 patient intake contract."
          />
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input type="text" className="form-input" placeholder="e.g. John" />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input type="text" className="form-input" placeholder="e.g. Doe" />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input type="date" className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-select">
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Contact Phone</label>
            <input type="tel" className="form-input" placeholder="+1 (555) 000-0000" />
          </div>
        </div>
      </Modal>
    </>
  );
}

export default PatientsPage;
