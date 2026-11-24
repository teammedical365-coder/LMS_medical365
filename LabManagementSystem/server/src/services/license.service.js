/**
 * Lab Management System (LMS) - Offline Asymmetric Licensing Service
 * 
 * Implements Phase 5E Asymmetric Licensing & Machine Fingerprint Binding:
 * - RSA-2048 / SHA-256 digital signature verification
 * - Embedded public key verification only (private key strictly external)
 * - Deterministic host machine fingerprinting for Windows 10, Windows 11 & Linux WSL2
 * - Persistent storage in Docker volume (/app/storage) & host files
 * - Expiration & 14-day grace period management
 * - Healthcare Safety: Expired licenses degrade to READ-ONLY mode.
 *   Patient and diagnostic records are NEVER locked, encrypted, wiped, or destroyed.
 *   Search, view, export, and printing remain permanently available.
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import config from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_PUBLIC_KEY_PATH = path.resolve(__dirname, '../config/licensePublicKey.pem');

// In-memory overrides for testing and instant activation caching
let _overrideMachineFingerprint = null;
let _cachedLicenseObj = null;

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
 * Calculate deterministic hardware identifier from host-level Windows or Linux identifiers
 */
function computeHostFingerprintInternal() {
  const platform = os.platform();
  const seedParts = ['LMS-MED365'];

  if (platform === 'win32') {
    // 1. Windows MachineGuid (Registry)
    let machineGuid = '';
    try {
      const regOut = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', {
        stdio: ['pipe', 'pipe', 'ignore'],
        encoding: 'utf8',
      });
      const match = regOut.match(/MachineGuid\s+REG_SZ\s+(\S+)/);
      if (match && match[1]) {
        machineGuid = match[1].trim();
      }
    } catch (_) {}

    // 2. Windows Motherboard / System UUID (CIM / WMIC)
    let systemUuid = '';
    try {
      const wmicOut = execSync('wmic csproduct get uuid', {
        stdio: ['pipe', 'pipe', 'ignore'],
        encoding: 'utf8',
      });
      const lines = wmicOut.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && l !== 'UUID');
      if (lines.length > 0) {
        systemUuid = lines[0];
      }
    } catch (_) {}

    if (machineGuid) seedParts.push(`GUID:${machineGuid}`);
    if (systemUuid) seedParts.push(`UUID:${systemUuid}`);
  } else if (platform === 'linux') {
    // Linux host or container machine-id
    const machineIdPaths = ['/etc/machine-id', '/var/lib/dbus/machine-id'];
    for (const p of machineIdPaths) {
      if (fs.existsSync(p)) {
        try {
          const id = fs.readFileSync(p, 'utf8').trim();
          if (id) {
            seedParts.push(`LINUX_ID:${id}`);
            break;
          }
        } catch (_) {}
      }
    }
  }

  // Fallback if hardware GUID and system UUID are unavailable
  if (seedParts.length <= 1) {
    const interfaces = os.networkInterfaces();
    const macs = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          macs.push(iface.mac.toLowerCase());
        }
      }
    }
    if (macs.length > 0) {
      seedParts.push(`MACS:${macs.sort().join(',')}`);
    } else {
      seedParts.push(`HOST:${os.hostname()}|${os.arch()}`);
    }
  }

  const identityString = seedParts.join('|').toLowerCase();
  return crypto.createHash('sha256').update(identityString).digest('hex').substring(0, 32);
}

/**
 * Persist computed fingerprint to persistent storage directories
 */
