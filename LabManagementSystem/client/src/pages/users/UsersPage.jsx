/**
 * Lab Management System (LMS) - Dynamic Users & Role-Based Access Control Builder
 * 
 * Implements:
 * 1. Laboratory Staff roster with dynamic role assignment.
 * 2. Database-backed Role & Permission Builder with granular module permission matrix.
 * 3. Navigation item and default landing dashboard configuration per role.
 * 4. Safe role creation, editing, and deactivation scoped strictly to the authenticated tenant.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  UserCheck,
  UserPlus,
  Key,
  Lock,
  Eye,
  PlusCircle,
  Edit2,
  Check,
  X,
  AlertTriangle,
  Loader2,
  Settings,
  LayoutDashboard,
  Navigation,
  FileCheck,
  Users as UsersIcon,
  Sparkles,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatusBanner from '../../components/common/StatusBanner';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import roleService from '../../services/roleService';

export function UsersPage() {
  const { tenant: authTenant, isSuperAdmin } = useAuth();
  const tenantId = authTenant?.tenantId || contextTenant?.tenantId || null;

  // Navigation tab: 'users' | 'roles'
  const [activeTab, setActiveTab] = useState('users');

  // Data states
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [matrixData, setMatrixData] = useState({ modules: {}, navigationItems: [] });
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  // Modals state
  const [selectedUser, setSelectedUser] = useState(null);
  const [roleAssignModalUser, setRoleAssignModalUser] = useState(null);
  const [selectedAssignRoleId, setSelectedAssignRoleId] = useState('');
  const [isAssigningRole, setIsAssigningRole] = useState(false);

  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    fullName: '',
    email: '',
    password: '',
    department: '',
    phone: '',
    role: 'lab_technician',
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Role Builder Modal
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

  // Load Matrix, Roles, and Users
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorBanner(null);
    try {
      const [matrixRes, rolesRes, usersRes] = await Promise.all([
        roleService.getPermissionsMatrix(tenantId).catch(() => ({ modules: {}, navigationItems: [] })),
        roleService.listRoles(tenantId).catch(() => []),
        roleService.listUsers(tenantId).catch(() => []),
      ]);

      setMatrixData(matrixRes);
      setRoles(rolesRes || []);
      setUsers(usersRes || []);
    } catch (err) {
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to load laboratory RBAC configuration.');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle open Role Builder Modal
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

  // Toggle all permissions for a module
  const handleToggleModuleAll = (moduleKey, actions = []) => {
    const modulePerms = actions.map((a) => `${moduleKey}:${a}`);
    const allSelected = modulePerms.every((p) => roleForm.permissions.includes(p));

    setRoleForm((prev) => {
      let nextPerms;
      if (allSelected) {
        // Deselect all
        nextPerms = prev.permissions.filter((p) => !modulePerms.includes(p));
      } else {
        // Select all
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

  // Save Role (Create or Update)
  const handleSaveRole = async (e) => {
    e.preventDefault();
    setIsSavingRole(true);
    setErrorBanner(null);
    try {
      if (editingRole) {
        await roleService.updateRole(tenantId, editingRole.roleId, roleForm);
        setSuccessBanner(`Role '${roleForm.name}' updated successfully.`);
      } else {
        await roleService.createRole(tenantId, roleForm);
        setSuccessBanner(`Custom role '${roleForm.name}' created successfully.`);
      }
      setRoleModalOpen(false);
      await loadData();
    } catch (err) {
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to save role.');
    } finally {
      setIsSavingRole(false);
    }
  };

  // Toggle Role Active Status
  const handleToggleRoleStatus = async (role) => {
    if (role.code === 'lab_admin' && role.isActive) {
      alert('The primary Laboratory Administrator role cannot be deactivated.');
      return;
    }
    const newStatus = !role.isActive;
    try {
      await roleService.updateRoleStatus(tenantId, role.roleId, newStatus);
      setSuccessBanner(`Role '${role.name}' ${newStatus ? 'activated' : 'deactivated'} successfully.`);
      await loadData();
    } catch (err) {
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to update role status.');
    }
  };

  // Create Staff User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setIsCreatingUser(true);
    setErrorBanner(null);
    try {
      await roleService.createUser(tenantId, newUserForm);
      setSuccessBanner(`Staff user '${newUserForm.fullName}' created successfully.`);
      setCreateUserModalOpen(false);
      setNewUserForm({
        fullName: '',
        email: '',
        password: '',
        department: '',
        phone: '',
        role: 'lab_technician',
      });
      await loadData();
    } catch (err) {
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to create staff member.');
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Assign Role to User
  const handleAssignRole = async (e) => {
    e.preventDefault();
    if (!roleAssignModalUser || !selectedAssignRoleId) return;
    setIsAssigningRole(true);
    setErrorBanner(null);
    try {
      await roleService.assignUserRole(tenantId, roleAssignModalUser.userId, selectedAssignRoleId);
      setSuccessBanner(`Assigned role to '${roleAssignModalUser.fullName}'.`);
      setRoleAssignModalUser(null);
      await loadData();
    } catch (err) {
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to assign role.');
    } finally {
      setIsAssigningRole(false);
    }
  };

  // Toggle User Active Status
  const handleToggleUserStatus = async (user) => {
    const nextStatus = !user.isActive;
    try {
      await roleService.updateUserStatus(tenantId, user.userId, nextStatus);
      setSuccessBanner(`User '${user.fullName}' ${nextStatus ? 'activated' : 'deactivated'} successfully.`);
      await loadData();
    } catch (err) {
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to update user status.');
    }
  };

  return (
    <>
      <PageHeader
        title="Laboratory Personnel, Roles & Access Control"
        description="Dynamic tenant role builder, custom permission matrices, and departmental staff identity management."
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => handleOpenRoleModal(null)}>
              <Key size={15} />
              <span>Create Custom Role</span>
            </button>
            <button className="btn btn-primary" onClick={() => setCreateUserModalOpen(true)}>
              <UserPlus size={15} />
              <span>Add Staff Member</span>
            </button>
          </div>
        }
      />

      {/* Success / Error Alerts */}
      {errorBanner && (
        <div
          style={{
            background: 'var(--danger-50)',
            border: '1px solid var(--danger-200)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.8125rem',
            color: 'var(--danger-700)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: 'var(--danger-600)' }} />
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger-500)' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {successBanner && (
        <div
          style={{
            background: 'var(--mint-bg)',
            border: '1px solid var(--mint-200)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem 1rem',
            marginBottom: '1rem',
            fontSize: '0.8125rem',
            color: 'var(--mint-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={16} />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mint-text)' }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: '1.25rem',
          paddingBottom: '2px',
        }}
      >
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '8px 16px',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            background: 'none',
            color: activeTab === 'users' ? 'var(--primary-blue)' : 'var(--slate-500)',
            borderBottom: activeTab === 'users' ? '2px solid var(--primary-blue)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <UsersIcon size={16} />
          <span>Laboratory Staff ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('roles')}
          style={{
            padding: '8px 16px',
            fontSize: '0.875rem',
            fontWeight: 600,
            border: 'none',
            background: 'none',
            color: activeTab === 'roles' ? 'var(--primary-blue)' : 'var(--slate-500)',
            borderBottom: activeTab === 'roles' ? '2px solid var(--primary-blue)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Key size={16} />
          <span>Role & Permission Builder ({roles.length})</span>
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--slate-500)' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary-blue)' }} />
          <p style={{ fontSize: '0.875rem' }}>Loading access control configuration...</p>
        </div>
      ) : activeTab === 'users' ? (
        /* TAB 1: LABORATORY STAFF */
        <div className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Active Laboratory Personnel</h2>
              <p className="card-subtitle">Staff accounts authenticated strictly within this tenant database.</p>
            </div>
            <span className="badge badge-teal">{users.length} Registered Accounts</span>
          </div>

          <div className="table-container">
            <table className="lms-table">
              <thead>
                <tr>
                  <th>Staff ID</th>
                  <th>Name & Contact</th>
                  <th>Assigned Role</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--slate-400)' }}>
                      No staff accounts found in this laboratory. Click "Add Staff Member" to provision an account.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => {
                    const matchedRole = roles.find((r) => r.code === u.role || r.roleId === u.roleId);
                    return (
                      <tr key={u.userId || u.id}>
                        <td>
                          <strong style={{ fontFamily: 'monospace', color: 'var(--primary-700)' }}>
                            {u.userId || u.id}
                          </strong>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: 'var(--slate-900)' }}>{u.fullName}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{u.email}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Badge variant={u.role === 'lab_admin' ? 'blue' : 'purple'}>
                              {matchedRole?.name || u.role}
                            </Badge>
                            {matchedRole?.isSystemDefault && (
                              <span style={{ fontSize: '0.6875rem', color: 'var(--slate-400)' }}>(default)</span>
                            )}
                          </div>
                        </td>
                        <td>{u.department || 'General Diagnostic'}</td>
                        <td>
                          <Badge variant={u.isActive ? 'success' : 'slate'}>
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </Badge>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setRoleAssignModalUser(u);
                                setSelectedAssignRoleId(matchedRole?.code || u.role);
                              }}
                              title="Assign custom role"
                            >
                              <Key size={13} />
                              <span>Role</span>
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelectedUser(u)}
                              title="Inspect profile"
                            >
                              <Eye size={13} />
                            </button>
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ color: u.isActive ? 'var(--danger-600)' : 'var(--mint-text)' }}
                              onClick={() => handleToggleUserStatus(u)}
                            >
                              {u.isActive ? 'Deactivate' : 'Activate'}
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
      ) : (
        /* TAB 2: ROLE & PERMISSION BUILDER */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Role Cards Grid */}
          <div className="card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Configured Laboratory Roles</h2>
                <p className="card-subtitle">
                  Define custom roles with landing dashboards, accessible navigation modules, and granular permissions.
                </p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => handleOpenRoleModal(null)}>
                <PlusCircle size={15} />
                <span>New Custom Role</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem', padding: '0.5rem 0' }}>
              {roles.map((r) => (
                <div
                  key={r.roleId || r.code}
                  style={{
                    background: 'white',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '1.25rem',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '0.5rem' }}>
                      <div>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--slate-900)' }}>{r.name}</h3>
                        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--slate-500)' }}>
                          code: {r.code}
                        </span>
                      </div>
                      <Badge variant={r.isActive ? (r.isSystemDefault ? 'blue' : 'teal') : 'slate'}>
                        {r.isActive ? (r.isSystemDefault ? 'System Default' : 'Custom Role') : 'Inactive'}
                      </Badge>
                    </div>

                    <p style={{ fontSize: '0.8125rem', color: 'var(--slate-600)', lineHeight: 1.4, marginBottom: '0.85rem' }}>
                      {r.description || 'No description provided.'}
                    </p>

                    <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '1rem' }}>
                      <div>
                        <strong>Landing Dashboard:</strong> <span style={{ color: 'var(--primary-blue)', fontFamily: 'monospace' }}>{r.dashboardPath || '/dashboard'}</span>
                      </div>
                      <div>
                        <strong>Granted Permissions:</strong> <Badge variant="teal">{r.permissions?.length || 0} Actions</Badge>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                        {(r.navigationItems || []).map((nav) => (
                          <span
                            key={nav}
                            style={{
                              background: 'var(--slate-100)',
                              fontSize: '0.6875rem',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              color: 'var(--slate-700)',
                            }}
                          >
                            {nav}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--slate-100)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenRoleModal(r)}
                    >
                      <Edit2 size={13} />
                      <span>Edit Permissions</span>
                    </button>
                    {r.code !== 'lab_admin' && (
                      <button
                        className="btn btn-secondary btn-sm"
                        style={{ color: r.isActive ? 'var(--danger-600)' : 'var(--mint-text)' }}
                        onClick={() => handleToggleRoleStatus(r)}
                      >
                        {r.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Role & Permission Builder */}
      <Modal
        isOpen={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title={editingRole ? `Configure Role: ${editingRole.name}` : 'Create Dynamic Laboratory Role'}
        size="lg"
      >
        <form onSubmit={handleSaveRole}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Identity & Basic Info */}
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="role-name">
                  Role Display Name *
                </label>
                <input
                  id="role-name"
                  type="text"
                  className="form-input"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
                  placeholder="e.g. Senior Pathologist"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="role-code">
                  Unique Code Identifier *
                </label>
                <input
                  id="role-code"
                  type="text"
                  className="form-input"
                  value={roleForm.code}
                  onChange={(e) => setRoleForm({ ...roleForm, code: e.target.value })}
                  placeholder="e.g. senior_pathologist"
                  disabled={!!editingRole?.isSystemDefault}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="role-desc">
                Role Description
              </label>
              <textarea
                id="role-desc"
                className="form-input"
                rows={2}
                value={roleForm.description}
                onChange={(e) => setRoleForm({ ...roleForm, description: e.target.value })}
                placeholder="Describe responsibilities, clinical authority, and access level..."
              />
            </div>

            {/* Dashboard Landing Path & Navigation Items */}
            <div
              style={{
                background: 'var(--slate-50)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--slate-900)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Navigation size={16} style={{ color: 'var(--primary-blue)' }} />
                <span>Navigation & Landing Configuration</span>
              </h4>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" htmlFor="landing-path">
                  Default Landing Dashboard
                </label>
                <select
                  id="landing-path"
                  className="form-input"
                  value={roleForm.dashboardPath}
                  onChange={(e) => setRoleForm({ ...roleForm, dashboardPath: e.target.value })}
                >
                  <option value="/dashboard">Main Dashboard (/dashboard)</option>
                  <option value="/patients">Patients Directory (/patients)</option>
                  <option value="/orders">Order Requisitions (/orders)</option>
                  <option value="/samples">Specimen Tracking (/samples)</option>
                  <option value="/reports">Pathology Reports (/reports)</option>
                  <option value="/billing">Patient Billing (/billing)</option>
                  <option value="/users">Users & Roles (/users)</option>
                  <option value="/settings">Laboratory Settings (/settings)</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ marginBottom: '0.5rem' }}>
                  Visible Sidebar Navigation Items
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '8px' }}>
                  {(matrixData.navigationItems || []).map((nav) => (
                    <label
                      key={nav.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        background: 'white',
                        borderRadius: '4px',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={roleForm.navigationItems.includes(nav.key)}
                        onChange={() => handleToggleNavItem(nav.key)}
                      />
                      <span>{nav.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Granular Permission Matrix */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--slate-900)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileCheck size={18} style={{ color: 'var(--primary-blue)' }} />
                  <span>Module Permission Matrix</span>
                </h4>
                <span className="badge badge-teal">{roleForm.permissions.length} Actions Granted</span>
              </div>

              <div
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  overflowX: 'auto',
                }}
              >
                <table className="lms-table" style={{ fontSize: '0.8125rem' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '220px' }}>Module Workflow</th>
                      <th>Applicable Permissions & Actions</th>
                      <th style={{ width: '100px', textAlign: 'right' }}>Select All</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(matrixData.modules || {}).map(([moduleKey, modDef]) => {
                      const allSelected = (modDef.actions || []).every((act) =>
                        roleForm.permissions.includes(`${moduleKey}:${act}`)
                      );

                      return (
                        <tr key={moduleKey}>
                          <td>
                            <strong>{modDef.label}</strong>
                            <div style={{ fontSize: '0.6875rem', color: 'var(--slate-500)', fontFamily: 'monospace' }}>
                              {moduleKey}:*
                            </div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              {(modDef.actions || []).map((act) => {
                                const permKey = `${moduleKey}:${act}`;
                                const isChecked = roleForm.permissions.includes(permKey);
                                return (
                                  <label
                                    key={permKey}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      background: isChecked ? 'var(--mint-bg)' : 'var(--slate-50)',
                                      border: `1px solid ${isChecked ? 'var(--mint-200)' : 'var(--border-subtle)'}`,
                                      borderRadius: '4px',
                                      padding: '3px 8px',
                                      cursor: 'pointer',
                                      fontSize: '0.75rem',
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleTogglePermission(permKey)}
                                    />
                                    <span style={{ color: isChecked ? 'var(--mint-text)' : 'var(--slate-700)', fontWeight: isChecked ? 600 : 400 }}>
                                      {modDef.actionLabels?.[act] || act}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 8px', fontSize: '0.6875rem' }}
                              onClick={() => handleToggleModuleAll(moduleKey, modDef.actions)}
                            >
                              {allSelected ? 'Clear' : 'All'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRoleModalOpen(false)}
                disabled={isSavingRole}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSavingRole}>
                {isSavingRole ? <Loader2 size={16} className="animate-spin" /> : null}
                <span>{editingRole ? 'Update Role' : 'Create Role'}</span>
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Create Staff User */}
      <Modal
        isOpen={createUserModalOpen}
        onClose={() => setCreateUserModalOpen(false)}
        title="Add Laboratory Staff Member"
      >
        <form onSubmit={handleCreateUser}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="new-fullname">
                Full Name *
              </label>
              <input
                id="new-fullname"
                type="text"
                className="form-input"
                value={newUserForm.fullName}
                onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                placeholder="e.g. Dr. Arthur Conan, MD"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new-email">
                Staff Email Address *
              </label>
              <input
                id="new-email"
                type="email"
                className="form-input"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                placeholder="staff@laboratory.org"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new-password">
                Temporary Password *
              </label>
              <input
                id="new-password"
                type="password"
                className="form-input"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                placeholder="Minimum 8 characters with numbers & uppercase"
                required
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="new-dept">
                  Department
                </label>
                <input
                  id="new-dept"
                  type="text"
                  className="form-input"
                  value={newUserForm.department}
                  onChange={(e) => setNewUserForm({ ...newUserForm, department: e.target.value })}
                  placeholder="e.g. Hematology"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="new-phone">
                  Phone
                </label>
                <input
                  id="new-phone"
                  type="text"
                  className="form-input"
                  value={newUserForm.phone}
                  onChange={(e) => setNewUserForm({ ...newUserForm, phone: e.target.value })}
                  placeholder="e.g. +1 555-0192"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new-role">
                Assigned Laboratory Role *
              </label>
              <select
                id="new-role"
                className="form-input"
                value={newUserForm.role}
                onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                required
              >
                {roles
                  .filter((r) => r.isActive)
                  .map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name} ({r.code})
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCreateUserModalOpen(false)}
                disabled={isCreatingUser}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isCreatingUser}>
                {isCreatingUser ? <Loader2 size={16} className="animate-spin" /> : null}
                <span>Create Staff User</span>
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: Assign Role to Existing User */}
      <Modal
        isOpen={!!roleAssignModalUser}
        onClose={() => setRoleAssignModalUser(null)}
        title={roleAssignModalUser ? `Assign Role: ${roleAssignModalUser.fullName}` : ''}
      >
        <form onSubmit={handleAssignRole}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)' }}>
              Select a standard or custom laboratory role to assign to{' '}
              <strong>{roleAssignModalUser?.fullName}</strong> ({roleAssignModalUser?.email}).
            </p>

            <div className="form-group">
              <label className="form-label" htmlFor="assign-role-select">
                Select Laboratory Role
              </label>
              <select
                id="assign-role-select"
                className="form-input"
                value={selectedAssignRoleId}
                onChange={(e) => setSelectedAssignRoleId(e.target.value)}
                required
              >
                {roles
                  .filter((r) => r.isActive)
                  .map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.name} — {r.permissions?.length || 0} permissions
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRoleAssignModalUser(null)}
                disabled={isAssigningRole}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isAssigningRole}>
                {isAssigningRole ? <Loader2 size={16} className="animate-spin" /> : null}
                <span>Confirm Role Assignment</span>
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: User Detail Inspector */}
      <Modal
        isOpen={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        title={selectedUser ? `Staff Profile: ${selectedUser.fullName}` : ''}
        footer={
          <button className="btn btn-secondary" onClick={() => setSelectedUser(null)}>
            Close
          </button>
        }
      >
        {selectedUser && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div className="grid-2">
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Staff ID</p>
                <p style={{ fontWeight: 600, fontFamily: 'monospace' }}>{selectedUser.userId}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Email Address</p>
                <p style={{ fontWeight: 600 }}>{selectedUser.email}</p>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Assigned Role</p>
                <Badge variant="purple">{selectedUser.role}</Badge>
              </div>
              <div>
                <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>Department</p>
                <p>{selectedUser.department || 'Diagnostic Operations'}</p>
              </div>
            </div>

            <div>
              <p style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '4px' }}>Tenant Isolation Identity</p>
              <p style={{ fontFamily: 'monospace', color: 'var(--primary-blue)', fontSize: '0.8125rem' }}>
                Bound to Database: lms_lab_{selectedUser.tenantId}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default UsersPage;
