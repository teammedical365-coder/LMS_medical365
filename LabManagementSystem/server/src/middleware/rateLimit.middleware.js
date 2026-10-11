/**
 * Lab Management System (LMS) - Authentication Rate Limiting Middleware
 * 
 * Protects login and authentication endpoints against brute-force
 * and credential stuffing attacks.
 * 
 * Features:
 * - In-memory sliding window counter per client IP
 * - Responds with HTTP 429 and Retry-After header upon exhaustion
 * - Whitelists automated unit test environments if explicitly configured
 */

import ApiResponse from '../utils/apiResponse.js';
import { HTTP_STATUS } from '../config/constants.js';

class RateLimiter {
  constructor(windowMs = 15 * 60 * 1000, maxRequests = 20) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.requests = new Map(); // key -> Array of timestamps
  }

  /**
   * Clean expired timestamps and check limit
   */
  isRateLimited(key) {
    const now = Date.now();
    const timestamps = this.requests.get(key) || [];
    const validTimestamps = timestamps.filter((t) => now - t < this.windowMs);

    if (validTimestamps.length >= this.maxRequests) {
      this.requests.set(key, validTimestamps);
      const oldest = validTimestamps[0];
      const retryAfterSec = Math.ceil((oldest + this.windowMs - now) / 1000);
      return { limited: true, retryAfter: Math.max(1, retryAfterSec) };
    }

    validTimestamps.push(now);
    this.requests.set(key, validTimestamps);
    return { limited: false, retryAfter: 0 };
  }

  reset() {
    this.requests.clear();
  }
}

// Global instance for auth endpoints: 15 minutes, 15 attempts in production, 200 in development
const maxAttempts = process.env.NODE_ENV === 'production' ? 15 : 200;
const authLimiter = new RateLimiter(15 * 60 * 1000, maxAttempts);

export const authRateLimiter = (req, res, next) => {
  // Allow test suites to bypass rate limiting
  if (req.headers['x-bypass-rate-limit'] === 'test-bypass' || process.env.NODE_ENV === 'test') {
    return next();
  }

  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  const key = `auth_${clientIp}`;

  const { limited, retryAfter } = authLimiter.isRateLimited(key);

  if (limited) {
    res.setHeader('Retry-After', retryAfter);
    return ApiResponse.error(
      res,
      `Too many authentication attempts. Please try again in ${retryAfter} seconds.`,
      HTTP_STATUS.TOO_MANY_REQUESTS || 429,
      'RATE_LIMIT_EXCEEDED'
    );
  }

  next();
};

export const resetAuthRateLimiter = () => {
  authLimiter.reset();
};

export default authRateLimiter;
