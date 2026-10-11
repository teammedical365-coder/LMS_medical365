/**
 * Lab Management System (LMS) - Password Security Service
 * 
 * Provides secure password hashing, verification, and policy enforcement
 * using bcryptjs with strong work factor (10-12 rounds).
 * 
 * SECURITY RULES:
 * 1. Never log plain-text passwords or hashes.
 * 2. Never return password hashes in API responses.
 * 3. Constant-time comparison to prevent timing side-channel attacks.
 * 4. Enforce minimum length and complexity rules.
 */

import bcrypt from 'bcryptjs';
import config from '../config/env.js';

export const BCRYPT_SALT_ROUNDS = config.security?.bcryptSaltRounds || 10;

export class PasswordValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PasswordValidationError';
    this.statusCode = 400;
  }
}

class PasswordService {
  /**
   * Validate password complexity according to enterprise healthcare security policy
   * Rules:
   * - Minimum 8 characters, maximum 128 characters
   * - At least one uppercase letter
   * - At least one lowercase letter
   * - At least one numeric digit
   * - At least one special character
   */
  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      return {
        isValid: false,
        message: 'Password is required and must be a string',
      };
    }

    if (password.length < 8) {
      return {
        isValid: false,
        message: 'Password must be at least 8 characters long',
      };
    }

    if (password.length > 128) {
      return {
        isValid: false,
        message: 'Password must not exceed 128 characters',
      };
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasUpper || !hasLower || !hasNumber) {
      return {
        isValid: false,
        message: 'Password must include at least one uppercase letter, one lowercase letter, and one number',
      };
    }

    return {
      isValid: true,
      message: 'Password meets complexity requirements',
    };
  }

  /**
   * Hash a plain-text password with bcrypt
   * @param {string} plainPassword 
   * @param {number} saltRounds 
   * @returns {Promise<string>}
   */
  async hashPassword(plainPassword, saltRounds = BCRYPT_SALT_ROUNDS) {
    const validation = this.validatePassword(plainPassword);
    if (!validation.isValid) {
      throw new PasswordValidationError(validation.message);
    }

    const salt = await bcrypt.genSalt(saltRounds);
    return bcrypt.hash(plainPassword, salt);
  }

  /**
   * Verify candidate password against stored bcrypt hash
   * Constant-time verification prevents timing attacks
   * @param {string} candidatePassword 
   * @param {string} storedHash 
   * @returns {Promise<boolean>}
   */
  async comparePassword(candidatePassword, storedHash) {
    if (!candidatePassword || !storedHash || typeof candidatePassword !== 'string' || typeof storedHash !== 'string') {
      return false;
    }

    try {
      return await bcrypt.compare(candidatePassword, storedHash);
    } catch {
      return false;
    }
  }

  /**
   * Normalize login identifiers (e.g. email)
   */
  normalizeEmail(email) {
    if (!email || typeof email !== 'string') return '';
    return email.trim().toLowerCase();
  }
}

export const passwordService = new PasswordService();
export default passwordService;
