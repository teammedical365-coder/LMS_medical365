/**
 * Lab Management System (LMS) - Platform Super Admin Roles & Permission Builder
 * 
 * Centralized governance of laboratory roles:
 * - Only Super Admin can define, configure, and manage system and custom roles.
 * - Granular module permission matrix with Select All / Clear All controls.
 * - Automatically propagates new or updated roles across all tenant databases.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import superAdminService from '../../services/superAdminService';

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
        navigationItems: ['dashboard', 'samples', 'reports'],
        permissions: ['patients:view', 'orders:view', 'samples:view', 'reports:view'],
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

  // Master Select All / Clear All Permissions
  const handleSelectAllPermissions = () => {
    const all = [];
    Object.entries(matrixData.modules || {}).forEach(([mod, def]) => {
      (def.actions || []).forEach((act) => all.push(`${mod}:${act}`));
    });
    setRoleForm((prev) => ({ ...prev, permissions: all }));
  };

  const handleClearAllPermissions = () => {
    setRoleForm((prev) => ({ ...prev, permissions: [] }));
  };

  const handleSelectAllNavItems = () => {
    const all = (matrixData.navigationItems || []).map((n) => n.key);
    setRoleForm((prev) => ({ ...prev, navigationItems: all }));
  };

  // Save Role (Create or Update)
  const handleSaveRole = async (e) => {
    e.preventDefault();
    setIsSavingRole(true);
    setErrorBanner(null);
    try {
      if (editingRole) {
        await superAdminService.updateRole(editingRole.roleId, roleForm);
        setSuccessBanner(`Master role '${roleForm.name}' updated and synced across all laboratory tenants.`);
      } else {
        await superAdminService.createRole(roleForm);
        setSuccessBanner(`New master role '${roleForm.name}' created and propagated to all laboratory tenants.`);
      }
      setRoleModalOpen(false);
      await loadData();
    } catch (err) {
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to save master role.');
    } finally {
      setIsSavingRole(false);
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (role) => {
    if (role.code === 'lab_admin' && role.isActive) {
      alert('The primary Laboratory Administrator role cannot be deactivated.');
      return;
    }
    const newStatus = !role.isActive;
    try {
      await superAdminService.updateRoleStatus(role.roleId, newStatus);
      setSuccessBanner(`Role '${role.name}' ${newStatus ? 'activated' : 'deactivated'} across all laboratories.`);
      await loadData();
    } catch (err) {
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to update role status.');
    }
  };

  // Delete Custom Role
  const handleDeleteRole = async (role) => {
    if (role.code === 'lab_admin') {
      alert('The primary Laboratory Administrator role cannot be deleted.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the platform role "${role.name}" (${role.code})? It will be removed from all laboratory databases.`)) {
      return;
    }
    try {
      await superAdminService.deleteRole(role.roleId);
      setSuccessBanner(`Role "${role.name}" deleted successfully across the platform.`);
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
  const filteredRoles = roles.filter((r) => {
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

  const systemDefaultCount = roles.filter((r) => r.isSystemDefault).length;
  const customRoleCount = roles.filter((r) => !r.isSystemDefault).length;

  return (
    <>
      <PageHeader
        title="Platform Role & Access Control Governance"
        description="Configure master laboratory roles, permission matrices, and landing workspaces. Changes propagate automatically to all laboratory tenants."
        actions={
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={handleForceSync}
              disabled={isSyncing}
              className="btn btn-secondary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Force sync all roles to all tenant databases"
            >
              <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
              <span>{isSyncing ? 'Syncing...' : 'Sync to All Labs'}</span>
            </button>
            <button
              onClick={() => handleOpenRoleModal(null)}
              className="btn btn-primary btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <PlusCircle size={14} />
              <span>Create New Master Role</span>
            </button>
          </div>
        }
      />

      {/* Security Context Banner */}
      <StatusBanner
        type="info"
        badgeText="Super Admin Exclusivity"
        message="Role creation and permission governance is strictly restricted to Platform Super Admin. Laboratory Administrators select pre-configured roles from a dropdown when creating staff members."
      />

      {/* Error / Success Banners */}
      {errorBanner && (
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b' }}>
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
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={16} />
            <span style={{ fontSize: '0.875rem' }}>{successBanner}</span>
          </div>
          <button onClick={() => setSuccessBanner(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#166534' }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'var(--primary-50)', color: 'var(--primary-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--slate-900)' }}>{roles.length}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>Total Master Roles</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Key size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--slate-900)' }}>{systemDefaultCount}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>Standard Clinical Roles</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--slate-900)' }}>{customRoleCount}</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>Custom Platform Roles</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--slate-900)' }}>All Tenants</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>Auto-Sync Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
            <input
              type="text"
              placeholder="Search by role name, code, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-control"
              style={{ paddingLeft: '36px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginRight: '4px' }}>Status:</span>
            {['ALL', 'ACTIVE', 'INACTIVE'].map((opt) => (
              <button
                key={opt}
                onClick={() => setFilterActive(opt)}
                className={`btn btn-sm ${filterActive === opt ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.75rem', padding: '4px 10px' }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Master Roles List Table */}
      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 className="card-title">Platform Master Role Registry ({filteredRoles.length})</h2>
            <p className="card-subtitle">These roles populate the role assignment dropdown on laboratory dashboards.</p>
          </div>
          <span className="badge badge-teal">Multi-Tenant Global Catalog</span>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--slate-500)' }}>
            <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary-blue)' }} />
            <p style={{ fontSize: '0.875rem' }}>Loading platform roles...</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Role Name & Code</th>
                  <th>Description</th>
                  <th>Landing View</th>
                  <th>Navigation Modules</th>
                  <th>Permissions</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--slate-400)' }}>
                      No roles matching search query. Click "Create New Master Role" to create one.
                    </td>
                  </tr>
                ) : (
                  filteredRoles.map((role) => (
                    <tr key={role.roleId || role.code}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{role.name}</span>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--primary-700)' }}>
                            {role.code}
                          </span>
                        </div>
                      </td>
                      <td style={{ maxWidth: '240px', fontSize: '0.8125rem', color: 'var(--slate-600)' }}>
                        {role.description || 'No description provided.'}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', background: 'var(--slate-100)', padding: '2px 6px', borderRadius: '4px' }}>
                          {role.dashboardPath || '/dashboard'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '180px' }}>
                          {(role.navigationItems || []).slice(0, 3).map((item) => (
                            <span
                              key={item}
                              style={{
                                fontSize: '0.6875rem',
                                padding: '1px 6px',
                                background: 'var(--slate-100)',
                                color: 'var(--slate-700)',
                                borderRadius: '4px',
                              }}
                            >
                              {item}
                            </span>
                          ))}
                          {(role.navigationItems || []).length > 3 && (
                            <span style={{ fontSize: '0.6875rem', color: 'var(--slate-500)' }}>
                              +{(role.navigationItems || []).length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => setInspectRole(role)}
                          className="badge badge-purple"
                          style={{ cursor: 'pointer', border: 'none' }}
                          title="Click to view all granted permissions"
                        >
                          {(role.permissions || []).length} Granted
                        </button>
                      </td>
                      <td>
                        <button
                          onClick={() => handleToggleStatus(role)}
                          disabled={role.code === 'lab_admin'}
                          className={`badge ${role.isActive ? 'badge-success' : 'badge-slate'}`}
                          style={{
                            cursor: role.code === 'lab_admin' ? 'not-allowed' : 'pointer',
                            border: 'none',
                          }}
                          title={role.code === 'lab_admin' ? 'Primary admin cannot be deactivated' : 'Click to toggle status'}
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
                          >
                            <Edit2 size={13} />
                            <span>Edit</span>
                          </button>
                          {!role.isSystemDefault && role.code !== 'lab_admin' && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDeleteRole(role)}
                              title="Delete custom role"
                              style={{ padding: '4px 8px' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
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
          title={editingRole ? `Edit Platform Role: ${editingRole.name}` : 'Create New Master Laboratory Role'}
          size="lg"
        >
          <form onSubmit={handleSaveRole}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label className="form-label" style={{ fontWeight: 600 }}>Role Display Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Consultant Pathologist"
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
                <label className="form-label" style={{ fontWeight: 600 }}>Role Code (Machine Identifier) *</label>
                <input
                  type="text"
                  required
                  disabled={!!editingRole}
                  placeholder="e.g., consultant_pathologist"
                  value={roleForm.code}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') }))}
                  className="form-control"
                  style={{ fontFamily: 'monospace' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                  Alphanumeric & underscore only. Permanent identifier used in codebase and RBAC checks.
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="form-label" style={{ fontWeight: 600 }}>Description</label>
              <textarea
                rows={2}
                placeholder="Operational purpose, responsibilities, and access boundaries of this role..."
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
                  <option value="/dashboard">Main Laboratory Dashboard (/dashboard)</option>
                  <option value="/reports">Diagnostic Reports / Pathologist Review (/reports)</option>
                  <option value="/samples">Specimen Bench & Processing (/samples)</option>
                  <option value="/patients">Patient Accessioning & Registry (/patients)</option>
                  <option value="/orders">Requisition Orders (/orders)</option>
                  <option value="/billing">Billing & Reimbursement (/billing)</option>
                  <option value="/users">Staff Directory (/users)</option>
                  <option value="/settings">Laboratory Settings (/settings)</option>
                </select>
                <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                  Where staff assigned to this role land immediately upon logging in.
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
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '100px', overflowY: 'auto', padding: '6px', border: '1px solid var(--border-subtle)', borderRadius: '6px' }}>
                  {(matrixData.navigationItems || []).map((nav) => {
                    const isChecked = roleForm.navigationItems.includes(nav.key);
                    return (
                      <label
                        key={nav.key}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.75rem',
                          padding: '3px 8px',
                          borderRadius: '4px',
                          background: isChecked ? 'var(--primary-50)' : 'var(--slate-100)',
                          color: isChecked ? 'var(--primary-blue)' : 'var(--slate-700)',
                          cursor: 'pointer',
                          userSelect: 'none',
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

            {/* Granular Permission Matrix */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: 0, color: 'var(--slate-900)' }}>
                    Granular Module Permissions ({roleForm.permissions.length} Selected)
                  </h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                    Controls clinical actions, test catalog modifications, and financial capabilities.
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={handleSelectAllPermissions}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Check size={12} />
                    <span>Select All Actions</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllPermissions}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#dc2626' }}
                  >
                    <X size={12} />
                    <span>Clear All</span>
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '360px', overflowY: 'auto', paddingRight: '4px' }}>
                {Object.entries(matrixData.modules || {}).map(([modKey, modDef]) => {
                  const modActions = modDef.actions || [];
                  const allSelected = modActions.every((act) => roleForm.permissions.includes(`${modKey}:${act}`));

                  return (
                    <div
                      key={modKey}
                      style={{
                        padding: '10px 12px',
                        background: 'var(--slate-50)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: 'var(--slate-900)' }}>
                          {modDef.label || modKey}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleToggleModuleAll(modKey, modActions)}
                          style={{
                            border: 'none',
                            background: 'none',
                            color: allSelected ? 'var(--primary-blue)' : 'var(--slate-500)',
                            fontSize: '0.6875rem',
                            cursor: 'pointer',
                            fontWeight: 600,
                          }}
                        >
                          {allSelected ? 'Deselect Module' : 'Select All Module'}
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px' }}>
                        {modActions.map((action) => {
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
                                padding: '4px 8px',
                                background: isChecked ? 'white' : 'transparent',
                                border: isChecked ? '1px solid var(--primary-200)' : '1px solid transparent',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                color: isChecked ? 'var(--primary-900)' : 'var(--slate-600)',
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
                <span>{editingRole ? 'Update & Sync to All Labs' : 'Create & Propagate to All Labs'}</span>
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
          title={`Granted Permissions: ${inspectRole.name}`}
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
    </>
  );
}

export default SuperAdminRolesPage;
