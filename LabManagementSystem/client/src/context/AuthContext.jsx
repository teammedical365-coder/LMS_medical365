/**
 * Lab Management System (LMS) - Authentication Context
 * 
 * Manages genuine JWT session state for:
 * 1. Platform Super Admin
 * 2. Laboratory Tenant Users
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import notify from '../utils/notify';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [accountType, setAccountType] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Initialize session by verifying token against backend GET /api/v1/auth/me
  const initSession = useCallback(async () => {
    if (!authService.hasToken()) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const profileData = await authService.getCurrentUser();
      if (profileData?.user) {
        setUser(profileData.user);
        setTenant(profileData.tenant || null);
        setAccountType(profileData.accountType);
        setIsAuthenticated(true);
        const savedCode = profileData.tenant?.code || profileData.tenant?.tenantId || profileData.user?.tenantId;
        if (savedCode && profileData.accountType !== 'PLATFORM_SUPER_ADMIN') {
          localStorage.setItem('lms_active_lab_code', savedCode.toLowerCase());
        }
      } else {
        // Invalid or expired token
        await authService.logout();
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch {
      // Session invalid or server unreachable
      await authService.logout();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initSession();

    // Listen for unauthorized 401 events dispatched by api.js
    const handleUnauthorized = (e) => {
      setUser(null);
      setTenant(null);
      setAccountType(null);
      setIsAuthenticated(false);
      const detail = e?.detail;
      if (detail?.message && detail?.code === 'SESSION_TERMINATED') {
        setAuthError(detail.message);
        notify.warning(detail.message);
      }
    };

    window.addEventListener('lms:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('lms:unauthorized', handleUnauthorized);
  }, [initSession]);

  /**
   * Super Admin Login
   */
  const loginSuperAdmin = async ({ email, password }) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const res = await authService.loginSuperAdmin({ email, password });
      setUser(res.user);
      setTenant(null);
      setAccountType(res.accountType);
      setIsAuthenticated(true);
      localStorage.removeItem('lms_active_lab_code');
      return { success: true, user: res.user };
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error?.message || err.message || 'Login failed';
      setAuthError(msg);
      return { success: false, error: msg, status: err.response?.status };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Laboratory User Login
   */
  const loginLabUser = async ({ organizationCode, email, password }) => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const res = await authService.loginLaboratoryUser({ organizationCode, email, password });
      setUser(res.user);
      setTenant(res.tenant);
      setAccountType(res.accountType);
      setIsAuthenticated(true);
      const code = res.tenant?.code || res.tenant?.tenantId || organizationCode;
      if (code) {
        localStorage.setItem('lms_active_lab_code', code.toLowerCase());
      }
      return { success: true, user: res.user, tenant: res.tenant };
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.error?.message || err.message || 'Login failed';
      setAuthError(msg);
      return { success: false, error: msg, status: err.response?.status };
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Terminate session
   * When a laboratory user logs out, redirect back to that laboratory's dedicated login URL.
   * Only Super Admin logs out to /login.
   */
  const logout = async () => {
    setIsLoading(true);
    const labCode =
      tenant?.code ||
      tenant?.tenantId ||
      user?.tenantCode ||
      user?.tenantId ||
      (typeof window !== 'undefined' ? localStorage.getItem('lms_active_lab_code') : null);
    const wasSuperAdmin = isSuperAdmin;
    try {
      await authService.logout();
    } finally {
      setUser(null);
      setTenant(null);
      setAccountType(null);
      setIsAuthenticated(false);
      setIsLoading(false);

      if (!wasSuperAdmin && labCode) {
        window.location.href = `/lab/${labCode.toLowerCase()}`;
      } else {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('lms_active_lab_code');
        }
        window.location.href = '/login';
      }
    }
  };

  const isSuperAdmin = accountType === 'PLATFORM_SUPER_ADMIN';

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        accountType,
        isAuthenticated,
        isSuperAdmin,
        isLoading,
        authError,
        loginSuperAdmin,
        loginLabUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
