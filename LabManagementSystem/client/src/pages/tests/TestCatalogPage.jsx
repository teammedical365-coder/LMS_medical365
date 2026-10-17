/**
 * Lab Management System (LMS) - Test Catalog Page (Phase 3 Deepening: Structured Parameters & Reference Ranges)
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
import notify from '../../utils/notify';

// Top standard parameter code presets (user-requested common presets)
const COMMON_PARAMETER_PRESETS = [
  { code: 'HGB', name: 'Hemoglobin', unit: 'g/dL', lowNormal: '12.0', highNormal: '16.0', criticalLow: '7.0', criticalHigh: '20.0' },
  { code: 'RBC', name: 'Red Blood Cells (RBC Count)', unit: '10^6/µL', lowNormal: '4.2', highNormal: '5.9', criticalLow: '2.5', criticalHigh: '7.0' },
  { code: 'GLU', name: 'Blood Glucose (Fasting)', unit: 'mg/dL', lowNormal: '70', highNormal: '100', criticalLow: '50', criticalHigh: '300' },
];

// Comprehensive diagnostic units of measure
const DIAGNOSTIC_UNITS = [
  'g/dL',
  'mg/dL',
  'µg/dL',
  'mmol/L',
  'µmol/L',
  'mEq/L',
  '%',
  'cells/µL',
  '10^3/µL',
  '10^6/µL',
  '/cumm',
  'IU/L',
  'U/L',
  'mIU/mL',
  'µIU/mL',
  'ng/mL',
  'pg/mL',
  'mg/L',
  'g/L',
  'fL',
  'pg',
  'sec',
  'mm/hr',
  'ratio',
  'Index',
  'copies/mL',
  'cells/HPF',
];

// Age milestone options in Years (0 to 120 Years)
const AGE_YEARS_OPTIONS = Array.from({ length: 121 }, (_, i) => {
  let milestone = '';
  if (i === 0) milestone = ' (Birth / Newborn)';
  else if (i === 1) milestone = ' (Infant - 1 yr)';
  else if (i === 5) milestone = ' (Early Child - 5 yrs)';
  else if (i === 12) milestone = ' (Adolescent - 12 yrs)';
  else if (i === 18) milestone = ' (Adult - 18 yrs)';
  else if (i === 60) milestone = ' (Senior - 60 yrs)';
  else if (i === 65) milestone = ' (Geriatric - 65 yrs)';
  else if (i === 120) milestone = ' (Lifespan / All Ages)';
  return {
    value: i,
    label: `${i} Year${i === 1 ? '' : 's'}${milestone}`,
  };
});

/**
 * Custom Scrollable Select Dropdown
 * Strictly renders only 3 items visible in height, with smooth vertical scrolling for the rest.
 */
function ScrollSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  disabled = false,
  allowCustom = false,
  style = {},
  className = '',
  menuWidth = null,
  alignRight = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const normalizedOptions = useMemo(() => {
    return options.map((opt) =>
      typeof opt === 'object' && opt !== null ? opt : { value: opt, label: String(opt) }
    );
  }, [options]);

  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(value)
  );

  const displayLabel = selectedOption
    ? selectedOption.label
    : (value !== undefined && value !== null && value !== '' ? String(value) : placeholder);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        ...style,
      }}
    >
      {allowCustom ? (
        <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
          <input
            type="text"
            className={`form-input ${className}`}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            style={{ width: '100%', paddingRight: '28px' }}
          />
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            style={{
              position: 'absolute',
              right: '6px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: 'var(--slate-500)',
              padding: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
            tabIndex={-1}
            aria-label="Toggle options"
          >
            <ChevronDown
              size={14}
              style={{
                transform: isOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.15s ease',
              }}
            />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={`form-select ${className}`}
          disabled={disabled}
          style={{
            width: '100%',
            textAlign: 'left',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: disabled ? 'not-allowed' : 'pointer',
            background: '#ffffff',
            color: (value !== undefined && value !== null && value !== '') ? 'var(--slate-800)' : 'var(--slate-400)',
            fontWeight: (value !== undefined && value !== null && value !== '') ? 500 : 400,
            padding: '6px 10px',
            minHeight: '36px',
          }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: '6px' }}>
            {displayLabel}
          </span>
          <ChevronDown
            size={14}
            style={{
              flexShrink: 0,
              color: 'var(--slate-500)',
              transform: isOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        </button>
      )}

      {/* Floating Menu strictly showing 3 items at a time with smooth scroll */}
      {isOpen && !disabled && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 3px)',
            left: alignRight ? 'auto' : 0,
            right: alignRight ? 0 : 'auto',
            width: menuWidth || '100%',
            minWidth: menuWidth || '100%',
            zIndex: 1050,
            background: '#ffffff',
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            boxShadow: '0 8px 18px rgba(0, 0, 0, 0.15)',
            maxHeight: '106px', // exactly 3 items at ~34px each
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {normalizedOptions.length === 0 ? (
            <div style={{ padding: '8px 10px', fontSize: '0.75rem', color: 'var(--slate-400)', textAlign: 'center' }}>
              No options
            </div>
          ) : (
            normalizedOptions.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <div
                  key={String(opt.value)}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  style={{
                    padding: '0 10px',
                    height: '34px',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    background: isSelected ? '#EFF6FF' : 'transparent',
                    color: isSelected ? 'var(--primary-blue)' : 'var(--slate-700)',
                    fontWeight: isSelected ? 600 : 400,
                    userSelect: 'none',
                    borderBottom: '1px solid #F1F5F9',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = '#F8FAFC';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = isSelected ? '#EFF6FF' : 'transparent';
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                  {isSelected && <span style={{ color: 'var(--primary-blue)', fontSize: '0.75rem', marginLeft: '6px' }}>✓</span>}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

const DIAGNOSTIC_DEPARTMENTS = [
  'Hematology',
  'Clinical Chemistry',
  'Clinical Pathology',
  'Endocrinology',
  'Immunology & Serology',
  'Microbiology',
  'Molecular Diagnostics',
  'Urinalysis',
];

const DEFAULT_FORM = {
  code: '',
  name: '',
  department: 'Hematology',
  category: '',
  specimenType: 'Whole Blood',
  container: 'EDTA Tube (Purple)',
  price: '',
  turnaroundHours: 24,
  referenceRange: '',
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

  // Category Management State
  const [categories, setCategories] = useState([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({ name: '', department: 'Hematology', description: '' });
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryFilterDept, setCategoryFilterDept] = useState('All');
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);

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
      setError(err.response?.data?.message || 'Failed to retrieve test catalogue');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  const fetchCategories = useCallback(async () => {
    if (!tenantId) return;
    try {
      setIsCategoryLoading(true);
      const res = await clinicalService.getTestCategories(tenantId);
      if (res.success && Array.isArray(res.data)) {
        setCategories(res.data);
      }
    } catch (err) {
      console.warn('Failed to retrieve test categories:', err);
    } finally {
      setIsCategoryLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchCatalog();
    fetchCategories();
  }, [fetchCatalog, fetchCategories]);

  // Save Category (Create or Edit)
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    if (!categoryFormData.name.trim()) {
      notify.error('Category name is required');
      return;
    }
    try {
      setIsCategorySubmitting(true);
      if (editingCategoryId) {
        const res = await clinicalService.updateTestCategory(tenantId, editingCategoryId, categoryFormData);
        if (res.success) {
          notify.success(`Category '${res.data.name}' updated successfully`);
          setEditingCategoryId(null);
          setCategoryFormData({
            name: '',
            department: categoryFilterDept !== 'All' ? categoryFilterDept : 'Hematology',
            description: '',
          });
          await fetchCategories();
          await fetchCatalog();
        }
      } else {
        const res = await clinicalService.createTestCategory(tenantId, categoryFormData);
        if (res.success) {
          notify.success(`Category '${res.data.name}' created under ${res.data.department}`);
          // If modal was triggered from Add/Edit Test Form, pre-select this newly created category
          if (formData.department && formData.department.toLowerCase() === (res.data.department || '').toLowerCase()) {
            setFormData((prev) => ({ ...prev, category: res.data.name }));
          }
          setCategoryFormData({
            name: '',
            department: categoryFilterDept !== 'All' ? categoryFilterDept : res.data.department,
            description: '',
          });
          await fetchCategories();
        }
      }
    } catch (err) {
      notify.error(err, { fallback: editingCategoryId ? 'Failed to update category' : 'Failed to create category' });
    } finally {
      setIsCategorySubmitting(false);
    }
  };

  const handleStartEditCategory = (cat) => {
    setEditingCategoryId(cat.categoryId || cat._id);
    setCategoryFormData({
      name: cat.name || '',
      department: cat.department || 'Clinical Pathology',
      description: cat.description || '',
    });
  };

  const handleCancelEditCategory = () => {
    setEditingCategoryId(null);
    setCategoryFormData({
      name: '',
      department: categoryFilterDept !== 'All' ? categoryFilterDept : (formData.department || 'Hematology'),
      description: '',
    });
  };

  const handleDeleteCategory = async (categoryId, name) => {
    if (!window.confirm(`Are you sure you want to delete category '${name}'?`)) return;
    try {
      await clinicalService.deleteTestCategory(tenantId, categoryId);
      notify.success(`Category '${name}' deleted successfully`);
      if (editingCategoryId === categoryId) {
        handleCancelEditCategory();
      }
      await fetchCategories();
    } catch (err) {
      notify.error(err, { fallback: 'Failed to delete category' });
    }
  };

  const handleDepartmentChange = (newDept) => {
    const matchingCats = categories.filter(
      (c) => (c.department || '').toLowerCase() === newDept.toLowerCase()
    );
    const stillValid = matchingCats.some(
      (c) => c.name.toLowerCase() === (formData.category || '').toLowerCase()
    );
    setFormData((prev) => ({
      ...prev,
      department: newDept,
      category: stillValid ? prev.category : (matchingCats[0]?.name || ''),
    }));
  };

  const filteredCategoriesForForm = useMemo(() => {
    if (!formData.department) return categories;
    return categories.filter(
      (c) => (c.department || '').toLowerCase() === formData.department.toLowerCase()
    );
  }, [categories, formData.department]);

  const modalFilteredCategories = useMemo(() => {
    return categories.filter((c) => {
      const matchesDept =
        categoryFilterDept === 'All' ||
        (c.department || '').toLowerCase() === categoryFilterDept.toLowerCase();
      const term = categorySearchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        (c.name || '').toLowerCase().includes(term) ||
        (c.department || '').toLowerCase().includes(term) ||
        (c.description || '').toLowerCase().includes(term);
      return matchesDept && matchesSearch;
    });
  }, [categories, categoryFilterDept, categorySearchTerm]);

  const handleOpenCreate = () => {
    const defaultDept = 'Hematology';
    const matchingCats = categories.filter(
      (c) => (c.department || '').toLowerCase() === defaultDept.toLowerCase()
    );
    setFormData({
      ...DEFAULT_FORM,
      department: defaultDept,
      category: matchingCats[0]?.name || '',
    });
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
            ? p.referenceRanges.map((r) => {
                const minYears = r.ageMinDays !== undefined ? Math.min(120, Math.max(0, Math.round(r.ageMinDays / 365))) : 0;
                let maxYears = r.ageMaxDays !== undefined ? Math.min(120, Math.max(0, Math.round(r.ageMaxDays / 365))) : 120;
                if (maxYears >= 120 || (r.ageMaxDays !== undefined && r.ageMaxDays >= 43800)) maxYears = 120;
                return {
                  gender: r.gender || 'BOTH',
                  ageMinYears: minYears,
                  ageMaxYears: maxYears,
                  lowNormal: r.lowNormal !== null && r.lowNormal !== undefined ? r.lowNormal : '',
                  highNormal: r.highNormal !== null && r.highNormal !== undefined ? r.highNormal : '',
                  criticalLow: r.criticalLow !== null && r.criticalLow !== undefined ? r.criticalLow : '',
                  criticalHigh: r.criticalHigh !== null && r.criticalHigh !== undefined ? r.criticalHigh : '',
                  textRange: r.textRange || '',
                };
              })
            : [],
        }))
      : [];

    setFormData({
      code: test.code || '',
      name: test.name || '',
      department: test.department || 'Hematology',
      category: test.category || '',
      specimenType: test.specimenType || 'Whole Blood',
      container: test.container || 'Standard Tube',
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
  const handleApplyPreset = (paramIndex, preset) => {
    setFormData((prev) => {
      const updated = [...prev.parameters];
      const curr = updated[paramIndex];
      updated[paramIndex] = {
        ...curr,
        parameterCode: preset.code,
        name: curr.name ? curr.name : preset.name,
        unit: curr.unit ? curr.unit : preset.unit,
        referenceRanges: curr.referenceRanges.map((rng, rIdx) => {
          if (rIdx === 0 && !rng.lowNormal && !rng.highNormal) {
            return {
              ...rng,
              lowNormal: preset.lowNormal || '',
              highNormal: preset.highNormal || '',
              criticalLow: preset.criticalLow || '',
              criticalHigh: preset.criticalHigh || '',
            };
          }
          return rng;
        }),
      };
      return { ...prev, parameters: updated };
    });
  };

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
              ageMinYears: 0,
              ageMaxYears: 120,
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
          ageMinYears: 0,
          ageMaxYears: 120,
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
        const minYears = Number(r.ageMinYears !== undefined ? r.ageMinYears : 0);
        const maxYears = Number(r.ageMaxYears !== undefined ? r.ageMaxYears : 120);
        if (minYears < 0 || maxYears < 0) {
          return `Parameter '${code}' range #${rIdx + 1}: Age values cannot be negative.`;
        }
        if (minYears > maxYears) {
          return `Parameter '${code}' range #${rIdx + 1}: Minimum age (${minYears} yrs) cannot exceed maximum age (${maxYears} yrs).`;
        }

        const low = r.lowNormal !== '' && r.lowNormal !== null ? Number(r.lowNormal) : null;
        const high = r.highNormal !== '' && r.highNormal !== null ? Number(r.highNormal) : null;
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

      const cleanRanges = p.referenceRanges.map((r) => {
        const minYears = Number(r.ageMinYears !== undefined ? r.ageMinYears : 0);
        const maxYears = Number(r.ageMaxYears !== undefined ? r.ageMaxYears : 120);
        const ageMinDays = minYears === 0 ? 0 : Math.round(minYears * 365);
        const ageMaxDays = maxYears >= 120 ? 47450 : Math.round(maxYears * 365);

        return {
          gender: r.gender || 'BOTH',
          ageMinDays,
          ageMaxDays,
          lowNormal: r.lowNormal !== '' && !isNaN(Number(r.lowNormal)) ? Number(r.lowNormal) : null,
          highNormal: r.highNormal !== '' && !isNaN(Number(r.highNormal)) ? Number(r.highNormal) : null,
          criticalLow: r.criticalLow !== '' && !isNaN(Number(r.criticalLow)) ? Number(r.criticalLow) : null,
          criticalHigh: r.criticalHigh !== '' && !isNaN(Number(r.criticalHigh)) ? Number(r.criticalHigh) : null,
          textRange: r.textRange ? String(r.textRange).trim() : null,
        };
      });

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
      specimenType: formData.specimenType ? formData.specimenType.trim() : 'Whole Blood',
      container: formData.container ? formData.container.trim() : 'Standard Tube',
      price: Number(formData.price) || 0,
      turnaroundHours: Number(formData.turnaroundHours) || 24,
      referenceRange: formData.referenceRange.trim() || '',
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
        const msg = isEditMode
          ? `Test panel '${res.data.name}' (${res.data.code}) updated successfully`
          : `Test panel '${res.data.name}' (${res.data.code}) added to catalogue`;
        notify.success(msg);
        setSuccessMsg(msg);
        setIsModalOpen(false);
        fetchCatalog();
        setTimeout(() => setSuccessMsg(null), 3500);
      }
    } catch (err) {
      notify.error(err, { fallback: 'Failed to save test catalogue entry' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const departments = useMemo(
    () => ['All', ...new Set([...DIAGNOSTIC_DEPARTMENTS, ...tests.map((t) => t.department).filter(Boolean)])],
    [tests]
  );

  const filteredTests = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return tests.filter((t) => {
      const matchesSearch =
        (t.name || '').toLowerCase().includes(term) ||
        (t.code || '').toLowerCase().includes(term);
      const matchesDept = selectedDept === 'All' || t.department === selectedDept;
      return matchesSearch && matchesDept;
    });
  }, [tests, searchTerm, selectedDept]);

  return (
    <>
      <PageHeader
        title="Laboratory Test Catalogue & Parameters"
        description="Standardized diagnostic test master, biological reference intervals, and structured multi-parameter profiles."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => setIsCategoryModalOpen(true)}>
              <Layers size={16} />
              <span>Manage Categories</span>
            </button>
            <button className="btn btn-primary" onClick={handleOpenCreate}>
              <PlusCircle size={16} />
              <span>Add Test Panel</span>
            </button>
          </div>
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

      {/* Test Catalogue Table */}
      <div className="card">
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary-blue)' }} />
            <p>Loading diagnostic catalogue...</p>
          </div>
        ) : filteredTests.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--slate-500)' }}>
            <TestTube2 size={36} style={{ margin: '0 auto 0.5rem', opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: 'var(--slate-700)' }}>No tests found in catalogue</p>
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
                      <td style={{ fontWeight: 600 }}>₹{Number(test.price || 0).toFixed(2)}</td>
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
                <p style={{ fontWeight: 600, color: 'var(--primary-blue)' }}>₹{Number(selectedTest.price || 0).toFixed(2)}</p>
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
                                  <td style={{ padding: '4px 6px', fontWeight: 500, color: 'var(--slate-700)' }}>
                                    {(() => {
                                      const minYears = Math.round((rng.ageMinDays || 0) / 365.25);
                                      const maxYears = Math.round((rng.ageMaxDays || 47450) / 365.25);
                                      if ((!rng.ageMinDays || rng.ageMinDays === 0) && (rng.ageMaxDays >= 36500 || !rng.ageMaxDays)) {
                                        return 'All Ages (0 – 130 yrs)';
                                      }
                                      if (!rng.ageMinDays || rng.ageMinDays === 0) {
                                        return `0 – ${maxYears} yrs`;
                                      }
                                      if (rng.ageMaxDays >= 36500 || !rng.ageMaxDays) {
                                        return `${minYears}+ yrs`;
                                      }
                                      return `${minYears} – ${maxYears} yrs`;
                                    })()}
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
        title={isEditMode ? `Edit Diagnostic Test Panel: ${formData.code}` : 'Add Diagnostic Test Panel to Catalogue'}
        size="lg"
        maxWidth="840px"
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
                <span>{isEditMode ? 'Save Changes' : 'Save to Catalogue'}</span>
              )}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {formValidationWarning && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#B91C1C', padding: '0.75rem', borderRadius: 'var(--radius-md)', fontSize: '0.8125rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <AlertCircle size={16} />
              <span>{formValidationWarning}</span>
            </div>
          )}

          {/* Core Panel Details - Line 1 (3 fields) */}
          <div className="grid-3" style={{ gap: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Test Code *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. CBC, LIPID, GLU"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Panel Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Complete Blood Count"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Department *</label>
              <ScrollSelect
                value={formData.department}
                onChange={handleDepartmentChange}
                options={DIAGNOSTIC_DEPARTMENTS}
              />
            </div>
          </div>

          {/* Core Panel Details - Line 2 (3 fields) */}
          <div className="grid-3" style={{ gap: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600, margin: 0 }}>
                  Category *
                </label>
                <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
                  {filteredCategoriesForForm.length} available
                </span>
              </div>
              <ScrollSelect
                value={formData.category}
                onChange={(val) => {
                  if (val === '__new__') {
                    setEditingCategoryId(null);
                    setCategoryFormData({
                      name: '',
                      department: formData.department || 'Hematology',
                      description: '',
                    });
                    setCategoryFilterDept(formData.department || 'All');
                    setIsCategoryModalOpen(true);
                  } else {
                    setFormData({ ...formData, category: val });
                  }
                }}
                options={[
                  ...filteredCategoriesForForm.map((c) => ({ value: c.name, label: c.name })),
                  { value: '__new__', label: `+ Add Category to ${formData.department}...` },
                ]}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Specimen Type</label>
              <ScrollSelect
                value={formData.specimenType}
                onChange={(val) => setFormData({ ...formData, specimenType: val })}
                allowCustom={true}
                placeholder="e.g. Whole Blood, Serum"
                options={[
                  'Whole Blood',
                  'Serum',
                  'Plasma',
                  'Urine',
                  'CSF (Cerebrospinal Fluid)',
                  'Synovial Fluid',
                  'Sputum',
                  'Stool',
                  'Swab',
                ]}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Container / Tube</label>
              <ScrollSelect
                value={formData.container || 'Standard Tube'}
                onChange={(val) => setFormData({ ...formData, container: val })}
                allowCustom={true}
                placeholder="e.g. EDTA, SST Gel"
                options={[
                  'EDTA Tube (Purple)',
                  'SST Gel Tube (Yellow)',
                  'Plain Tube (Red)',
                  'Sodium Citrate (Blue)',
                  'Sodium Fluoride (Grey)',
                  'Heparin Tube (Green)',
                  'Sterile Urine Container',
                  'Standard Tube',
                ]}
              />
            </div>
          </div>

          {/* Core Panel Details - Line 3 (3 fields) */}
          <div className="grid-3" style={{ gap: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Standard Price (₹) *</label>
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
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Turnaround Hours (TAT)</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={formData.turnaroundHours}
                onChange={(e) => setFormData({ ...formData, turnaroundHours: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Reference Summary</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Normal adult physiological limits"
                value={formData.referenceRange}
                onChange={(e) => setFormData({ ...formData, referenceRange: e.target.value })}
              />
            </div>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {formData.parameters.map((param, pIdx) => (
                  <div
                    key={pIdx}
                    style={{
                      border: '1px solid #CBD5E1',
                      borderRadius: '10px',
                      padding: '1.125rem',
                      background: '#F8FAFC',
                      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    {/* Parameter Header */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px',
                        borderBottom: '1px solid #E2E8F0',
                        paddingBottom: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: 700,
                            color: 'var(--primary-blue)',
                            background: '#EFF6FF',
                            border: '1px solid #BFDBFE',
                            padding: '3px 8px',
                            borderRadius: '5px',
                          }}
                        >
                          Parameter #{pIdx + 1}
                        </span>
                        {param.parameterCode && (
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--slate-700)' }}>
                            {param.parameterCode} {param.name ? `— ${param.name}` : ''}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{
                          color: '#DC2626',
                          borderColor: '#FECACA',
                          background: '#FEF2F2',
                          padding: '4px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        onClick={() => handleRemoveParameter(pIdx)}
                        title="Remove parameter"
                      >
                        <Trash2 size={13} />
                        <span>Remove Parameter</span>
                      </button>
                    </div>

                    {/* Parameter Code and Analyte Name */}
                    <div className="grid-2" style={{ gap: '1rem', marginBottom: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label
                          className="form-label"
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px',
                          }}
                        >
                          <span>Parameter Code *</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 400 }}>
                            Type custom or select preset
                          </span>
                        </label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="e.g. HGB, RBC, GLU or Custom"
                            required
                            value={param.parameterCode}
                            onChange={(e) => handleParameterChange(pIdx, 'parameterCode', e.target.value.toUpperCase())}
                            style={{ flex: 1, textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.02em' }}
                          />
                          <div style={{ width: '155px', flexShrink: 0 }}>
                            <ScrollSelect
                              value=""
                              placeholder={`Presets (${COMMON_PARAMETER_PRESETS.length})`}
                              options={COMMON_PARAMETER_PRESETS.map((preset) => ({
                                value: preset.code,
                                label: `${preset.code} (${preset.name})`,
                              }))}
                              onChange={(val) => {
                                const selected = COMMON_PARAMETER_PRESETS.find((p) => p.code === val);
                                if (selected) handleApplyPreset(pIdx, selected);
                              }}
                              menuWidth="220px"
                              alignRight={true}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '4px' }}>
                          Analyte Name *
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Hemoglobin, Fasting Blood Glucose"
                          required
                          value={param.name}
                          onChange={(e) => handleParameterChange(pIdx, 'name', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Unit and Result Type */}
                    <div className="grid-2" style={{ gap: '1rem', marginBottom: '12px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label
                          className="form-label"
                          style={{
                            fontSize: '0.8125rem',
                            fontWeight: 600,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '4px',
                          }}
                        >
                          <span>Unit of Measure</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)', fontWeight: 400 }}>
                            Type custom or select
                          </span>
                        </label>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <input
                            type="text"
                            list={`unit-suggestions-${pIdx}`}
                            className="form-input"
                            placeholder="e.g. g/dL, mg/dL, %"
                            value={param.unit}
                            onChange={(e) => handleParameterChange(pIdx, 'unit', e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <datalist id={`unit-suggestions-${pIdx}`}>
                            {DIAGNOSTIC_UNITS.map((u) => (
                              <option key={u} value={u} />
                            ))}
                          </datalist>
                          <div style={{ width: '145px', flexShrink: 0 }}>
                            <ScrollSelect
                              value={DIAGNOSTIC_UNITS.includes(param.unit) ? param.unit : ''}
                              placeholder="-- Select Unit --"
                              options={DIAGNOSTIC_UNITS.map((u) => ({ value: u, label: u }))}
                              onChange={(val) => handleParameterChange(pIdx, 'unit', val)}
                              menuWidth="155px"
                              alignRight={true}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '4px' }}>
                          Result Type
                        </label>
                        <ScrollSelect
                          value={param.resultType}
                          onChange={(val) => handleParameterChange(pIdx, 'resultType', val)}
                          options={[
                            { value: 'NUMERIC', label: 'NUMERIC (Numeric range check)' },
                            { value: 'TEXT', label: 'TEXT (Qualitative clinical narrative)' },
                            { value: 'OPTIONS', label: 'OPTIONS (Structured discrete choices)' },
                          ]}
                        />
                      </div>
                    </div>

                    {param.resultType === 'OPTIONS' && (
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label className="form-label" style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '4px' }}>
                          Allowed Options (comma-separated) *
                        </label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="e.g. Negative, Positive, Equivocal"
                          value={param.optionsString}
                          onChange={(e) => handleParameterChange(pIdx, 'optionsString', e.target.value)}
                        />
                      </div>
                    )}

                    {/* Reference Ranges Sub-section */}
                    <div style={{ marginTop: '14px', borderTop: '1px solid #CBD5E1', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h5 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: 700, color: 'var(--slate-800)' }}>
                              Reference Intervals ({param.referenceRanges.length})
                            </h5>
                            <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)', background: '#F1F5F9', padding: '2px 6px', borderRadius: '4px' }}>
                              CLSI / ISO Compliant
                            </span>
                          </div>
                          <p style={{ margin: '2px 0 0', fontSize: '0.7rem', color: 'var(--slate-500)' }}>
                            Configure normal physiological intervals and critical alert thresholds by gender and age bracket.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{
                            fontSize: '0.75rem',
                            padding: '4px 10px',
                            background: '#FFFFFF',
                            borderColor: 'var(--primary-blue)',
                            color: 'var(--primary-blue)',
                            fontWeight: 600,
                          }}
                          onClick={() => handleAddRange(pIdx)}
                        >
                          <Plus size={13} />
                          <span>Add Interval</span>
                        </button>
                      </div>

                      {param.referenceRanges.length === 0 ? (
                        <div
                          style={{
                            background: '#FFFFFF',
                            border: '1px dashed #CBD5E1',
                            padding: '12px',
                            borderRadius: '6px',
                            textAlign: 'center',
                            fontSize: '0.75rem',
                            color: 'var(--slate-500)',
                          }}
                        >
                          No reference intervals added. Click "+ Add Interval" to define normal and critical limits.
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {param.referenceRanges.map((rng, rIdx) => (
                            <div
                              key={rIdx}
                              style={{
                                background: '#FFFFFF',
                                border: '1px solid #CBD5E1',
                                borderRadius: '8px',
                                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                                overflow: 'hidden',
                              }}
                            >
                              {/* Interval Header */}
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  padding: '8px 12px',
                                  background: '#F8FAFC',
                                  borderBottom: '1px solid #E2E8F0',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span
                                    style={{
                                      fontWeight: 700,
                                      fontSize: '0.75rem',
                                      color: 'var(--primary-blue)',
                                      background: '#EFF6FF',
                                      border: '1px solid #BFDBFE',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                    }}
                                  >
                                    Interval #{rIdx + 1}
                                  </span>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-600)' }}>
                                    {rng.gender === 'BOTH' ? 'All Genders' : rng.gender} • {rng.ageMinYears} to{' '}
                                    {Number(rng.ageMaxYears) >= 120 ? '120+ (All Ages)' : `${rng.ageMaxYears} Yrs`}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  style={{
                                    background: '#FEF2F2',
                                    border: '1px solid #FECACA',
                                    color: '#DC2626',
                                    cursor: 'pointer',
                                    padding: '3px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.7rem',
                                    fontWeight: 600,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                  }}
                                  onClick={() => handleRemoveRange(pIdx, rIdx)}
                                  title="Remove this reference interval"
                                >
                                  <Trash2 size={12} />
                                  <span>Remove</span>
                                </button>
                              </div>

                              <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {/* Demographics Group */}
                                <div>
                                  <div
                                    style={{
                                      fontSize: '0.7rem',
                                      fontWeight: 700,
                                      color: 'var(--slate-600)',
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.04em',
                                      marginBottom: '6px',
                                    }}
                                  >
                                    1. Patient Demographics & Age Range
                                  </div>
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                                    <div>
                                      <label
                                        style={{
                                          display: 'block',
                                          color: 'var(--slate-600)',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          marginBottom: '4px',
                                        }}
                                      >
                                        Gender *
                                      </label>
                                      <ScrollSelect
                                        value={rng.gender}
                                        onChange={(val) => handleRangeChange(pIdx, rIdx, 'gender', val)}
                                        options={[
                                          { value: 'BOTH', label: 'BOTH (Male & Female)' },
                                          { value: 'MALE', label: 'MALE only' },
                                          { value: 'FEMALE', label: 'FEMALE only' },
                                        ]}
                                      />
                                    </div>
                                    <div>
                                      <label
                                        style={{
                                          display: 'block',
                                          color: 'var(--slate-600)',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          marginBottom: '4px',
                                        }}
                                      >
                                        Age Min (Years) *
                                      </label>
                                      <ScrollSelect
                                        value={Number(rng.ageMinYears !== undefined ? rng.ageMinYears : 0)}
                                        onChange={(val) => handleRangeChange(pIdx, rIdx, 'ageMinYears', Number(val))}
                                        options={AGE_YEARS_OPTIONS}
                                      />
                                    </div>
                                    <div>
                                      <label
                                        style={{
                                          display: 'block',
                                          color: 'var(--slate-600)',
                                          fontSize: '0.75rem',
                                          fontWeight: 600,
                                          marginBottom: '4px',
                                        }}
                                      >
                                        Age Max (Years) *
                                      </label>
                                      <ScrollSelect
                                        value={Number(rng.ageMaxYears !== undefined ? rng.ageMaxYears : 120)}
                                        onChange={(val) => handleRangeChange(pIdx, rIdx, 'ageMaxYears', Number(val))}
                                        options={AGE_YEARS_OPTIONS}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Numeric Limits or Text Range */}
                                {param.resultType === 'NUMERIC' ? (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    {/* Normal Biological Range */}
                                    <div
                                      style={{
                                        background: '#F0FDF4',
                                        border: '1px solid #BBF7D0',
                                        borderRadius: '6px',
                                        padding: '10px',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                        <span
                                          style={{
                                            display: 'inline-block',
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: '#16A34A',
                                          }}
                                        />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#166534' }}>
                                          Normal Reference Interval {param.unit ? `(${param.unit})` : ''}
                                        </span>
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div>
                                          <label
                                            style={{
                                              display: 'block',
                                              color: '#166534',
                                              fontSize: '0.7rem',
                                              fontWeight: 600,
                                              marginBottom: '2px',
                                            }}
                                          >
                                            Low Normal
                                          </label>
                                          <input
                                            type="number"
                                            step="any"
                                            className="form-input"
                                            style={{ padding: '5px 8px', fontSize: '0.75rem', background: '#FFFFFF' }}
                                            placeholder="e.g. 12.0"
                                            value={rng.lowNormal}
                                            onChange={(e) => handleRangeChange(pIdx, rIdx, 'lowNormal', e.target.value)}
                                          />
                                        </div>
                                        <div>
                                          <label
                                            style={{
                                              display: 'block',
                                              color: '#166534',
                                              fontSize: '0.7rem',
                                              fontWeight: 600,
                                              marginBottom: '2px',
                                            }}
                                          >
                                            High Normal
                                          </label>
                                          <input
                                            type="number"
                                            step="any"
                                            className="form-input"
                                            style={{ padding: '5px 8px', fontSize: '0.75rem', background: '#FFFFFF' }}
                                            placeholder="e.g. 16.0"
                                            value={rng.highNormal}
                                            onChange={(e) => handleRangeChange(pIdx, rIdx, 'highNormal', e.target.value)}
                                          />
                                        </div>
                                      </div>
                                      <div style={{ fontSize: '0.675rem', color: '#15803D', marginTop: '6px' }}>
                                        Values between Low & High are marked Normal.
                                      </div>
                                    </div>

                                    {/* Critical / Panic Alert Thresholds */}
                                    <div
                                      style={{
                                        background: '#FFF1F2',
                                        border: '1px solid #FECDD3',
                                        borderRadius: '6px',
                                        padding: '10px',
                                      }}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                                        <span
                                          style={{
                                            display: 'inline-block',
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            background: '#E11D48',
                                          }}
                                        />
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9F1239' }}>
                                          Critical / Panic Limits (Alerts)
                                        </span>
                                      </div>
                                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                        <div>
                                          <label
                                            style={{
                                              display: 'block',
                                              color: '#9F1239',
                                              fontSize: '0.7rem',
                                              fontWeight: 600,
                                              marginBottom: '2px',
                                            }}
                                          >
                                            Panic Low
                                          </label>
                                          <input
                                            type="number"
                                            step="any"
                                            className="form-input"
                                            style={{ padding: '5px 8px', fontSize: '0.75rem', background: '#FFFFFF' }}
                                            placeholder="e.g. 7.0"
                                            value={rng.criticalLow}
                                            onChange={(e) => handleRangeChange(pIdx, rIdx, 'criticalLow', e.target.value)}
                                          />
                                        </div>
                                        <div>
                                          <label
                                            style={{
                                              display: 'block',
                                              color: '#9F1239',
                                              fontSize: '0.7rem',
                                              fontWeight: 600,
                                              marginBottom: '2px',
                                            }}
                                          >
                                            Panic High
                                          </label>
                                          <input
                                            type="number"
                                            step="any"
                                            className="form-input"
                                            style={{ padding: '5px 8px', fontSize: '0.75rem', background: '#FFFFFF' }}
                                            placeholder="e.g. 20.0"
                                            value={rng.criticalHigh}
                                            onChange={(e) => handleRangeChange(pIdx, rIdx, 'criticalHigh', e.target.value)}
                                          />
                                        </div>
                                      </div>
                                      <div style={{ fontSize: '0.675rem', color: '#BE123C', marginTop: '6px' }}>
                                        Triggers immediate clinical alert if violated.
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      background: '#F8FAFC',
                                      border: '1px solid #E2E8F0',
                                      borderRadius: '6px',
                                      padding: '10px',
                                    }}
                                  >
                                    <label
                                      style={{
                                        display: 'block',
                                        color: 'var(--slate-700)',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        marginBottom: '4px',
                                      }}
                                    >
                                      Expected Qualitative Text Range / Norm
                                    </label>
                                    <input
                                      type="text"
                                      className="form-input"
                                      style={{ padding: '6px 8px', fontSize: '0.75rem' }}
                                      placeholder="e.g. Negative, Non-Reactive, Clear"
                                      value={rng.textRange}
                                      onChange={(e) => handleRangeChange(pIdx, rIdx, 'textRange', e.target.value)}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>
      </Modal>

      {/* Category Management Modal */}
      <Modal
        isOpen={isCategoryModalOpen}
        onClose={() => {
          setIsCategoryModalOpen(false);
          handleCancelEditCategory();
        }}
        title="Manage Diagnostic Test Categories"
        maxWidth="760px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Add / Edit Category Form */}
          <form
            onSubmit={handleSaveCategory}
            style={{
              background: editingCategoryId ? '#EFF6FF' : '#F8FAFC',
              padding: '1rem 1.25rem',
              borderRadius: '8px',
              border: editingCategoryId ? '1px solid #93C5FD' : '1px solid #E2E8F0',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: editingCategoryId ? '#1E40AF' : '#0F172A' }}>
                {editingCategoryId ? '✏️ Edit Diagnostic Category' : '+ Add New Diagnostic Category'}
              </h4>
              {editingCategoryId && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCancelEditCategory}
                  style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                >
                  Cancel Edit
                </button>
              )}
            </div>

            <div className="grid-3" style={{ gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Department *</label>
                <select
                  className="form-select"
                  style={{ fontSize: '0.8125rem', padding: '6px 10px' }}
                  value={categoryFormData.department}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, department: e.target.value })}
                >
                  {DIAGNOSTIC_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8125rem' }}>Category Name *</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ fontSize: '0.8125rem', padding: '6px 10px' }}
                  placeholder="e.g. Lipid Profile, Complete Blood Count"
                  required
                  value={categoryFormData.name}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, name: e.target.value })}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.8125rem' }}>Description (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  style={{ fontSize: '0.8125rem', padding: '6px 10px' }}
                  placeholder="Summary of panels..."
                  value={categoryFormData.description}
                  onChange={(e) => setCategoryFormData({ ...categoryFormData, description: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              {editingCategoryId && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCancelEditCategory}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={isCategorySubmitting}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {isCategorySubmitting ? <Loader2 size={14} className="animate-spin" /> : (editingCategoryId ? <Edit2 size={14} /> : <Plus size={14} />)}
                <span>{editingCategoryId ? 'Save Changes' : 'Create Category'}</span>
              </button>
            </div>
          </form>

          {/* Filter & Search Bar */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '220px' }}>
              <Search size={15} style={{ color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search categories by name or clinical scope..."
                className="form-input"
                style={{ fontSize: '0.8125rem', padding: '4px 8px' }}
                value={categorySearchTerm}
                onChange={(e) => setCategorySearchTerm(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>Filter Dept:</span>
              <select
                className="form-select"
                style={{ fontSize: '0.75rem', padding: '4px 8px', width: 'auto' }}
                value={categoryFilterDept}
                onChange={(e) => setCategoryFilterDept(e.target.value)}
              >
                <option value="All">All Departments ({categories.length})</option>
                {DIAGNOSTIC_DEPARTMENTS.map((dept) => {
                  const count = categories.filter((c) => (c.department || '').toLowerCase() === dept.toLowerCase()).length;
                  return (
                    <option key={dept} value={dept}>
                      {dept} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Existing Categories Table */}
          <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
            <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
              <table className="table" style={{ margin: 0, fontSize: '0.825rem', width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 1, background: '#F1F5F9' }}>
                  <tr>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left' }}>Category & Scope</th>
                    <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', width: '170px' }}>Parent Department</th>
                    <th style={{ width: '85px', textAlign: 'center', padding: '0.5rem 0.75rem' }}>Tests</th>
                    <th style={{ width: '80px', textAlign: 'center', padding: '0.5rem 0.75rem' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isCategoryLoading ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                        <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                        <p style={{ margin: 0, fontSize: '0.8125rem' }}>Loading diagnostic categories...</p>
                      </td>
                    </tr>
                  ) : modalFilteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>
                        <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>No categories found</p>
                        <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#64748B' }}>
                          {categoryFilterDept !== 'All'
                            ? `No categories in "${categoryFilterDept}". You can add one using the form above.`
                            : 'No categories match your search.'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    modalFilteredCategories.map((cat) => {
                      const count =
                        cat.testCount !== undefined
                          ? cat.testCount
                          : tests.filter(
                              (t) =>
                                (t.categoryId && t.categoryId === cat.categoryId) ||
                                (t.category || '').toLowerCase() === cat.name.toLowerCase()
                            ).length;

                      const isEditingThis = editingCategoryId === (cat.categoryId || cat._id);

                      return (
                        <tr
                          key={cat.categoryId || cat.name}
                          style={{
                            borderBottom: '1px solid #F1F5F9',
                            background: isEditingThis ? '#EFF6FF' : 'transparent',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <div style={{ fontWeight: 600, color: '#0F172A' }}>{cat.name}</div>
                            {cat.description && (
                              <div style={{ fontSize: '0.725rem', color: '#64748B', marginTop: '2px' }}>
                                {cat.description}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: '#F1F5F9',
                                color: '#334155',
                                border: '1px solid #E2E8F0',
                              }}
                            >
                              {cat.department || 'Clinical Pathology'}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                background: count > 0 ? '#E0F2FE' : '#F1F5F9',
                                color: count > 0 ? '#0369A1' : '#94A3B8',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                              }}
                            >
                              {count} {count === 1 ? 'test' : 'tests'}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem 0.75rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleStartEditCategory(cat)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: isEditingThis ? '#2563EB' : '#64748B',
                                  cursor: 'pointer',
                                  padding: '4px',
                                  borderRadius: '4px',
                                }}
                                title="Edit category"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(cat.categoryId || cat.name, cat.name)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: count > 0 ? '#CBD5E1' : '#EF4444',
                                  cursor: count > 0 ? 'not-allowed' : 'pointer',
                                  padding: '4px',
                                  borderRadius: '4px',
                                }}
                                title={count > 0 ? `Cannot delete: ${count} tests assigned` : 'Delete category'}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default TestCatalogPage;
