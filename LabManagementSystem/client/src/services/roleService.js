/**
 * Lab Management System (LMS) - Role and Permission API Client
 */

import api from './api';

export const roleService = {
  /**
   * Get permission matrix definition
   */
  async getPermissionsMatrix(tenantId) {
    const res = await api.get(`/tenants/${tenantId}/roles/permissions-matrix`);
    return res.data.data;
  },

  /**
   * List all roles in tenant
   */
  async listRoles(tenantId, query = {}) {
    const params = new URLSearchParams();
    if (query.search) params.append('search', query.search);
    if (typeof query.isActive !== 'undefined') params.append('isActive', query.isActive);

    const res = await api.get(`/tenants/${tenantId}/roles?${params.toString()}`);
    return res.data.data.roles;
  },

  /**
   * Get single role details
   */
  async getRole(tenantId, roleId) {
    const res = await api.get(`/tenants/${tenantId}/roles/${roleId}`);
    return res.data.data;
  },

  /**
   * Create custom role
   */
  async createRole(tenantId, roleData) {
    const res = await api.post(`/tenants/${tenantId}/roles`, roleData);
    return res.data.data;
  },

  /**
   * Update custom role
   */
  async updateRole(tenantId, roleId, roleData) {
    const res = await api.put(`/tenants/${tenantId}/roles/${roleId}`, roleData);
    return res.data.data;
  },

  /**
   * Deactivate or activate role
   */
  async updateRoleStatus(tenantId, roleId, isActive) {
    const res = await api.patch(`/tenants/${tenantId}/roles/${roleId}/status`, { isActive });
    return res.data.data;
  },

  /**
   * Delete custom role
   */
  async deleteRole(tenantId, roleId) {
    const res = await api.delete(`/tenants/${tenantId}/roles/${roleId}`);
    return res.data.data;
  },

  /**
   * List users in tenant
   */
  async listUsers(tenantId, query = {}) {
    const params = new URLSearchParams();
    if (query.role) params.append('role', query.role);
    if (query.search) params.append('search', query.search);

    const res = await api.get(`/tenants/${tenantId}/users?${params.toString()}`);
    return res.data.data.users;
  },

  /**
   * Create new user in tenant
   */
  async createUser(tenantId, userData) {
    const res = await api.post(`/tenants/${tenantId}/users`, userData);
    return res.data.data;
  },

  /**
   * Update user status (active/deactivated)
   */
  async updateUserStatus(tenantId, userId, isActive) {
    const res = await api.patch(`/tenants/${tenantId}/users/${userId}/status`, { isActive });
    return res.data.data;
  },

  /**
   * Assign role to user
   */
  async assignUserRole(tenantId, userId, role) {
    const res = await api.patch(`/tenants/${tenantId}/users/${userId}/role`, { role });
    return res.data.data;
  },

  /**
   * Safely soft-delete staff member
   */
  async deleteUser(tenantId, userId) {
    const res = await api.delete(`/tenants/${tenantId}/users/${userId}`);
    return res.data.data;
  },
};

export default roleService;
