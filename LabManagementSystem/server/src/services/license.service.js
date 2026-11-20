/**
 * Lab Management System (LMS) - Offline Asymmetric Licensing Service
 * 
 * Implements Phase 5E Asymmetric Licensing:
 * - RSA-2048 / SHA-256 digital signature verification
 * - Embedded public key verification only (private key strictly external)
 * - Hardware fingerprint binding with wildcard fallback
 * - Expiration & 14-day grace period management
 * - Healthcare Safety: Expired licenses degrade to READ-ONLY mode.
 *   Patient and diagnostic records are NEVER locked, encrypted, wiped, or destroyed.
 *   Search, view, export, and printing remain permanently available.
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_PUBLIC_KEY_PATH = path.resolve(__dirname, '../config/licensePublicKey.pem');

/**
 * Deterministically serialize payload object for signature verification
 */
export function canonicalizePayload(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizePayload).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const parts = sortedKeys.map((key) => {
    return JSON.stringify(key) + ':' + canonicalizePayload(obj[key]);
  });
  return '{' + parts.join(',') + '}';
}

/**
 * Calculate deterministic hardware fingerprint of the host machine
 */
export function getMachineFingerprint() {
  const interfaces = os.networkInterfaces();
  const macAddresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        macAddresses.push(iface.mac.toLowerCase());
      }
    }
  }

  const identityString = [
    os.platform(),
    os.arch(),
    os.hostname(),
    macAddresses.sort().join(','),
  ].join('|');

  return crypto.createHash('sha256').update(identityString).digest('hex').substring(0, 32);
}

/**
 * Load public key from disk
 */
export function loadPublicKey(keyPath = DEFAULT_PUBLIC_KEY_PATH) {
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, 'utf8').trim();
  }
  return null;
}

/**
 * Verify RSA-SHA256 signature of license
 */
export function verifySignature(payload, signatureBase64, publicKeyPem) {
  if (!payload || !signatureBase64 || !publicKeyPem) {
    return false;
  }
  try {
    const canonical = canonicalizePayload(payload);
    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(canonical);
    return verify.verify(publicKeyPem, signatureBase64, 'base64');
  } catch (err) {
    return false;
  }
}

/**
 * Parse license key string (can be JSON or base64 JSON)
 */
export function parseLicenseKeyString(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return null;
  const trimmed = rawKey.trim();

  // Try direct JSON
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed.payload && parsed.signature) return parsed;
  } catch (_) {}

  // Try base64 decoded JSON
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded);
    if (parsed.payload && parsed.signature) return parsed;
  } catch (_) {}

  return null;
}

/**
 * Evaluate complete license status against time and machine identity
 */
