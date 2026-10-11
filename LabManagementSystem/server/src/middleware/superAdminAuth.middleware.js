/**
 * Lab Management System (LMS) - Super Admin Authorization Middleware
 * 
 * Protects platform-level Super Admin endpoints.
 * Never allows public/unauthenticated access to laboratory registration,
 * status transitions, or database provisioning controls.
 */

import config from '../config/env.js';
import { HTTP_STATUS, ACCOUNT_TYPE } from '../config/constants.js';
import ApiResponse from '../utils/apiResponse.js';
import tokenService from '../services/token.service.js';
import logger from '../utils/logger.js';


export function superAdminAuthMiddleware(req, res, next) {
  // 1. Check for JWT Bearer token or HttpOnly cookie
  let token = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.cookies && req.cookies.lms_token) {
    token = req.cookies.lms_token;
  }

  if (token) {
    try {
      const decoded = tokenService.verifyToken(token);
      // Strictly verify accountType is PLATFORM_SUPER_ADMIN
      if (decoded.accountType === ACCOUNT_TYPE.PLATFORM_SUPER_ADMIN) {
        req.platformAdmin = {
          isAuthenticated: true,
          role: decoded.role || 'super_admin',
          actorType: 'super_admin',
          id: decoded.sub,
          email: decoded.email,
        };
        req.user = decoded;
        return next();
      } else {
        // A tenant user token tried to access Super Admin API!
        logger.warn(`[SECURITY] Tenant user (${decoded.email}) attempted to access Super Admin endpoint: ${req.originalUrl}`);
        return ApiResponse.error(
          res,
          'Access denied. Platform Super Admin privileges required. Laboratory accounts cannot access platform administration.',
          HTTP_STATUS.FORBIDDEN,
          'FORBIDDEN'
        );
      }
    } catch (err) {
      // If token was provided but is invalid or expired
      logger.warn(`[SECURITY] Invalid or expired token presented to Super Admin endpoint: ${err.message}`);
      return ApiResponse.error(
        res,
        `Super Admin authentication failed: ${err.message}`,
        HTTP_STATUS.UNAUTHORIZED,
        err.code || 'INVALID_TOKEN'
      );
    }
  }

  // 2. Fallback to configured Super Admin API Key (for server-to-server operations / Phase 2 tests)
  const apiKeyHeader = req.headers['x-admin-api-key'];
  if (apiKeyHeader) {
    const configuredKey = config.superAdmin.apiKey;
    if (configuredKey && apiKeyHeader === configuredKey) {
      req.platformAdmin = {
        isAuthenticated: true,
        role: 'super_admin',
        actorType: 'super_admin',
        id: 'super_admin_primary',
        email: 'admin@platform.lms.health',
      };
      return next();
    }
    return ApiResponse.error(
      res,
      'Access denied. Invalid Super Admin authorization credentials.',
      HTTP_STATUS.FORBIDDEN
    );
  }

  // 3. No credentials provided
  logger.warn(`[SECURITY] Unauthenticated Super Admin access attempt to [${req.method}] ${req.originalUrl} from IP: ${req.ip}`);
  return ApiResponse.error(
    res,
    'Super Admin authorization required. Missing authentication credentials.',
    HTTP_STATUS.UNAUTHORIZED
  );
}

export default superAdminAuthMiddleware;

