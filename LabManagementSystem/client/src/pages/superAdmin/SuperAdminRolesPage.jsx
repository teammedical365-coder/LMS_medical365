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
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
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

  // Role Builder Modal State
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [permSearch, setPermSearch] = useState('');
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

  // Open modal for Create or Edit
  const handleOpenRoleModal = (roleToEdit = null) => {
    setErrorBanner(null);
    setSuccessBanner(null);
    setPermSearch('');
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
    setRoleModalOpen(true);
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
      setRoleModalOpen(false);
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

  // Delete Role
  const handleDeleteRole = async (role) => {
    if (!window.confirm(`Are you sure you want to delete the role "${role.name}" (${role.code})? It will be removed from all laboratory databases.`)) {
      return;
    }
    try {
      await superAdminService.deleteRole(role.roleId);
      setSuccessBanner(`Role "${role.name}" deleted successfully.`);
      await loadData();
    } catch (err) {
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to delete role.');
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <PageHeader
        title="Roles & Permissions Management"
        description="Create custom laboratory roles, configure module access, and control staff permissions. Any role created here becomes available across laboratory staff dropdowns."
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {roles.length > 0 && (
              <button
                onClick={handleForceSync}
                disabled={isSyncing}
                className="btn btn-secondary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                title="Synchronize roles across all laboratories"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                <span>{isSyncing ? 'Syncing...' : 'Sync to Labs'}</span>
              </button>
            )}
            <button
              onClick={() => handleOpenRoleModal(null)}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <PlusCircle size={15} />
              <span>Create Custom Role</span>
            </button>
          </div>
        }
      />

      {/* Info Status Banner */}
      <StatusBanner
        type="info"
        badgeText="Manual Role Control Active"
        message="Default roles are disabled. You have full manual control to define staff roles, select permissions, and assign landing dashboards."
      />

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
                        <button
                          onClick={() => setInspectRole(role)}
                          className="badge badge-purple"
                          style={{ cursor: 'pointer', border: 'none', padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600 }}
                          title="Click to view full permission details"
                        >
                          {(role.permissions || []).length} Actions Granted
                        </button>
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

      {/* Role Builder Modal (Create / Edit) */}
      {roleModalOpen && (
        <Modal
          isOpen={roleModalOpen}
          onClose={() => setRoleModalOpen(false)}
          title={editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Custom Role'}
          size="lg"
        >
          <form onSubmit={handleSaveRole}>
            {/* Quick Presets Bar */}
            <div style={{ padding: '10px 14px', background: 'var(--slate-50, #f8fafc)', borderRadius: '8px', border: '1px solid var(--border-subtle, #e2e8f0)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--slate-700)' }}>
                <Sparkles size={15} style={{ color: 'var(--primary-blue)' }} />
                <span>Quick Permission Presets:</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => applyPreset('ALL')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                >
                  Full Access (All)
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('CLINICAL')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                >
                  Clinical Staff
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('VIEW_ONLY')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                >
                  View-Only
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('CLEAR')}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '3px 8px', color: '#dc2626' }}
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Basic Information */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Role Name *</label>
                <input
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
                />
              </div>

              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Role Identifier Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., senior_pathologist"
                  value={roleForm.code}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  className="form-control"
                  style={{ fontFamily: 'monospace' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                  Alphanumeric & underscore only. Used for role checks in the system.
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Description</label>
              <textarea
                rows={2}
                placeholder="What does this role do in the laboratory? (e.g., Interprets laboratory findings, verifies samples...)"
                value={roleForm.description}
                onChange={(e) => setRoleForm((prev) => ({ ...prev, description: e.target.value }))}
                className="form-control"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Default Landing Dashboard</label>
                <select
                  value={roleForm.dashboardPath}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, dashboardPath: e.target.value }))}
                  className="form-control"
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
                <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                  Where the user lands immediately upon logging in.
                </span>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>Authorized Navigation Items</label>
                  <button
                    type="button"
                    onClick={handleSelectAllNavItems}
                    style={{ border: 'none', background: 'none', color: 'var(--primary-blue)', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Select All
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '110px', overflowY: 'auto', padding: '8px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--slate-50)' }}>
                  {(matrixData.navigationItems || []).map((nav) => {
                    const isChecked = roleForm.navigationItems.includes(nav.key);
                    return (
                      <label
                        key={nav.key}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.75rem',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: isChecked ? 'white' : 'transparent',
                          border: isChecked ? '1px solid var(--primary-blue, #2563eb)' : '1px solid #cbd5e1',
                          color: isChecked ? 'var(--primary-blue, #2563eb)' : 'var(--slate-700)',
                          cursor: 'pointer',
                          userSelect: 'none',
                          fontWeight: isChecked ? 600 : 400,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleNavItem(nav.key)}
                          style={{ margin: 0 }}
                        />
                        <span>{nav.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Granular Module Permission Matrix */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: 'var(--slate-900)' }}>
                    Permissions Matrix ({roleForm.permissions.length} / {totalAvailablePerms} Actions Selected)
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                    Check each capability you wish to grant to this role.
                  </span>
                </div>

                {/* Search inside permissions */}
                <div style={{ position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
                  <input
                    type="text"
                    placeholder="Filter permissions..."
                    value={permSearch}
                    onChange={(e) => setPermSearch(e.target.value)}
                    className="form-control"
                    style={{ paddingLeft: '28px', fontSize: '0.75rem', padding: '4px 8px 4px 28px', width: '180px' }}
                  />
                </div>
              </div>

              {/* Module Cards Grid */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto', paddingRight: '4px' }}>
                {Object.entries(matrixData.modules || {}).map(([modKey, modDef]) => {
                  const Icon = MODULE_ICONS[modKey] || Layers;
                  const modActions = modDef.actions || [];
                  const matchingActions = permSearch.trim()
                    ? modActions.filter((act) => {
                        const label = modDef.actionLabels?.[act] || act;
                        return (
                          label.toLowerCase().includes(permSearch.toLowerCase()) ||
                          modKey.toLowerCase().includes(permSearch.toLowerCase()) ||
                          act.toLowerCase().includes(permSearch.toLowerCase())
                        );
                      })
                    : modActions;

                  if (matchingActions.length === 0 && permSearch.trim()) return null;

                  const allSelected = modActions.every((act) => roleForm.permissions.includes(`${modKey}:${act}`));
                  const someSelected = modActions.some((act) => roleForm.permissions.includes(`${modKey}:${act}`));

                  return (
                    <div
                      key={modKey}
                      style={{
                        padding: '10px 12px',
                        background: someSelected ? 'white' : 'var(--slate-50)',
                        border: '1px solid',
                        borderColor: someSelected ? 'var(--primary-subtle, #bfdbfe)' : 'var(--border-subtle, #e2e8f0)',
                        borderRadius: '8px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: 'var(--primary-subtle, #eff6ff)', color: 'var(--primary-blue, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Icon size={14} />
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: 'var(--slate-900)' }}>
                            {modDef.label || modKey}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleModuleAll(modKey, modActions)}
                          style={{
                            border: 'none',
                            background: 'none',
                            color: allSelected ? 'var(--primary-blue, #2563eb)' : 'var(--slate-500)',
                            fontSize: '0.6875rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          {allSelected ? 'Deselect Module' : 'Select All in Module'}
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px' }}>
                        {matchingActions.map((action) => {
                          const permKey = `${modKey}:${action}`;
                          const isChecked = roleForm.permissions.includes(permKey);
                          const actionLabel = modDef.actionLabels?.[action] || action;

                          return (
                            <label
                              key={permKey}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontSize: '0.75rem',
                                padding: '5px 8px',
                                background: isChecked ? 'var(--primary-subtle, #eff6ff)' : 'white',
                                border: '1px solid',
                                borderColor: isChecked ? 'var(--primary-blue, #2563eb)' : '#cbd5e1',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                color: isChecked ? 'var(--primary-blue, #1d4ed8)' : 'var(--slate-700)',
                                fontWeight: isChecked ? 600 : 400,
                                userSelect: 'none',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleTogglePermission(permKey)}
                                style={{ margin: 0 }}
                              />
                              <span>{actionLabel}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRoleModalOpen(false)}
                disabled={isSavingRole}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSavingRole}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {isSavingRole && <Loader2 size={14} className="animate-spin" />}
                <span>{editingRole ? 'Save Changes' : 'Create & Save Role'}</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Inspect Role Permissions Modal */}
      {inspectRole && (
        <Modal
          isOpen={!!inspectRole}
          onClose={() => setInspectRole(null)}
          title={`Role Details: ${inspectRole.name}`}
          size="md"
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
            </div>
          </div>

          <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--slate-800)' }}>
              Assigned Permissions ({(inspectRole.permissions || []).length}):
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {(inspectRole.permissions || []).map((perm) => (
                <span
                  key={perm}
                  style={{
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    background: 'var(--slate-100)',
                    color: 'var(--slate-800)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {perm}
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={() => setInspectRole(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default SuperAdminRolesPage;
