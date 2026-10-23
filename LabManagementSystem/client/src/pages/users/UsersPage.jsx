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
  Trash2,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import ConfirmModal from '../../components/common/ConfirmModal';
import notify from '../../utils/notify';
import { useAuth } from '../../context/AuthContext';
import { useTenant } from '../../context/TenantContext';
import roleService from '../../services/roleService';

export function UsersPage() {
  const { user, tenant: authTenant, isSuperAdmin } = useAuth();
  const { tenant: contextTenant } = useTenant();
  const tenantId = user?.tenantId || authTenant?.tenantId || contextTenant?.tenantId || null;

  // Navigation tab: 'users' | 'roles'
  const [activeTab, setActiveTab] = useState('users');

  // Data states
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [matrixData, setMatrixData] = useState({ modules: {}, navigationItems: [] });
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState(null);

  // Modals state
  const [selectedUser, setSelectedUser] = useState(null);
  const [roleAssignModalUser, setRoleAssignModalUser] = useState(null);
  const [selectedAssignRoleId, setSelectedAssignRoleId] = useState('');
  const [isAssigningRole, setIsAssigningRole] = useState(false);

  // Staff Account Deletion Modal state
  const [userToDelete, setUserToDelete] = useState(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState(null);

  const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    fullName: '',
    email: '',
    password: '',
    department: '',
    phone: '',
    role: '',
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Edit Staff Member Modal state
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({
    fullName: '',
    email: '',
    password: '',
    department: '',
    phone: '',
    role: '',
  });
  const [initialEditUserForm, setInitialEditUserForm] = useState({
    fullName: '',
    email: '',
    password: '',
    department: '',
    phone: '',
    role: '',
  });
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);

  // Helper to resolve standard/first active staff role (excludes lab_admin)
  const getAvailableStaffRole = useCallback((roleList = []) => {
    const active = roleList.filter((r) => r.isActive && r.code !== 'lab_admin');
    return active[0]?.code || '';
  }, []);

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
  const [roleToDelete, setRoleToDelete] = useState(null);
  const [isDeletingRole, setIsDeletingRole] = useState(false);

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

      const fetchedRoles = Array.isArray(rolesRes) ? rolesRes : [];
      setMatrixData(matrixRes);
      setRoles(fetchedRoles);
      setUsers(usersRes || []);

      setNewUserForm((prev) => ({
        ...prev,
        role: prev.role && fetchedRoles.some((r) => r.code === prev.role && r.isActive)
          ? prev.role
          : getAvailableStaffRole(fetchedRoles),
      }));
    } catch (err) {
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to load laboratory RBAC configuration.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, getAvailableStaffRole]);

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
        notify.success(`Role '${roleForm.name}' updated successfully.`);
      } else {
        await roleService.createRole(tenantId, roleForm);
        notify.success(`Custom role '${roleForm.name}' created successfully.`);
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
      notify.warning('The primary Laboratory Administrator role cannot be deactivated.');
      return;
    }
    const newStatus = !role.isActive;
    try {
      await roleService.updateRoleStatus(tenantId, role.roleId, newStatus);
      notify.success(`Role '${role.name}' ${newStatus ? 'activated' : 'deactivated'} successfully.`);
      await loadData();
    } catch (err) {
      notify.error(err, { fallback: 'Failed to update role status.' });
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to update role status.');
    }
  };

  // Delete Custom Role
  const handleDeleteRole = (role) => {
    if (role.code === 'lab_admin') {
      notify.warning('The primary Laboratory Administrator role cannot be deleted.');
      return;
    }
    setRoleToDelete(role);
  };

  const handleConfirmDeleteRole = async () => {
    if (!roleToDelete) return;
    try {
      setIsDeletingRole(true);
      await roleService.deleteRole(tenantId, roleToDelete.roleId);
      notify.success(`Role "${roleToDelete.name}" deleted successfully.`);
      setRoleToDelete(null);
      await loadData();
    } catch (err) {
      notify.error(err, { fallback: 'Failed to delete role.' });
      setErrorBanner(err.response?.data?.message || err.message || 'Failed to delete role.');
    } finally {
      setIsDeletingRole(false);
    }
  };

  // Master Permission Select / Clear All
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

  // Open Create Staff Modal with dynamic default role
  const handleOpenCreateUserModal = () => {
    setNewUserForm({
      fullName: '',
      email: '',
      password: '',
      department: '',
      phone: '',
      role: '',
    });
    setCreateUserModalOpen(true);
  };

  // Create Staff User
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setErrorBanner(null);

    if (!newUserForm.role) {
      notify.error('Please choose a laboratory role.');
      return;
    }

    if (!newUserForm.email || !newUserForm.email.trim()) {
      notify.error('Staff email address is required.');
      return;
    }

    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.com$/i.test(newUserForm.email.trim())) {
      notify.error('Staff email must be a valid email ending with .com (e.g. staff@laboratory.com).');
      return;
    }

    const cleanPhone = (newUserForm.phone || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10) {
      notify.error('Phone number is required and must be exactly 10 numeric digits.');
      return;
    }

    setIsCreatingUser(true);
    try {
      await roleService.createUser(tenantId, {
        ...newUserForm,
        phone: cleanPhone,
      });
      notify.success(`Staff user '${newUserForm.fullName}' created successfully.`);
      setCreateUserModalOpen(false);
      setNewUserForm({
        fullName: '',
        email: '',
        password: '',
        department: '',
        phone: '',
        role: '',
      });
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to create staff member.';
      notify.error(msg);
      setErrorBanner(msg);
    } finally {
      setIsCreatingUser(false);
    }
  };

  // Helper to detect if any field in the Edit Staff modal has been modified
  const isEditFormChanged = Boolean(
    editingUser && (
      (editUserForm.fullName || '').trim() !== (initialEditUserForm.fullName || '').trim() ||
      (editUserForm.email || '').trim().toLowerCase() !== (initialEditUserForm.email || '').trim().toLowerCase() ||
      (editUserForm.password || '').trim() !== '' ||
      (editUserForm.department || '').trim() !== (initialEditUserForm.department || '').trim() ||
      (editUserForm.phone || '').trim() !== (initialEditUserForm.phone || '').trim() ||
      editUserForm.role !== initialEditUserForm.role
    )
  );

  // Open Edit Staff Modal populated with target user data
  const handleOpenEditUserModal = (u) => {
    const matchedRole = roles.find((r) => r.code === u.role || r.roleId === u.roleId);
    const resolvedRole = matchedRole?.code || u.role || getAvailableStaffRole(roles);
    const initialData = {
      fullName: u.fullName || '',
      email: u.email || '',
      password: '',
      department: u.department || '',
      phone: u.phone ? String(u.phone).replace(/\D/g, '').slice(0, 10) : '',
      role: resolvedRole,
    };
    setEditingUser(u);
    setEditUserForm({ ...initialData });
    setInitialEditUserForm({ ...initialData });
    setEditUserModalOpen(true);
  };

  // Update Staff User
  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!editingUser || !isEditFormChanged) return;

    if (!editUserForm.fullName.trim()) {
      notify.error('Staff full name is required.');
      return;
    }

    if (!editUserForm.email || !editUserForm.email.trim()) {
      notify.error('Staff email address is required.');
      return;
    }

    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.com$/i.test(editUserForm.email.trim())) {
      notify.error('Staff email must be a valid email ending with .com (e.g. staff@laboratory.com).');
      return;
    }

    const cleanPhone = (editUserForm.phone || '').replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 10) {
      notify.error('Phone number is required and must be exactly 10 numeric digits.');
      return;
    }

    if (!editUserForm.role) {
      notify.error('Please assign a laboratory role.');
      return;
    }

    if (editUserForm.password && editUserForm.password.trim() && editUserForm.password.trim().length < 8) {
      notify.error('Password must be at least 8 characters long.');
      return;
    }

    setIsUpdatingUser(true);
    try {
      const payload = {
        fullName: editUserForm.fullName.trim(),
        email: editUserForm.email.trim().toLowerCase(),
        department: editUserForm.department.trim(),
        phone: cleanPhone,
        role: editUserForm.role,
      };
      if (editUserForm.password && editUserForm.password.trim()) {
        payload.password = editUserForm.password.trim();
      }

      await roleService.updateUser(tenantId, editingUser.userId || editingUser.id, payload);
      notify.success(`Staff user '${editUserForm.fullName}' updated successfully.`);
      setEditUserModalOpen(false);
      setEditingUser(null);
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update staff member.';
      notify.error(msg);
    } finally {
      setIsUpdatingUser(false);
    }
  };

  // Open Role Assignment Modal with resolved active role
  const handleOpenRoleAssignModal = (u) => {
    setRoleAssignModalUser(u);
    const activeRoles = roles.filter((r) => r.isActive);
    const matched = activeRoles.find((r) => r.code === u.role || r.roleId === u.roleId);
    const fallback = getAvailableStaffRole(activeRoles);
    setSelectedAssignRoleId(matched ? matched.code : fallback);
  };

  // Assign Role to User
  const handleAssignRole = async (e) => {
    e.preventDefault();
    if (!roleAssignModalUser || !selectedAssignRoleId) return;
    setIsAssigningRole(true);
    setErrorBanner(null);
    try {
      await roleService.assignUserRole(tenantId, roleAssignModalUser.userId, selectedAssignRoleId);
      notify.success(`Assigned role to '${roleAssignModalUser.fullName}'.`);
      setRoleAssignModalUser(null);
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to assign role.';
      notify.error(msg);
      setErrorBanner(msg);
    } finally {
      setIsAssigningRole(false);
    }
  };

  // Toggle User Active Status
  const handleToggleUserStatus = async (user) => {
    const nextStatus = !user.isActive;
    try {
      await roleService.updateUserStatus(tenantId, user.userId, nextStatus);
      notify.success(`User '${user.fullName}' ${nextStatus ? 'activated' : 'deactivated'} successfully.`);
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to update user status.';
      notify.error(msg);
      setErrorBanner(msg);
    }
  };

  // Open Delete Confirmation Modal
  const handleOpenDeleteModal = (targetUser) => {
    setErrorBanner(null);
    setDeleteModalError(null);
    if (targetUser.role === 'lab_admin' || targetUser.role === 'admin') {
      notify.warning('The primary Laboratory Administrator account cannot be deleted.');
      return;
    }
    setUserToDelete(targetUser);
  };

  // Confirm and Execute Safe Staff Account Deletion
  const handleConfirmDeleteUser = async () => {
    if (!userToDelete || isDeletingUser) return;
    setIsDeletingUser(true);
    setDeleteModalError(null);
    setErrorBanner(null);
    try {
      await roleService.deleteUser(tenantId, userToDelete.userId);
      notify.success(`Staff account '${userToDelete.fullName}' (${userToDelete.email}) was deleted successfully.`);
      setUserToDelete(null);
      await loadData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to delete staff account.';
      setDeleteModalError(msg);
      notify.error(msg);
      setErrorBanner(msg);
    } finally {
      setIsDeletingUser(false);
    }
  };

  return (
    <>
      <PageHeader
        title={isSuperAdmin ? "Laboratory Personnel, Roles & Access Control" : "Laboratory Personnel Directory"}
        description={
          isSuperAdmin
            ? "Dynamic tenant role builder, custom permission matrices, and departmental staff identity management."
            : "Manage laboratory team members, assign pre-configured roles governed by Super Admin, and monitor departmental accounts."
        }
        actions={
          <div style={{ display: 'flex', gap: '8px' }}>
            {isSuperAdmin && (
              <button className="btn btn-secondary" onClick={() => handleOpenRoleModal(null)}>
                <Key size={15} />
                <span>Create Custom Role</span>
              </button>
            )}
            <button className="btn btn-primary" onClick={handleOpenCreateUserModal}>
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


      {/* Tabs (Only visible if viewing as Super Admin) */}
      {isSuperAdmin && (
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
      )}

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
                  <th style={{ textAlign: 'right', minWidth: '220px' }}>Actions</th>
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
                          </div>
                        </td>
                        <td>{u.department || 'General Diagnostic'}</td>
                        <td>
                          <Badge variant={u.isActive ? 'success' : 'slate'}>
                            {u.isActive ? 'Active' : 'Deactivated'}
                          </Badge>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {u.role === 'lab_admin' || u.role === 'admin' || matchedRole?.code === 'lab_admin' ? (
                            <span style={{ color: 'var(--slate-400)', fontSize: '0.8125rem' }}>—</span>
                          ) : (
                            <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleOpenEditUserModal(u)}
                                title="Edit staff member"
                              >
                                <Edit2 size={13} />
                                <span>Edit</span>
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ color: u.isActive ? 'var(--danger-600)' : 'var(--mint-text)' }}
                                onClick={() => handleToggleUserStatus(u)}
                                title={u.isActive ? 'Deactivate staff account' : 'Activate staff account'}
                              >
                                {u.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                              <button
                                className="btn btn-danger btn-sm"
                                style={{
                                  background: 'var(--danger-600, #dc2626)',
                                  color: '#ffffff',
                                  border: '1px solid var(--danger-700, #b91c1c)',
                                }}
                                onClick={() => handleOpenDeleteModal(u)}
                                title={`Delete staff account ${u.fullName}`}
                              >
                                <Trash2 size={13} />
                                <span>Delete</span>
                              </button>
                            </div>
                          )}
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

                  <div style={{ borderTop: '1px solid var(--slate-100)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleOpenRoleModal(r)}
                    >
                      <Edit2 size={13} />
                      <span>Edit Role & Permissions</span>
                    </button>
                    {r.code !== 'lab_admin' && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: r.isActive ? 'var(--warning-700, #b45309)' : 'var(--mint-text)' }}
                          onClick={() => handleToggleRoleStatus(r)}
                          title={r.isActive ? 'Deactivate role' : 'Activate role'}
                        >
                          {r.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ color: 'var(--danger-600)' }}
                          onClick={() => handleDeleteRole(r)}
                          title="Delete custom role"
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      </div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '6px' }}>
                  <label className="form-label" style={{ margin: 0 }}>
                    Visible Sidebar Navigation Items
                  </label>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                    onClick={handleSelectAllNavItems}
                  >
                    Select All Modules
                  </button>
                </div>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '8px' }}>
                <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--slate-900)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileCheck size={18} style={{ color: 'var(--primary-blue)' }} />
                  <span>Module Permission Matrix</span>
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                    onClick={handleSelectAllPermissions}
                  >
                    Select All Actions
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                    onClick={handleClearAllPermissions}
                  >
                    Clear All
                  </button>
                  <span className="badge badge-teal">{roleForm.permissions.length} Actions Granted</span>
                </div>
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
                  Phone *
                </label>
                <input
                  id="new-phone"
                  type="tel"
                  className="form-input"
                  value={newUserForm.phone}
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setNewUserForm({ ...newUserForm, phone: digits });
                  }}
                  required
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
                {roles.filter((r) => r.isActive && r.code !== 'lab_admin').length === 0 ? (
                  <option value="" disabled>No roles created yet. Please define roles in Super Admin first.</option>
                ) : (
                  <>
                    <option value="" disabled>Choose Role</option>
                    {roles
                      .filter((r) => r.isActive && r.code !== 'lab_admin')
                      .map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.name} ({r.code})
                        </option>
                      ))}
                  </>
                )}
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

      {/* MODAL: Edit Staff User */}
      <Modal
        isOpen={editUserModalOpen}
        onClose={() => !isUpdatingUser && setEditUserModalOpen(false)}
        title="Edit Laboratory Staff Member"
      >
        <form onSubmit={handleUpdateUser}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="edit-fullname">
                Full Name *
              </label>
              <input
                id="edit-fullname"
                type="text"
                className="form-input"
                value={editUserForm.fullName}
                onChange={(e) => setEditUserForm({ ...editUserForm, fullName: e.target.value })}
                placeholder="e.g. Dr. Arthur Conan, MD"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-email">
                Staff Email Address *
              </label>
              <input
                id="edit-email"
                type="email"
                className="form-input"
                value={editUserForm.email}
                onChange={(e) => setEditUserForm({ ...editUserForm, email: e.target.value })}
                placeholder="staff@laboratory.org"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-password">
                Password <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--slate-500)' }}>(leave blank to keep current)</span>
              </label>
              <input
                id="edit-password"
                type="password"
                className="form-input"
                value={editUserForm.password}
                onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
                placeholder="Enter new password only to change"
                autoComplete="new-password"
              />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label" htmlFor="edit-dept">
                  Department
                </label>
                <input
                  id="edit-dept"
                  type="text"
                  className="form-input"
                  value={editUserForm.department}
                  onChange={(e) => setEditUserForm({ ...editUserForm, department: e.target.value })}
                  placeholder="e.g. Hematology"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-phone">
                  Phone *
                </label>
                <input
                  id="edit-phone"
                  type="tel"
                  className="form-input"
                  value={editUserForm.phone}
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setEditUserForm({ ...editUserForm, phone: digits });
                  }}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-role">
                Assigned Laboratory Role *
              </label>
              <select
                id="edit-role"
                className="form-input"
                value={editUserForm.role}
                onChange={(e) => setEditUserForm({ ...editUserForm, role: e.target.value })}
                required
              >
                {roles.filter((r) => r.isActive && r.code !== 'lab_admin').length === 0 ? (
                  <option value="" disabled>No roles available.</option>
                ) : (
                  <>
                    <option value="" disabled>Select a laboratory role...</option>
                    {roles
                      .filter((r) => r.isActive && r.code !== 'lab_admin')
                      .map((r) => (
                        <option key={r.code} value={r.code}>
                          {r.name} ({r.code})
                        </option>
                      ))}
                  </>
                )}
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditUserModalOpen(false)}
                disabled={isUpdatingUser}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!isEditFormChanged || isUpdatingUser}
                title={!isEditFormChanged ? 'Change any field to enable update' : 'Save changes'}
                style={{
                  opacity: !isEditFormChanged ? 0.6 : 1,
                  cursor: !isEditFormChanged ? 'not-allowed' : 'pointer',
                }}
              >
                {isUpdatingUser ? <Loader2 size={16} className="animate-spin" /> : null}
                <span>Update Staff User</span>
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
                {roles.filter((r) => r.isActive && r.code !== 'lab_admin').length === 0 ? (
                  <option value="" disabled>No active laboratory roles found.</option>
                ) : (
                  roles
                    .filter((r) => r.isActive && r.code !== 'lab_admin')
                    .map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name} — {r.permissions?.length || 0} permissions
                      </option>
                    ))
                )}
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

      {/* MODAL 5: Delete Staff Account Confirmation */}
      <Modal
        isOpen={!!userToDelete}
        onClose={() => !isDeletingUser && setUserToDelete(null)}
        title="Confirm Staff Account Deletion"
        size="md"
      >
        {userToDelete && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {/* Warning Callout */}
            <div
              style={{
                background: 'var(--danger-50, #fef2f2)',
                border: '1px solid var(--danger-200, #fecaca)',
                borderRadius: 'var(--radius-md, 8px)',
                padding: '0.875rem 1rem',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangle size={20} style={{ color: 'var(--danger-600, #dc2626)', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ fontWeight: 600, color: 'var(--danger-800, #991b1b)', fontSize: '0.875rem', marginBottom: '4px' }}>
                  Permanent Access Revocation
                </p>
                <p style={{ fontSize: '0.8125rem', color: 'var(--danger-700, #b91c1c)', lineHeight: 1.45 }}>
                  Deleting this account will immediately revoke all laboratory staff login privileges and session access. This action may be irreversible.
                </p>
              </div>
            </div>

            {/* Target Staff Identity Card */}
            <div
              style={{
                background: 'var(--slate-50, #f8fafc)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: 'var(--radius-md, 8px)',
                padding: '1rem',
              }}
            >
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-500, #64748b)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
                Staff Member Identity
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '0.875rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500, #64748b)' }}>Full Name:</span>
                  <p style={{ fontWeight: 600, color: 'var(--slate-900, #0f172a)' }}>{userToDelete.fullName}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500, #64748b)' }}>Email Address:</span>
                  <p style={{ fontWeight: 600, color: 'var(--slate-900, #0f172a)' }}>{userToDelete.email}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500, #64748b)' }}>Staff ID:</span>
                  <p style={{ fontFamily: 'monospace', color: 'var(--primary-700, #1d4ed8)' }}>{userToDelete.userId || userToDelete.id}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--slate-500, #64748b)' }}>Assigned Role:</span>
                  <p>
                    <Badge variant={userToDelete.role === 'lab_admin' ? 'blue' : 'purple'}>
                      {roles.find((r) => r.code === userToDelete.role || r.roleId === userToDelete.roleId)?.name || userToDelete.role}
                    </Badge>
                  </p>
                </div>
              </div>
            </div>

            {/* Data Integrity Notice */}
            <p style={{ fontSize: '0.8125rem', color: 'var(--slate-600, #475569)', lineHeight: 1.5 }}>
              <strong>Clinical & Audit Trail Notice:</strong> Historical patient accessioning records, laboratory orders, specimens, verified test findings, released diagnostic reports, and audit trail events attributed to this staff member will remain completely preserved for regulatory and accreditation compliance.
            </p>

            {/* Delete Modal Error Alert */}
            {deleteModalError && (
              <div
                style={{
                  background: 'var(--danger-50, #fef2f2)',
                  border: '1px solid var(--danger-200, #fecaca)',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '0.75rem 1rem',
                  fontSize: '0.8125rem',
                  color: 'var(--danger-700, #b91c1c)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={16} style={{ color: 'var(--danger-600, #dc2626)', flexShrink: 0 }} />
                <span>{deleteModalError}</span>
              </div>
            )}

            {/* Self-Deletion Warning in Modal */}
            {(user?.userId === userToDelete.userId || (user?.email && userToDelete.email && user.email.toLowerCase() === userToDelete.email.toLowerCase())) && (
              <div
                style={{
                  background: 'var(--warning-50, #fffbeb)',
                  border: '1px solid var(--warning-200, #fde68a)',
                  borderRadius: 'var(--radius-md, 8px)',
                  padding: '0.75rem 1rem',
                  fontSize: '0.8125rem',
                  color: 'var(--warning-800, #92400e)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertTriangle size={16} style={{ color: 'var(--warning-600, #d97706)', flexShrink: 0 }} />
                <span>You are currently authenticated as this administrator. Self-deletion is blocked to prevent accidental system lockout.</span>
              </div>
            )}

            {/* Confirmation Controls */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '0.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setUserToDelete(null)}
                disabled={isDeletingUser}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ background: 'var(--danger-600, #dc2626)', color: '#ffffff', border: 'none' }}
                onClick={handleConfirmDeleteUser}
                disabled={
                  isDeletingUser ||
                  (user?.userId === userToDelete.userId || (user?.email && userToDelete.email && user.email.toLowerCase() === userToDelete.email.toLowerCase()))
                }
              >
                {isDeletingUser ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Deleting Account...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Role Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(roleToDelete)}
        onClose={() => setRoleToDelete(null)}
        onConfirm={handleConfirmDeleteRole}
        title="Delete Custom Role"
        message={
          roleToDelete ? (
            <span>
              Are you sure you want to delete the role <strong>"{roleToDelete.name}"</strong> ({roleToDelete.code})?
              Staff assigned to this role must be reassigned first. This action cannot be undone.
            </span>
          ) : ''
        }
        confirmText="Delete Role"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeletingRole}
      />
    </>
  );
}

export default UsersPage;
