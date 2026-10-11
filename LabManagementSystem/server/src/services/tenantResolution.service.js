/**
 * Lab Management System (LMS) - Tenant Resolution Service
 * 
 * SECURITY RULES:
 * 1. Derives tenant identity strictly from:
 *    a) Verified custom domain / subdomain matching master registry
 *    b) Verified cryptographic token claim (JWT) in Phase 3
 * 2. Rejects raw client headers (X-Tenant-ID, X-Hospital-ID) as proof of authorization
 * 3. Never falls back to master DB or another tenant's database
 * 4. Rejects inactive, pending, or suspended tenants
 * 5. Rejects tenants whose database provisioning is not READY
 */

import TenantModel, { normalizeDomain } from '../models/tenant.model.js';
import { LAB_STATUS, PROVISIONING_STATUS } from '../config/constants.js';
import dbConnection from '../config/db.js';
import laboratoryManagementService from './laboratoryManagement.service.js';
import logger from '../utils/logger.js';

class TenantResolutionService {
  /**
   * Resolve a tenant from an incoming request using verified domain mapping
   */
  async resolveFromRequest(req) {
    // 1. Check if an untrusted tenant header hint is provided
    const untrustedHeaderHint = req.headers['x-tenant-id'] || req.headers['x-hospital-id'] || null;

    // 2. Extract and normalize hostname safely (never trust raw x-forwarded-host blindly)
    const rawHost = req.get('host') || req.hostname;
    const normalizedHost = normalizeDomain(rawHost);

    if (!normalizedHost) {
      return {
        isResolved: false,
        error: 'Unable to extract valid host from request',
        untrustedHeaderHint,
      };
    }

    // 3. Query Master Registry for a tenant with matching verified domain
    const resolution = await this.resolveByDomain(normalizedHost);

    // Attach untrusted hint for security auditing only
    resolution.untrustedHeaderHint = untrustedHeaderHint;
    return resolution;
  }

  /**
   * Resolve and validate a tenant by normalized domain
   */
  async resolveByDomain(domain) {
    const cleanDomain = normalizeDomain(domain);
    if (!cleanDomain) {
      return { isResolved: false, reason: 'INVALID_DOMAIN' };
    }

    try {
      let tenant = null;

      if (dbConnection.getStatus().connected) {
        tenant = await TenantModel.findOne({
          'domains.domain': cleanDomain,
        });
      } else {
        // Query in-memory registry fallback
        for (const t of laboratoryManagementService.memoryTenants.values()) {
          if (t.domains?.some((d) => d.domain === cleanDomain)) {
            tenant = t;
            break;
          }
        }
      }

      if (!tenant) {
        return {
          isResolved: false,
          reason: 'TENANT_NOT_FOUND',
          domain: cleanDomain,
        };
      }

      // Check if domain is verified
      const domainEntry = tenant.domains.find((d) => d.domain === cleanDomain);
      if (!domainEntry || !domainEntry.isVerified) {
        logger.warn(`[TENANT RESOLUTION] Domain ${cleanDomain} found on tenant ${tenant.code} but is not marked verified.`);
        return {
          isResolved: false,
          reason: 'DOMAIN_NOT_VERIFIED',
          tenantCode: tenant.code,
        };
      }

      // Check tenant lifecycle status: only ACTIVE is permitted
      if (tenant.status !== LAB_STATUS.ACTIVE) {
        logger.warn(`[TENANT RESOLUTION] Tenant ${tenant.code} has status ${tenant.status}. Access denied.`);
        return {
          isResolved: false,
          reason: `TENANT_${tenant.status}`,
          status: tenant.status,
          tenantCode: tenant.code,
        };
      }

      // Check database provisioning status: must be READY
      if (tenant.database?.provisioningStatus !== PROVISIONING_STATUS.READY) {
        logger.warn(`[TENANT RESOLUTION] Tenant ${tenant.code} database provisioning is ${tenant.database?.provisioningStatus}. Access denied.`);
        return {
          isResolved: false,
          reason: 'DATABASE_NOT_READY',
          provisioningStatus: tenant.database?.provisioningStatus,
          tenantCode: tenant.code,
        };
      }

      // Successful resolution
      return {
        isResolved: true,
        tenantId: tenant.tenantId,
        code: tenant.code,
        name: tenant.name,
        databaseName: tenant.database.name,
        status: tenant.status,
        plan: tenant.plan,
        branding: tenant.branding,
      };
    } catch (err) {
      logger.error(`[TENANT RESOLUTION] Exception resolving domain ${cleanDomain}:`, err);
      return {
        isResolved: false,
        reason: 'RESOLUTION_ERROR',
        error: err.message,
      };
    }
  }

  /**
   * Resolve and validate a tenant by server-verified tenantId (for token validation)
   */
  async resolveByTenantId(tenantId) {
    if (!tenantId || typeof tenantId !== 'string') {
      return { isResolved: false, reason: 'INVALID_TENANT_ID' };
    }

    try {
      let tenant = null;
      if (dbConnection.getStatus().connected) {
        tenant = await TenantModel.findOne({ tenantId });
      } else {
        tenant = laboratoryManagementService.memoryTenants.get(tenantId);
      }

      if (!tenant) {
        return { isResolved: false, reason: 'TENANT_NOT_FOUND' };
      }

      if (tenant.status !== LAB_STATUS.ACTIVE) {
        return { isResolved: false, reason: `TENANT_${tenant.status}`, status: tenant.status };
      }

      if (tenant.database?.provisioningStatus !== PROVISIONING_STATUS.READY) {
        return { isResolved: false, reason: 'DATABASE_NOT_READY' };
      }

      return {
        isResolved: true,
        tenantId: tenant.tenantId,
        code: tenant.code,
        name: tenant.name,
        databaseName: tenant.database.name,
        status: tenant.status,
      };
    } catch (err) {
      return { isResolved: false, reason: 'RESOLUTION_ERROR', error: err.message };
    }
  }
}

export const tenantResolutionService = new TenantResolutionService();
export default tenantResolutionService;
