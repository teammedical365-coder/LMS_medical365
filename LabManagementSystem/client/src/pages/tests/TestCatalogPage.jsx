/**
 * Lab Management System (LMS) - Test Catalog Page (Phase 3 Deepening: Structured Parameters & Reference Ranges)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TestTube2,
  PlusCircle,
  Search,
  Eye,
  Edit2,
  Trash2,
  Plus,
  Loader2,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import clinicalService from '../../services/clinicalService';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';

const DEFAULT_FORM = {
  code: '',
  name: '',
  category: 'General Pathology',
  department: 'Hematology',
  specimenType: 'Whole Blood (EDTA)',
  price: '',
  turnaroundHours: 24,
  referenceRange: 'Normal reference range',
  parameters: [],
};

export function TestCatalogPage() {
  const { user, tenant } = useAuth();
  const tenantId = tenant?.tenantId || user?.tenantId;

  const [tests, setTests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedTest, setSelectedTest] = useState(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingTestId, setEditingTestId] = useState(null);
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [formValidationWarning, setFormValidationWarning] = useState(null);

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

  const handleOpenCreate = () => {
    setFormData(DEFAULT_FORM);
    setIsEditMode(false);
    setEditingTestId(null);
    setFormValidationWarning(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (test) => {
    const mappedParameters = Array.isArray(test.parameters)
      ? test.parameters.map((p) => ({
          parameterCode: p.parameterCode || '',
          name: p.name || '',
          unit: p.unit || '',
          resultType: p.resultType || 'NUMERIC',
          optionsString: Array.isArray(p.options) ? p.options.join(', ') : '',
          referenceRanges: Array.isArray(p.referenceRanges)
            ? p.referenceRanges.map((r) => ({
                gender: r.gender || 'BOTH',
                ageMinDays: r.ageMinDays !== undefined ? r.ageMinDays : 0,
                ageMaxDays: r.ageMaxDays !== undefined ? r.ageMaxDays : 47450,
                lowNormal: r.lowNormal !== null && r.lowNormal !== undefined ? r.lowNormal : '',
                highNormal: r.highNormal !== null && r.highNormal !== undefined ? r.highNormal : '',
                criticalLow: r.criticalLow !== null && r.criticalLow !== undefined ? r.criticalLow : '',
                criticalHigh: r.criticalHigh !== null && r.criticalHigh !== undefined ? r.criticalHigh : '',
                textRange: r.textRange || '',
              }))
            : [],
        }))
      : [];

    setFormData({
      code: test.code || '',
      name: test.name || '',
      category: test.category || 'General Pathology',
      department: test.department || 'Hematology',
      specimenType: test.specimenType || 'Serum',
      price: test.price !== undefined ? String(test.price) : '0',
      turnaroundHours: test.turnaroundHours || 24,
      referenceRange: test.referenceRange || '',
      parameters: mappedParameters,
    });
    setIsEditMode(true);
    setEditingTestId(test.testId || test._id);
    setFormValidationWarning(null);
    setIsModalOpen(true);
  };

  // Parameter manipulation helpers
  const handleAddParameter = () => {
    setFormData((prev) => ({
      ...prev,
      parameters: [
        ...prev.parameters,
        {
          parameterCode: '',
          name: '',
          unit: '',
          resultType: 'NUMERIC',
          optionsString: '',
          referenceRanges: [
            {
              gender: 'BOTH',
              ageMinDays: 0,
              ageMaxDays: 47450,
              lowNormal: '',
              highNormal: '',
              criticalLow: '',
              criticalHigh: '',
              textRange: '',
            },
          ],
        },
      ],
    }));
  };

  const handleRemoveParameter = (index) => {
    setFormData((prev) => ({
      ...prev,
      parameters: prev.parameters.filter((_, idx) => idx !== index),
    }));
  };

  const handleParameterChange = (paramIndex, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.parameters];
      updated[paramIndex] = { ...updated[paramIndex], [field]: value };
      return { ...prev, parameters: updated };
    });
  };

  const handleAddRange = (paramIndex) => {
    setFormData((prev) => {
      const updated = [...prev.parameters];
      const param = { ...updated[paramIndex] };
      param.referenceRanges = [
        ...param.referenceRanges,
        {
          gender: 'BOTH',
          ageMinDays: 0,
          ageMaxDays: 47450,
          lowNormal: '',
          highNormal: '',
          criticalLow: '',
          criticalHigh: '',
          textRange: '',
        },
      ];
      updated[paramIndex] = param;
      return { ...prev, parameters: updated };
    });
  };

  const handleRemoveRange = (paramIndex, rangeIndex) => {
    setFormData((prev) => {
      const updated = [...prev.parameters];
      const param = { ...updated[paramIndex] };
      param.referenceRanges = param.referenceRanges.filter((_, idx) => idx !== rangeIndex);
      updated[paramIndex] = param;
      return { ...prev, parameters: updated };
    });
  };

  const handleRangeChange = (paramIndex, rangeIndex, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.parameters];
      const param = { ...updated[paramIndex] };
      const ranges = [...param.referenceRanges];
      ranges[rangeIndex] = { ...ranges[rangeIndex], [field]: value };
      param.referenceRanges = ranges;
      updated[paramIndex] = param;
      return { ...prev, parameters: updated };
    });
  };

  const validateForm = () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      return 'Test code and panel name are required.';
    }

    const seenCodes = new Set();
    for (let i = 0; i < formData.parameters.length; i++) {
      const p = formData.parameters[i];
      const code = p.parameterCode.trim().toUpperCase();
      if (!code) {
        return `Parameter #${i + 1} requires a parameter code.`;
      }
      if (seenCodes.has(code)) {
        return `Duplicate parameter code '${code}' defined in test.`;
      }
      seenCodes.add(code);

      if (!p.name.trim()) {
        return `Parameter '${code}' requires a descriptive name.`;
      }

      if (p.resultType === 'OPTIONS') {
        const opts = p.optionsString
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (opts.length === 0) {
          return `Parameter '${code}' of type OPTIONS must have at least one comma-separated option.`;
        }
      }

      for (let rIdx = 0; rIdx < p.referenceRanges.length; rIdx++) {
        const r = p.referenceRanges[rIdx];
        const minDays = Number(r.ageMinDays);
        const maxDays = Number(r.ageMaxDays);
        if (minDays < 0 || maxDays < 0) {
          return `Parameter '${code}' range #${rIdx + 1}: Age values cannot be negative.`;
        }
        if (minDays > maxDays) {
          return `Parameter '${code}' range #${rIdx + 1}: Minimum age (${minDays}) cannot exceed maximum age (${maxDays}).`;
        }

        const low = r.lowNormal !== '' ? Number(r.lowNormal) : null;
        const high = r.highNormal !== '' ? Number(r.highNormal) : null;
        if (low !== null && high !== null && low > high) {
          return `Parameter '${code}' range #${rIdx + 1}: Low normal (${low}) cannot exceed high normal (${high}).`;
        }
      }
    }

    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const valError = validateForm();
    if (valError) {
      setFormValidationWarning(valError);
      return;
    }
    setFormValidationWarning(null);

    // Format parameters payload
    const formattedParams = formData.parameters.map((p, pIdx) => {
      const cleanOptions =
        p.resultType === 'OPTIONS'
          ? p.optionsString
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      const cleanRanges = p.referenceRanges.map((r) => ({
        gender: r.gender || 'BOTH',
        ageMinDays: Number(r.ageMinDays) || 0,
        ageMaxDays: Number(r.ageMaxDays) || 47450,
        lowNormal: r.lowNormal !== '' && !isNaN(Number(r.lowNormal)) ? Number(r.lowNormal) : null,
        highNormal: r.highNormal !== '' && !isNaN(Number(r.highNormal)) ? Number(r.highNormal) : null,
        criticalLow: r.criticalLow !== '' && !isNaN(Number(r.criticalLow)) ? Number(r.criticalLow) : null,
        criticalHigh: r.criticalHigh !== '' && !isNaN(Number(r.criticalHigh)) ? Number(r.criticalHigh) : null,
        textRange: r.textRange ? String(r.textRange).trim() : null,
      }));

      return {
        parameterCode: p.parameterCode.trim().toUpperCase(),
        name: p.name.trim(),
        unit: p.unit.trim(),
        resultType: p.resultType,
        options: cleanOptions,
        referenceRanges: cleanRanges,
        displayOrder: pIdx + 1,
      };
    });

    const payload = {
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      category: formData.category.trim(),
      department: formData.department.trim(),
      specimenType: formData.specimenType.trim(),
      price: Number(formData.price) || 0,
      turnaroundHours: Number(formData.turnaroundHours) || 24,
      referenceRange: formData.referenceRange.trim() || 'Standard reference interval',
      parameters: formattedParams,
    };

    try {
      setIsSubmitting(true);
      setError(null);

      let res;
      if (isEditMode) {
        res = await clinicalService.updateTest(tenantId, editingTestId, payload);
      } else {
        res = await clinicalService.createTest(tenantId, payload);
      }

      if (res.success) {
        setSuccessMsg(
          isEditMode
            ? `Test panel '${res.data.name}' (${res.data.code}) updated successfully`
            : `Test panel '${res.data.name}' (${res.data.code}) added to catalog`
        );
        setIsModalOpen(false);
        fetchCatalog();
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save test catalog entry');
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
        title="Laboratory Test Catalog & Parameters"
        description="Standardized diagnostic test master, biological reference intervals, and structured multi-parameter profiles."
        actions={
          <button className="btn btn-primary" onClick={handleOpenCreate}>
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
                  <th>Specimen</th>
                  <th>Structure</th>
                  <th>Target TAT</th>
                  <th>Standard Price</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTests.map((test) => {
                  const paramCount = Array.isArray(test.parameters) ? test.parameters.length : 0;
                  return (
                    <tr key={test.testId || test._id}>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-blue)' }}>
                          {test.code}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{test.name}</td>
                      <td>{test.department || 'Pathology'}</td>
                      <td>{test.specimenType || 'Serum'}</td>
                      <td>
                        {paramCount > 0 ? (
                          <Badge variant="purple">
                            <Layers size={11} style={{ marginRight: '4px' }} />
                            {paramCount} {paramCount === 1 ? 'Parameter' : 'Parameters'}
                          </Badge>
                        ) : (
                          <Badge variant="slate">Single Analyte</Badge>
                        )}
                      </td>
                      <td>{test.turnaroundHours ? `${test.turnaroundHours}h` : '24h'}</td>
                      <td style={{ fontWeight: 600 }}>${Number(test.price || 0).toFixed(2)}</td>
                      <td>
                        <Badge variant="success">Active</Badge>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedTest(test)}
                            title="View test details and reference ranges"
                          >
                            <Eye size={13} />
                            <span>View</span>
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenEdit(test)}
                            title="Edit test parameters and pricing"
                          >
                            <Edit2 size={13} />
                            <span>Edit</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Test Details Modal */}
      <Modal
        isOpen={!!selectedTest}
        onClose={() => setSelectedTest(null)}
        title={selectedTest ? `${selectedTest.code} — ${selectedTest.name}` : ''}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                const target = selectedTest;
                setSelectedTest(null);
                handleOpenEdit(target);
              }}
            >
              <Edit2 size={14} />
              <span>Edit Panel</span>
            </button>
            <button className="btn btn-secondary" onClick={() => setSelectedTest(null)}>
              Close
            </button>
          </div>
        }
      >
        {selectedTest && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.875rem' }}>
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
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Standard Tariff</p>
                <p style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>${Number(selectedTest.price || 0).toFixed(2)}</p>
              </div>
            </div>

            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>General Summary Interval</p>
              <div style={{ background: 'var(--slate-50)', padding: '0.625rem', borderRadius: 'var(--radius-md)', fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                {selectedTest.referenceRange || 'Standard laboratory biological interval'}
              </div>
            </div>

            {/* Structured Parameters Breakdown */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--slate-700)' }}>
                  Structured Parameters ({selectedTest.parameters?.length || 0})
                </p>
              </div>

              {selectedTest.parameters && selectedTest.parameters.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedTest.parameters.map((param, pIdx) => (
                    <div
                      key={pIdx}
                      style={{
                        border: '1px solid var(--border-light, #E2E8F0)',
                        borderRadius: 'var(--radius-md)',
                        padding: '0.75rem',
                        background: '#FFFFFF',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-blue)', marginRight: '8px' }}>
                            {param.parameterCode}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--slate-800)' }}>{param.name}</span>
                          {param.unit && (
                            <span style={{ color: 'var(--slate-500)', fontSize: '0.8125rem', marginLeft: '6px' }}>
                              ({param.unit})
                            </span>
                          )}
                        </div>
                        <Badge variant={param.resultType === 'NUMERIC' ? 'teal' : param.resultType === 'OPTIONS' ? 'purple' : 'slate'}>
                          {param.resultType}
                        </Badge>
                      </div>

                      {param.resultType === 'OPTIONS' && param.options && param.options.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--slate-600)', marginBottom: '6px' }}>
                          Allowed Options: <strong>{param.options.join(', ')}</strong>
                        </div>
                      )}

                      {/* Reference Ranges Table */}
                      {param.referenceRanges && param.referenceRanges.length > 0 ? (
                        <div style={{ overflowX: 'auto', marginTop: '6px' }}>
                          <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                              <tr style={{ background: 'var(--slate-50)', color: 'var(--slate-600)', borderBottom: '1px solid #E2E8F0' }}>
                                <th style={{ padding: '4px 6px' }}>Gender</th>
                                <th style={{ padding: '4px 6px' }}>Age Bracket</th>
                                <th style={{ padding: '4px 6px' }}>Normal Interval</th>
                                <th style={{ padding: '4px 6px' }}>Critical / Panic</th>
                                <th style={{ padding: '4px 6px' }}>Text / Expected</th>
                              </tr>
                            </thead>
                            <tbody>
                              {param.referenceRanges.map((rng, rIdx) => (
                                <tr key={rIdx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                  <td style={{ padding: '4px 6px', fontWeight: 600 }}>{rng.gender}</td>
                                  <td style={{ padding: '4px 6px' }}>
                                    {Math.round(rng.ageMinDays / 365.25)} - {Math.round(rng.ageMaxDays / 365.25)} yrs
                                    <span style={{ color: 'var(--slate-400)', fontSize: '0.7rem' }}> ({rng.ageMinDays}-{rng.ageMaxDays}d)</span>
                                  </td>
                                  <td style={{ padding: '4px 6px', fontFamily: 'monospace', fontWeight: 600 }}>
                                    {rng.lowNormal !== null && rng.highNormal !== null
                                      ? `${rng.lowNormal} – ${rng.highNormal} ${param.unit}`
                                      : rng.lowNormal !== null
                                      ? `> ${rng.lowNormal}`
                                      : rng.highNormal !== null
                                      ? `< ${rng.highNormal}`
                                      : '—'}
                                  </td>
                                  <td style={{ padding: '4px 6px', color: 'var(--danger-600, #DC2626)', fontFamily: 'monospace' }}>
                                    {rng.criticalLow !== null || rng.criticalHigh !== null
                                      ? `< ${rng.criticalLow ?? '—'} / > ${rng.criticalHigh ?? '—'}`
                                      : '—'}
                                  </td>
                                  <td style={{ padding: '4px 6px', color: 'var(--slate-600)' }}>
                                    {rng.textRange || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.75rem', color: 'var(--slate-400)', fontStyle: 'italic', margin: 0 }}>
                          No demographic age/gender reference ranges configured.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ background: 'var(--slate-50)', padding: '0.75rem', borderRadius: 'var(--radius-md)', color: 'var(--slate-500)', fontSize: '0.8125rem' }}>
                  No structured sub-parameters. This panel is recorded as a single summary analyte.
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Test Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={isEditMode ? `Edit Diagnostic Test Panel: ${formData.code}` : 'Add Diagnostic Test Panel to Catalog'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEditMode ? 'Save Changes' : 'Save to Catalog'}</span>
              )}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {formValidationWarning && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <AlertCircle size={16} />
              <span>{formValidationWarning}</span>
            </div>
          )}

          {/* Core Panel Details */}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Test Code *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. CBC, LIPID, GLU"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
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
                <option value="Urinalysis">Urinalysis</option>
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
                placeholder="e.g. Whole Blood (EDTA), Serum (SST)"
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
            <label className="form-label">General Reference Summary Description</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Normal adult physiological limits"
              value={formData.referenceRange}
              onChange={(e) => setFormData({ ...formData, referenceRange: e.target.value })}
            />
          </div>

          {/* Structured Parameters Section */}
          <div style={{ marginTop: '0.5rem', borderTop: '1px solid #E2E8F0', paddingTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--slate-800)' }}>
                  Structured Analytes & Parameters
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                  Define individual measured parameters, numeric limits, and age/gender biological intervals.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddParameter}
              >
                <Plus size={14} />
                <span>Add Parameter</span>
              </button>
            </div>

            {formData.parameters.length === 0 ? (
              <div style={{ background: 'var(--slate-50)', padding: '1rem', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.8125rem' }}>
                No sub-parameters added. This test will be recorded as a single flat result. Click "Add Parameter" to configure multi-analyte profiles (e.g. CBC, Metabolic Panel).
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {formData.parameters.map((param, pIdx) => (
                  <div
                    key={pIdx}
                    style={{
                      border: '1px solid #CBD5E1',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.875rem',
                      background: '#F8FAFC',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--primary-blue)' }}>
                        Parameter #{pIdx + 1}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ color: '#DC2626', borderColor: '#FCA5A5' }}
                        onClick={() => handleRemoveParameter(pIdx)}
                        title="Remove parameter"
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                    </div>

                    <div className="grid-2" style={{ marginBottom: '8px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Code *</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. HGB, RBC, GLU"
                          required
                          value={param.parameterCode}
                          onChange={(e) => handleParameterChange(pIdx, 'parameterCode', e.target.value.toUpperCase())}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Analyte Name *</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Hemoglobin"
                          required
                          value={param.name}
                          onChange={(e) => handleParameterChange(pIdx, 'name', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid-2" style={{ marginBottom: '8px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Unit</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. g/dL, mg/dL, %"
                          value={param.unit}
                          onChange={(e) => handleParameterChange(pIdx, 'unit', e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Result Type</label>
                        <select
                          className="form-select"
                          value={param.resultType}
                          onChange={(e) => handleParameterChange(pIdx, 'resultType', e.target.value)}
                        >
                          <option value="NUMERIC">NUMERIC (Numeric range check)</option>
                          <option value="TEXT">TEXT (Qualitative narrative)</option>
                          <option value="OPTIONS">OPTIONS (Preset choices)</option>
                        </select>
                      </div>
                    </div>

                    {param.resultType === 'OPTIONS' && (
                      <div className="form-group" style={{ marginBottom: '8px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem' }}>Allowed Options (comma-separated) *</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Negative, Positive, Equivocal"
                          value={param.optionsString}
                          onChange={(e) => handleParameterChange(pIdx, 'optionsString', e.target.value)}
                        />
                      </div>
                    )}

                    {/* Reference Ranges Sub-table */}
                    <div style={{ marginTop: '8px', borderTop: '1px dashed #CBD5E1', paddingTop: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-700)' }}>
                          Reference Intervals ({param.referenceRanges.length})
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                          onClick={() => handleAddRange(pIdx)}
                        >
                          <Plus size={11} />
                          <span>Add Interval</span>
                        </button>
                      </div>

                      {param.referenceRanges.map((rng, rIdx) => (
                        <div
                          key={rIdx}
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            borderRadius: '4px',
                            padding: '6px 8px',
                            marginBottom: '6px',
                            fontSize: '0.75rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--slate-600)' }}>Interval #{rIdx + 1}</span>
                            <button
                              type="button"
                              style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', padding: 0 }}
                              onClick={() => handleRemoveRange(pIdx, rIdx)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '6px' }}>
                            <div>
                              <label style={{ display: 'block', color: 'var(--slate-500)', fontSize: '0.7rem' }}>Gender</label>
                              <select
                                className="form-select"
                                style={{ padding: '2px 4px', fontSize: '0.75rem' }}
                                value={rng.gender}
                                onChange={(e) => handleRangeChange(pIdx, rIdx, 'gender', e.target.value)}
                              >
                                <option value="BOTH">BOTH</option>
                                <option value="MALE">MALE</option>
                                <option value="FEMALE">FEMALE</option>
                              </select>
                            </div>
                            <div>
                              <label style={{ display: 'block', color: 'var(--slate-500)', fontSize: '0.7rem' }}>Age Min (Days)</label>
                              <input
                                type="number"
                                className="form-input"
                                style={{ padding: '2px 4px', fontSize: '0.75rem' }}
                                value={rng.ageMinDays}
                                onChange={(e) => handleRangeChange(pIdx, rIdx, 'ageMinDays', e.target.value)}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', color: 'var(--slate-500)', fontSize: '0.7rem' }}>Age Max (Days)</label>
                              <input
                                type="number"
                                className="form-input"
                                style={{ padding: '2px 4px', fontSize: '0.75rem' }}
                                value={rng.ageMaxDays}
                                onChange={(e) => handleRangeChange(pIdx, rIdx, 'ageMaxDays', e.target.value)}
                              />
                            </div>

                            {param.resultType === 'NUMERIC' ? (
                              <>
                                <div>
                                  <label style={{ display: 'block', color: 'var(--slate-500)', fontSize: '0.7rem' }}>Low Normal</label>
                                  <input
                                    type="number"
                                    step="any"
                                    className="form-input"
                                    style={{ padding: '2px 4px', fontSize: '0.75rem' }}
                                    placeholder="e.g. 12.0"
                                    value={rng.lowNormal}
                                    onChange={(e) => handleRangeChange(pIdx, rIdx, 'lowNormal', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', color: 'var(--slate-500)', fontSize: '0.7rem' }}>High Normal</label>
                                  <input
                                    type="number"
                                    step="any"
                                    className="form-input"
                                    style={{ padding: '2px 4px', fontSize: '0.75rem' }}
                                    placeholder="e.g. 16.0"
                                    value={rng.highNormal}
                                    onChange={(e) => handleRangeChange(pIdx, rIdx, 'highNormal', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', color: 'var(--slate-500)', fontSize: '0.7rem' }}>Panic Low</label>
                                  <input
                                    type="number"
                                    step="any"
                                    className="form-input"
                                    style={{ padding: '2px 4px', fontSize: '0.75rem' }}
                                    placeholder="e.g. 7.0"
                                    value={rng.criticalLow}
                                    onChange={(e) => handleRangeChange(pIdx, rIdx, 'criticalLow', e.target.value)}
                                  />
                                </div>
                                <div>
                                  <label style={{ display: 'block', color: 'var(--slate-500)', fontSize: '0.7rem' }}>Panic High</label>
                                  <input
                                    type="number"
                                    step="any"
                                    className="form-input"
                                    style={{ padding: '2px 4px', fontSize: '0.75rem' }}
                                    placeholder="e.g. 20.0"
                                    value={rng.criticalHigh}
                                    onChange={(e) => handleRangeChange(pIdx, rIdx, 'criticalHigh', e.target.value)}
                                  />
                                </div>
                              </>
                            ) : (
                              <div style={{ gridColumn: 'span 2' }}>
                                <label style={{ display: 'block', color: 'var(--slate-500)', fontSize: '0.7rem' }}>Expected Text Range</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ padding: '2px 4px', fontSize: '0.75rem' }}
                                  placeholder="e.g. Negative"
                                  value={rng.textRange}
                                  onChange={(e) => handleRangeChange(pIdx, rIdx, 'textRange', e.target.value)}
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </Modal>
    </>
  );
}

export default TestCatalogPage;
