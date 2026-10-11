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
      const token = sessionStorage.getItem('lms_token') || sessionStorage.getItem('lms_admin_token');
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 unauthenticated
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config.url?.includes('/auth/')) {
      // Invalidate expired session
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('lms_token');
        sessionStorage.removeItem('lms_admin_token');
        window.dispatchEvent(new CustomEvent('lms:unauthorized'));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
