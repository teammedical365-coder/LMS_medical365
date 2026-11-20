/**
 * Lab Management System (LMS) - System & Licensing Routes
 */

import { Router } from 'express';
import licenseService from '../services/license.service.js';
import ApiResponse from '../utils/apiResponse.js';
import fs from 'fs';
import path from 'path';

const router = Router();

/**
 * GET /api/v1/system/license
 * Publicly report license status without leaking cryptographic keys
 */
router.get('/license', (req, res) => {
  const status = licenseService.getCurrentLicenseStatus();
  return ApiResponse.success(res, {
    status: status.state,
    isValid: status.isValid,
    isReadOnly: status.isReadOnly,
    daysRemaining: status.daysRemaining,
    reason: status.reason,
    customer: status.payload?.customer || null,
    edition: status.payload?.edition || 'standard',
    features: status.features || [],
    maxUsers: status.payload?.maxUsers || null,
    maxWorkstations: status.payload?.maxWorkstations || null,
    validFrom: status.payload?.validFrom || null,
    expiresAt: status.payload?.expiresAt || null,
    machineFingerprint: licenseService.getMachineFingerprint(),
  }, 'System license status retrieved');
});

/**
 * POST /api/v1/system/license
 * Upload or apply new license key
 */
router.post('/license', (req, res) => {
  const { licenseKey } = req.body;
  if (!licenseKey) {
    return ApiResponse.badRequest(res, 'licenseKey string is required in request body');
  }

  const parsed = licenseService.parseLicenseKeyString(licenseKey);
  if (!parsed) {
    return ApiResponse.badRequest(res, 'Invalid license format. Must be JSON or base64 encoded license object.');
  }

  const evalStatus = licenseService.evaluateLicenseStatus(parsed);
  if (!evalStatus.isValid && evalStatus.state === 'INVALID_SIGNATURE') {
    return ApiResponse.forbidden(res, 'Cryptographic signature verification failed. License rejected.');
  }

  // Save license to disk
  try {
    const targetPath = path.resolve('docker/license.key');
    fs.writeFileSync(targetPath, JSON.stringify(parsed, null, 2), 'utf8');
    return ApiResponse.success(res, evalStatus, 'License applied successfully');
  } catch (err) {
    return ApiResponse.error(res, `Failed saving license: ${err.message}`);
  }
});

export default router;
