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

    // Securely persist token for session lifecycle
    if (token) {
      sessionStorage.setItem('lms_token', token);
      sessionStorage.setItem('lms_admin_token', token);
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

    // Persist token in session storage
    if (token) {
      sessionStorage.setItem('lms_token', token);
      sessionStorage.removeItem('lms_admin_token'); // Clear admin token if any
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
      sessionStorage.removeItem('lms_token');
      sessionStorage.removeItem('lms_admin_token');
      localStorage.removeItem('lms_ui_user');
    }
  },

  /**
   * Check if token exists in session
   */
  hasToken() {
    return !!sessionStorage.getItem('lms_token');
  },

  getToken() {
    return sessionStorage.getItem('lms_token');
  },
};

export default authService;
