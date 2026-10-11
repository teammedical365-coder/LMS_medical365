/**
 * Lab Management System (LMS) - Environment Configuration & Validation
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server root .env if it exists (with override: true so server/.env takes precedence over inherited shell variables)
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  apiPrefix: process.env.API_PREFIX || '/api/v1',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  database: {
    uri: process.env.MONGODB_URI || '',
    masterDbName: process.env.MONGODB_MASTER_DB_NAME || 'lms_master',
    autoConnect: process.env.DB_AUTO_CONNECT === 'true',
    strategy: process.env.TENANT_DB_STRATEGY || 'isolated_db',
    tenantDbPrefix: process.env.TENANT_DB_NAME_PREFIX || 'lms_lab_',
    provisioningMode: process.env.TENANT_PROVISIONING_MODE || 'auto', // 'auto', 'memory', or 'mongo'
  },
  superAdmin: {
    apiKey: process.env.SUPER_ADMIN_API_KEY || 'dev-super-admin-key-change-in-production',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-lms-jwt-secret-do-not-use-in-production-change-me-32chars',
    expiresIn: process.env.JWT_EXPIRES_IN || '1h',
    issuer: process.env.JWT_ISSUER || 'lms-platform-auth',
    audience: process.env.JWT_AUDIENCE || 'lms-api',
  },
  cookie: {
    secret: process.env.COOKIE_SECRET || 'dev-lms-cookie-signing-secret-change-in-production',
  },
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development' || !process.env.NODE_ENV,
};

/**
 * Validate required configuration
 */
export function validateConfig() {
  const warnings = [];

  if (config.database.autoConnect && !config.database.uri) {
    warnings.push('DB_AUTO_CONNECT is enabled but MONGODB_URI is not provided.');
  }

  if (config.isProduction && config.superAdmin.apiKey === 'dev-super-admin-key-change-in-production') {
    warnings.push('SUPER_ADMIN_API_KEY is using the default development key in production environment.');
  }

  if (config.isProduction && config.jwt.secret.includes('dev-lms-jwt-secret')) {
    warnings.push('JWT_SECRET is using an insecure development default secret in production environment.');
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

export default config;
