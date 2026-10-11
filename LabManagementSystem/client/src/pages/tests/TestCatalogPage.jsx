/**
 * Lab Management System (LMS) - Test Catalog Page (Phase 6 Real Catalog Integration)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { TestTube2, PlusCircle, Search, Eye, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import clinicalService from '../../services/clinicalService';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

export function TestCatalogPage() {
  const { user, tenant } = useAuth();
  const tenantId = tenant?.tenantId || user?.tenantId;

  const [tests, setTests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedTest, setSelectedTest] = useState(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    category: 'General Pathology',
    department: 'Hematology',
    specimenType: 'Whole Blood (EDTA)',
    price: '',
    turnaroundHours: 24,
    referenceRange: 'Normal reference range',
  });

  const fetchCatalog = useCallback(async () => {
    if (!tenantId) return;
    try {
      setIsLoading(true);
      setError(null);
      const res = await clinicalService.getTestCatalog(tenantId);
      if (res.success && Array.isArray(res.data)) {
        setTests(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve test catalog');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  const handleCreateTest = async (e) => {
    e.preventDefault();
    if (!formData.code.trim() || !formData.name.trim()) {
      alert('Test code and descriptive name are required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await clinicalService.createTest(tenantId, {
        ...formData,
        price: Number(formData.price) || 0,
        turnaroundHours: Number(formData.turnaroundHours) || 24,
      });

      if (res.success) {
        setSuccessMsg(`Test panel '${res.data.name}' (${res.data.code}) added to catalog`);
        setIsAddOpen(false);
        setFormData({
          code: '',
          name: '',
          category: 'General Pathology',
          department: 'Hematology',
          specimenType: 'Whole Blood (EDTA)',
          price: '',
          turnaroundHours: 24,
          referenceRange: 'Normal reference range',
        });
        fetchCatalog();
        setTimeout(() => setSuccessMsg(null), 3000);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create test item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const departments = ['All', ...new Set(tests.map((t) => t.department).filter(Boolean))];

  const filteredTests = tests.filter((t) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (t.name || '').toLowerCase().includes(term) ||
      (t.code || '').toLowerCase().includes(term);
    const matchesDept = selectedDept === 'All' || t.department === selectedDept;
    return matchesSearch && matchesDept;
  });

  return (
    <>
      <PageHeader
        title="Laboratory Test Catalog & Pricing"
        description="Standardized diagnostic test master, specimen tube prerequisites, biological reference intervals, and billing rates."
        actions={
          <button className="btn btn-primary" onClick={() => setIsAddOpen(true)}>
            <PlusCircle size={16} />
            <span>Add Test Panel</span>
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

      {/* Filter / Search Bar */}
      <div className="card" style={{ padding: '0.75rem 1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
            <Search size={16} style={{ color: 'var(--slate-400)' }} />
            <input
              type="text"
              placeholder="Search tests by panel name, analyte, or CPT/Test code..."
              className="form-input"
              style={{ border: 'none', padding: '0.35rem 0' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', whiteSpace: 'nowrap' }}>Department:</span>
            <select
              className="form-select"
              style={{ width: 'auto', padding: '0.25rem 0.75rem' }}
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Test Catalog Table */}
      <div className="card">
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary-blue)' }} />
            <p>Loading diagnostic catalog...</p>
          </div>
        ) : filteredTests.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <TestTube2 size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--slate-700)' }}>No tests found in catalog</p>
            <p style={{ fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Click "Add Test Panel" to define laboratory pricing and methodologies.
            </p>
          </div>
        ) : (
          <div className="table-container">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Test Code</th>
                  <th>Panel Name</th>
                  <th>Department</th>
                  <th>Specimen Type</th>
                  <th>Target TAT</th>
                  <th>Standard Price</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTests.map((test) => (
                  <tr key={test.testId || test._id}>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-blue)' }}>
                        {test.code}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{test.name}</td>
                    <td>{test.department || 'Pathology'}</td>
                    <td>{test.specimenType || 'Serum'}</td>
                    <td>{test.turnaroundHours ? `${test.turnaroundHours} Hours` : '24 Hours'}</td>
                    <td style={{ fontWeight: 600 }}>${Number(test.price || 0).toFixed(2)}</td>
                    <td>
                      <Badge variant="success">Active</Badge>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedTest(test)}
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

      {/* Test Details Modal */}
      <Modal
        isOpen={!!selectedTest}
        onClose={() => setSelectedTest(null)}
        title={selectedTest ? `${selectedTest.code} - ${selectedTest.name}` : ''}
        footer={
          <button className="btn btn-secondary" onClick={() => setSelectedTest(null)}>
            Close
          </button>
        }
      >
        {selectedTest && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div className="grid-2">
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Department</p>
                <p style={{ fontWeight: 600 }}>{selectedTest.department || 'General'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Specimen Requirement</p>
                <p style={{ fontWeight: 600 }}>{selectedTest.specimenType || 'Serum'}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Target Turnaround</p>
                <p>{selectedTest.turnaroundHours || 24} Hours</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Default Price</p>
                <p style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>${Number(selectedTest.price || 0).toFixed(2)}</p>
              </div>
            </div>

            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>Biological Reference Interval</p>
              <div style={{ background: 'var(--slate-50)', padding: '0.625rem', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                {selectedTest.referenceRange || 'Standard laboratory biological interval'}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Test Modal */}
      <Modal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Add Diagnostic Test Panel to Catalog"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsAddOpen(false)} disabled={isSubmitting}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleCreateTest} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save to Catalog</span>
              )}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateTest} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Test Code *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. CBC, LIPID"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Panel Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Complete Blood Count"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Department</label>
              <select
                className="form-select"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              >
                <option value="Hematology">Hematology</option>
                <option value="Clinical Chemistry">Clinical Chemistry</option>
                <option value="Immunology">Immunology</option>
                <option value="Microbiology">Microbiology</option>
                <option value="Endocrinology">Endocrinology</option>
                <option value="Molecular Diagnostics">Molecular Diagnostics</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Standard Price ($) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="form-input"
                placeholder="45.00"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Specimen Container / Type</label>
              <input
                type="text"
                className="form-input"
                placeholder="Whole Blood (EDTA), Serum (SST)"
                value={formData.specimenType}
                onChange={(e) => setFormData({ ...formData, specimenType: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Turnaround Hours (TAT)</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={formData.turnaroundHours}
                onChange={(e) => setFormData({ ...formData, turnaroundHours: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Reference Range Description</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. 70 - 99 mg/dL"
              value={formData.referenceRange}
              onChange={(e) => setFormData({ ...formData, referenceRange: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </>
  );
}

export default TestCatalogPage;
