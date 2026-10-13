/**
 * Lab Management System (LMS) - Authentication & Role Middleware
 * 
 * Enforces JWT verification, token expiration checks, and strict separation
 * between Platform Super Admin and Tenant Laboratory users.
 */

import tokenService, { TokenVerificationError } from '../services/token.service.js';
import roleService from '../services/role.service.js';
import ApiResponse from '../utils/apiResponse.js';
import { ACCOUNT_TYPE, USER_ROLES, HTTP_STATUS } from '../config/constants.js';
import logger from '../utils/logger.js';

/**
 * Extract token from Authorization Bearer header or HttpOnly cookie
 */
export function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // Check HttpOnly cookie
  if (req.cookies && req.cookies.lms_token) {
    return req.cookies.lms_token;
  }

  return null;
}

/**
 * Middleware: Verify JWT access token and attach decoded user claims to `req.user`
 */
export function authenticateToken(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    return ApiResponse.error(
      res,
      'Authentication required. No valid session or token provided.',
      HTTP_STATUS.UNAUTHORIZED,
      'UNAUTHENTICATED'
    );
  }

  try {
    const decoded = tokenService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    logger.warn(`[AUTH] Token verification failed: ${err.message}`);
    const statusCode = err.statusCode || HTTP_STATUS.UNAUTHORIZED;
    return ApiResponse.error(
      res,
      err.message || 'Invalid or expired token',
      statusCode,
      err.code || 'INVALID_TOKEN'
    );
  }
}

/**
 * Middleware: Require Platform Super Admin privileges
 * Strictly blocks tenant laboratory users
 */
export function requireSuperAdmin(req, res, next) {
  if (!req.user) {
    return ApiResponse.error(
      res,
      'Authentication required',
      HTTP_STATUS.UNAUTHORIZED,
      'UNAUTHENTICATED'
    );
  }

  if (req.user.accountType !== ACCOUNT_TYPE.PLATFORM_SUPER_ADMIN) {
    logger.warn(`[SECURITY] Forbidden access attempt by ${req.user.accountType} (${req.user.email}) to Super Admin route`);
    return ApiResponse.error(
      res,
      'Access denied. Platform Super Admin privileges required.',
      HTTP_STATUS.FORBIDDEN,
      'FORBIDDEN'
    );
  }

  next();
}

/**
 * Middleware: Require Tenant Laboratory User privileges
 * Strictly blocks platform-admin accounts from posing as tenant users unless explicitly managed
 */
export function requireTenantUser(req, res, next) {
  if (!req.user) {
    return ApiResponse.error(
      res,
      'Authentication required',
      HTTP_STATUS.UNAUTHORIZED,
      'UNAUTHENTICATED'
    );
  }

  if (req.user.accountType !== ACCOUNT_TYPE.TENANT_USER) {
    return ApiResponse.error(
      res,
      'Access denied. Laboratory user credentials required.',
      HTTP_STATUS.FORBIDDEN,
      'FORBIDDEN'
    );
  }

  // If a tenantId route parameter is present, enforce strict tenant isolation!
  if (req.params.tenantId && req.params.tenantId !== req.user.tenantId) {
    logger.warn(
      `[SECURITY] Cross-tenant access attempt: user tenant=${req.user.tenantId} attempted accessing param tenant=${req.params.tenantId}`
    );
    return ApiResponse.error(
      res,
      'Access denied. Cross-tenant access is strictly prohibited.',
      HTTP_STATUS.FORBIDDEN,
      'CROSS_TENANT_FORBIDDEN'
    );
  }

  next();
}

/**
 * Middleware: Require Laboratory Administrator or Director role
 * Allows Super Admin OR Lab Admin of that tenant
 */
export function requireLabAdminOrSuperAdmin(req, res, next) {
  if (!req.user) {
    return ApiResponse.error(
      res,
      'Authentication required',
      HTTP_STATUS.UNAUTHORIZED,
      'UNAUTHENTICATED'
    );
  }

  // Super Admin is authorized
  if (req.user.accountType === ACCOUNT_TYPE.PLATFORM_SUPER_ADMIN) {
    return next();
  }

  // Tenant Lab Admin / Director is authorized
  if (
    req.user.accountType === ACCOUNT_TYPE.TENANT_USER &&
    [USER_ROLES.LAB_ADMIN, USER_ROLES.LAB_DIRECTOR].includes(req.user.role)
  ) {
    // Check tenant boundary
    if (req.params.tenantId && req.params.tenantId !== req.user.tenantId) {
      return ApiResponse.error(
        res,
        'Access denied. Cross-tenant access is strictly prohibited.',
        HTTP_STATUS.FORBIDDEN,
        'CROSS_TENANT_FORBIDDEN'
      );
    }
    return next();
  }

  return ApiResponse.error(
    res,
    'Access denied. Laboratory Administrator or Platform Super Admin privileges required.',
    HTTP_STATUS.FORBIDDEN,
    'FORBIDDEN'
  );
}

