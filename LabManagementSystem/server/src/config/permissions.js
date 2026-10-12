/**
 * Lab Management System (LMS) - Permission Matrix & Module Actions Definition
 * 
 * Defines granular module-level actions applicable for laboratory workflows.
 * Only applicable actions are exposed per module.
 */

export const MODULE_ACTIONS = {
  patients: {
    label: 'Patients & Accessioning',
    actions: ['view', 'create', 'update', 'delete'],
    actionLabels: {
      view: 'View Patient Profiles',
      create: 'Register New Patient',
      update: 'Update Demographics',
      delete: 'Delete Patient Record',
    },
  },
  orders: {
    label: 'Laboratory Orders',
    actions: ['view', 'create', 'update', 'delete'],
    actionLabels: {
      view: 'View Orders',
      create: 'Create Requisition',
      update: 'Edit Order Tests',
      delete: 'Cancel / Delete Order',
    },
  },
  samples: {
    label: 'Specimen & Sample Tracking',
    actions: ['view', 'collect', 'process', 'verify'],
    actionLabels: {
      view: 'View Samples',
      collect: 'Collect / Draw Sample',
      process: 'Run Analyzer Processing',
      verify: 'Verify Specimen Quality',
    },
  },
  tests: {
    label: 'Test Catalog & Analyzers',
    actions: ['view', 'manage'],
    actionLabels: {
      view: 'View Test Catalog',
      manage: 'Manage Tests & Reference Ranges',
    },
  },
  reports: {
    label: 'Diagnostic Pathology Reports',
    actions: ['view', 'create', 'verify', 'release'],
    actionLabels: {
      view: 'View Reports',
      create: 'Draft Diagnostic Findings',
      verify: 'Pathologist Verification',
      release: 'Release Diagnostic Report',
    },
  },
  billing: {
    label: 'Billing & Reimbursement',
    actions: ['view', 'manage'],
    actionLabels: {
      view: 'View Invoices & Ledgers',
      manage: 'Manage Payments & Claims',
    },
  },
  users: {
    label: 'Staff User Management',
    actions: ['view', 'manage'],
    actionLabels: {
      view: 'View Staff Directory',
      manage: 'Create / Deactivate Staff & Assign Roles',
    },
  },
  roles: {
    label: 'Role & Permission Builder',
    actions: ['view', 'manage'],
    actionLabels: {
      view: 'View Custom Roles',
      manage: 'Create / Edit Custom Roles & Permissions',
    },
  },
  settings: {
    label: 'Laboratory Settings',
    actions: ['view', 'manage'],
    actionLabels: {
      view: 'View Laboratory Profile',
      manage: 'Edit Tenant Settings & Integrations',
    },
  },
  audit: {
    label: 'Audit Trail & Compliance',
    actions: ['view'],
    actionLabels: {
      view: 'View Laboratory Audit Logs',
    },
  },
};

export const AVAILABLE_NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', path: '/dashboard' },
  { key: 'patients', label: 'Patients', path: '/patients' },
  { key: 'orders', label: 'Lab Orders', path: '/orders' },
  { key: 'samples', label: 'Samples', path: '/samples' },
  { key: 'tests', label: 'Test Catalog', path: '/tests' },
  { key: 'reports', label: 'Reports', path: '/reports' },
  { key: 'billing', label: 'Billing', path: '/billing' },
  { key: 'users', label: 'Users & Roles', path: '/users' },
  { key: 'audit', label: 'Audit Logs', path: '/audit-logs' },
  { key: 'settings', label: 'Lab Settings', path: '/settings' },
];

/**
 * Validates whether a permission string (e.g., 'patients:create') is valid in the matrix
 */
export function isValidPermission(permissionString) {
  if (!permissionString || typeof permissionString !== 'string') return false;
  if (permissionString === '*') return true;

  const [module, action] = permissionString.split(':');
  if (!module || !action) return false;

  const moduleDef = MODULE_ACTIONS[module];
  if (!moduleDef) return false;

  return moduleDef.actions.includes(action);
}

