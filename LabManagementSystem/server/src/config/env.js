/**
 * Lab Management System (LMS) - Environment Configuration & Validation
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server root .env if it exists.
// Explicit runtime environment variables (from containers, CI, or shell) strictly take precedence.
const initialRuntimeEnv = { ...process.env };
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
for (const [key, val] of Object.entries(initialRuntimeEnv)) {
  if (val !== undefined) {
    process.env[key] = val;
  }
}

/**
 * Parses and normalizes configured CORS origins from environment variables.
 * In production, returns only explicitly specified origins (empty array if unset - fail-safe).
 * In development, falls back to http://localhost:5173 if unspecified.
 */
export function parseCorsOrigins(
  rawOrigins = process.env.CORS_ORIGINS,
  legacyOrigin = process.env.CORS_ORIGIN,
  isProd = process.env.NODE_ENV === 'production'
) {
  const combined = [];
  if (rawOrigins) {
    combined.push(...rawOrigins.split(','));
  } else if (legacyOrigin) {
    combined.push(...legacyOrigin.split(','));
  }
  const parsed = combined
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);

  const unique = Array.from(new Set(parsed));
  if (unique.length > 0) {
    return unique;
  }
  return isProd ? [] : ['http://localhost:5173'];
}

/**
 * Known default, placeholder, or template secrets that must NEVER be accepted in production.
 */
export const KNOWN_UNSAFE_SECRETS = [
  'dev-lms-jwt-secret-do-not-use-in-production-change-me-32chars',
  'replace_with_a_secure_random_secret_at_least_32_characters_long',
  'dev-super-admin-key-change-in-production',
  'replace_with_a_secure_random_key_at_least_32_characters_long',
  'dev-lms-cookie-signing-secret-change-in-production',
  'replace_with_a_secure_cookie_signing_secret',
  'replace_with_a_secure_cookie_signing_secret_at_least_32_characters_long',
  'replace_with_secure_admin_password',
];

const UNSAFE_SECRET_PATTERNS = [
  /dev-lms/i,
  /change[-_]?me/i,
  /replace[-_]?with/i,
  /example/i,
  /default/i,
];

/**
 * Validates a production secret for presence, minimum length, and absence of known default/placeholder patterns.
 * Never prints or leaks the secret value.
 */
export function validateSecret(keyName, secretValue, minLength = 32) {
  if (!secretValue || typeof secretValue !== 'string' || secretValue.trim().length === 0) {
    return {
      isValid: false,
      error: `${keyName} is required in production but is missing or empty.`,
    };
  }

  const trimmed = secretValue.trim();
  if (trimmed.length < minLength) {
    return {
      isValid: false,
      error: `${keyName} must be at least ${minLength} characters in production (actual length: ${trimmed.length}).`,
    };
  }

  const lower = trimmed.toLowerCase();
  if (KNOWN_UNSAFE_SECRETS.some((known) => known.toLowerCase() === lower)) {
    return {
      isValid: false,
      error: `${keyName} is using a known default or template placeholder secret in production.`,
    };
  }

  if (UNSAFE_SECRET_PATTERNS.some((pattern) => pattern.test(lower))) {
    return {
      isValid: false,
      error: `${keyName} contains insecure development or placeholder patterns in production.`,
    };
  }

  return { isValid: true };
}

const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase();
const appEnv = (process.env.APP_ENV || '').trim().toLowerCase();
const isProduction = nodeEnv === 'production' || nodeEnv === 'prod' || appEnv === 'production';
const isTest = nodeEnv === 'test';
const isDevelopment = !isProduction && !isTest;

const initialCorsOrigins = parseCorsOrigins(process.env.CORS_ORIGINS, process.env.CORS_ORIGIN, isProduction);

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  corsOrigins: initialCorsOrigins,
  corsOrigin: initialCorsOrigins[0] || '',
  database: {
    uri: process.env.MONGODB_URI || '',
    masterDbName: process.env.MONGODB_MASTER_DB_NAME || 'lms_master',
    autoConnect: process.env.DB_AUTO_CONNECT === 'true',
    strategy: process.env.TENANT_DB_STRATEGY || 'isolated_db',
    tenantDbPrefix: process.env.TENANT_DB_NAME_PREFIX || 'lms_lab_',
    provisioningMode: process.env.TENANT_PROVISIONING_MODE || 'auto', // 'auto', 'memory', or 'mongo'
  },
  superAdmin: {
    apiKey: process.env.SUPER_ADMIN_API_KEY || (isProduction ? '' : 'dev-super-admin-key-change-in-production'),
  },
  jwt: {
    secret: process.env.JWT_SECRET || (isProduction ? '' : 'dev-lms-jwt-secret-do-not-use-in-production-change-me-32chars'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'lms-platform-auth',
    audience: process.env.JWT_AUDIENCE || 'lms-api',
  },
  cookie: {
    secret: process.env.COOKIE_SECRET || (isProduction ? '' : 'dev-lms-cookie-signing-secret-change-in-production'),
  },
  isProduction,
  isDevelopment,
  isTest,
};

/**
 * Validate required configuration
 */
export function validateConfig(targetConfig = config) {
  const errors = [];
  const warnings = [];

  if (targetConfig.isProduction) {
    // 1. Validate JWT_SECRET (SEC-03: Fatal in production)
    const jwtCheck = validateSecret('JWT_SECRET', targetConfig.jwt?.secret, 32);
    if (!jwtCheck.isValid) {
      errors.push(jwtCheck.error);
    }

    // 2. Validate COOKIE_SECRET (Fatal in production)
    const cookieCheck = validateSecret('COOKIE_SECRET', targetConfig.cookie?.secret, 32);
    if (!cookieCheck.isValid) {
      errors.push(cookieCheck.error);
    }

    // 3. Validate SUPER_ADMIN_API_KEY (Fatal in production)
    const adminKeyCheck = validateSecret('SUPER_ADMIN_API_KEY', targetConfig.superAdmin?.apiKey, 24);
    if (!adminKeyCheck.isValid) {
      errors.push(adminKeyCheck.error);
    }

    // 4. Validate CORS origins in production (fail-safe warning)
    if (!targetConfig.corsOrigins || targetConfig.corsOrigins.length === 0) {
      warnings.push('CORS_ORIGINS is not configured in production environment. Cross-origin browser requests will be blocked by default (fail-safe).');
    }
  }

  if (targetConfig.database?.autoConnect && !targetConfig.database?.uri) {
    warnings.push('DB_AUTO_CONNECT is enabled but MONGODB_URI is not provided.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Asserts production configuration validity, throwing a descriptive exception on fatal errors.
 */
export function assertProductionConfig(targetConfig = config) {
  const validation = validateConfig(targetConfig);
  if (!validation.isValid && validation.errors.length > 0) {
    throw new Error(`Production configuration validation failed: ${validation.errors.join('; ')}`);
  }
  return validation;
}

export default config;
