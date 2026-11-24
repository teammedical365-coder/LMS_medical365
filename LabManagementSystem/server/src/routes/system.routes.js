/**
 * Lab Management System (LMS) - System & Licensing Routes
 */

import { Router } from 'express';
import os from 'os';
import licenseService from '../services/license.service.js';
import ApiResponse from '../utils/apiResponse.js';

const router = Router();

/**
 * GET /api/v1/system/license/fingerprint
 * Returns current machine hardware fingerprint for license generation/binding
 */
router.get('/license/fingerprint', (req, res) => {
  const machineFingerprint = licenseService.getMachineFingerprint();
  return ApiResponse.success(res, {
    machineFingerprint,
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
  }, 'Hardware machine fingerprint retrieved successfully');
});

/**
 * GET /api/v1/system/license
 * Publicly report license status without leaking cryptographic secrets
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
 * Common handler for license activation
 */
function handleLicenseActivation(req, res) {
  const { licenseKey } = req.body;
  if (!licenseKey || typeof licenseKey !== 'string') {
    return ApiResponse.badRequest(res, 'licenseKey string is required in request body');
  }

  const result = licenseService.saveAndActivateLicense(licenseKey);
  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: result.error,
      message: result.error?.message || 'License activation failed',
      machineFingerprint: licenseService.getMachineFingerprint(),
    });
  }

  return ApiResponse.success(res, {
    status: result.status?.state,
    isValid: result.status?.isValid,
    isReadOnly: result.status?.isReadOnly,
    daysRemaining: result.status?.daysRemaining,
    customer: result.status?.payload?.customer,
    edition: result.status?.payload?.edition,
    features: result.status?.features,
    expiresAt: result.status?.payload?.expiresAt,
    machineFingerprint: licenseService.getMachineFingerprint(),
  }, 'License activated and verified successfully');
}

/**
 * POST /api/v1/system/license/activate
 * Explicit activation endpoint
 */
router.post('/license/activate', handleLicenseActivation);

/**
 * POST /api/v1/system/license
 * Standard upload / apply new license key
 */
router.post('/license', handleLicenseActivation);

export default router;
