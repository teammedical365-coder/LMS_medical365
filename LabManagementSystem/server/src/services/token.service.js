/**
 * Lab Management System (LMS) - JWT Token Service
 * 
 * Implements cryptographically secure, server-signed JWT access tokens.
 * Validates signature, issuer, audience, expiry, and required claims.
 * 
 * SECURITY RULES:
 * 1. Signs tokens with server-side secret only (never exposed to client).
 * 2. Strictly verifies issuer, audience, and expiration on every request.
 * 3. Enforces account type separation (PLATFORM_SUPER_ADMIN vs TENANT_USER).
 * 4. Never embeds sensitive secrets or password hashes in token payload.
 */

import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { ACCOUNT_TYPE } from '../config/constants.js';

export class TokenVerificationError extends Error {
  constructor(message, code = 'INVALID_TOKEN', statusCode = 401) {
    super(message);
    this.name = 'TokenVerificationError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class TokenService {
  constructor() {
    this.secret = config.jwt?.secret;
    this.issuer = config.jwt?.issuer || 'lms-platform-auth';
    this.audience = config.jwt?.audience || 'lms-api';
    this.expiresIn = config.jwt?.expiresIn || '15m';

    if (!this.secret || this.secret.length < 32) {
      if (config.isProduction) {
        throw new Error('FATAL: JWT_SECRET must be at least 32 characters in production');
      }
    }
  }

  /**
   * Generate an access token for Platform Super Admin
   * @param {Object} admin
   * @returns {string}
   */
  generatePlatformAdminToken(admin) {
    if (!admin || !admin.adminId || !admin.email) {
      throw new Error('Cannot sign admin token without adminId and email');
    }

    const payload = {
      sub: admin.adminId,
      email: admin.email,
      role: admin.role || 'super_admin',
      accountType: ACCOUNT_TYPE.PLATFORM_SUPER_ADMIN,
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      issuer: this.issuer,
      audience: this.audience,
    });
  }

  /**
   * Generate an access token for Tenant Laboratory User
   * @param {Object} user 
   * @param {string} tenantId 
   * @returns {string}
   */
  generateTenantUserToken(user, tenantId) {
    if (!user || !user.userId || !user.email) {
      throw new Error('Cannot sign tenant token without userId and email');
    }
    if (!tenantId) {
      throw new Error('Cannot sign tenant token without tenantId');
    }

    const payload = {
      sub: user.userId,
      email: user.email,
      role: user.role,
      tenantId: tenantId,
      accountType: ACCOUNT_TYPE.TENANT_USER,
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
      issuer: this.issuer,
      audience: this.audience,
    });
  }

  /**
   * Verify and decode a JWT access token
   * Validates signature, expiry, issuer, and audience
   * @param {string} token 
   * @returns {Object} decoded claims
   */
  verifyToken(token) {
    if (!token || typeof token !== 'string') {
      throw new TokenVerificationError('Authentication token missing or invalid format', 'TOKEN_MISSING');
    }

    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: this.issuer,
        audience: this.audience,
      });

      // Validate required claims
      if (!decoded.sub || !decoded.email || !decoded.accountType) {
        throw new TokenVerificationError('Token is missing mandatory subject or accountType claims', 'INVALID_CLAIMS');
      }

      if (decoded.accountType === ACCOUNT_TYPE.TENANT_USER && !decoded.tenantId) {
        throw new TokenVerificationError('Tenant token missing mandatory tenantId claim', 'INVALID_CLAIMS');
      }

      return decoded;
    } catch (err) {
      if (err instanceof TokenVerificationError) {
        throw err;
      }
      if (err.name === 'TokenExpiredError') {
        throw new TokenVerificationError('Authentication token has expired. Please log in again.', 'TOKEN_EXPIRED');
      }
      if (err.name === 'JsonWebTokenError') {
        throw new TokenVerificationError(`Authentication token is invalid: ${err.message}`, 'INVALID_TOKEN');
      }
      if (err.name === 'NotBeforeError') {
        throw new TokenVerificationError('Authentication token not active yet', 'TOKEN_INACTIVE');
      }
      throw new TokenVerificationError('Failed to verify authentication token', 'TOKEN_ERROR');
    }
  }

  /**
   * Cookie configuration for secure HTTP-only browser storage
   */
  getCookieOptions() {
    return {
      httpOnly: true,
      secure: config.isProduction, // In production, cookies require HTTPS
      sameSite: config.isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes aligned with token expiry
      path: '/',
    };
  }
}

export const tokenService = new TokenService();
export default tokenService;
