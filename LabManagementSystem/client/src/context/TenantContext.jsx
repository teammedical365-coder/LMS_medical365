/**
 * Lab Management System (LMS) - Dynamic White-Label Tenant Context
 * 
 * Resolves laboratory tenant identity & custom white-label branding:
 * 1. Hostname/Domain matching for public unauthenticated visitors (login page).
 * 2. Authenticated laboratory session branding.
 * 3. Applies CSS root variables (--primary-blue, --accent-cyan), custom page title & favicon.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

const TenantContext = createContext(null);

const DEFAULT_BRANDING = {
  displayName: 'LabMS Diagnostic Cloud',
  primaryColor: '#2563eb',
  accentColor: '#22c1dc',
  logoUrl: '',
  faviconUrl: '',
  loginBannerText: 'Welcome to the Diagnostic Cloud Portal',
};

const DEFAULT_TENANT = {
  tenantId: 'tenant_demo_central',
  code: 'CENTRAL-01',
  name: 'Central Diagnostics Laboratory',
  type: 'Clinical Reference Laboratory',
  tier: 'Enterprise Multi-Site',
  branding: DEFAULT_BRANDING,
  settings: {
    orderPrefix: 'ORD-',
    samplePrefix: 'SMP-',
    timezone: 'UTC',
  },
};

export function TenantProvider({ children }) {
  const { tenant: authTenant, isSuperAdmin } = useAuth();
  const [currentTenant, setCurrentTenant] = useState(DEFAULT_TENANT);
  const [branding, setBranding] = useState(DEFAULT_BRANDING);
  const [isBrandingLoaded, setIsBrandingLoaded] = useState(false);

  /**
   * Dynamically applies white-label design tokens to DOM
   */
  const applyThemeTokens = useCallback((brandData) => {
    if (!brandData) return;

    const root = document.documentElement;

    // Apply primary brand color if customized
    if (brandData.primaryColor) {
      root.style.setProperty('--primary-blue', brandData.primaryColor);
      root.style.setProperty('--primary-600', brandData.primaryColor);
      root.style.setProperty('--primary-500', brandData.primaryColor);
    }

    // Apply accent color
    if (brandData.accentColor) {
      root.style.setProperty('--accent-cyan', brandData.accentColor);
      root.style.setProperty('--cyan-500', brandData.accentColor);
    }

    // Update document title
    if (brandData.displayName) {
      document.title = `${brandData.displayName} | LabMS`;
    }

    // Update favicon if provided
    if (brandData.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = brandData.faviconUrl;
    }
  }, []);

  // Sync with authenticated tenant session
  useEffect(() => {
    if (authTenant) {
      const mergedBranding = {
        ...DEFAULT_BRANDING,
        displayName: authTenant.branding?.displayName || authTenant.name,
        primaryColor: authTenant.branding?.primaryColor || DEFAULT_BRANDING.primaryColor,
        accentColor: authTenant.branding?.accentColor || DEFAULT_BRANDING.accentColor,
        logoUrl: authTenant.branding?.logoUrl || '',
        faviconUrl: authTenant.branding?.faviconUrl || '',
        loginBannerText: authTenant.branding?.loginBannerText || '',
      };

      setCurrentTenant({
        ...authTenant,
        branding: mergedBranding,
      });
      setBranding(mergedBranding);
      applyThemeTokens(mergedBranding);
      setIsBrandingLoaded(true);
      return;
    }

    // If Super Admin, use default platform branding
    if (isSuperAdmin) {
      const saBranding = {
        ...DEFAULT_BRANDING,
        displayName: 'LMS Master Registry Platform',
        primaryColor: '#2563eb',
        accentColor: '#0d9488',
      };
      setBranding(saBranding);
      applyThemeTokens(saBranding);
      setIsBrandingLoaded(true);
      return;
    }

    // Public visitor / unauthenticated: Resolve tenant branding from Hostname or URL param
    const resolvePublicBranding = async () => {
      try {
        const hostname = window.location.hostname;
        const urlParams = new URLSearchParams(window.location.search);
        const labCode = urlParams.get('lab') || urlParams.get('tenant') || urlParams.get('org');

        // On localhost/127.0.0.1 without a specific lab parameter, use default branding immediately
        if ((!hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') && !labCode) {
          applyThemeTokens(DEFAULT_BRANDING);
          setIsBrandingLoaded(true);
          return;
        }

        const query = labCode 
          ? `code=${encodeURIComponent(labCode)}` 
          : `domain=${encodeURIComponent(hostname)}`;

        const res = await api.get(`/tenant/branding?${query}`);
        if (res.data?.success && res.data?.data) {
          const publicBrand = res.data.data;
          const merged = {
            ...DEFAULT_BRANDING,
            ...publicBrand.branding,
            displayName: publicBrand.branding?.displayName || publicBrand.name,
          };
          if (publicBrand.tenantId) {
            setCurrentTenant({
              tenantId: publicBrand.tenantId,
              code: publicBrand.code,
              name: publicBrand.name,
              branding: merged,
            });
          }
          setBranding(merged);
          applyThemeTokens(merged);
        }
      } catch {
        // Fallback to default branding if hostname not registered or local dev
        applyThemeTokens(DEFAULT_BRANDING);
      } finally {
        setIsBrandingLoaded(true);
      }
    };

    resolvePublicBranding();
  }, [authTenant, isSuperAdmin, applyThemeTokens]);

  return (
    <TenantContext.Provider
      value={{
        tenant: currentTenant,
        branding,
        setTenant: setCurrentTenant,
        isBrandingLoaded,
        applyThemeTokens,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}

export default TenantContext;