function persistFingerprintInternal(fp) {
  if (!fp || typeof fp !== 'string' || fp.length < 16) return;
  const targetPaths = [
    '/app/storage/machine.id',
    path.resolve('storage/machine.id'),
    path.resolve('docker/machine.id'),
  ];

  for (const tPath of targetPaths) {
    try {
      const dir = path.dirname(tPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(tPath, fp.trim(), 'utf8');
    } catch (_) {}
  }
}

/**
 * Calculate deterministic hardware fingerprint of the host machine.
 * Guaranteed stable across Windows restarts, WSL2/Docker restarts, and container recreations.
 */
export function getMachineFingerprint() {
  // 1. In-memory override (unit tests / mock environments)
  if (_overrideMachineFingerprint) {
    return _overrideMachineFingerprint;
  }

  // 2. Environment variable (passed from docker compose or local.env)
  if (process.env.LMS_MACHINE_FINGERPRINT && process.env.LMS_MACHINE_FINGERPRINT.trim().length >= 16) {
    return process.env.LMS_MACHINE_FINGERPRINT.trim();
  }

  // 3. Persisted storage files
  const candidateFiles = [
    '/app/storage/machine.id',
    path.resolve('storage/machine.id'),
    '/app/machine.id',
    path.resolve('machine.id'),
    path.resolve('docker/machine.id'),
    path.resolve('../docker/machine.id'),
  ];

  for (const filePath of candidateFiles) {
    if (fs.existsSync(filePath)) {
      try {
        const val = fs.readFileSync(filePath, 'utf8').trim();
        if (val && val.length >= 16) {
          return val;
        }
      } catch (_) {}
    }
  }

  // 4. Compute from stable host identifiers
  const computed = computeHostFingerprintInternal();

  // 5. Auto-persist so subsequent calls and restarts remain 100% deterministic
  persistFingerprintInternal(computed);

  return computed;
}

/**
 * Set in-memory machine fingerprint override (useful for testing)
 */
export function setOverrideMachineFingerprint(fp) {
  _overrideMachineFingerprint = fp;
}

/**
 * Reset in-memory machine fingerprint override
 */
export function resetOverrideMachineFingerprint() {
  _overrideMachineFingerprint = null;
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
  // 1. Cached in-memory active license
  if (_cachedLicenseObj) {
    return _cachedLicenseObj;
  }

  // 2. Environment variable
  if (process.env.LMS_LICENSE_KEY) {
    const parsed = parseLicenseKeyString(process.env.LMS_LICENSE_KEY);
    if (parsed) return parsed;
  }

  // 3. Candidate file paths (checked in priority order)
  const candidates = [
    '/app/storage/license.key',
    path.resolve('storage/license.key'),
    '/app/license.key',
    path.resolve('docker/license.key'),
    path.resolve('../docker/license.key'),
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
 * Save and activate license key string into persistent storage and runtime cache
 */
export function saveAndActivateLicense(rawLicenseKey, options = {}) {
  const parsed = parseLicenseKeyString(rawLicenseKey);
  if (!parsed) {
    return {
      success: false,
      error: {
        code: 'INVALID_FORMAT',
        message: 'Invalid license format. Must be JSON or base64 encoded license object.',
      },
      status: evaluateLicenseStatus(null, options),
    };
  }

  const evalStatus = evaluateLicenseStatus(parsed, options);
  if (!evalStatus.isValid && evalStatus.state !== 'GRACE_PERIOD') {
    return {
      success: false,
      error: {
        code: evalStatus.state,
        message: evalStatus.reason,
        machineFingerprint: options.hardwareId || getMachineFingerprint(),
      },
      status: evalStatus,
    };
  }

  // Save to persistent storage locations
  const targetPaths = [
    '/app/storage/license.key',
    path.resolve('storage/license.key'),
    path.resolve('docker/license.key'),
  ];

  let savedSuccessfully = false;
  for (const targetPath of targetPaths) {
    try {
      const dir = path.dirname(targetPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(targetPath, JSON.stringify(parsed, null, 2), 'utf8');
      savedSuccessfully = true;
    } catch (_) {}
  }

  _cachedLicenseObj = parsed;

  return {
    success: true,
    savedToDisk: savedSuccessfully,
    status: evalStatus,
  };
}

/**
 * Reset runtime license cache (for testing)
 */
export function resetLicenseCache() {
  _cachedLicenseObj = null;
}

/**
 * Get current system license evaluation
 */
export function getCurrentLicenseStatus(options = {}) {
  const licenseObj = resolveCurrentLicense();
  return evaluateLicenseStatus(licenseObj, options);
}

/**
 * Express Middleware: Enforces Read-Only protection when license is expired or missing.
 * Healthcare Clinical Safety Rule: GET / HEAD / OPTIONS requests are NEVER blocked.
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

  // Allow license activation / renewal endpoints
  if (req.originalUrl && req.originalUrl.includes('/system/license')) {
    return next();
  }

  const status = getCurrentLicenseStatus();
  if (status.isReadOnly) {
    return res.status(403).json({
      success: false,
      error: {
        code: status.state === 'UNLICENSED' ? 'LICENSE_EXPIRED_READ_ONLY' : (status.state || 'LICENSE_EXPIRED_READ_ONLY'),
        message: status.reason || 'System is operating in Read-Only Mode. Patient records remain accessible for viewing and printing. Please activate or renew your license.',
        state: status.state,
        daysRemaining: status.daysRemaining,
        machineFingerprint: getMachineFingerprint(),
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
  setOverrideMachineFingerprint,
  resetOverrideMachineFingerprint,
  resolveCurrentLicense,
  saveAndActivateLicense,
  resetLicenseCache,
  getCurrentLicenseStatus,
  enforceLicenseWriteAccess,
  loadPublicKey,
  parseLicenseKeyString,
  DEFAULT_PUBLIC_KEY_PATH,
};
