/**
 * Lab Management System (LMS) - Authentication Controller
 * 
 * Handles login, session retrieval, and logout for Platform Super Admins
 * and Laboratory Tenant Users.
 */

import authService, { AuthenticationError } from '../services/auth.service.js';
import tokenService from '../services/token.service.js';
import { extractToken } from '../middleware/auth.middleware.js';
import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../config/constants.js';

class AuthController {
  /**
   * Platform Super Admin Login
   * POST /api/v1/auth/super-admin/login
   */
  async superAdminLogin(req, res, next) {
    try {
      const { email, password } = req.body || {};
      const ipAddress = req.ip || req.socket?.remoteAddress;
      const userAgent = req.get('user-agent');

      const result = await authService.loginSuperAdmin({
        email,
        password,
        ipAddress,
        userAgent,
      });

      // Set HttpOnly cookie for secure browser sessions
      res.cookie('lms_token', result.token, tokenService.getCookieOptions());

      return ApiResponse.success(
        res,
        {
          user: result.user,
          token: result.token,
          accountType: result.accountType,
        },
        'Platform Super Admin authenticated successfully'
      );
    } catch (err) {
      if (err instanceof AuthenticationError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * Laboratory User Login
   * POST /api/v1/auth/laboratory/login
   */
  async labUserLogin(req, res, next) {
    try {
      const { organizationCode, email, password } = req.body || {};
      const ipAddress = req.ip || req.socket?.remoteAddress;
      const userAgent = req.get('user-agent');

      const result = await authService.loginLaboratoryUser({
        organizationCode,
        email,
        password,
        ipAddress,
        userAgent,
      });

      // Set HttpOnly cookie for secure browser sessions
      res.cookie('lms_token', result.token, tokenService.getCookieOptions());

      return ApiResponse.success(
        res,
        {
          user: result.user,
          tenant: result.tenant,
          token: result.token,
          accountType: result.accountType,
        },
        'Laboratory user authenticated successfully'
      );
    } catch (err) {
      if (err instanceof AuthenticationError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * Get Current Authenticated User Profile
   * GET /api/v1/auth/me
   */
  async getCurrentUser(req, res, next) {
    try {
      const profile = await authService.getCurrentUserProfile(req.user);
      return ApiResponse.success(res, profile, 'Current authenticated profile retrieved');
    } catch (err) {
      if (err instanceof AuthenticationError) {
        return ApiResponse.error(res, err.message, err.statusCode, err.code);
      }
      next(err);
    }
  }

  /**
   * Invalidate Session / Logout
   * POST /api/v1/auth/logout
   */
  async logout(req, res) {
    try {
      const token = extractToken(req);
      if (token) {
        try {
          const decoded = tokenService.verifyToken(token);
          await authService.logoutUser(decoded);
        } catch {
          // Token expired or invalid, continue logout
        }
      }
    } catch {
      // Ignore
    }

    // Clear the authentication cookie
    res.clearCookie('lms_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      path: '/',
    });

    return ApiResponse.success(res, { loggedOut: true }, 'Signed out successfully');
  }
}

export const authController = new AuthController();
export default authController;
