/**
 * Lab Management System (LMS) - Axios HTTP Client
 * 
 * Configured with credentials and automated JWT Bearer authorization interceptor.
 */

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 10000,
  withCredentials: true, // Send HttpOnly session cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach verified JWT token if present
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token =
        (typeof localStorage !== 'undefined' && (localStorage.getItem('lms_token') || localStorage.getItem('lms_admin_token'))) ||
        (typeof sessionStorage !== 'undefined' && (sessionStorage.getItem('lms_token') || sessionStorage.getItem('lms_admin_token')));
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 unauthenticated & single device session termination
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginEndpoint = error.config?.url?.includes('/auth/super-admin/login') || error.config?.url?.includes('/auth/laboratory/login');
    if (error.response?.status === 401 && !isLoginEndpoint) {
      // Invalidate expired or superseded session
      if (typeof window !== 'undefined') {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem('lms_token');
          localStorage.removeItem('lms_admin_token');
          localStorage.removeItem('lms_ui_user');
        }
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('lms_token');
          sessionStorage.removeItem('lms_admin_token');
        }
        const errData = error.response?.data || {};
        window.dispatchEvent(
          new CustomEvent('lms:unauthorized', {
            detail: {
              code: errData.code || 'UNAUTHENTICATED',
              message: errData.message || 'Session expired or logged in from another device.',
            },
          })
        );
      }
    }
    return Promise.reject(error);
  }
);

export default api;