export function evaluateLicenseStatus(licenseObj, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const currentHwId = options.hardwareId || getMachineFingerprint();
  const publicKeyPem = options.publicKey || loadPublicKey(options.publicKeyPath);

  if (!licenseObj || !licenseObj.payload || !licenseObj.signature) {
    return {
      isValid: false,
      state: 'UNLICENSED',
      isReadOnly: true,
      reason: 'No license key configured or invalid license format.',
      daysRemaining: 0,
      features: ['clinical', 'reports'], // Read-only baseline
      payload: null,
    };
  }

  // 1. Cryptographic Signature Verification
  if (!publicKeyPem) {
    return {
      isValid: false,
      state: 'ERROR',
      isReadOnly: true,
      reason: 'LMS Public verification key not found.',
      daysRemaining: 0,
      features: [],
      payload: null,
    };
  }

  const isSigValid = verifySignature(licenseObj.payload, licenseObj.signature, publicKeyPem);
  if (!isSigValid) {
    return {
      isValid: false,
      state: 'INVALID_SIGNATURE',
      isReadOnly: true,
      reason: 'Digital signature verification failed. License is corrupted or forged.',
      daysRemaining: 0,
      features: [],
      payload: null,
    };
  }

  const payload = licenseObj.payload;

  // 2. Hardware ID Binding Check
  if (payload.hardwareId && payload.hardwareId !== '*') {
    if (payload.hardwareId.toLowerCase() !== currentHwId.toLowerCase()) {
      return {
        isValid: false,
        state: 'HARDWARE_MISMATCH',
        isReadOnly: true,
        reason: `License is bound to machine ${payload.hardwareId}, but running on ${currentHwId}.`,
        daysRemaining: 0,
        features: payload.features || [],
        payload,
      };
    }
  }

  // 3. Time Validity Checks
  const validFrom = new Date(payload.validFrom || 0);
  const expiresAt = new Date(payload.expiresAt || 0);
  const graceDays = typeof payload.gracePeriodDays === 'number' ? payload.gracePeriodDays : 14;
  const graceExpiresAt = new Date(expiresAt.getTime() + graceDays * 24 * 60 * 60 * 1000);

  if (now < validFrom) {
    return {
      isValid: false,
      state: 'NOT_YET_VALID',
      isReadOnly: true,
      reason: `License will become valid on ${validFrom.toISOString()}.`,
      daysRemaining: 0,
      features: payload.features || [],
      payload,
    };
  }

  const msRemaining = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (24 * 60 * 60 * 1000)));

  if (now <= expiresAt) {
    return {
      isValid: true,
      state: 'ACTIVE',
      isReadOnly: false,
      reason: 'License is fully active and validated.',
      daysRemaining,
      features: payload.features || [],
      payload,
    };
  }

  // In Grace Period
  if (now <= graceExpiresAt) {
    const graceMsRemaining = graceExpiresAt.getTime() - now.getTime();
    const graceDaysRemaining = Math.max(0, Math.ceil(graceMsRemaining / (24 * 60 * 60 * 1000)));
    return {
      isValid: true,
      state: 'GRACE_PERIOD',
      isReadOnly: false,
      reason: `License expired on ${expiresAt.toISOString()}. Operating in ${graceDaysRemaining}-day grace period.`,
      daysRemaining: graceDaysRemaining,
      features: payload.features || [],
      payload,
    };
  }

  // Expired -> Transition to READ-ONLY mode (Patient records remain viewable/printable)
  return {
    isValid: false,
    state: 'EXPIRED',
    isReadOnly: true,
    reason: `License expired on ${expiresAt.toISOString()} and grace period has ended. The system is operating in Read-Only Mode. Patient records remain accessible for viewing and printing.`,
    daysRemaining: 0,
    features: payload.features || [],
    payload,
  };
}

/**
 * Locate and read license key file from standard paths or environment
 */
export function resolveCurrentLicense() {
  // 1. Environment variable
  if (process.env.LMS_LICENSE_KEY) {
    const parsed = parseLicenseKeyString(process.env.LMS_LICENSE_KEY);
    if (parsed) return parsed;
  }

  // 2. Candidate file paths
  const candidates = [
    path.resolve('docker/license.key'),
    path.resolve('server/config/license.key'),
    path.resolve('server/license.key'),
    path.resolve('license.key'),
  ];

  for (const cPath of candidates) {
    if (fs.existsSync(cPath)) {
      try {
        const raw = fs.readFileSync(cPath, 'utf8');
        const parsed = parseLicenseKeyString(raw);
        if (parsed) return parsed;
      } catch (_) {}
    }
  }

  return null;
}

/**
 * Get current system license evaluation
 */
export function getCurrentLicenseStatus(options = {}) {
  const licenseObj = resolveCurrentLicense();
  return evaluateLicenseStatus(licenseObj, options);
}

/**
 * Express Middleware: Enforces Read-Only protection when license is expired
 * Healthcare Clinical Safety Rule: GET / HEAD requests are NEVER blocked.
 * Patient records and diagnostic results are always viewable and printable.
 */
export function enforceLicenseWriteAccess(req, res, next) {
  // If not running in Local Edition (e.g. Cloud Edition), do not enforce offline licensing
  if (!config.isLocalEdition) {
    return next();
  }

  // Allow all read-only HTTP methods unconditionally (Healthcare clinical safety requirement)
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  // Allow license activation / renewal endpoint itself
  if (req.originalUrl && req.originalUrl.includes('/system/license')) {
    return next();
  }

  const status = getCurrentLicenseStatus();
  if (status.isReadOnly) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'LICENSE_EXPIRED_READ_ONLY',
        message: status.reason || 'System is operating in Read-Only Mode. Patient records remain accessible for viewing and printing. Please renew your license.',
        state: status.state,
        daysRemaining: status.daysRemaining,
      },
    });
  }

  return next();
}

export default {
  verifySignature,
  evaluateLicenseStatus,
  canonicalizePayload,
  getMachineFingerprint,
  resolveCurrentLicense,
  getCurrentLicenseStatus,
  enforceLicenseWriteAccess,
  loadPublicKey,
  parseLicenseKeyString,
};
