/**
 * Lab Management System (LMS) - Platform Super Admin Roles & Permission Builder
 * 
 * Manual Governance Mode:
 * - Super Admin defines, configures, and manages all custom roles and granular permissions.
 * - No forced or unwanted default roles.
 * - Quick presets, live search across permissions, and instant propagation to all laboratories.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldCheck,
  Key,
  PlusCircle,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  RefreshCw,
  Search,
  LayoutDashboard,
  Navigation,
  FileCheck,
  Building2,
  Sparkles,
  AlertTriangle,
  Info,
  Layers,
  Users,
  FileText,
  FlaskConical,
  Activity,
  Receipt,
  Settings,
  CheckSquare,
  Square,
  Sliders,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Filter,
  Microscope,
} from 'lucide-react';
// Cleaned up header imports for custom banner
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ConfirmModal from '../../components/common/ConfirmModal';
import notify from '../../utils/notify';
import superAdminService from '../../services/superAdminService';

// Module visual mapping
const MODULE_ICONS = {
  patients: Users,
  orders: FileText,
  samples: FlaskConical,
  tests: Activity,
  reports: FileCheck,
  billing: Receipt,
  users: Users,
  roles: Key,
  settings: Settings,
  audit: ShieldCheck,
};

// Clear laboratory-related functional module groups
export const PERMISSION_MODULE_GROUPS = [
  {
    id: 'patient_mgmt',
    label: 'Patient Management',
    description: 'Patient intake, registration, demographic records, and master profiles',
    icon: Users,
    color: '#0284c7', // Sky Blue
    bgLight: '#f0f9ff',
    borderLight: '#bae6fd',
    moduleKeys: ['patients'],
  },
  {
    id: 'orders_billing',
    label: 'Orders & Billing',
    description: 'Laboratory requisitions, order entry, invoicing, and patient billing ledgers',
    icon: Receipt,
    color: '#0d9488', // Teal
    bgLight: '#f0fdfa',
    borderLight: '#99f6e4',
    moduleKeys: ['orders', 'billing'],
  },
  {
    id: 'sample_collection',
    label: 'Sample Collection',
    description: 'Biological specimen collection, tube barcoding, and bench accessioning',
    icon: FlaskConical,
    color: '#2563eb', // Blue
    bgLight: '#eff6ff',
    borderLight: '#bfdbfe',
    moduleKeys: ['samples'],
  },
  {
    id: 'lab_testing',
    label: 'Laboratory Testing',
    description: 'Master test catalog, standard pricing, and analyzer normal reference ranges',
    icon: Activity,
    color: '#7c3aed', // Purple
    bgLight: '#f5f3ff',
    borderLight: '#ddd6fe',
    moduleKeys: ['tests'],
  },
  {
    id: 'reports_pathology',
    label: 'Reports & Pathology',
    description: 'Clinical findings drafting, pathologist verification sign-off, and report releases',
    icon: FileCheck,
    color: '#059669', // Emerald
    bgLight: '#ecfdf5',
    borderLight: '#a7f3d0',
    moduleKeys: ['reports'],
  },
  {
    id: 'staff_roles',
    label: 'Staff & Roles',
    description: 'Laboratory staff accounts, user permissions, and custom role builder access',
    icon: Key,
    color: '#d97706', // Amber
    bgLight: '#fffbeb',
    borderLight: '#fde68a',
    moduleKeys: ['users', 'roles'],
  },
  {
    id: 'lab_config',
    label: 'Lab Configuration & Compliance',
    description: 'Laboratory facility settings, white-label branding, and compliance audit trail',
    icon: Settings,
    color: '#475569', // Slate
    bgLight: '#f8fafc',
    borderLight: '#cbd5e1',
    moduleKeys: ['settings', 'audit'],
  },
];

// Rich descriptive metadata and privilege classification for all granular actions
export const ACTION_METADATA = {
  'patients:view': {
    title: 'View Patient Profiles',
    description: 'Browse and search registered patients & demographics',
    level: 'read',
    levelLabel: 'Read-Only',
  },
  'patients:create': {
    title: 'Register New Patient',
    description: 'Admit new patients and create master clinical records',
    level: 'write',
    levelLabel: 'Operational',
  },
  'patients:update': {
    title: 'Update Demographics',
    description: 'Modify patient profile info, age, gender, contact',
    level: 'write',
    levelLabel: 'Operational',
  },
  'patients:delete': {
    title: 'Delete Patient Record',
    description: 'Remove patient profile (High Privilege / Administrative)',
    level: 'danger',
    levelLabel: 'Admin Only',
  },
  'orders:view': {
    title: 'View Orders',
    description: 'View requisitions, diagnostic order queues, and test items',
    level: 'read',
    levelLabel: 'Read-Only',
  },
  'orders:create': {
    title: 'Create Requisition',
    description: 'Book new laboratory test orders for registered patients',
    level: 'write',
    levelLabel: 'Operational',
  },
  'orders:update': {
    title: 'Edit Order Tests',
    description: 'Add or modify ordered tests on existing requisitions',
    level: 'write',
    levelLabel: 'Operational',
  },
  'orders:delete': {
    title: 'Cancel / Delete Order',
    description: 'Void or cancel active laboratory requisitions',
    level: 'danger',
    levelLabel: 'Admin Only',
  },
  'billing:view': {
    title: 'View Invoices & Ledgers',
    description: 'Access billing amounts, patient balances, and invoices',
    level: 'read',
    levelLabel: 'Read-Only',
  },
  'billing:manage': {
    title: 'Manage Payments & Claims',
    description: 'Collect payments, generate receipts, record discounts',
    level: 'write',
    levelLabel: 'Operational',
  },
  'samples:view': {
    title: 'View Samples',
    description: 'Access specimen tracking queue and accessioning bench',
    level: 'read',
    levelLabel: 'Read-Only',
  },
  'samples:collect': {
    title: 'Collect / Draw Sample',
    description: 'Mark specimen drawn, barcode tube, record collection time',
    level: 'write',
    levelLabel: 'Operational',
  },
  'samples:process': {
    title: 'Run Analyzer Processing',
    description: 'Operate bench analyzers, record findings, run batch tubes',
    level: 'write',
    levelLabel: 'Operational',
  },
  'samples:verify': {
    title: 'Verify Specimen Quality',
    description: 'Inspect sample integrity (e.g., hemolysis, clotting, volume)',
    level: 'write',
    levelLabel: 'Operational',
  },
  'tests:view': {
    title: 'View Test Catalog',
    description: 'Browse diagnostic test list, prices, and sample requirements',
    level: 'read',
    levelLabel: 'Read-Only',
  },
  'tests:manage': {
    title: 'Manage Tests & Reference Ranges',
    description: 'Create test profiles, edit normal ranges, configure units',
    level: 'write',
    levelLabel: 'Operational',
  },
  'reports:view': {
    title: 'View Reports',
    description: 'Inspect diagnostic pathology and lab report previews',
    level: 'read',
    levelLabel: 'Read-Only',
  },
  'reports:create': {
    title: 'Draft Diagnostic Findings',
    description: 'Enter clinical observations, parameter results, comments',
    level: 'write',
    levelLabel: 'Operational',
  },
  'reports:verify': {
    title: 'Pathologist Verification',
    description: 'Medical sign-off and clinical validation by pathologist',
    level: 'clinical',
    levelLabel: 'Clinical Sign-Off',
  },
  'reports:release': {
    title: 'Release Diagnostic Report',
    description: 'Final sign-off to publish, print, and send to patient/doctor',
    level: 'clinical',
    levelLabel: 'Clinical Sign-Off',
  },
  'users:view': {
    title: 'View Staff Directory',
    description: 'Inspect laboratory employee list and assigned roles',
    level: 'read',
    levelLabel: 'Read-Only',
  },
  'users:manage': {
    title: 'Manage Staff Accounts',
    description: 'Onboard laboratory staff, reset access, assign roles',
    level: 'danger',
    levelLabel: 'Admin Only',
  },
  'roles:view': {
    title: 'View Custom Roles',
    description: 'Browse defined laboratory roles and assigned permissions',
    level: 'read',
    levelLabel: 'Read-Only',
  },
  'roles:manage': {
    title: 'Create / Edit Custom Roles',
    description: 'Create and configure custom staff roles & RBAC matrix',
    level: 'danger',
    levelLabel: 'Admin Only',
  },
  'settings:view': {
    title: 'View Laboratory Profile',
    description: 'View facility information, license details, header branding',
    level: 'read',
    levelLabel: 'Read-Only',
  },
  'settings:manage': {
    title: 'Edit Facility Settings',
    description: 'Update white-label branding, reporting headers, preferences',
    level: 'write',
    levelLabel: 'Operational',
  },
  'audit:view': {
    title: 'View Audit Logs',
    description: 'Review tamper-evident clinical and administrative activity trail',
    level: 'read',
    levelLabel: 'Read-Only',
  },
};

export function SuperAdminRolesPage() {
  const [roles, setRoles] = useState([]);
  const [matrixData, setMatrixData] = useState({ modules: {}, navigationItems: [] });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('ALL');
  const [errorBanner, setErrorBanner] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // View Mode: 'list' | 'editor'
  const [viewMode, setViewMode] = useState('list');
  const [editingRole, setEditingRole] = useState(null);
  const [permSearch, setPermSearch] = useState('');
  const [categoryFilterTab, setCategoryFilterTab] = useState('ALL');
  const [roleForm, setRoleForm] = useState({
    name: '',
    code: '',
    description: '',
    dashboardPath: '/dashboard',
    navigationItems: ['dashboard'],
    permissions: [],
  });
  const [isSavingRole, setIsSavingRole] = useState(false);

  // Inspect Modal State
  const [inspectRole, setInspectRole] = useState(null);

  // Delete Role Confirmation Modal State
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [isDeletingRole, setIsDeletingRole] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const [matrixRes, rolesRes] = await Promise.all([
        superAdminService.getPermissionsMatrix().catch(() => ({ modules: {}, navigationItems: [] })),
        superAdminService.listRoles().catch(() => []),
      ]);

      setMatrixData(matrixRes || { modules: {}, navigationItems: [] });
      setRoles(rolesRes || []);
    } catch (err) {
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to load master role definitions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Editor Page for Create or Edit
  const handleOpenRoleModal = (roleToEdit = null) => {
    setErrorBanner(null);
    setSuccessBanner(null);
    setPermSearch('');
    setCategoryFilterTab('ALL');
    if (roleToEdit) {
      setEditingRole(roleToEdit);
      setRoleForm({
        name: roleToEdit.name,
        code: roleToEdit.code,
        description: roleToEdit.description || '',
        dashboardPath: roleToEdit.dashboardPath || '/dashboard',
        navigationItems: roleToEdit.navigationItems || ['dashboard'],
        permissions: [...(roleToEdit.permissions || [])],
      });
    } else {
      setEditingRole(null);
      setRoleForm({
        name: '',
        code: '',
        description: '',
        dashboardPath: '/dashboard',
        navigationItems: ['dashboard'],
        permissions: [],
      });
    }
    setViewMode('editor');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Toggle single permission checkbox
  const handleTogglePermission = (permissionKey) => {
    setRoleForm((prev) => {
      const exists = prev.permissions.includes(permissionKey);
      const nextPerms = exists
        ? prev.permissions.filter((p) => p !== permissionKey)
        : [...prev.permissions, permissionKey];
      return { ...prev, permissions: nextPerms };
    });
  };

  // Toggle all permissions for a specific module
  const handleToggleModuleAll = (moduleKey, actions = []) => {
    const modulePerms = actions.map((a) => `${moduleKey}:${a}`);
    const allSelected = modulePerms.every((p) => roleForm.permissions.includes(p));

    setRoleForm((prev) => {
      let nextPerms;
      if (allSelected) {
        nextPerms = prev.permissions.filter((p) => !modulePerms.includes(p));
      } else {
        nextPerms = Array.from(new Set([...prev.permissions, ...modulePerms]));
      }
      return { ...prev, permissions: nextPerms };
    });
  };

  // Toggle all permissions within a whole functional category group
  const handleToggleCategoryAll = (groupDef) => {
    const groupPerms = [];
    (groupDef.moduleKeys || []).forEach((modKey) => {
      const modDef = matrixData.modules?.[modKey];
      if (modDef) {
        (modDef.actions || []).forEach((act) => {
          groupPerms.push(`${modKey}:${act}`);
        });
      }
    });

    const allSelected = groupPerms.length > 0 && groupPerms.every((p) => roleForm.permissions.includes(p));

    setRoleForm((prev) => {
      let nextPerms;
      if (allSelected) {
        nextPerms = prev.permissions.filter((p) => !groupPerms.includes(p));
      } else {
        nextPerms = Array.from(new Set([...prev.permissions, ...groupPerms]));
      }
      return { ...prev, permissions: nextPerms };
    });
  };

  // Select all available permissions
  const handleSelectAllPermissions = () => {
    const all = [];
    Object.entries(matrixData.modules || {}).forEach(([mod, def]) => {
      (def.actions || []).forEach((act) => all.push(`${mod}:${act}`));
    });
    setRoleForm((prev) => ({ ...prev, permissions: all }));
  };

  // Clear all permissions
  const handleClearAllPermissions = () => {
    setRoleForm((prev) => ({ ...prev, permissions: [] }));
  };

  // Quick grant helper for missing permissions
  const handleQuickAddPermission = (permKey) => {
    if (!permKey) return;
    setRoleForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permKey) ? prev.permissions : [...prev.permissions, permKey],
    }));
  };

  // Resolve all detected dependency warnings in 1-click
  const handleFixAllWarnings = (missingList) => {
    if (!missingList || missingList.length === 0) return;
    setRoleForm((prev) => ({
      ...prev,
      permissions: Array.from(new Set([...prev.permissions, ...missingList])),
    }));
  };

  // Computed summary of modules assigned to a role for table display
  const getRoleModuleSummary = (permissions = []) => {
    if (!permissions || permissions.length === 0) return 'No permissions assigned';
    const activeGroups = PERMISSION_MODULE_GROUPS.filter((group) => {
      return (group.moduleKeys || []).some((modKey) => {
        return permissions.some((p) => p.startsWith(`${modKey}:`));
      });
    });
    if (activeGroups.length === PERMISSION_MODULE_GROUPS.length) {
      return 'All Laboratory Modules';
    }
    return activeGroups.map((g) => g.label.replace(' Management', '').replace(' & Compliance', '')).join(', ');
  };

  // Real-time Access Denied prevention and dependency checker
  const accessWarnings = useMemo(() => {
    const warnings = [];
    const selected = roleForm.permissions;

    // 1. Landing Dashboard Check
    const dashboardPermMap = {
      '/patients': 'patients:view',
      '/orders': 'orders:view',
      '/samples': 'samples:view',
      '/tests': 'tests:view',
      '/reports': 'reports:view',
      '/billing': 'billing:view',
      '/users': 'users:view',
      '/settings': 'settings:view',
      '/audit-logs': 'audit:view',
    };

    const requiredForDashboard = dashboardPermMap[roleForm.dashboardPath];
    if (requiredForDashboard && !selected.includes(requiredForDashboard)) {
      warnings.push({
        id: `dashboard-${requiredForDashboard}`,
        type: 'critical',
        message: `Landing dashboard is set to "${roleForm.dashboardPath}", but "${requiredForDashboard}" is not granted. Users assigned this role will encounter "Access Denied" upon login.`,
        missingPerm: requiredForDashboard,
      });
    }

    // 2. Navigation Items Check
    const navPermMap = {
      patients: 'patients:view',
      orders: 'orders:view',
      samples: 'samples:view',
      tests: 'tests:view',
      reports: 'reports:view',
      billing: 'billing:view',
      users: 'users:view',
      settings: 'settings:view',
      audit: 'audit:view',
    };

    (roleForm.navigationItems || []).forEach((navKey) => {
      const requiredPerm = navPermMap[navKey];
      if (requiredPerm && !selected.includes(requiredPerm)) {
        warnings.push({
          id: `nav-${navKey}`,
          type: 'warning',
          message: `Sidebar navigation item "${navKey}" is enabled, but "${requiredPerm}" is not granted. Clicking it will produce an "Access Denied" error.`,
          missingPerm: requiredPerm,
        });
      }
    });

    // 3. Workflow Action Dependencies
    const actionDependencies = [
      { action: 'reports:verify', needs: 'reports:view', reason: 'Reviewing diagnostic reports requires view permission.' },
      { action: 'reports:release', needs: 'reports:view', reason: 'Releasing reports requires view permission.' },
      { action: 'reports:create', needs: 'reports:view', reason: 'Drafting findings requires viewing the report workspace.' },
      { action: 'samples:process', needs: 'samples:view', reason: 'Processing specimens requires viewing the sample queue.' },
      { action: 'samples:collect', needs: 'samples:view', reason: 'Collecting specimens requires viewing the collection bench.' },
      { action: 'orders:create', needs: 'orders:view', reason: 'Creating requisitions requires viewing the orders workspace.' },
      { action: 'orders:update', needs: 'orders:view', reason: 'Modifying requisitions requires viewing orders.' },
      { action: 'patients:create', needs: 'patients:view', reason: 'Registering patients requires viewing patient records.' },
      { action: 'billing:manage', needs: 'billing:view', reason: 'Recording payments requires viewing billing invoices.' },
      { action: 'users:manage', needs: 'users:view', reason: 'Managing staff accounts requires viewing staff directory.' },
      { action: 'roles:manage', needs: 'roles:view', reason: 'Configuring roles requires viewing roles list.' },
      { action: 'settings:manage', needs: 'settings:view', reason: 'Modifying facility settings requires viewing settings.' },
    ];

    actionDependencies.forEach(({ action, needs, reason }) => {
      if (selected.includes(action) && !selected.includes(needs)) {
        warnings.push({
          id: `dep-${action}-${needs}`,
          type: 'workflow',
          message: `"${action}" is granted without "${needs}". ${reason}`,
          missingPerm: needs,
        });
      }
    });

    return warnings;
  }, [roleForm.dashboardPath, roleForm.navigationItems, roleForm.permissions]);

  // Toggle navigation item
  const handleToggleNavItem = (navKey) => {
    setRoleForm((prev) => {
      const exists = prev.navigationItems.includes(navKey);
      const nextNavs = exists
        ? prev.navigationItems.filter((n) => n !== navKey)
        : [...prev.navigationItems, navKey];
      return { ...prev, navigationItems: nextNavs };
    });
  };

  // Quick Presets
  const applyPreset = (presetType) => {
    const allModules = matrixData.modules || {};
    const allPerms = [];
    Object.entries(allModules).forEach(([mod, def]) => {
      (def.actions || []).forEach((act) => allPerms.push(`${mod}:${act}`));
    });

    if (presetType === 'ALL') {
      setRoleForm((prev) => ({
        ...prev,
        permissions: allPerms,
        navigationItems: (matrixData.navigationItems || []).map((n) => n.key),
      }));
    } else if (presetType === 'VIEW_ONLY') {
      const viewPerms = allPerms.filter((p) => p.endsWith(':view'));
      setRoleForm((prev) => ({
        ...prev,
        permissions: viewPerms,
        navigationItems: ['dashboard', 'patients', 'orders', 'samples', 'reports', 'billing'],
      }));
    } else if (presetType === 'CLINICAL') {
      const clinicalPerms = allPerms.filter(
        (p) =>
          p.startsWith('patients:') ||
          p.startsWith('orders:') ||
          p.startsWith('samples:') ||
          p.startsWith('tests:') ||
          p.startsWith('reports:')
      );
      setRoleForm((prev) => ({
        ...prev,
        permissions: clinicalPerms,
        navigationItems: ['dashboard', 'patients', 'orders', 'samples', 'reports'],
      }));
    } else if (presetType === 'CLEAR') {
      setRoleForm((prev) => ({
        ...prev,
        permissions: [],
        navigationItems: ['dashboard'],
      }));
    }
  };

  const handleSelectAllNavItems = () => {
    const all = (matrixData.navigationItems || []).map((n) => n.key);
    setRoleForm((prev) => ({ ...prev, navigationItems: all }));
  };

  // Save Role (Create or Update)
  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      setErrorBanner('Role name is required.');
      return;
    }
    if (!roleForm.code.trim()) {
      setErrorBanner('Role code is required.');
      return;
    }

    setIsSavingRole(true);
    setErrorBanner(null);
    try {
      if (editingRole) {
        await superAdminService.updateRole(editingRole.roleId, roleForm);
        setSuccessBanner(`Role "${roleForm.name}" updated successfully.`);
      } else {
        await superAdminService.createRole(roleForm);
        setSuccessBanner(`New role "${roleForm.name}" created and synced to all laboratories.`);
      }
      setViewMode('list');
      await loadData();
    } catch (err) {
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to save role.');
    } finally {
      setIsSavingRole(false);
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (role) => {
    const newStatus = !role.isActive;
    try {
      await superAdminService.updateRoleStatus(role.roleId, newStatus);
      setSuccessBanner(`Role "${role.name}" ${newStatus ? 'activated' : 'deactivated'} successfully.`);
      await loadData();
    } catch (err) {
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to update role status.');
    }
  };

  // Delete Role Handlers
  const handleDeleteRole = (role) => {
    setRoleToDelete(role);
  };

  const handleConfirmDeleteRole = async () => {
    if (!roleToDelete) return;
    setIsDeletingRole(true);
    try {
      await superAdminService.deleteRole(roleToDelete.roleId);
      const successMsg = `Role "${roleToDelete.name}" deleted successfully.`;
      setSuccessBanner(successMsg);
      notify.success(successMsg);
      setRoleToDelete(null);
      await loadData();
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Failed to delete role.';
      setErrorBanner(errorMsg);
      notify.error(err, { fallback: 'Failed to delete role.' });
    } finally {
      setIsDeletingRole(false);
    }
  };

  // Force Sync Roles to All Laboratories
  const handleForceSync = async () => {
    setIsSyncing(true);
    setErrorBanner(null);
    try {
      const res = await superAdminService.syncRolesToLabs();
      setSuccessBanner(`Successfully synchronized ${res.totalMasterRoles} roles across ${res.syncedTenants} laboratories.`);
    } catch (err) {
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to synchronize roles to laboratories.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter roles
  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      const matchesSearch =
        r.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesActive =
        filterActive === 'ALL' ||
        (filterActive === 'ACTIVE' && r.isActive) ||
        (filterActive === 'INACTIVE' && !r.isActive);
      return matchesSearch && matchesActive;
    });
  }, [roles, searchTerm, filterActive]);

  // Compute total available actions in matrix
  const totalAvailablePerms = useMemo(() => {
    let count = 0;
    Object.values(matrixData.modules || {}).forEach((mod) => {
      count += (mod.actions || []).length;
    });
    return count;
  }, [matrixData]);
  // -------------------------------------------------------------
  // DEDICATED FULL-PAGE ROLE BUILDER / EDITOR VIEW
  // -------------------------------------------------------------
  if (viewMode === 'editor') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {/* Editor Top Banner (Flush Top/Left/Right) */}
        <div
          className="overview-hero-banner overview-hero-banner-flush"
          style={{
            background: 'linear-gradient(135deg, #e0f2fe 0%, #ecfdf5 45%, #f0fdf4 100%)',
            borderRadius: '0 0 16px 16px',
            padding: '1.35rem 1.75rem',
            color: '#0f172a',
            boxShadow: '0 4px 20px -2px rgba(2, 132, 199, 0.08), 0 2px 6px rgba(16, 185, 129, 0.05)',
            position: 'relative',
            overflow: 'hidden',
            borderBottom: '1.5px solid #bae6fd',
          }}
        >
          {/* Ambient Lighting Orbs */}
          <div
            style={{
              position: 'absolute',
              top: '-50%',
              right: '-10%',
              width: '380px',
              height: '380px',
              background: 'radial-gradient(circle, rgba(167, 243, 208, 0.45) 0%, rgba(224, 242, 254, 0) 70%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute',
              bottom: '-50%',
              left: '20%',
              width: '320px',
              height: '320px',
              background: 'radial-gradient(circle, rgba(186, 230, 253, 0.4) 0%, rgba(240, 253, 244, 0) 70%)',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.4rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('list');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '5px 12px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ArrowLeft size={14} />
                  <span>Back to Roles Directory</span>
                </button>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
                    border: '1px solid #fbcfe8',
                    borderRadius: '20px',
                    padding: '3px 10px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    boxShadow: '0 2px 6px rgba(236, 72, 153, 0.1)',
                  }}
                >
                  <Sparkles size={11} color="#ec4899" />
                  <span style={{ background: 'linear-gradient(135deg, #0284c7 0%, #ec4899 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    RBAC Role Studio
                  </span>
                </span>
              </div>

              <h1
                style={{
                  fontSize: 'clamp(1.35rem, 2.4vw, 1.8rem)',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #0284c7 0%, #3b82f6 30%, #ec4899 70%, #f43f5e 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1.25,
                  margin: '0 0 0.35rem 0',
                  letterSpacing: '-0.02em',
                }}
              >
                {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Custom Role'}
              </h1>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.45 }}>
                {editingRole
                  ? 'Update identifier code, default landing view, sidebar access, and granular permission capabilities.'
                  : 'Configure a clean, tailor-made laboratory staff role with exact functional module authorizations.'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => {
                  setViewMode('list');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={isSavingRole}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.6rem 1.15rem',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                <X size={15} />
                <span>Cancel</span>
              </button>
              <button
                type="submit"
                form="custom-role-page-form"
                disabled={isSavingRole}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '0.6rem 1.35rem',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  boxShadow: '0 2px 10px rgba(37, 99, 235, 0.28)',
                  cursor: isSavingRole ? 'not-allowed' : 'pointer',
                }}
              >
                {isSavingRole ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                <span>{editingRole ? 'Save Changes' : 'Create & Save Role'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error / Success Banners */}
        {errorBanner && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={16} />
              <span style={{ fontSize: '0.875rem' }}>{errorBanner}</span>
            </div>
            <button onClick={() => setErrorBanner(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#991b1b' }}>
              <X size={15} />
            </button>
          </div>
        )}

        {/* Form Container */}
        <form id="custom-role-page-form" onSubmit={handleSaveRole} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Card 1: Role Profile & Navigation Scope */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Key size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                  1. Role Credentials & Identity
                </h3>
                <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '2px 0 0 0' }}>
                  Configure the primary title, unique identifier key, and landing experience for this role.
                </p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="role-page-name-input">
                  Role Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="role-page-name-input"
                  type="text"
                  required
                  placeholder="e.g., Senior Pathologist, Front Desk Receptionist"
                  value={roleForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setRoleForm((prev) => ({
                      ...prev,
                      name,
                      code: editingRole ? prev.code : name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_'),
                    }));
                  }}
                  className="form-control"
                  style={{ height: '42px', fontSize: '0.875rem' }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="role-page-code-input">
                  Role Identifier Code <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  id="role-page-code-input"
                  type="text"
                  required
                  placeholder="e.g., senior_pathologist"
                  value={roleForm.code}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  className="form-control"
                  style={{ fontFamily: 'monospace', height: '42px', fontSize: '0.875rem' }}
                />
                <span className="form-hint" style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                  Alphanumeric & underscore only. Used for role checks in the system.
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" htmlFor="role-page-desc-input">Description</label>
              <textarea
                id="role-page-desc-input"
                rows={2}
                placeholder="What does this role do in the laboratory? (e.g., Interprets laboratory findings, verifies samples...)"
                value={roleForm.description}
                onChange={(e) => setRoleForm((prev) => ({ ...prev, description: e.target.value }))}
                className="form-control"
                style={{ resize: 'vertical', fontSize: '0.875rem' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="role-page-dashboard-select">
                  Default Landing Dashboard <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <select
                  id="role-page-dashboard-select"
                  value={roleForm.dashboardPath}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, dashboardPath: e.target.value }))}
                  className="form-control"
                  style={{ height: '42px', fontSize: '0.875rem' }}
                >
                  <option value="/dashboard">Main Dashboard (/dashboard)</option>
                  <option value="/reports">Reports & Pathology Review (/reports)</option>
                  <option value="/samples">Specimen Bench (/samples)</option>
                  <option value="/patients">Patient Registration (/patients)</option>
                  <option value="/orders">Requisition Orders (/orders)</option>
                  <option value="/billing">Billing & Invoicing (/billing)</option>
                  <option value="/tests">Test Catalog (/tests)</option>
                  <option value="/users">Staff Directory (/users)</option>
                  <option value="/settings">Lab Settings (/settings)</option>
                </select>
                <span className="form-hint" style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                  Where the user lands immediately upon logging in.
                </span>
              </div>

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Authorized Navigation Items</label>
                  <button
                    type="button"
                    onClick={handleSelectAllNavItems}
                    style={{ border: 'none', background: 'none', color: '#2563eb', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Select All
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '44px', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc' }}>
                  {(matrixData.navigationItems || []).map((nav) => {
                    const isChecked = roleForm.navigationItems.includes(nav.key);
                    return (
                      <label
                        key={nav.key}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.78rem',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: isChecked ? '#eff6ff' : 'white',
                          border: isChecked ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                          color: isChecked ? '#1d4ed8' : '#334155',
                          cursor: 'pointer',
                          userSelect: 'none',
                          fontWeight: isChecked ? 600 : 400,
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleNavItem(nav.key)}
                          style={{ margin: 0, accentColor: '#2563eb' }}
                        />
                        <span>{nav.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Granular Permissions Matrix */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
                    2. Granular Permissions Configuration
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: '#64748b', margin: '2px 0 0 0' }}>
                    {roleForm.permissions.length} of {totalAvailablePerms} actions granted across laboratory modules.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={handleSelectAllPermissions}
                  style={{
                    border: '1px solid #cbd5e1',
                    background: 'white',
                    color: '#334155',
                    padding: '6px 13px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Select All Actions
                </button>
                <button
                  type="button"
                  onClick={handleClearAllPermissions}
                  style={{
                    border: '1px solid #fecaca',
                    background: 'white',
                    color: '#dc2626',
                    padding: '6px 13px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Quick Presets Bar & Session Notice */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.25rem' }}>
              <div style={{ padding: '12px 16px', background: '#f0f9ff', borderRadius: '10px', border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', fontWeight: 600, color: '#0369a1' }}>
                  <Sparkles size={16} style={{ color: '#0284c7' }} />
                  <span>Quick Permission Presets:</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => applyPreset('ALL')}
                    style={{ fontSize: '0.75rem', padding: '5px 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: '#334155' }}
                  >
                    Full Access (All)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('CLINICAL')}
                    style={{ fontSize: '0.75rem', padding: '5px 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: '#334155' }}
                  >
                    Clinical Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('VIEW_ONLY')}
                    style={{ fontSize: '0.75rem', padding: '5px 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: '#334155' }}
                  >
                    View-Only
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('CLEAR')}
                    style={{ fontSize: '0.75rem', padding: '5px 12px', background: 'white', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, color: '#dc2626' }}
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Session Notice */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.78rem', color: '#475569' }}>
                <Info size={15} style={{ color: '#0284c7', flexShrink: 0 }} />
                <span>
                  <strong>Session Notice:</strong> Active staff members who are currently logged in should log out and sign back in after permissions are updated to renew their token claims and prevent temporary "Access Denied" errors.
                </span>
              </div>

              {/* Access Denied Guardian */}
              {accessWarnings.length > 0 && (
                <div style={{ padding: '12px 16px', background: '#fffbeb', border: '1.5px solid #fde68a', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldAlert size={16} style={{ color: '#d97706' }} />
                      <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#92400e' }}>
                        Permission Dependency Assistant ({accessWarnings.length} potential Access Denied risk{accessWarnings.length > 1 ? 's' : ''})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleFixAllWarnings(accessWarnings.map((w) => w.missingPerm).filter(Boolean))}
                      style={{ background: '#fef3c7', border: '1px solid #d97706', color: '#92400e', fontSize: '0.72rem', padding: '3px 9px', borderRadius: '4px', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Auto-Resolve All
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {accessWarnings.map((w, idx) => (
                      <div key={w.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', fontSize: '0.75rem', color: '#78350f', background: '#fef3c7', padding: '5px 10px', borderRadius: '4px' }}>
                        <span>• {w.message}</span>
                        {w.missingPerm && (
                          <button
                            type="button"
                            onClick={() => handleQuickAddPermission(w.missingPerm)}
                            style={{ border: 'none', background: '#15803d', color: 'white', fontSize: '0.6875rem', fontWeight: 600, padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 }}
                          >
                            + Grant {w.missingPerm}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Filter and Search Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => setCategoryFilterTab('ALL')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '20px',
                    fontSize: '0.75rem',
                    fontWeight: categoryFilterTab === 'ALL' ? 700 : 500,
                    border: '1px solid',
                    borderColor: categoryFilterTab === 'ALL' ? '#2563eb' : '#cbd5e1',
                    background: categoryFilterTab === 'ALL' ? '#2563eb' : 'white',
                    color: categoryFilterTab === 'ALL' ? 'white' : '#334155',
                    cursor: 'pointer',
                  }}
                >
                  All Modules ({PERMISSION_MODULE_GROUPS.length})
                </button>
                {PERMISSION_MODULE_GROUPS.map((grp) => {
                  const isActive = categoryFilterTab === grp.id;
                  let groupTotal = 0;
                  let groupSelected = 0;
                  (grp.moduleKeys || []).forEach((mKey) => {
                    const actions = matrixData.modules?.[mKey]?.actions || [];
                    groupTotal += actions.length;
                    actions.forEach((act) => {
                      if (roleForm.permissions.includes(`${mKey}:${act}`)) groupSelected++;
                    });
                  });

                  return (
                    <button
                      key={grp.id}
                      type="button"
                      onClick={() => setCategoryFilterTab(grp.id)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.72rem',
                        fontWeight: isActive ? 700 : 500,
                        border: '1px solid',
                        borderColor: isActive ? grp.color : '#cbd5e1',
                        background: isActive ? grp.color : 'white',
                        color: isActive ? 'white' : '#334155',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>{grp.label}</span>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          padding: '1px 5px',
                          borderRadius: '10px',
                          background: isActive ? 'rgba(255,255,255,0.25)' : (groupSelected > 0 ? grp.bgLight : '#f1f5f9'),
                          color: isActive ? 'white' : (groupSelected > 0 ? grp.color : '#64748b'),
                          fontWeight: 700,
                        }}
                      >
                        {groupSelected}/{groupTotal}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Search Inside Permissions */}
              <div style={{ position: 'relative', width: '240px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search actions or codes..."
                  value={permSearch}
                  onChange={(e) => setPermSearch(e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: '32px', fontSize: '0.78rem' }}
                />
              </div>
            </div>

            {/* Grouped Permission Module Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {PERMISSION_MODULE_GROUPS.filter((grp) => categoryFilterTab === 'ALL' || categoryFilterTab === grp.id).map((grp) => {
                const GroupIcon = grp.icon || Layers;

                const groupModulesWithActions = (grp.moduleKeys || [])
                  .map((mKey) => {
                    const modDef = matrixData.modules?.[mKey] || { actions: [], label: mKey };
                    const actions = modDef.actions || [];
                    const filteredActions = permSearch.trim()
                      ? actions.filter((act) => {
                          const permKey = `${mKey}:${act}`;
                          const meta = ACTION_METADATA[permKey];
                          const label = meta?.title || modDef.actionLabels?.[act] || act;
                          const desc = meta?.description || '';
                          const query = permSearch.toLowerCase();
                          return (
                            label.toLowerCase().includes(query) ||
                            desc.toLowerCase().includes(query) ||
                            mKey.toLowerCase().includes(query) ||
                            act.toLowerCase().includes(query) ||
                            permKey.toLowerCase().includes(query)
                          );
                        })
                      : actions;
                    return {
                      moduleKey: mKey,
                      modDef,
                      actions: filteredActions,
                    };
                  })
                  .filter((item) => item.actions.length > 0);

                if (groupModulesWithActions.length === 0 && permSearch.trim()) {
                  return null;
                }

                let groupTotalActions = 0;
                let groupSelectedActions = 0;
                (grp.moduleKeys || []).forEach((mKey) => {
                  const acts = matrixData.modules?.[mKey]?.actions || [];
                  groupTotalActions += acts.length;
                  acts.forEach((act) => {
                    if (roleForm.permissions.includes(`${mKey}:${act}`)) groupSelectedActions++;
                  });
                });

                const allGroupSelected = groupTotalActions > 0 && groupSelectedActions === groupTotalActions;

                return (
                  <div
                    key={grp.id}
                    style={{
                      border: `1.5px solid ${grp.borderLight}`,
                      borderRadius: '12px',
                      padding: '14px 16px',
                      background: 'white',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                    }}
                  >
                    {/* Group Header */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingBottom: '10px',
                        marginBottom: '10px',
                        borderBottom: `1px solid ${grp.borderLight}`,
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: grp.bgLight,
                            color: grp.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <GroupIcon size={16} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>
                              {grp.label}
                            </span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 600,
                                padding: '1px 8px',
                                borderRadius: '10px',
                                background: groupSelectedActions > 0 ? grp.bgLight : '#f1f5f9',
                                color: groupSelectedActions > 0 ? grp.color : '#64748b',
                              }}
                            >
                              {groupSelectedActions} / {groupTotalActions} Actions Selected
                            </span>
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '1px' }}>
                            {grp.description}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleCategoryAll(grp)}
                        style={{
                          border: 'none',
                          background: 'none',
                          color: allGroupSelected ? '#dc2626' : grp.color,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          fontWeight: 600,
                          padding: '3px 8px',
                        }}
                      >
                        {allGroupSelected ? 'Deselect Category' : 'Select All in Category'}
                      </button>
                    </div>

                    {/* Sub-modules list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {groupModulesWithActions.map(({ moduleKey, modDef, actions }) => {
                        const showSubHeader = (grp.moduleKeys || []).length > 1;
                        const allModSelected = (modDef.actions || []).every((act) => roleForm.permissions.includes(`${moduleKey}:${act}`));

                        return (
                          <div key={moduleKey}>
                            {showSubHeader && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', marginBottom: '6px', borderBottom: '1px dashed #e2e8f0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155' }}>
                                    {modDef.label || moduleKey}
                                  </span>
                                  <span style={{ fontSize: '0.6875rem', fontFamily: 'monospace', color: '#94a3b8' }}>
                                    ({moduleKey}:*)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleToggleModuleAll(moduleKey, modDef.actions || [])}
                                  style={{
                                    border: 'none',
                                    background: 'none',
                                    color: allModSelected ? '#64748b' : grp.color,
                                    fontSize: '0.6875rem',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                  }}
                                >
                                  {allModSelected ? 'Deselect Module' : 'Select Module'}
                                </button>
                              </div>
                            )}

                            {/* Action Items Cards Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
                              {actions.map((action) => {
                                const permKey = `${moduleKey}:${action}`;
                                const isChecked = roleForm.permissions.includes(permKey);
                                const meta = ACTION_METADATA[permKey] || {
                                  title: modDef.actionLabels?.[action] || action,
                                  description: `Grants ${action} permission for ${modDef.label || moduleKey}`,
                                  level: 'write',
                                  levelLabel: 'Operational',
                                };

                                const levelBadges = {
                                  read: { bg: '#f1f5f9', color: '#475569', label: 'Read-Only' },
                                  write: { bg: '#ecfdf5', color: '#047857', label: 'Operational' },
                                  clinical: { bg: '#f5f3ff', color: '#6d28d9', label: 'Clinical Sign-Off' },
                                  danger: { bg: '#fff1f2', color: '#be123c', label: 'Admin Only' },
                                };
                                const lvl = levelBadges[meta.level] || levelBadges.write;

                                return (
                                  <div
                                    key={permKey}
                                    onClick={() => handleTogglePermission(permKey)}
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '4px',
                                      padding: '8px 11px',
                                      background: isChecked ? '#f0fdf4' : 'white',
                                      border: '1.5px solid',
                                      borderColor: isChecked ? '#22c55e' : '#cbd5e1',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      transition: 'all 0.12s ease',
                                      userSelect: 'none',
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={() => {}}
                                          style={{ margin: 0, accentColor: '#16a34a', cursor: 'pointer' }}
                                        />
                                        <span style={{ fontSize: '0.8125rem', fontWeight: isChecked ? 700 : 600, color: isChecked ? '#15803d' : '#0f172a' }}>
                                          {meta.title}
                                        </span>
                                      </div>
                                      <span
                                        style={{
                                          fontSize: '0.625rem',
                                          fontWeight: 600,
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          background: lvl.bg,
                                          color: lvl.color,
                                        }}
                                      >
                                        {lvl.label}
                                      </span>
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', paddingLeft: '22px' }}>
                                      <span style={{ fontSize: '0.72rem', color: '#64748b', lineHeight: 1.25 }}>
                                        {meta.description}
                                      </span>
                                      <span style={{ fontSize: '0.625rem', fontFamily: 'monospace', color: '#94a3b8', flexShrink: 0 }}>
                                        {permKey}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Floating Action Bar */}
          <div
            style={{
              position: 'sticky',
              bottom: '1rem',
              background: '#ffffff',
              borderRadius: '12px',
              padding: '1rem 1.5rem',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              border: '1.5px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              zIndex: 10,
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#0f172a' }}>
                {roleForm.name.trim() || 'Untitled Custom Role'}
              </span>
              <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '4px' }}>
                {roleForm.code || 'no_code'}
              </span>
              <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                • {roleForm.permissions.length} actions selected
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => {
                  setViewMode('list');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                disabled={isSavingRole}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '0.55rem 1.15rem',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#475569',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingRole}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '0.55rem 1.35rem',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  boxShadow: '0 2px 10px rgba(37, 99, 235, 0.28)',
                  cursor: isSavingRole ? 'not-allowed' : 'pointer',
                }}
              >
                {isSavingRole ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                <span>{editingRole ? 'Save Changes' : 'Create & Save Role'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. Light Green & Light Blue Mixed Pastel Medical Banner (Flush Top/Left/Right) */}
      <div
        className="overview-hero-banner overview-hero-banner-flush"
        style={{
          background: 'linear-gradient(135deg, #e0f2fe 0%, #ecfdf5 45%, #f0fdf4 100%)',
          borderRadius: '0 0 16px 16px',
          padding: '1.5rem 1.75rem',
          color: '#0f172a',
          boxShadow: '0 4px 20px -2px rgba(2, 132, 199, 0.08), 0 2px 6px rgba(16, 185, 129, 0.05)',
          position: 'relative',
          overflow: 'hidden',
          borderBottom: '1.5px solid #bae6fd',
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
        }}
      >
        {/* Soft pastel ambient lighting orbs */}
        <div
          style={{
            position: 'absolute',
            top: '-50%',
            right: '-10%',
            width: '380px',
            height: '380px',
            background: 'radial-gradient(circle, rgba(167, 243, 208, 0.45) 0%, rgba(224, 242, 254, 0) 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-50%',
            left: '20%',
            width: '320px',
            height: '320px',
            background: 'radial-gradient(circle, rgba(186, 230, 253, 0.4) 0%, rgba(240, 253, 244, 0) 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
          <div style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.35rem' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'linear-gradient(135deg, #ffffff 0%, #fdf2f8 100%)',
                  border: '1px solid #fbcfe8',
                  borderRadius: '20px',
                  padding: '3px 12px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  boxShadow: '0 2px 6px rgba(236, 72, 153, 0.1)',
                }}
              >
                <Sparkles size={12} color="#ec4899" />
                <span
                  style={{
                    background: 'linear-gradient(135deg, #0284c7 0%, #ec4899 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Live Access Control • RBAC Studio
                </span>
              </span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(1.35rem, 2.5vw, 1.85rem)',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #0284c7 0%, #3b82f6 30%, #ec4899 70%, #f43f5e 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                lineHeight: 1.25,
                margin: '0 0 0.45rem 0',
                letterSpacing: '-0.02em',
              }}
            >
              Roles & Permissions Management
            </h1>

            <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569', lineHeight: 1.45, maxWidth: '620px' }}>
              Create custom laboratory roles, configure module access, and control staff permissions. Any role created here becomes available across laboratory staff dropdowns.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginLeft: 'auto' }}>
            {roles.length > 0 && (
              <button
                onClick={handleForceSync}
                disabled={isSyncing}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '7px',
                  padding: '0.55rem 1rem',
                  borderRadius: '8px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  cursor: isSyncing ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.15s ease',
                }}
                title="Synchronize roles across all laboratories"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                <span>{isSyncing ? 'Syncing...' : 'Sync to Labs'}</span>
              </button>
            )}

            <button
              onClick={() => handleOpenRoleModal(null)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '0.6rem 1.25rem',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)',
                border: 'none',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '0.84rem',
                boxShadow: '0 2px 10px rgba(37, 99, 235, 0.28)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <PlusCircle size={16} />
              <span>Create Custom Role</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error / Success Banners */}
      {errorBanner && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <span style={{ fontSize: '0.875rem' }}>{errorBanner}</span>
          </div>
          <button onClick={() => setErrorBanner(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#991b1b' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {successBanner && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={16} />
            <span style={{ fontSize: '0.875rem' }}>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#166534' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Top Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'var(--primary-subtle, #eff6ff)', color: 'var(--primary-blue, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Key size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--slate-900, #0f172a)' }}>{roles.length}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500, #64748b)' }}>Defined Roles</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--slate-900, #0f172a)' }}>
                {roles.filter((r) => r.isActive).length}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500, #64748b)' }}>Active Roles</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sliders size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--slate-900, #0f172a)' }}>
                {totalAvailablePerms}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500, #64748b)' }}>Available Permission Actions</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 className="card-title">Laboratory Roles ({roles.length})</h2>
            <p className="card-subtitle">These roles will appear in the role selection dropdown when laboratory admins create staff.</p>
          </div>

          {roles.length > 0 && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
                <input
                  type="text"
                  placeholder="Search roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: '32px', fontSize: '0.8125rem', width: '200px' }}
                />
              </div>

              <select
                value={filterActive}
                onChange={(e) => setFilterActive(e.target.value)}
                className="form-control"
                style={{ fontSize: '0.8125rem', width: '130px' }}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--slate-500)' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px', color: 'var(--primary-blue)' }} />
            <p style={{ fontSize: '0.875rem' }}>Loading roles...</p>
          </div>
        ) : roles.length === 0 ? (
          /* Empty State */
          <div style={{ textAlign: 'center', padding: '4rem 1.5rem', background: 'white' }}>
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '16px',
                background: 'var(--primary-subtle, #eff6ff)',
                color: 'var(--primary-blue, #2563eb)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
              }}
            >
              <Key size={32} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--slate-900, #0f172a)', marginBottom: '8px' }}>
              No Roles Created Yet
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-500, #64748b)', maxWidth: '500px', margin: '0 auto 24px', lineHeight: 1.5 }}>
              Default roles have been cleared per your instructions. You can now build roles manually, customize which modules each role can access, and assign exact permissions.
            </p>
            <button
              onClick={() => handleOpenRoleModal(null)}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontSize: '0.9375rem', fontWeight: 600 }}
            >
              <PlusCircle size={18} />
              <span>Create Your First Role</span>
            </button>
          </div>
        ) : (
          /* Roles Table */
          <div className="table-container">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Role Name & Code</th>
                  <th>Description</th>
                  <th>Default Landing View</th>
                  <th>Navigation Modules</th>
                  <th>Permissions</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--slate-400)' }}>
                      No roles matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((role) => (
                    <tr key={role.roleId || role.code}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 600, color: 'var(--slate-900, #0f172a)', fontSize: '0.9375rem' }}>
                            {role.name}
                          </span>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--primary-blue, #2563eb)' }}>
                            {role.code}
                          </span>
                        </div>
                      </td>
                      <td style={{ maxWidth: '240px', fontSize: '0.8125rem', color: 'var(--slate-600)' }}>
                        {role.description || '—'}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', background: 'var(--slate-100)', padding: '3px 8px', borderRadius: '4px', color: 'var(--slate-800)' }}>
                          {role.dashboardPath || '/dashboard'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '200px' }}>
                          {(role.navigationItems || []).map((nav) => (
                            <span
                              key={nav}
                              style={{
                                fontSize: '0.6875rem',
                                padding: '2px 6px',
                                background: 'var(--slate-100)',
                                color: 'var(--slate-700)',
                                borderRadius: '4px',
                              }}
                            >
                              {nav}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
                          <button
                            onClick={() => setInspectRole(role)}
                            className="badge badge-purple"
                            style={{ cursor: 'pointer', border: 'none', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}
                            title="Click to view full permission details"
                          >
                            {(role.permissions || []).length} Actions Granted
                          </button>
                          <span style={{ fontSize: '0.7rem', color: 'var(--slate-500)', maxWidth: '200px', lineHeight: 1.3 }}>
                            {getRoleModuleSummary(role.permissions)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleStatus(role)}
                          className={`badge ${role.isActive ? 'badge-success' : 'badge-slate'}`}
                          style={{ cursor: 'pointer', border: 'none', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}
                          title="Click to toggle role status"
                        >
                          {role.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleOpenRoleModal(role)}
                            title="Edit role and permissions"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Edit2 size={13} />
                            <span>Edit</span>
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => handleDeleteRole(role)}
                            title="Delete role"
                            style={{ padding: '4px 8px' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect Role Permissions Modal with Clean Module Breakdown */}
      {inspectRole && (
        <Modal
          isOpen={!!inspectRole}
          onClose={() => setInspectRole(null)}
          title={`Role Details: ${inspectRole.name}`}
          size="lg"
        >
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', margin: '0 0 10px 0' }}>
              {inspectRole.description || 'No description provided.'}
            </p>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <Badge variant="blue">Code: {inspectRole.code}</Badge>
              <Badge variant="purple">Landing: {inspectRole.dashboardPath}</Badge>
              <Badge variant={inspectRole.isActive ? 'success' : 'slate'}>
                {inspectRole.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <Badge variant="cyan">Total Actions: {(inspectRole.permissions || []).length}</Badge>
            </div>
          </div>

          <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, margin: 0, color: 'var(--slate-800)' }}>
              Assigned Permissions by Laboratory Module:
            </h4>

            {PERMISSION_MODULE_GROUPS.map((grp) => {
              const GroupIcon = grp.icon || Layers;
              const grantedInGroup = (inspectRole.permissions || []).filter((perm) => {
                const [modKey] = perm.split(':');
                return (grp.moduleKeys || []).includes(modKey);
              });

              if (grantedInGroup.length === 0) return null;

              return (
                <div
                  key={grp.id}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${grp.borderLight}`,
                    background: grp.bgLight,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'white', color: grp.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <GroupIcon size={14} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--slate-900)' }}>
                      {grp.label} ({grantedInGroup.length} actions)
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {grantedInGroup.map((perm) => {
                      const meta = ACTION_METADATA[perm];
                      return (
                        <span
                          key={perm}
                          style={{
                            fontSize: '0.72rem',
                            padding: '4px 8px',
                            borderRadius: '5px',
                            background: 'white',
                            color: 'var(--slate-800)',
                            border: '1px solid #cbd5e1',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                          }}
                        >
                          <CheckCircle2 size={12} style={{ color: grp.color }} />
                          <span style={{ fontWeight: 600 }}>{meta?.title || perm}</span>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: 'var(--slate-500)' }}>
                            ({perm})
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {(inspectRole.permissions || []).length === 0 && (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--slate-400)', fontSize: '0.8125rem' }}>
                No permissions assigned to this role.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={() => setInspectRole(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* Role Deletion Confirmation Modal */}
      <ConfirmModal
        isOpen={Boolean(roleToDelete)}
        title="Delete Master Role"
        message={
          roleToDelete
            ? `Are you sure you want to delete the role "${roleToDelete.name}" (${roleToDelete.code})? It will be permanently removed from all laboratory databases.`
            : ''
        }
        confirmText="Delete Role"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeletingRole}
        onConfirm={handleConfirmDeleteRole}
        onClose={() => {
          if (!isDeletingRole) {
            setRoleToDelete(null);
          }
        }}
      />
    </div>
  );
}

export default SuperAdminRolesPage;
