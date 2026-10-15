/**
 * Lab Management System (LMS) - Super Admin API Client Service
 * 
 * SECURITY AUDIT CORRECTION (Phase 2 Review):
 * - Removed hardcoded `dev-super-admin-key-change-in-production` fallback.
 * - Removed `VITE_SUPER_ADMIN_API_KEY` browser environment exposure.
 * - Platform administrator operations require genuine server-authenticated session tokens.
 * - Zero shared platform keys are bundled or exposed in client distribution assets.
 */

import api from './api';

/**
 * Retrieve active administrator session headers if an authenticated session exists.
 * Never embeds shared platform secrets in the client bundle.
 */
function getAdminHeaders() {
  // If an administrator session token has been securely issued:
  const token =
    typeof window !== 'undefined'
      ? (typeof localStorage !== 'undefined' && localStorage.getItem('lms_admin_token')) ||
        sessionStorage.getItem('lms_admin_token')
      : null;
  if (token) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }
  return {};
}

export const superAdminService = {
  /**
   * Check if a client-side administrator session token is active
   */
  hasActiveAdminSession() {
    if (typeof window === 'undefined') return false;
    return !!(
      (typeof localStorage !== 'undefined' && localStorage.getItem('lms_admin_token')) ||
      sessionStorage.getItem('lms_admin_token')
    );
  },

  /**
   * Get Platform Overview Metrics & Recent Audits
   */
  async getOverview() {
    const res = await api.get('/super-admin/overview', { headers: getAdminHeaders() });
    return res.data.data;
  },

  /**
   * List laboratories with pagination and filters
   */
  async listLaboratories({ page = 1, limit = 10, status = '', provisioningStatus = '', q = '' } = {}) {
    const params = new URLSearchParams();
    if (page) params.append('page', page);
    if (limit) params.append('limit', limit);
    if (status) params.append('status', status);
    if (provisioningStatus) params.append('provisioningStatus', provisioningStatus);
    if (q) params.append('q', q);

    const res = await api.get(`/super-admin/laboratories?${params.toString()}`, { headers: getAdminHeaders() });
    return {
      laboratories: res.data.data,
      pagination: res.data.meta?.pagination || { total: res.data.data.length, page: 1, limit: 10, totalPages: 1 },
    };
  },

  /**
   * Get single laboratory by ID or tenantId
   */
  async getLaboratory(id) {
    const res = await api.get(`/super-admin/laboratories/${id}`, { headers: getAdminHeaders() });
    return res.data.data;
  },

  /**
   * Get laboratory staff list
   */
  async getLaboratoryStaff(id) {
    const res = await api.get(`/super-admin/laboratories/${id}/staff`, { headers: getAdminHeaders() });
    return res.data.data;
  },

  /**
   * Create staff member or administrator in laboratory
   */
  async createLaboratoryStaff(id, staffData) {
    const res = await api.post(`/super-admin/laboratories/${id}/staff`, staffData, { headers: getAdminHeaders() });
    return res.data.data;
  },

  /**
   * Register a new laboratory
   */
  async registerLaboratory(labData) {
    const res = await api.post('/super-admin/laboratories', labData, { headers: getAdminHeaders() });
    return res.data.data;
  },

  /**
   * Update laboratory profile fields
   */
  async updateLaboratory(id, updateData) {
    const res = await api.patch(`/super-admin/laboratories/${id}`, updateData, { headers: getAdminHeaders() });
    return res.data.data;
  },

  /**
   * Delete laboratory
   */
  async deleteLaboratory(id) {
    const res = await api.delete(`/super-admin/laboratories/${id}`, { headers: getAdminHeaders() });
    return res.data;
  },

  /**
   * Transition laboratory lifecycle status
   */
  async transitionStatus(id, targetStatus, reason = null) {
    const res = await api.post(
      `/super-admin/laboratories/${id}/status`,
      { status: targetStatus, reason },
      { headers: getAdminHeaders() }
    );
    return res.data.data;
  },

  /**
   * Update laboratory status (alias for transitionStatus)
   */
  async updateLaboratoryStatus(id, statusOrPayload, reason = null) {
    if (typeof statusOrPayload === 'object' && statusOrPayload !== null) {
      return this.transitionStatus(id, statusOrPayload.status, statusOrPayload.reason);
    }
    return this.transitionStatus(id, statusOrPayload, reason);
  },

  /**
   * Get safe provisioning status
   */
  async getProvisioningStatus(id) {
    const res = await api.get(`/super-admin/laboratories/${id}/provisioning`, { headers: getAdminHeaders() });
    return res.data.data;
  },

  /**
   * Retry database provisioning idempotently
   */
  async retryProvisioning(id) {
    const res = await api.post(`/super-admin/laboratories/${id}/provisioning/retry`, {}, { headers: getAdminHeaders() });
    return res.data.data;
  },

  /**
   * Request domain verification check (requires genuine DNS validation)
   */
  async verifyDomain(id, domain) {
    const res = await api.post(`/super-admin/laboratories/${id}/domains/${domain}/verify`, {}, { headers: getAdminHeaders() });
    return res.data.data;
  },

  /**
   * Verify domain mapping (alias for verifyDomain)
   */
  async verifyDomainMapping(id, domain) {
    return this.verifyDomain(id, domain);
  },

  /**
   * Get platform audit logs
   */
  async getAuditLogs({ tenantId = null, limit = 20, page = 1 } = {}) {
    const params = new URLSearchParams();
    if (tenantId) params.append('tenantId', tenantId);
    if (limit) params.append('limit', limit);
    if (page) params.append('page', page);

    const res = await api.get(`/super-admin/audit-logs?${params.toString()}`, { headers: getAdminHeaders() });
    return {
      items: res.data.data,
      pagination: res.data.meta?.pagination || { total: res.data.data.length, page: 1, limit: 20 },
    };
  },

  /**
   * Get role permissions matrix and navigation items
   */
  async getPermissionsMatrix() {
    const res = await api.get('/super-admin/roles/matrix', { headers: getAdminHeaders() });
    return res.data.data;
  },

  /**
   * List platform master roles
   */
  async listRoles(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (typeof params.isActive !== 'undefined') query.append('isActive', params.isActive);

    const res = await api.get(`/super-admin/roles?${query.toString()}`, { headers: getAdminHeaders() });
    return res.data.data;
  },

  /**
   * Get single master role
   */
  async getRole(roleId) {
    const res = await api.get(`/super-admin/roles/${roleId}`, { headers: getAdminHeaders() });
    return res.data.data;
  },

  /**
   * Create new master role
   */
  async createRole(roleData) {
    const res = await api.post('/super-admin/roles', roleData, { headers: getAdminHeaders() });
    return res.data.data;
  },

  /**
   * Update master role
   */
  async updateRole(roleId, roleData) {
    const res = await api.put(`/super-admin/roles/${roleId}`, roleData, { headers: getAdminHeaders() });
    return res.data.data;
  },

  /**
   * Toggle master role active status
   */
  async updateRoleStatus(roleId, isActive) {
    const res = await api.patch(`/super-admin/roles/${roleId}/status`, { isActive }, { headers: getAdminHeaders() });
    return res.data.data;
  },

  /**
   * Delete master role
   */
  async deleteRole(roleId) {
    const res = await api.delete(`/super-admin/roles/${roleId}`, { headers: getAdminHeaders() });
    return res.data.data;
  },

  /**
   * Force sync master roles to all laboratories
   */
  async syncRolesToLabs() {
    const res = await api.post('/super-admin/roles/sync', {}, { headers: getAdminHeaders() });
    return res.data.data;
  },
};

export default superAdminService;
