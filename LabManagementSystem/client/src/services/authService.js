/**
 * Lab Management System (LMS) - Authentication Client Service
 * 
 * Interacts with genuine backend /api/v1/auth endpoints.
 * Never stores or exposes secrets in client environment variables.
 */

import api from './api';

export const authService = {
  /**
   * Authenticate Platform Super Admin
   * @param {Object} credentials { email, password }
   */
  async loginSuperAdmin({ email, password }) {
    const res = await api.post('/auth/super-admin/login', { email, password });
    const { user, token, accountType } = res.data.data;

    // Securely persist token for 7-day session lifecycle (both local & session storage)
    if (token) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('lms_token', token);
        localStorage.setItem('lms_admin_token', token);
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('lms_token', token);
        sessionStorage.setItem('lms_admin_token', token);
      }
    }

    return { user, token, accountType };
  },

  /**
   * Authenticate Laboratory Tenant User
   * @param {Object} credentials { organizationCode, email, password }
   */
  async loginLaboratoryUser({ organizationCode, email, password }) {
    const res = await api.post('/auth/laboratory/login', { organizationCode, email, password });
    const { user, tenant, token, accountType } = res.data.data;

    // Persist token in local and session storage
    if (token) {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('lms_token', token);
        localStorage.removeItem('lms_admin_token'); // Clear admin token if any
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('lms_token', token);
        sessionStorage.removeItem('lms_admin_token');
      }
    }

    return { user, tenant, token, accountType };
  },

  /**
   * Get current authenticated user profile
   */
  async getCurrentUser() {
    const res = await api.get('/auth/me');
    return res.data.data;
  },

  /**
   * Terminate session / Logout
   */
  async logout() {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Ignore network errors on logout
    } finally {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('lms_token');
        localStorage.removeItem('lms_admin_token');
        localStorage.removeItem('lms_ui_user');
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('lms_token');
        sessionStorage.removeItem('lms_admin_token');
      }
    }
  },

  /**
   * Check if token exists in session
   */
  hasToken() {
    return !!this.getToken();
  },

  getToken() {
    if (typeof localStorage !== 'undefined') {
      const local = localStorage.getItem('lms_token') || localStorage.getItem('lms_admin_token');
      if (local) return local;
    }
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('lms_token') || sessionStorage.getItem('lms_admin_token');
    }
    return null;
  },
};

export default authService;