/**
 * Filter an array of permissions to ensure all entries are valid
 */
export function sanitizePermissions(permissionList = []) {
  if (!Array.isArray(permissionList)) return [];
  return Array.from(new Set(permissionList.filter(isValidPermission)));
}

/**
 * Sensible default roles for laboratory onboarding
 */
export const DEFAULT_LAB_ROLES = [
  {
    code: 'lab_admin',
    name: 'Laboratory Administrator',
    description: 'Full administrative access to all laboratory operational, clinical, staff, and role management workflows.',
    dashboardPath: '/dashboard',
    navigationItems: ['dashboard', 'patients', 'orders', 'samples', 'tests', 'reports', 'billing', 'users', 'audit', 'settings'],
    permissions: [
      'patients:view', 'patients:create', 'patients:update', 'patients:delete',
      'orders:view', 'orders:create', 'orders:update', 'orders:delete',
      'samples:view', 'samples:collect', 'samples:process', 'samples:verify',
      'tests:view', 'tests:manage',
      'reports:view', 'reports:create', 'reports:verify', 'reports:release',
      'billing:view', 'billing:manage',
      'users:view', 'users:manage',
      'roles:view', 'roles:manage',
      'audit:view',
      'settings:view', 'settings:manage',
    ],
    isSystemDefault: true,
  },
  {
    code: 'pathologist',
    name: 'Consultant Pathologist',
    description: 'Physician authorized for diagnostic specimen interpretation, test verification, and releasing diagnostic reports.',
    dashboardPath: '/reports',
    navigationItems: ['dashboard', 'patients', 'orders', 'samples', 'tests', 'reports'],
    permissions: [
      'patients:view',
      'orders:view',
      'samples:view', 'samples:verify',
      'tests:view',
      'reports:view', 'reports:create', 'reports:verify', 'reports:release',
    ],
    isSystemDefault: true,
  },
  {
    code: 'lab_technician',
    name: 'Medical Laboratory Technician',
    description: 'Processes patient specimens, operates analyzer equipment, inputs findings, and drafts test reports.',
    dashboardPath: '/samples',
    navigationItems: ['dashboard', 'patients', 'orders', 'samples', 'tests', 'reports'],
    permissions: [
      'patients:view',
      'orders:view',
      'samples:view', 'samples:collect', 'samples:process', 'samples:verify',
      'tests:view',
      'reports:view', 'reports:create',
    ],
    isSystemDefault: true,
  },
  {
    code: 'phlebotomist',
    name: 'Certified Phlebotomist',
    description: 'Performs patient blood draws, collects biological specimens, and prints barcode tube labels.',
    dashboardPath: '/samples',
    navigationItems: ['dashboard', 'patients', 'orders', 'samples'],
    permissions: [
      'patients:view',
      'orders:view',
      'samples:view', 'samples:collect',
    ],
    isSystemDefault: true,
  },
  {
    code: 'receptionist',
    name: 'Front Desk / Patient Intake',
    description: 'Registers incoming patients, schedules tests, and generates requisition intake orders.',
    dashboardPath: '/patients',
    navigationItems: ['dashboard', 'patients', 'orders'],
    permissions: [
      'patients:view', 'patients:create', 'patients:update',
      'orders:view', 'orders:create',
      'tests:view',
    ],
    isSystemDefault: true,
  },
  {
    code: 'billing_clerk',
    name: 'Billing & Patient Accounts Clerk',
    description: 'Manages patient invoicing, copays, insurer claim statements, and financial reports.',
    dashboardPath: '/billing',
    navigationItems: ['dashboard', 'patients', 'orders', 'billing'],
    permissions: [
      'patients:view',
      'orders:view',
      'billing:view', 'billing:manage',
    ],
    isSystemDefault: true,
  },
];
