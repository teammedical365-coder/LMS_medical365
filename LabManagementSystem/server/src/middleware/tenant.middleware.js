/**
 * Lab Management System (LMS) - Multi-Tenant Resolution Middleware
 * 
 * SECURITY ARCHITECTURE RULES:
 * 1. Do NOT trust raw client-supplied headers (e.g., 'X-Tenant-Id', 'X-Hospital-Id')
 *    as proof of identity or authorization. They are treated solely as untrusted hints.
 * 2. Tenant resolution derives from:
 *    a) Verified custom domain / subdomain lookup matched against Master DB verified domains
 *    b) Authenticated, server-signed JWT claims in future Phase 3
 * 3. Never fallback to master database or an arbitrary default tenant.
 * 4. Inactive, pending, or suspended tenants are blocked.
 */

import { HTTP_STATUS } from '../config/constants.js';
import ApiResponse from '../utils/apiResponse.js';
import tenantResolutionService from '../services/tenantResolution.service.js';

export async function tenantBoundaryMiddleware(req, res, next) {
  // Capture client header hint for security auditing only
  const untrustedHeaderHint = req.headers['x-tenant-id'] || req.headers['x-hospital-id'] || null;

  try {
    // Attempt resolution via verified domain mapping
    const resolution = await tenantResolutionService.resolveFromRequest(req);

    if (resolution.isResolved) {
      req.tenantContext = {
        isResolved: true,
        tenantId: resolution.tenantId,
        code: resolution.code,
        name: resolution.name,
        databaseName: resolution.databaseName,
        status: resolution.status,
        plan: resolution.plan,
        branding: resolution.branding,
        untrustedHeaderHint,
      };
    } else {
      req.tenantContext = {
        isResolved: false,
        tenantId: null,
        domain: req.hostname,
        reason: resolution.reason || 'UNRESOLVED',
        untrustedHeaderHint,
      };
    }
  } catch (err) {
    req.tenantContext = {
      isResolved: false,
      tenantId: null,
      domain: req.hostname,
      reason: 'RESOLUTION_ERROR',
      untrustedHeaderHint,
    };
  }

  next();
}

/**
 * Guard middleware for tenant-scoped routes requiring a verified active tenant
 */
export function requireActiveTenant(req, res, next) {
  if (!req.tenantContext || !req.tenantContext.isResolved) {
    const reason = req.tenantContext?.reason || 'TENANT_NOT_RESOLVED';

    if (reason === 'TENANT_SUSPENDED') {
      return ApiResponse.error(
        res,
        'Access denied. This laboratory account is suspended. Please contact platform administration.',
        HTTP_STATUS.FORBIDDEN
      );
    }

    if (reason === 'TENANT_INACTIVE' || reason === 'TENANT_PENDING') {
      return ApiResponse.error(
        res,
        'Access denied. This laboratory account is not active.',
        HTTP_STATUS.FORBIDDEN
      );
    }

    if (reason === 'DATABASE_NOT_READY') {
      return ApiResponse.error(
        res,
        'Laboratory database provisioning is not completed. Access unavailable.',
        HTTP_STATUS.SERVICE_UNAVAILABLE
      );
    }

    return ApiResponse.error(
      res,
      'Valid laboratory tenant resolution required. No active verified tenant matched.',
      HTTP_STATUS.FORBIDDEN
    );
  }

  next();
}

export default tenantBoundaryMiddleware;
