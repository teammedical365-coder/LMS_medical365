/**
 * Lab Management System (LMS) - Patients Page & Unified Clinical Intake
 * 
 * Features:
 * 1. Hero Operations Banner: Integrated "Register Patient" form at the top
 *    with auto-sync Age/DOB, demographics, and optional live catalog test order requisition.
 * 2. Modern Patient Directory: Stylized, organized directory cards and table
 *    with avatars, MRN copy chips, blood group indicators, and search/filters.
 * 3. Full-Page Patient Profile: Complete clinical history (Orders, Reports, Invoices, Samples)
 *    and exhaustive registration demographics.
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
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  ChevronUp,
  Copy,
  Activity,
  HeartPulse,
  UserCheck,
  RotateCcw,
  X,
  ChevronLeft,
  ChevronRight,
  Upload,
  Image,
  Banknote,
  QrCode,
  Layers,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import clinicalService from '../../services/clinicalService';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ConfirmModal from '../../components/common/ConfirmModal';
import CustomSelect from '../../components/common/CustomSelect';
import notify from '../../utils/notify';
import PatientProfileView from './PatientProfileView';

const INITIAL_FORM_STATE = {
  fullName: '',
  age: '',
  gender: 'female',
  bloodGroup: '', // Initially blank - user selects manually
  phone: '',
  email: '',
  orderingPhysician: '', // Blank initially - user enters custom doctor name or Self
  address: '',
  medicalHistory: '',
  priority: 'routine',
  paymentMethod: 'cash', // 'cash' | 'upi' | 'split'
  cashAmount: '',
  upiAmount: '',
  utrNumber: '',
  paymentProof: null,
  paymentProofName: '',
};

const ROW_COLOR_PALETTES = [
  {
    bg: '#f0f9ff', // Soft Sky Blue
    hoverBg: '#e0f2fe',
    border: '#bae6fd',
    accentColor: '#0284c7',
    badgeBg: '#e0f2fe',
    badgeColor: '#0369a1',
    avatarBg: '#0284c7',
    avatarColor: '#ffffff',
  },
  {
    bg: '#f5f3ff', // Soft Violet / Lavender
    hoverBg: '#ede9fe',
    border: '#ddd6fe',
    accentColor: '#7c3aed',
    badgeBg: '#ede9fe',
    badgeColor: '#6d28d9',
    avatarBg: '#7c3aed',
    avatarColor: '#ffffff',
  },
  {
    bg: '#ecfdf5', // Soft Mint / Emerald
    hoverBg: '#d1fae5',
    border: '#a7f3d0',
    accentColor: '#059669',
    badgeBg: '#d1fae5',
    badgeColor: '#047857',
    avatarBg: '#059669',
    avatarColor: '#ffffff',
  },
  {
    bg: '#f0fdfa', // Soft Teal
    hoverBg: '#ccfbf1',
    border: '#99f6e4',
    accentColor: '#0d9488',
    badgeBg: '#ccfbf1',
    badgeColor: '#0f766e',
    avatarBg: '#0d9488',
    avatarColor: '#ffffff',
  },
  {
    bg: '#fffbeb', // Soft Amber / Warm Light
    hoverBg: '#fef3c7',
    border: '#fde68a',
    accentColor: '#d97706',
    badgeBg: '#fef3c7',
    badgeColor: '#b45309',
    avatarBg: '#d97706',
    avatarColor: '#ffffff',
  },
  {
    bg: '#fdf2f8', // Soft Rose / Pink
    hoverBg: '#fce7f3',
    border: '#fbcfe8',
    accentColor: '#db2777',
    badgeBg: '#fce7f3',
    badgeColor: '#be185d',
    avatarBg: '#db2777',
    avatarColor: '#ffffff',
  },
  {
    bg: '#eff6ff', // Soft Indigo / Royal
    hoverBg: '#dbeafe',
    border: '#bfdbfe',
    accentColor: '#2563eb',
    badgeBg: '#dbeafe',
    badgeColor: '#1d4ed8',
    avatarBg: '#2563eb',
    avatarColor: '#ffffff',
  },
  {
    bg: '#f8fafc', // Soft Slate / Cool Ice
    hoverBg: '#f1f5f9',
    border: '#cbd5e1',
    accentColor: '#475569',
    badgeBg: '#f1f5f9',
    badgeColor: '#334155',
    avatarBg: '#475569',
    avatarColor: '#ffffff',
  },
  {
    bg: '#fdf4ff', // Soft Orchid / Fuchsia
    hoverBg: '#fae8ff',
    border: '#f5d0fe',
    accentColor: '#c026d3',
    badgeBg: '#fae8ff',
    badgeColor: '#a21caf',
    avatarBg: '#c026d3',
    avatarColor: '#ffffff',
  },
  {
    bg: '#f7fee7', // Soft Sage / Lime
    hoverBg: '#ecfccb',
    border: '#d9f99d',
    accentColor: '#65a30d',
    badgeBg: '#ecfccb',
    badgeColor: '#4d7c0f',
    avatarBg: '#65a30d',
    avatarColor: '#ffffff',
  },
];

export function PatientsPage() {
  const { user, tenant } = useAuth();
  const tenantId = tenant?.tenantId || user?.tenantId;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Patient Directory State
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [bloodFilter, setBloodFilter] = useState('ALL');
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Modal Registration Form State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedTests, setSelectedTests] = useState([]);
  const [formData, setFormData] = useState(INITIAL_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Category & Test Dropdown Selection States
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedTestDropdownCode, setSelectedTestDropdownCode] = useState('');

  // Catalog State for Test Pricing
  const [catalogTests, setCatalogTests] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);

  // Full Page Profile & History States
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientHistory, setPatientHistory] = useState({
    orders: [],
    reports: [],
    invoices: [],
    samples: [],
    loading: false,
  });

  // Modal States
  const [intakeSuccessResult, setIntakeSuccessResult] = useState(null);
  const [confirmNoTestsOpen, setConfirmNoTestsOpen] = useState(false);
  const [copiedMrnId, setCopiedMrnId] = useState(null);

  // Check if URL specifies register parameter (e.g. from Dashboard quick link)
  useEffect(() => {
    if (searchParams.get('register') === 'true' || searchParams.get('new') === 'true') {
      setIsRegisterModalOpen(true);
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

  // Fetch Test Categories created by Lab Admin
  const fetchCategories = useCallback(async () => {
    if (!tenantId) return;
    try {
      const res = await clinicalService.getTestCategories(tenantId);
      if (res.success && Array.isArray(res.data)) {
        setCategories(res.data);
      }
    } catch (err) {
      console.warn('Failed to retrieve test categories for intake:', err);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchPatients();
    fetchTestCatalog();
    fetchCategories();
  }, [fetchPatients, fetchTestCatalog, fetchCategories]);

  // Load complete patient history across clinical modules
  const loadPatientHistory = useCallback(
    async (patient) => {
      if (!tenantId || !patient) return;
      setPatientHistory((prev) => ({ ...prev, loading: true }));
      try {
        const pId = String(patient.patientId || patient._id || '');
        const pMrn = String(patient.mrn || '').toUpperCase().trim();
        const pName = String(patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`)
          .toLowerCase()
          .trim();
        const queryParams = { patientId: pId, mrn: pMrn, limit: 100 };

        const [ordersRes, reportsRes, invoicesRes, samplesRes] = await Promise.allSettled([
          clinicalService.getOrders(tenantId, queryParams).catch(() => ({ data: [] })),
          clinicalService.getReports(tenantId, queryParams).catch(() => ({ data: [] })),
          clinicalService.getInvoices(tenantId, queryParams).catch(() => ({ data: [] })),
          clinicalService.getSamples(tenantId, queryParams).catch(() => ({ data: [] })),
        ]);

        const matchPatient = (item) => {
          if (!item) return false;
          const itemPId = String(item.patientId?._id || item.patientId || item.patient?._id || item.patient?.patientId || '');
          if (pId && itemPId && itemPId === pId) return true;

          const itemMrn = String(item.patientMrn || item.mrn || item.patient?.mrn || '').toUpperCase().trim();
          if (pMrn && itemMrn && itemMrn === pMrn) return true;

          const itemName = String(item.patientName || item.patient?.fullName || item.patient?.name || '')
            .toLowerCase()
            .trim();
          if (pName && itemName && itemName === pName) return true;

          return false;
        };

        const orders =
          ordersRes.status === 'fulfilled' && Array.isArray(ordersRes.value?.data)
            ? ordersRes.value.data.filter(matchPatient)
            : [];

        const reports =
          reportsRes.status === 'fulfilled' && Array.isArray(reportsRes.value?.data)
            ? reportsRes.value.data.filter(matchPatient)
            : [];

        const invoices =
          invoicesRes.status === 'fulfilled' && Array.isArray(invoicesRes.value?.data)
            ? invoicesRes.value.data.filter(matchPatient)
            : [];

        const samples =
          samplesRes.status === 'fulfilled' && Array.isArray(samplesRes.value?.data)
            ? samplesRes.value.data.filter(matchPatient)
            : [];

        setPatientHistory({
          orders,
          reports,
          invoices,
          samples,
          loading: false,
        });
      } catch (err) {
        console.error('Error loading patient clinical history:', err);
        setPatientHistory((prev) => ({ ...prev, loading: false }));
      }
    },
    [tenantId]
  );

  const handleViewProfile = (patient) => {
    setSelectedPatient(patient);
    loadPatientHistory(patient);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Copy MRN helper
  const handleCopyMRN = (mrn, id, e) => {
    e?.stopPropagation();
    if (navigator.clipboard) {
      navigator.clipboard.writeText(mrn);
      setCopiedMrnId(id);
      setTimeout(() => setCopiedMrnId(null), 1800);
    }
  };

  // Available categories (combining Lab Admin created categories and test catalog tags)
  const availableCategories = useMemo(() => {
    const set = new Set();
    categories.forEach((c) => {
      if (c?.name) set.add(c.name);
    });
    catalogTests.forEach((t) => {
      if (t.category) set.add(t.category);
      else if (t.department) set.add(t.department);
    });
    return ['All Categories', ...Array.from(set)];
  }, [categories, catalogTests]);

  // Filtered tests for selected category in dropdown
  const testsForSelectedCategory = useMemo(() => {
    return catalogTests.filter((test) => {
      if (selectedCategory === 'All Categories') return true;
      const cat = (test.category || test.department || '').toLowerCase();
      return cat === selectedCategory.toLowerCase();
    });
  }, [catalogTests, selectedCategory]);

  // Add test from Category + Test dropdown
  const handleAddDropdownTest = () => {
    if (!selectedTestDropdownCode) return;
    const testToAdd = catalogTests.find(
      (t) => (t.code || '').toUpperCase() === selectedTestDropdownCode.toUpperCase()
    );
    if (!testToAdd) return;

    const alreadySelected = selectedTests.some(
      (t) => (t.code || '').toUpperCase() === (testToAdd.code || '').toUpperCase()
    );
    if (alreadySelected) {
      notify.info(`'${testToAdd.name}' is already added to this requisition`);
      return;
    }

    const nextSelected = [...selectedTests, testToAdd];
    setSelectedTests(nextSelected);
    setSelectedTestDropdownCode('');
    notify.success(`Added ${testToAdd.name} (₹${Number(testToAdd.price || 0).toLocaleString()})`);

    // Auto update split balance if split mode is active
    const nextSub = nextSelected.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
    setFormData((prev) => {
      if (prev.paymentMethod === 'split') {
        const half = Math.round(nextSub / 2);
        return {
          ...prev,
          cashAmount: String(half),
          upiAmount: String(nextSub - half),
        };
      }
      return prev;
    });
  };

  // Filtered patient records for directory
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      // Gender filter
      if (genderFilter !== 'ALL') {
        if ((p.gender || '').toLowerCase() !== genderFilter.toLowerCase()) return false;
      }
      // Blood Group filter
      if (bloodFilter !== 'ALL') {
        if ((p.bloodGroup || '').toUpperCase() !== bloodFilter.toUpperCase()) return false;
      }
      // Search term filter
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        const fullName = (p.fullName || `${p.firstName || ''} ${p.lastName || ''}`).toLowerCase();
        const mrn = (p.mrn || '').toLowerCase();
        const phone = (p.phone || '').toLowerCase();
        const email = (p.email || '').toLowerCase();
        return fullName.includes(s) || mrn.includes(s) || phone.includes(s) || email.includes(s);
      }
      return true;
    });
  }, [patients, genderFilter, bloodFilter, searchTerm]);

  // Pagination Configuration (10 patients per page)
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // Reset to page 1 whenever search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, genderFilter, bloodFilter]);

  const totalPages = Math.ceil(filteredPatients.length / PAGE_SIZE) || 1;
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const paginatedPatients = filteredPatients.slice(startIndex, startIndex + PAGE_SIZE);

  // Statistics counters
  const stats = useMemo(() => {
    const total = patients.length;
    const male = patients.filter((p) => (p.gender || '').toLowerCase() === 'male').length;
    const female = patients.filter((p) => (p.gender || '').toLowerCase() === 'female').length;
    const todayStr = new Date().toDateString();
    const today = patients.filter((p) => {
      if (!p.createdAt) return false;
      return new Date(p.createdAt).toDateString() === todayStr;
    }).length;
    return { total, male, female, today };
  }, [patients]);

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

  // Manual age input (strictly max 2 numeric digits: 1 to 99)
  const handleAgeChange = (val) => {
    const digitsOnly = val.replace(/\D/g, '').slice(0, 2);
    setFormData((prev) => ({ ...prev, age: digitsOnly }));
  };

  const handlePhoneChange = (val) => {
    const digitsOnly = val.replace(/\D/g, '').slice(0, 10);
    setFormData((prev) => ({ ...prev, phone: digitsOnly }));
  };

  // Proof screenshot upload
  const handleProofUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify.error('Please upload an image file (PNG, JPG, JPEG)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify.error('Payment screenshot file must be less than 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({
        ...prev,
        paymentProof: reader.result,
        paymentProofName: file.name,
      }));
      notify.success(`Receipt screenshot uploaded: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveProof = () => {
    setFormData((prev) => ({
      ...prev,
      paymentProof: null,
      paymentProofName: '',
    }));
  };

  // Payment method selection & split balance
  const handlePaymentMethodChange = (mode) => {
    setFormData((prev) => {
      if (mode === 'split') {
        const half = Math.round(subtotal / 2);
        return {
          ...prev,
          paymentMethod: mode,
          cashAmount: prev.cashAmount || String(half),
          upiAmount: prev.upiAmount || String(subtotal - half),
        };
      }
      return {
        ...prev,
        paymentMethod: mode,
      };
    });
  };

  const handleCashAmountChange = (val) => {
    const digitsOnly = val.replace(/\D/g, '');
    setFormData((prev) => ({ ...prev, cashAmount: digitsOnly }));
  };

  const handleUpiAmountChange = (val) => {
    const digitsOnly = val.replace(/\D/g, '');
    setFormData((prev) => ({ ...prev, upiAmount: digitsOnly }));
  };

  // UPI UTR transaction reference number: strictly max 12 numeric digits
  const handleUtrChange = (val) => {
    const digitsOnly = val.replace(/\D/g, '').slice(0, 12);
    setFormData((prev) => ({ ...prev, utrNumber: digitsOnly }));
  };

  const handleAutoBalanceSplit = (direction = 'upi') => {
    if (direction === 'upi') {
      const c = Number(formData.cashAmount) || 0;
      setFormData((prev) => ({ ...prev, upiAmount: String(Math.max(0, subtotal - c)) }));
    } else {
      const u = Number(formData.upiAmount) || 0;
      setFormData((prev) => ({ ...prev, cashAmount: String(Math.max(0, subtotal - u)) }));
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

    const nextSub = nextSelected.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
    setFormData((prev) => {
      if (prev.paymentMethod === 'split') {
        const half = Math.round(nextSub / 2);
        return {
          ...prev,
          cashAmount: String(half),
          upiAmount: String(nextSub - half),
        };
      }
      return prev;
    });
  };

  const handleRemoveTest = (code) => {
    const nextSelected = selectedTests.filter(
      (t) => (t.code || '').toUpperCase() !== (code || '').toUpperCase()
    );
    setSelectedTests(nextSelected);

    const nextSub = nextSelected.reduce((sum, t) => sum + (Number(t.price) || 0), 0);
    setFormData((prev) => {
      if (prev.paymentMethod === 'split') {
        const half = Math.round(nextSub / 2);
        return {
          ...prev,
          cashAmount: String(half),
          upiAmount: String(nextSub - half),
        };
      }
      return prev;
    });
  };

  // Execute patient registration
  const executeRegistration = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      const nameParts = formData.fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '.';

      const hasTests = selectedTests.length > 0;
      let paidAmount = 0;
      let paymentRef = null;

      if (hasTests) {
        paidAmount = subtotal;
        if (formData.paymentMethod === 'cash') {
          paymentRef = 'Cash Counter Payment';
        } else if (formData.paymentMethod === 'upi') {
          paymentRef = `UPI (UTR: ${formData.utrNumber.trim()})`;
        } else if (formData.paymentMethod === 'split') {
          paymentRef = `Split: Cash ₹${Number(formData.cashAmount)} + UPI ₹${Number(formData.upiAmount)} (UTR: ${formData.utrNumber.trim()})`;
        }
      }

      const payload = {
        firstName,
        lastName,
        age: formData.age,
        dateOfBirth: null,
        gender: formData.gender,
        phone: formData.phone.trim(),
        email: formData.email.trim(),
        bloodGroup: formData.bloodGroup ? formData.bloodGroup.trim() : '',
        address: formData.address?.trim() || null,
        orderingPhysician: formData.orderingPhysician?.trim() || 'Self',
        referredBy: formData.orderingPhysician?.trim() || 'Self',
        medicalHistory: formData.medicalHistory?.trim() || null,
        priority: formData.priority,
        items: hasTests
          ? selectedTests.map((t) => ({
              testCode: t.code,
              testName: t.name,
              price: Number(t.price) || 0,
              specimenType: t.specimenType,
              container: t.container,
              parameters: t.parameters || [],
            }))
          : [],
        paidAmount,
        paymentMethod: formData.paymentMethod || 'cash',
        paymentReference: paymentRef,
        cashAmount: formData.paymentMethod === 'split' ? Number(formData.cashAmount) : undefined,
        upiAmount: formData.paymentMethod === 'split' ? Number(formData.upiAmount) : undefined,
        utrNumber: formData.utrNumber?.trim() || undefined,
        paymentProof: formData.paymentProof || undefined,
      };

      const res = await clinicalService.registerPatientWithOrder(tenantId, payload);

      if (res.success) {
        notify.success('Patient registered successfully.');
        setIntakeSuccessResult(res.data);
        setSuccessMsg(
          `Patient accessioned: ${res.data.patient.fullName} (MRN: ${res.data.patient.mrn})` +
            (res.data.order ? ` — Order #${res.data.order.orderNumber} created!` : '')
        );

        // Reset form & close modal smoothly
        setFormData(INITIAL_FORM_STATE);
        setSelectedTests([]);
        setSelectedCategory('All Categories');
        setSelectedTestDropdownCode('');
        setIsRegisterModalOpen(false);
        fetchPatients();
      }
    } catch (err) {
      notify.error(err, { fallback: 'Failed to complete patient registration' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit from modal form
  const handleModalSubmit = async (e) => {
    e.preventDefault();

    // 1. Full Name required
    if (!formData.fullName.trim()) {
      notify.error('Patient Full Name is required');
      return;
    }

    // 2. Age required (manual 2 digits, 1 to 99)
    if (!formData.age || Number(formData.age) <= 0 || Number(formData.age) > 99) {
      notify.error('Please specify a valid Age between 1 and 99 years (max 2 digits)');
      return;
    }

    // 4. Mobile Number (strictly 10 digits)
    if (!formData.phone || formData.phone.length !== 10) {
      notify.error('Mobile Number must be exactly 10 numeric digits');
      return;
    }

    // 5. Email Address required & valid
    if (!formData.email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      notify.error('Please enter a valid Email Address (e.g. patient@example.com)');
      return;
    }

    // 6. Attending Physician required
    if (!formData.orderingPhysician?.trim()) {
      notify.error('Attending / Referring Physician is required');
      return;
    }

    // 7. Payment validation if tests are selected
    if (selectedTests.length > 0) {
      if (formData.paymentMethod === 'upi') {
        if (!formData.utrNumber?.trim()) {
          notify.error('UTR / Transaction reference number is required for UPI payment');
          return;
        }
        if (formData.utrNumber.trim().length !== 12) {
          notify.error('UPI UTR number must be exactly 12 numeric digits');
          return;
        }
      } else if (formData.paymentMethod === 'split') {
        const cAmt = Number(formData.cashAmount) || 0;
        const uAmt = Number(formData.upiAmount) || 0;
        const splitSum = cAmt + uAmt;

        if (cAmt <= 0 || uAmt <= 0) {
          notify.error('Both Cash and UPI amounts must be greater than 0 in Split payment');
          return;
        }

        if (splitSum !== subtotal) {
          notify.error(
            `Payment mismatch: Cash (₹${cAmt}) + UPI (₹${uAmt}) = ₹${splitSum}, but Total Bill is ₹${subtotal}. Total split payment must strictly equal ₹${subtotal}!`
          );
          return;
        }

        if (!formData.utrNumber?.trim()) {
          notify.error('UPI UTR / Transaction reference number is required for the UPI portion in Split payment');
          return;
        }
        if (formData.utrNumber.trim().length !== 12) {
          notify.error('UPI UTR number must be exactly 12 numeric digits');
          return;
        }
      }
    }

    await executeRegistration();
  };

  const handleResetForm = () => {
    setFormData(INITIAL_FORM_STATE);
    setSelectedTests([]);
    setSelectedCategory('All Categories');
    setSelectedTestDropdownCode('');
  };

  const getInitials = (firstName, lastName, fullName) => {
    if (fullName) {
      const parts = fullName.trim().split(/\s+/);
      if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      return fullName.slice(0, 2).toUpperCase();
    }
    const f = (firstName || '')[0] || '';
    const l = (lastName || '')[0] || '';
    return (f + l).toUpperCase() || 'PT';
  };

  // IF A PATIENT IS SELECTED: RENDER PROPER FULL-PAGE PROFILE VIEW
  if (selectedPatient) {
    return (
      <PatientProfileView
        patient={selectedPatient}
        onBack={() => setSelectedPatient(null)}
        patientHistory={patientHistory}
        onNewOrder={(patient) => {
          setSelectedPatient(null);
          setIsRegisterModalOpen(true);
          const pName = patient.fullName || `${patient.firstName || ''} ${patient.lastName || ''}`.trim();
          setFormData((prev) => ({
            ...prev,
            fullName: pName,
            age: patient.age ? String(patient.age).slice(0, 2) : '',
            gender: patient.gender || 'female',
            phone: patient.phone || '',
            email: patient.email || '',
            bloodGroup: patient.bloodGroup || '',
            orderingPhysician: patient.orderingPhysician || patient.referredBy || '',
            address: patient.address || '',
          }));
        }}
      />
    );
  }

  return (
    <>
      <PageHeader
        title="Patients Accessioning & Diagnostic Intake"
        description="Accession incoming patients, manage complete clinical records, and review diagnostic history."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-primary"
              onClick={() => setIsRegisterModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
              }}
            >
              <UserPlus size={16} />
              <span>Register Patient</span>
            </button>
          </div>
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

      {/* =========================================================================
          2. PATIENT DETAILS DIRECTORY (ORGANIZED, RICH MODERN WAY)
          ========================================================================= */}
      
      {/* Directory Stat Cards (Rich Medical Look - 4 in desktop, 2 in mobile) */}
      <div className="patients-stat-grid">
        <div
          className="patients-stat-card"
          style={{
            background: '#ffffff',
            padding: '1rem 1.25rem',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span className="stat-lbl" style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 650, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Total Accessioned
            </span>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#eff6ff', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={16} />
            </div>
          </div>
          <div className="stat-val" style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0f172a', marginTop: '6px' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Accessioned directory
          </div>
        </div>

        <div
          className="patients-stat-card"
          style={{
            background: '#ffffff',
            padding: '1rem 1.25rem',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span className="stat-lbl" style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 650, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Female Patients
            </span>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#fdf2f8', color: '#db2777', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserCheck size={16} />
            </div>
          </div>
          <div className="stat-val" style={{ fontSize: '1.55rem', fontWeight: 800, color: '#db2777', marginTop: '6px' }}>
            {stats.female}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Registered females
          </div>
        </div>

        <div
          className="patients-stat-card"
          style={{
            background: '#ffffff',
            padding: '1rem 1.25rem',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span className="stat-lbl" style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 650, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Male Patients
            </span>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#f0fdfa', color: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <UserCheck size={16} />
            </div>
          </div>
          <div className="stat-val" style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0284c7', marginTop: '6px' }}>
            {stats.male}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Registered males
          </div>
        </div>

        <div
          className="patients-stat-card"
          style={{
            background: '#ffffff',
            padding: '1rem 1.25rem',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span className="stat-lbl" style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 650, letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              Registered Today
            </span>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Calendar size={16} />
            </div>
          </div>
          <div className="stat-val" style={{ fontSize: '1.55rem', fontWeight: 800, color: '#15803d', marginTop: '6px' }}>
            {stats.today}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Accessioned today
          </div>
        </div>
      </div>

      {/* Directory Search & Filter Controls */}
      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '280px', position: 'relative' }}>
            <Search size={18} style={{ color: '#94a3b8', position: 'absolute', left: '12px' }} />
            <input
              type="text"
              placeholder="Search directory by Patient Name, MRN, Phone number, or Email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '38px', borderRadius: '8px' }}
            />
          </div>

          {/* Quick Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Gender filter */}
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '2px' }}>
              {['ALL', 'female', 'male'].map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGenderFilter(g)}
                  style={{
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: 'none',
                    background: genderFilter === g ? '#ffffff' : 'transparent',
                    color: genderFilter === g ? '#0284c7' : '#64748b',
                    boxShadow: genderFilter === g ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {g === 'ALL' ? 'All Genders' : g}
                </button>
              ))}
            </div>

            {/* Blood group selector */}
            <div style={{ width: '165px' }}>
              <CustomSelect
                id="bloodFilter"
                value={bloodFilter}
                onChange={(e) => setBloodFilter(e.target.value)}
                options={[
                  { value: 'ALL', label: 'All Blood Groups' },
                  ...['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => ({ value: bg, label: bg })),
                ]}
                maxVisibleItems={3}
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
      </div>

      {/* Directory Table / List */}
      <div className="card" style={{ borderRadius: '14px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', background: '#fafcff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Patient Records
            </h3>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', background: '#e0f2fe', color: '#0369a1' }}>
              {filteredPatients.length} shown
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
            Click <strong>View Profile</strong> on any record to open their comprehensive clinical history.
          </span>
        </div>

        {isLoading ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
            <Loader2 size={36} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: '#0284c7' }} />
            <p style={{ fontWeight: 600, color: '#1e293b' }}>Loading patient records...</p>
          </div>
        ) : filteredPatients.length === 0 ? (
          <div style={{ padding: '3.5rem', textAlign: 'center', color: '#64748b' }}>
            <Users size={44} style={{ margin: '0 auto 0.75rem', opacity: 0.35, color: '#0284c7' }} />
            <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '1.1rem' }}>No patient records found</p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.35rem', color: '#64748b' }}>
              {searchTerm || genderFilter !== 'ALL' || bloodFilter !== 'ALL'
                ? 'Try adjusting your search or filter options.'
                : 'Use the registration banner above to register the first patient.'}
            </p>
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: '1rem' }}
              onClick={() => {
                setIsRegisterModalOpen(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <UserPlus size={15} />
              <span>Register Patient Now</span>
            </button>
          </div>
        ) : (
          <div className="table-container" style={{ margin: 0 }}>
            <table className="lms-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: '135px' }}>MRN</th>
                  <th>Patient Name</th>
                  <th>Age / Gender</th>
                  <th>Contact</th>
                  <th>Blood Group</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right', width: '170px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPatients.map((p, index) => {
                  const pId = p.patientId || p._id;
                  const fullName = p.fullName || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Unnamed Patient';
                  const initials = getInitials(p.firstName, p.lastName, p.fullName);
                  const palette = ROW_COLOR_PALETTES[(startIndex + index) % ROW_COLOR_PALETTES.length];

                  return (
                    <tr
                      key={pId}
                      style={{
                        background: palette.bg,
                        borderBottom: `1px solid ${palette.border}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = palette.hoverBg;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = palette.bg;
                      }}
                      onClick={() => handleViewProfile(p)}
                    >
                      {/* MRN */}
                      <td>
                        <div
                          className="mrn-chip"
                          onClick={(e) => handleCopyMRN(p.mrn, pId, e)}
                          title="Click to copy MRN"
                          style={{
                            background: palette.badgeBg,
                            color: palette.badgeColor,
                            border: `1px solid ${palette.border}`,
                            fontWeight: 700,
                          }}
                        >
                          <span>{p.mrn || 'N/A'}</span>
                          {copiedMrnId === pId ? (
                            <Check size={12} style={{ color: '#10b981' }} />
                          ) : (
                            <Copy size={12} style={{ opacity: 0.6 }} />
                          )}
                        </div>
                      </td>

                      {/* Patient Name with Avatar */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            className="patient-avatar"
                            style={{
                              background: palette.avatarBg,
                              color: palette.avatarColor,
                              boxShadow: `0 2px 6px ${palette.avatarBg}33`,
                              fontWeight: 700,
                            }}
                          >
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.925rem' }}>
                              {fullName}
                            </div>
                            {p.orderingPhysician && (
                              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                Ref: {p.orderingPhysician}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Age / Gender */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.85rem' }}>
                            {p.age ? `${p.age} yrs` : 'N/A'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'capitalize' }}>
                            {p.gender || 'Unknown'}
                          </span>
                        </div>
                      </td>

                      {/* Contact Phone & Email */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.825rem', color: '#1e293b' }}>
                            <Phone size={12} style={{ color: '#64748b' }} />
                            <span>{p.phone || 'No phone'}</span>
                          </div>
                          {p.email ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: '#64748b' }}>
                              <Mail size={11} style={{ color: '#94a3b8' }} />
                              <span>{p.email}</span>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.72rem', color: '#94a3b8' }}>
                              <Mail size={11} style={{ opacity: 0.5 }} />
                              <span>No email</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Blood Group */}
                      <td>
                        <span
                          className="blood-group-badge"
                          style={{
                            background: '#ffffff',
                            border: `1px solid ${palette.border}`,
                            color: '#b91c1c',
                            fontWeight: 700,
                          }}
                        >
                          <HeartPulse size={12} style={{ marginRight: '4px', color: '#ef4444' }} />
                          {p.bloodGroup || '-'}
                        </span>
                      </td>

                      {/* Registered Date */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', color: '#64748b' }}>
                          <Calendar size={13} style={{ color: '#94a3b8' }} />
                          <span>
                            {p.createdAt
                              ? new Date(p.createdAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : 'Today'}
                          </span>
                        </div>
                      </td>

                      {/* Action Button: View Profile */}
                      <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            onClick={() => handleViewProfile(p)}
                            style={{
                              background: '#ffffff',
                              color: palette.accentColor,
                              border: `1px solid ${palette.border}`,
                              fontWeight: 600,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '0.35rem 0.75rem',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                              transition: 'all 0.15s ease',
                            }}
                            title="View Full Patient Profile & Clinical History"
                          >
                            <Eye size={14} />
                            <span>View Profile</span>
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

        {/* =========================================================================
            PAGINATION CONTROLS (10 PATIENTS PER PAGE)
            ========================================================================= */}
        {filteredPatients.length > 0 && (
          <div
            style={{
              padding: '0.875rem 1.25rem',
              borderTop: '1px solid #e2e8f0',
              background: '#fafcff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div style={{ fontSize: '0.825rem', color: '#64748b' }}>
              Showing <strong>{startIndex + 1}</strong> to{' '}
              <strong>{Math.min(startIndex + PAGE_SIZE, filteredPatients.length)}</strong> of{' '}
              <strong>{filteredPatients.length}</strong> patient records (10 per page)
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: currentPage === 1 ? 0.45 : 1,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  }}
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((pNum) => {
                    if (totalPages <= 7) return true;
                    if (pNum === 1 || pNum === totalPages) return true;
                    return Math.abs(pNum - currentPage) <= 1;
                  })
                  .map((pNum, idx, arr) => {
                    const showEllipsisBefore = idx > 0 && pNum - arr[idx - 1] > 1;
                    return (
                      <React.Fragment key={pNum}>
                        {showEllipsisBefore && (
                          <span style={{ padding: '0 4px', color: '#94a3b8', fontSize: '0.8rem' }}>...</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(pNum)}
                          style={{
                            minWidth: '32px',
                            height: '32px',
                            padding: '0 6px',
                            borderRadius: '6px',
                            border: currentPage === pNum ? '1px solid #0284c7' : '1px solid #cbd5e1',
                            background: currentPage === pNum ? '#0284c7' : '#ffffff',
                            color: currentPage === pNum ? '#ffffff' : '#334155',
                            fontWeight: currentPage === pNum ? 700 : 500,
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {pNum}
                        </button>
                      </React.Fragment>
                    );
                  })}

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.8rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    opacity: currentPage === totalPages ? 0.45 : 1,
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* =========================================================================
          INTAKE SUCCESS RECEIPT MODAL
          ========================================================================= */}
      <Modal
        isOpen={!!intakeSuccessResult}
        onClose={() => setIntakeSuccessResult(null)}
        title="Patient Intake & Accessioning Summary"
        maxWidth="680px"
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
            <button className="btn btn-secondary" onClick={() => setIntakeSuccessResult(null)}>
              Close
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                const pt = intakeSuccessResult.patient;
                setIntakeSuccessResult(null);
                if (pt) handleViewProfile(pt);
              }}
            >
              <Eye size={15} />
              <span>Open Patient Profile</span>
            </button>
          </div>
        }
      >
        {intakeSuccessResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              borderRadius: '8px',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <CheckCircle2 size={24} style={{ color: '#059669', flexShrink: 0 }} />
              <div>
                <h4 style={{ margin: 0, color: '#065f46', fontSize: '0.95rem', fontWeight: 700 }}>
                  Patient Accessioned Successfully
                </h4>
                <p style={{ margin: '2px 0 0', fontSize: '0.825rem', color: '#047857' }}>
                  Demographic file registered and MRN generated in tenant directory.
                </p>
              </div>
            </div>

            {/* Patient File Specs */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.875rem',
              padding: '1rem',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '0.875rem',
            }}>
              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Medical Record # (MRN)</span>
                <p style={{ margin: '2px 0 0', fontWeight: 800, fontFamily: 'monospace', color: '#0284c7', fontSize: '1.05rem' }}>
                  {intakeSuccessResult.patient?.mrn}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Patient Name</span>
                <p style={{ margin: '2px 0 0', fontWeight: 700 }}>
                  {intakeSuccessResult.patient?.fullName}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Demographics</span>
                <p style={{ margin: '2px 0 0' }}>
                  {intakeSuccessResult.patient?.age ? `${intakeSuccessResult.patient?.age} yrs` : 'N/A'} • {intakeSuccessResult.patient?.gender} • {intakeSuccessResult.patient?.bloodGroup || 'Not specified'}
                </p>
              </div>

              <div>
                <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Contact Phone</span>
                <p style={{ margin: '2px 0 0' }}>{intakeSuccessResult.patient?.phone || 'N/A'}</p>
              </div>

              {intakeSuccessResult.order && (
                <>
                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Laboratory Order #</span>
                    <p style={{ margin: '2px 0 0', fontWeight: 700, fontFamily: 'monospace', color: '#0284c7' }}>
                      {intakeSuccessResult.order?.orderNumber}
                    </p>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase' }}>Ordering Physician</span>
                    <p style={{ margin: '2px 0 0' }}>{intakeSuccessResult.order?.orderingPhysician || 'Attending Physician'}</p>
                  </div>
                </>
              )}
            </div>

            {/* Test Requisition & Financial Receipt */}
            {intakeSuccessResult.order && (
              <div>
                <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 700, color: '#1e293b' }}>
                  Requisitioned Diagnostic Tests:
                </h5>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table className="lms-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Test Code</th>
                        <th>Test Name</th>
                        <th style={{ textAlign: 'right' }}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intakeSuccessResult.order?.items?.map((it) => (
                        <tr key={it.itemId || it.testCode}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0284c7' }}>{it.testCode}</td>
                          <td style={{ fontWeight: 600 }}>{it.testName}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700 }}>₹{Number(it.price || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: '#f8fafc',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.875rem',
                }}>
                  <div>
                    <span style={{ color: '#64748b' }}>Payment Mode: </span>
                    <strong style={{ textTransform: 'uppercase' }}>
                      {intakeSuccessResult.invoice?.payments?.[0]?.method || 'Cash'}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Total: </span>
                      <strong style={{ color: '#0f172a' }}>
                        ₹{Number(intakeSuccessResult.order?.totalAmount || 0).toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Paid: </span>
                      <strong style={{ color: '#16a34a' }}>
                        ₹{Number(intakeSuccessResult.order?.paidAmount || 0).toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Balance: </span>
                      <strong style={{ color: intakeSuccessResult.order?.balance > 0 ? '#dc2626' : '#16a34a' }}>
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
          REGISTRATION POPUP MODAL (CLINICAL INTAKE)
          ========================================================================= */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        title="Register Patient — Unified Clinical Intake"
        maxWidth="1100px"
        size="xl"
      >
        <form onSubmit={handleModalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* SECTION 1: Patient Identity & Demographics */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1.25rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
              <Users size={17} style={{ color: '#0284c7' }} />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                1. Patient Identity & Demographics
              </h3>
            </div>

            {/* 3 Fields Per Row Grid */}
            <div className="grid-3" style={{ gap: '0.875rem' }}>
              {/* Row 1, Col 1: Full Name * */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Full Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ramesh Kumar"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>

              {/* Row 1, Col 2: Age (Years) * (Strictly Manual 2 Digits) */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Age (Years) <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={2}
                  className="form-input"
                  placeholder="e.g. 28 (Max 2 digits)"
                  required
                  value={formData.age}
                  onChange={(e) => handleAgeChange(e.target.value)}
                />
              </div>

              {/* Row 1, Col 3: Gender * */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Gender <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <CustomSelect
                  id="patientGender"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  options={[
                    { value: 'female', label: 'Female' },
                    { value: 'male', label: 'Male' },
                    { value: 'other', label: 'Other' },
                  ]}
                  maxVisibleItems={3}
                />
              </div>

              {/* Row 2, Col 1: Mobile Number * (10 Digits only) */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Mobile Number <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  className="form-input"
                  placeholder="10-digit mobile (e.g. 9876543210)"
                  required
                  value={formData.phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                />
              </div>

              {/* Row 2, Col 2: Email Address * */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Email Address <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="patient@example.com"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              {/* Row 2, Col 3: Blood Group */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Blood Group</label>
                <CustomSelect
                  id="patientBloodGroup"
                  value={formData.bloodGroup}
                  placeholder="Select Blood Group"
                  onChange={(e) => setFormData({ ...formData, bloodGroup: e.target.value })}
                  options={[
                    { value: '', label: 'Select Blood Group' },
                    { value: 'A+', label: 'A+' },
                    { value: 'A-', label: 'A-' },
                    { value: 'B+', label: 'B+' },
                    { value: 'B-', label: 'B-' },
                    { value: 'AB+', label: 'AB+' },
                    { value: 'AB-', label: 'AB-' },
                    { value: 'O+', label: 'O+' },
                    { value: 'O-', label: 'O-' },
                  ]}
                  maxVisibleItems={3}
                />
              </div>

              {/* Row 3, Col 1: Referred By / Attending Doctor */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>
                  Referred By / Attending Doctor
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter Doctor Name or Self (e.g. Dr. Sharma)"
                  value={formData.orderingPhysician}
                  onChange={(e) => setFormData({ ...formData, orderingPhysician: e.target.value })}
                />
              </div>

              {/* Row 3, Col 2 & 3: Home Address / City */}
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label className="form-label" style={{ fontWeight: 600 }}>Home Address / City</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Flat 402, Gandhi Road, City"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
            </div>

            {/* Row 4 (Full Width): Clinical History / Patient Notes (Optional) */}
            <div className="form-group" style={{ marginTop: '0.875rem' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Clinical History / Patient Notes (Optional)</label>
              <textarea
                rows={2}
                className="form-input"
                placeholder="e.g. Known diabetic for 5 years, penicillin allergy, routine health screening..."
                value={formData.medicalHistory}
                onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          {/* SECTION 2: Diagnostic Test Requisition & Billing (Category & Test Dropdowns) */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1.25rem',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TestTube2 size={17} style={{ color: '#0d9488' }} />
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                  2. Diagnostic Test Requisition & Billing (Optional)
                </h3>
              </div>
              <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                Live category rates configured by Lab Admin
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Priority selection */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.6rem 0.8rem', background: '#f8fafc', borderRadius: '8px' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569' }}>Order Priority:</span>
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
                        padding: '0.2rem 0.65rem',
                        background:
                          formData.priority === prio
                            ? prio === 'stat'
                              ? '#dc2626'
                              : prio === 'urgent'
                              ? '#ea580c'
                              : '#0284c7'
                            : 'white',
                        borderColor: formData.priority === prio ? 'transparent' : '#cbd5e1',
                      }}
                    >
                      {prio === 'stat' ? 'STAT (Emergency)' : prio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Dropdown & Test Dropdown Bar with Add Button */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(200px, 1fr) minmax(280px, 2fr) auto',
                  gap: '0.75rem',
                  alignItems: 'flex-end',
                  background: '#f8fafc',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                }}
              >
                {/* Dropdown 1: Category */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Layers size={13} style={{ color: '#0284c7' }} />
                    <span>1. Test Category</span>
                  </label>
                  <CustomSelect
                    id="testCategorySelect"
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setSelectedTestDropdownCode('');
                    }}
                    options={availableCategories.map((cat) => ({ value: cat, label: cat }))}
                    maxVisibleItems={3}
                  />
                </div>

                {/* Dropdown 2: Select Test with Price */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <TestTube2 size={13} style={{ color: '#0d9488' }} />
                    <span>2. Select Diagnostic Test (with Price)</span>
                  </label>
                  <CustomSelect
                    id="testSelect"
                    value={selectedTestDropdownCode}
                    onChange={(e) => setSelectedTestDropdownCode(e.target.value)}
                    placeholder={
                      catalogLoading
                        ? 'Loading catalog tests...'
                        : testsForSelectedCategory.length === 0
                        ? '-- No tests found in this category --'
                        : `-- Choose Test (${testsForSelectedCategory.length} available) --`
                    }
                    disabled={catalogLoading || testsForSelectedCategory.length === 0}
                    options={[
                      {
                        value: '',
                        label: catalogLoading
                          ? 'Loading catalog tests...'
                          : testsForSelectedCategory.length === 0
                          ? '-- No tests found in this category --'
                          : `-- Choose Test (${testsForSelectedCategory.length} available) --`,
                      },
                      ...testsForSelectedCategory.map((t) => ({
                        value: t.code,
                        label: `${t.name} (${t.code}) — ₹${Number(t.price || 0).toLocaleString()}`,
                      })),
                    ]}
                    maxVisibleItems={3}
                  />
                </div>

                {/* Button: Add Test */}
                <div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleAddDropdownTest}
                    disabled={!selectedTestDropdownCode}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: 700,
                      padding: '0.55rem 1.1rem',
                      whiteSpace: 'nowrap',
                      height: '38px',
                      boxShadow: selectedTestDropdownCode ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
                    }}
                  >
                    <Plus size={16} />
                    <span>Add Test</span>
                  </button>
                </div>
              </div>

              {/* Requisition Table for Selected Tests */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', background: '#ffffff' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.75rem 1rem',
                    background: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                  }}
                >
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#334155' }}>
                    Requisitioned Tests List ({selectedTests.length}):
                  </span>
                  <span style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0284c7' }}>
                    Order Subtotal: ₹{subtotal.toLocaleString()}
                  </span>
                </div>

                {selectedTests.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    No tests added to requisition yet. Select a category and test from the dropdowns above and click "Add Test".
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="lms-table" style={{ margin: 0, width: '100%' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                          <th style={{ width: '120px' }}>Code</th>
                          <th>Test Name</th>
                          <th>Category / Specimen</th>
                          <th style={{ textAlign: 'right', width: '130px' }}>Price (₹)</th>
                          <th style={{ width: '70px', textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTests.map((st, idx) => (
                          <tr key={st.code || idx}>
                            <td style={{ textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>{idx + 1}</td>
                            <td>
                              <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0284c7', background: '#e0f2fe', padding: '2px 6px', borderRadius: '4px', fontSize: '0.78rem' }}>
                                {st.code}
                              </span>
                            </td>
                            <td style={{ fontWeight: 600, color: '#0f172a' }}>{st.name}</td>
                            <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                              {st.category || st.department || 'General'} • {st.specimenType || 'Serum'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#047857', fontSize: '0.9rem' }}>
                              ₹{Number(st.price || 0).toLocaleString()}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => handleRemoveTest(st.code)}
                                className="btn-icon"
                                style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                                title="Remove test"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                          <td colSpan={4} style={{ textAlign: 'right', paddingRight: '1rem', color: '#334155' }}>
                            Total Requisition Bill ({selectedTests.length} {selectedTests.length === 1 ? 'test' : 'tests'}):
                          </td>
                          <td style={{ textAlign: 'right', color: '#0284c7', fontSize: '1rem', fontWeight: 800 }}>
                            ₹{subtotal.toLocaleString()}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

                {/* Payment Collection & Methods (Only if tests are selected) */}
                {selectedTests.length > 0 && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                    
                    {/* Bill Summary Banner */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #bbf7d0', marginBottom: '1rem' }}>
                      <div>
                        <div style={{ fontSize: '0.72rem', color: '#15803d', textTransform: 'uppercase', fontWeight: 700 }}>
                          Total Requisition Amount
                        </div>
                        <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#166534' }}>
                          ₹{subtotal.toLocaleString()}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#15803d', fontWeight: 600 }}>
                        {selectedTests.length} Diagnostic {selectedTests.length === 1 ? 'Test' : 'Tests'}
                      </div>
                    </div>

                    {/* Payment Mode Selector: Cash / UPI / Split */}
                    <div style={{ marginBottom: '1rem' }}>
                      <label className="form-label" style={{ fontWeight: 700, marginBottom: '0.5rem', display: 'block' }}>
                        Select Payment Mode <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
                        <button
                          type="button"
                          onClick={() => handlePaymentMethodChange('cash')}
                          style={{
                            padding: '0.65rem 0.75rem',
                            borderRadius: '8px',
                            border: `2px solid ${formData.paymentMethod === 'cash' ? '#0284c7' : '#e2e8f0'}`,
                            background: formData.paymentMethod === 'cash' ? '#f0f9ff' : '#ffffff',
                            color: formData.paymentMethod === 'cash' ? '#0369a1' : '#475569',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <Banknote size={16} />
                          <span>Cash</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePaymentMethodChange('upi')}
                          style={{
                            padding: '0.65rem 0.75rem',
                            borderRadius: '8px',
                            border: `2px solid ${formData.paymentMethod === 'upi' ? '#0284c7' : '#e2e8f0'}`,
                            background: formData.paymentMethod === 'upi' ? '#f0f9ff' : '#ffffff',
                            color: formData.paymentMethod === 'upi' ? '#0369a1' : '#475569',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <QrCode size={16} />
                          <span>UPI / QR</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handlePaymentMethodChange('split')}
                          style={{
                            padding: '0.65rem 0.75rem',
                            borderRadius: '8px',
                            border: `2px solid ${formData.paymentMethod === 'split' ? '#0284c7' : '#e2e8f0'}`,
                            background: formData.paymentMethod === 'split' ? '#f0f9ff' : '#ffffff',
                            color: formData.paymentMethod === 'split' ? '#0369a1' : '#475569',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                          }}
                        >
                          <Layers size={16} />
                          <span>Split (Cash + UPI)</span>
                        </button>
                      </div>
                    </div>

                    {/* Mode 1: Cash Details */}
                    {formData.paymentMethod === 'cash' && (
                      <div style={{ background: '#f8fafc', padding: '0.875rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534' }}>
                          <CheckCircle2 size={16} style={{ color: '#16a34a' }} />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                            Counter Cash Collection: Exact payment of ₹{subtotal.toLocaleString()} will be accepted at the counter.
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Mode 2: UPI Details */}
                    {formData.paymentMethod === 'upi' && (
                      <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                        <div className="grid-2" style={{ gap: '0.875rem' }}>
                          <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>
                              UPI UTR / Reference No. <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="12-digit UTR (e.g. 423456789012)"
                              required
                              maxLength={12}
                              value={formData.utrNumber}
                              onChange={(e) => handleUtrChange(e.target.value)}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>
                              Upload UPI Screenshot / SS Proof
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <label
                                htmlFor="modal-upi-proof-file"
                                className="btn btn-secondary"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  cursor: 'pointer',
                                  fontSize: '0.8125rem',
                                  padding: '0.45rem 0.85rem',
                                }}
                              >
                                <Upload size={14} />
                                <span>Choose Screenshot</span>
                              </label>
                              <input
                                id="modal-upi-proof-file"
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={handleProofUpload}
                              />
                              {formData.paymentProofName && (
                                <span style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: 600, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {formData.paymentProofName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Screenshot Preview */}
                        {formData.paymentProof && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#ecfdf5', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                            <img
                              src={formData.paymentProof}
                              alt="Proof preview"
                              style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #6ee7b7' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#065f46' }}>
                                Payment Screenshot Attached
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#047857' }}>
                                {formData.paymentProofName}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleRemoveProof}
                              className="btn btn-sm"
                              style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                              title="Remove screenshot"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mode 3: Split Payment (Cash + UPI) */}
                    {formData.paymentMethod === 'split' && (
                      <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                        {/* 3 Fields in a Row for Split */}
                        <div className="grid-3" style={{ gap: '0.875rem' }}>
                          <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>
                              Cash Amount (₹) <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="e.g. 500"
                              required
                              value={formData.cashAmount}
                              onChange={(e) => handleCashAmountChange(e.target.value)}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>
                              UPI Amount (₹) <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="e.g. 500"
                              required
                              value={formData.upiAmount}
                              onChange={(e) => handleUpiAmountChange(e.target.value)}
                            />
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>
                              UPI UTR Number <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="12-digit UTR No."
                              required
                              maxLength={12}
                              value={formData.utrNumber}
                              onChange={(e) => handleUtrChange(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* UPI Screenshot in Split Mode */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <label
                              htmlFor="modal-split-proof-file"
                              className="btn btn-secondary"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                                fontSize: '0.8125rem',
                                padding: '0.45rem 0.85rem',
                              }}
                            >
                              <Upload size={14} />
                              <span>Upload UPI Screenshot (SS)</span>
                            </label>
                            <input
                              id="modal-split-proof-file"
                              type="file"
                              accept="image/*"
                              style={{ display: 'none' }}
                              onChange={handleProofUpload}
                            />
                            {formData.paymentProofName && (
                              <span style={{ fontSize: '0.78rem', color: '#0284c7', fontWeight: 600 }}>
                                {formData.paymentProofName}
                              </span>
                            )}
                          </div>

                          {/* Quick Split Balancer */}
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const half = Math.round(subtotal / 2);
                                setFormData((prev) => ({
                                  ...prev,
                                  cashAmount: String(half),
                                  upiAmount: String(subtotal - half),
                                }));
                              }}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                            >
                              Split 50:50
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAutoBalanceSplit('upi')}
                              className="btn btn-sm btn-secondary"
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem' }}
                            >
                              Balance UPI
                            </button>
                          </div>
                        </div>

                        {/* Split Screenshot Preview */}
                        {formData.paymentProof && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#ecfdf5', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                            <img
                              src={formData.paymentProof}
                              alt="Proof preview"
                              style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #6ee7b7' }}
                            />
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#065f46' }}>
                                UPI Screenshot Attached
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#047857' }}>
                                {formData.paymentProofName}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleRemoveProof}
                              className="btn btn-sm"
                              style={{ color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}

                        {/* Split Payment Strict Amount Validation Box */}
                        {(() => {
                          const cAmt = Number(formData.cashAmount) || 0;
                          const uAmt = Number(formData.upiAmount) || 0;
                          const totalEntered = cAmt + uAmt;
                          const isMatch = totalEntered === subtotal && cAmt > 0 && uAmt > 0;
                          const isUnder = totalEntered < subtotal;
                          const diff = Math.abs(subtotal - totalEntered);

                          return (
                            <div
                              style={{
                                padding: '0.75rem 1rem',
                                borderRadius: '8px',
                                border: `1px solid ${isMatch ? '#86efac' : '#fca5a5'}`,
                                background: isMatch ? '#f0fdf4' : '#fef2f2',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                flexWrap: 'wrap',
                                gap: '8px',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {isMatch ? (
                                  <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
                                ) : (
                                  <AlertCircle size={18} style={{ color: '#dc2626' }} />
                                )}
                                <div>
                                  <div style={{ fontWeight: 700, fontSize: '0.85rem', color: isMatch ? '#166534' : '#991b1b' }}>
                                    {isMatch
                                      ? `Exact Match: Total ₹${subtotal.toLocaleString()}`
                                      : isUnder
                                      ? `Short by ₹${diff.toLocaleString()} — Exact amount required!`
                                      : `Exceeds by ₹${diff.toLocaleString()} — Exact amount required!`}
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: isMatch ? '#15803d' : '#b91c1c' }}>
                                    Cash: ₹${cAmt.toLocaleString()} + UPI: ₹${uAmt.toLocaleString()} = ₹${totalEntered.toLocaleString()} (Bill: ₹${subtotal.toLocaleString()})
                                  </div>
                                </div>
                              </div>
                              {!isMatch && (
                                <button
                                  type="button"
                                  onClick={() => handleAutoBalanceSplit('upi')}
                                  className="btn btn-sm btn-secondary"
                                  style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}
                                >
                                  Auto-Balance UPI (₹${Math.max(0, subtotal - cAmt)})
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

          {/* Form Action Buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              paddingTop: '0.5rem',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsRegisterModalOpen(false)}
              disabled={isSubmitting}
            >
              <X size={15} />
              <span>Close</span>
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleResetForm}
              disabled={isSubmitting}
            >
              <RotateCcw size={15} />
              <span>Clear Form</span>
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                padding: '0.65rem 1.75rem',
                fontWeight: 700,
                fontSize: '0.95rem',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Registering Patient...</span>
                </>
              ) : selectedTests.length > 0 ? (
                <>
                  <CheckCircle2 size={18} />
                  <span>Register Patient & Requisition (₹{subtotal.toLocaleString()})</span>
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  <span>Register Patient</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Save Patient Profile Only Modal */}
      <ConfirmModal
        isOpen={confirmNoTestsOpen}
        onClose={() => setConfirmNoTestsOpen(false)}
        onConfirm={async () => {
          setConfirmNoTestsOpen(false);
          await executeRegistration(false);
        }}
        title="Register Patient Without Tests?"
        message="No diagnostic tests are currently selected. Would you like to save the patient profile only, without creating an initial lab requisition order?"
        confirmText="Save Patient Only"
        cancelText="Cancel"
        variant="warning"
        isLoading={isSubmitting}
      />
    </>
  );
}

export default PatientsPage;