/**
 * Middleware Factory: Require specific granular module permission
 * Evaluates dynamically against the user's assigned role in their tenant
 * @param {string} requiredPermission e.g. 'roles:manage', 'users:view', 'reports:release'
 */
export function requirePermission(requiredPermission) {
  const permissionsToCheck = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];

  return async (req, res, next) => {
    if (!req.user) {
      return ApiResponse.error(
        res,
        'Authentication required',
        HTTP_STATUS.UNAUTHORIZED,
        'UNAUTHENTICATED'
      );
    }

    // Platform Super Admin has administrative privileges for platform operations
    if (req.user.accountType === ACCOUNT_TYPE.PLATFORM_SUPER_ADMIN) {
      return next();
    }

    // Tenant user: validate tenant isolation
    if (req.user.accountType === ACCOUNT_TYPE.TENANT_USER) {
      if (req.params.tenantId && req.params.tenantId !== req.user.tenantId) {
        return ApiResponse.error(
          res,
          'Access denied. Cross-tenant access is strictly prohibited.',
          HTTP_STATUS.FORBIDDEN,
          'CROSS_TENANT_FORBIDDEN'
        );
      }

      // Lab Admin / Director permissions: explicitly disallowed from clinical operations, audit logs, and settings
      const disallowedForLabAdmin = ['patients:', 'orders:', 'samples:', 'audit:', 'settings:'];
      const isLabAdminRole = [USER_ROLES.LAB_ADMIN, USER_ROLES.LAB_DIRECTOR, 'lab_admin', 'lab_director'].includes(req.user.role);

      if (isLabAdminRole) {
        if (permissionsToCheck.some((p) => disallowedForLabAdmin.some((prefix) => p.startsWith(prefix)))) {
          const permLabel = permissionsToCheck.join(' or ');
          logger.warn(
            `[SECURITY] Permission denied: Lab Admin (${req.user.email}) restricted from module: ${permLabel}`
          );
          return ApiResponse.error(
            res,
            `Access denied. Lab Admin does not have permission for: ${permLabel}`,
            HTTP_STATUS.FORBIDDEN,
            'INSUFFICIENT_PERMISSIONS'
          );
        }
        return next();
      }

      // Check dynamic role permissions from tenant database
      try {
        const role = await roleService.getRoleById(req.user.tenantId, req.user.role);
        if (!role || !role.isActive) {
          return ApiResponse.error(
            res,
            'Access denied. User role is inactive or unassigned.',
            HTTP_STATUS.FORBIDDEN,
            'ROLE_INACTIVE'
          );
        }

        const hasPermission =
          role.permissions?.includes('*') ||
          permissionsToCheck.some((p) => role.permissions?.includes(p));

        if (!hasPermission) {
          const permLabel = permissionsToCheck.join(' or ');
          logger.warn(
            `[SECURITY] Permission denied: user=${req.user.email} (role=${role.code}) missing required permission: ${permLabel}`
          );
          return ApiResponse.error(
            res,
            `Access denied. Missing required permission: ${permLabel}`,
            HTTP_STATUS.FORBIDDEN,
            'PERMISSION_DENIED'
          );
        }

        req.role = role;
        return next();
      } catch (err) {
        logger.error(`[SECURITY] Error checking permission for ${req.user.email}:`, err);
        return ApiResponse.error(
          res,
          'Access denied. Unable to verify permissions.',
          HTTP_STATUS.FORBIDDEN,
          'PERMISSION_CHECK_FAILED'
        );
      }
    }

    return ApiResponse.error(
      res,
      'Access denied. Unauthorized account type.',
      HTTP_STATUS.FORBIDDEN,
      'FORBIDDEN'
    );
  };
}

export default {
  authenticateToken,
  requireSuperAdmin,
  requireTenantUser,
  requireLabAdminOrSuperAdmin,
  requirePermission,
};
