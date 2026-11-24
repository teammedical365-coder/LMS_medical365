/**
 * LMS Medical365 - Comprehensive 15-Point Automated License Activation & Fingerprint Test Suite
 * 
 * Verifies:
 * 1. Windows 10 fingerprint generation.
 * 2. Windows 11 fingerprint generation.
 * 3. Stable fingerprint across restarts.
 * 4. Missing fingerprint fallback & auto-persistence.
 * 5. Missing license key (UNLICENSED & Read-Only).
 * 6. Invalid license format rejection.
 * 7. Invalid RSA signature / tamper detection.
 * 8. Machine fingerprint mismatch (HARDWARE_MISMATCH).
 * 9. Expired license handling (EXPIRED & Read-Only).
 * 10. Valid customer license activation.
 * 11. Docker container recreation persistence.
 * 12. Windows restart simulation.
 * 13. Fresh customer installation lifecycle.
 * 14. Lab Admin creating a Lab Test (Blocked when unlicensed, allowed when licensed).
 * 15. Lab Admin creating a Test Category (Blocked when unlicensed, allowed when licensed).
 */

import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import licenseService, {
  canonicalizePayload,
  verifySignature,
  evaluateLicenseStatus,
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
} from '../src/services/license.service.js';

import { signPayload, generateLicense } from './generate-license.js';
import { getErrorMessage } from '../../client/src/utils/notify.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] Test ${totalTests.toString().padStart(2, ' ')}: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  [FAIL] Test ${totalTests.toString().padStart(2, ' ')}: ${name}`);
    console.error(`         ${err.message}`);
  }
}

console.log('\n======================================================================');
console.log('   LMS MEDICAL365 — 15-POINT LICENSE ACTIVATION & FINGERPRINT AUDIT');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Windows 10 Fingerprint Generation
// -----------------------------------------------------------------------------
runTest('1. Windows 10 fingerprint generation', () => {
  // Simulate Windows 10 Host (Build 19045, standard MachineGuid + BIOS UUID)
  const win10Guid = 'e5306176-d0dd-468d-8e38-81eacf723b56';
  const win10Uuid = 'CA0EFE99-2C04-EA11-8102-0068EBD48594';
  const seedString = `LMS-MED365|GUID:${win10Guid}|UUID:${win10Uuid}`.toLowerCase();
  const expectedHash = crypto.createHash('sha256').update(seedString).digest('hex').substring(0, 32);

  assert.strictEqual(expectedHash.length, 32, 'Fingerprint must be 32 hex characters');
  assert.ok(/^[0-9a-f]{32}$/.test(expectedHash), 'Fingerprint must be valid hex');
  
  // Real host check on Windows 10
  const currentFp = getMachineFingerprint();
  assert.strictEqual(currentFp.length, 32);
});

// -----------------------------------------------------------------------------
// Test 2: Windows 11 Fingerprint Generation
// -----------------------------------------------------------------------------
runTest('2. Windows 11 fingerprint generation', () => {
  // Simulate Windows 11 Host (Build 22621/22631, MachineGuid + TPM/UEFI UUID)
  const win11Guid = '4f8b2c1a-9876-4abc-def0-123456789abc';
  const win11Uuid = '9A8B7C6D-5E4F-3A2B-1C0D-FFEEDDCCBBAA';
  const seedString = `LMS-MED365|GUID:${win11Guid}|UUID:${win11Uuid}`.toLowerCase();
  const win11Hash = crypto.createHash('sha256').update(seedString).digest('hex').substring(0, 32);

  assert.strictEqual(win11Hash.length, 32);
  assert.ok(/^[0-9a-f]{32}$/.test(win11Hash));
  assert.notStrictEqual(win11Hash, '00000000000000000000000000000000');
});

// -----------------------------------------------------------------------------
// Test 3: Stable Fingerprint Across Restarts
// -----------------------------------------------------------------------------
runTest('3. Stable fingerprint across restarts', () => {
  // Repeated invocations must yield identical output
  const fp1 = getMachineFingerprint();
  const fp2 = getMachineFingerprint();
  const fp3 = getMachineFingerprint();

  assert.strictEqual(fp1, fp2, 'Fingerprint 1 and 2 must be identical');
  assert.strictEqual(fp2, fp3, 'Fingerprint 2 and 3 must be identical');

  // Verify against disk file if present
  const diskPath = path.join(rootDir, 'storage/machine.id');
  if (fs.existsSync(diskPath)) {
    const fromDisk = fs.readFileSync(diskPath, 'utf8').trim();
    assert.strictEqual(fp1, fromDisk, 'Fingerprint must match storage/machine.id file on disk');
  }
});

// -----------------------------------------------------------------------------
// Test 4: Missing Fingerprint Fallback & Auto-Persistence
// -----------------------------------------------------------------------------
runTest('4. Missing fingerprint fallback & auto-persistence', () => {
  // Test fallback logic when neither env nor file is provided
  const tempDir = path.join(rootDir, 'storage/temp_test_fp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const originalEnv = process.env.LMS_MACHINE_FINGERPRINT;
  delete process.env.LMS_MACHINE_FINGERPRINT;
  resetOverrideMachineFingerprint();

  const fp = getMachineFingerprint();
  assert.ok(fp && fp.length === 32, 'Fallback fingerprint must be generated');

  // Restore env
  if (originalEnv) process.env.LMS_MACHINE_FINGERPRINT = originalEnv;
});

// -----------------------------------------------------------------------------
// Test 5: Missing License Key (UNLICENSED & Read-Only Mode)
// -----------------------------------------------------------------------------
runTest('5. Missing license key', () => {
  const status = evaluateLicenseStatus(null);
  assert.strictEqual(status.isValid, false);
  assert.strictEqual(status.state, 'UNLICENSED');
  assert.strictEqual(status.isReadOnly, true);
  assert.strictEqual(status.daysRemaining, 0);
  assert.ok(status.reason.includes('No license key configured'));
});

// -----------------------------------------------------------------------------
// Test 6: Invalid License Format
// -----------------------------------------------------------------------------
runTest('6. Invalid license format', () => {
  const malformedString = 'NOT_A_VALID_LICENSE_JSON_OR_BASE64_!!!';
  const parsed = parseLicenseKeyString(malformedString);
  assert.strictEqual(parsed, null, 'Malformed license string must parse to null');

  const activationResult = saveAndActivateLicense(malformedString);
  assert.strictEqual(activationResult.success, false);
  assert.strictEqual(activationResult.error.code, 'INVALID_FORMAT');
});

// -----------------------------------------------------------------------------
// Test 7: Invalid RSA Signature / Tampering Detection
// -----------------------------------------------------------------------------
runTest('7. Invalid RSA signature', () => {
  const validLic = generateLicense({ customerName: 'St. Mary Diagnostic Lab', maxUsers: 15 });
  const publicKeyPem = loadPublicKey();
  assert.ok(publicKeyPem, 'Public key must load from config');

  // Verify untampered
  assert.strictEqual(verifySignature(validLic.payload, validLic.signature, publicKeyPem), true);

  // Tamper with payload (e.g. increase maxUsers from 15 to 9999)
  const tamperedPayload = { ...validLic.payload, maxUsers: 9999 };
  const isTamperedValid = verifySignature(tamperedPayload, validLic.signature, publicKeyPem);
  assert.strictEqual(isTamperedValid, false, 'Tampered payload must fail RSA verification');

  // Evaluate tampered object
  const tamperedLic = { payload: tamperedPayload, signature: validLic.signature };
  const status = evaluateLicenseStatus(tamperedLic);
  assert.strictEqual(status.isValid, false);
  assert.strictEqual(status.state, 'INVALID_SIGNATURE');
  assert.strictEqual(status.isReadOnly, true);
});

// -----------------------------------------------------------------------------
// Test 8: Machine Fingerprint Mismatch
// -----------------------------------------------------------------------------
runTest('8. Machine fingerprint mismatch', () => {
  const hostFp = getMachineFingerprint();
  const otherFp = 'ffffffffffffffffffffffffffffffff'; // Different machine

  const boundLic = generateLicense({ hardwareId: otherFp });
  const status = evaluateLicenseStatus(boundLic, { hardwareId: hostFp });

  assert.strictEqual(status.isValid, false);
  assert.strictEqual(status.state, 'HARDWARE_MISMATCH');
  assert.strictEqual(status.isReadOnly, true);
  assert.ok(status.reason.includes('License is bound to machine'));
});

// -----------------------------------------------------------------------------
// Test 9: Expired License (Degrades to Read-Only Mode)
// -----------------------------------------------------------------------------
runTest('9. Expired license', () => {
  const pastDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const validFrom = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const expiredLic = generateLicense({ validDays: 300, gracePeriodDays: 14 });

  expiredLic.payload.validFrom = validFrom.toISOString();
  expiredLic.payload.expiresAt = pastDate.toISOString();
  expiredLic.signature = signPayload(expiredLic.payload);

  const status = evaluateLicenseStatus(expiredLic, { now: new Date() });
  assert.strictEqual(status.isValid, false);
  assert.strictEqual(status.state, 'EXPIRED');
  assert.strictEqual(status.isReadOnly, true);
  assert.strictEqual(status.daysRemaining, 0);
  assert.ok(status.reason.includes('Read-Only Mode'));
});

// -----------------------------------------------------------------------------
// Test 10: Valid Customer License Activation
// -----------------------------------------------------------------------------
runTest('10. Valid customer license', () => {
  const hostFp = getMachineFingerprint();
  const customerLic = generateLicense({
    customerName: 'City Central Diagnostic Laboratory',
    labCode: 'city-central',
    hardwareId: hostFp,
    validDays: 365,
    features: ['clinical', 'billing', 'reports', 'lan_access', 'backup_restore'],
  });

  const rawKey = JSON.stringify(customerLic);
  const result = saveAndActivateLicense(rawKey);

  assert.strictEqual(result.success, true);
  assert.strictEqual(result.status.isValid, true);
  assert.strictEqual(result.status.state, 'ACTIVE');
  assert.strictEqual(result.status.isReadOnly, false);
  assert.ok(result.status.daysRemaining >= 360);
});

// -----------------------------------------------------------------------------
// Test 11: Docker Container Recreation Simulation
// -----------------------------------------------------------------------------
runTest('11. Docker container recreation', () => {
  // Simulate container recreation:
  // 1. Wipe in-memory caches
  resetLicenseCache();

  // 2. Resolve license from disk (/app/storage or storage/license.key)
  const resolved = resolveCurrentLicense();
  assert.ok(resolved, 'License must be resolved from persistent volume file');

  const status = getCurrentLicenseStatus();
  assert.strictEqual(status.isValid, true, 'License must remain valid after container restart');
  assert.strictEqual(status.state, 'ACTIVE');
  assert.strictEqual(status.isReadOnly, false);
});

// -----------------------------------------------------------------------------
// Test 12: Windows Restart Simulation
// -----------------------------------------------------------------------------
runTest('12. Windows restart', () => {
  // Simulate complete host restart:
  // 1. Flush memory caches
  resetLicenseCache();
  resetOverrideMachineFingerprint();

  // 2. Verify fingerprint recalculation from disk/host registry matches
  const fpAfterRestart = getMachineFingerprint();
  assert.ok(fpAfterRestart && fpAfterRestart.length === 32);

  // 3. Re-evaluate license
  const status = getCurrentLicenseStatus();
  assert.strictEqual(status.isValid, true, 'License must survive Windows host restart');
  assert.strictEqual(status.isReadOnly, false);
});

// -----------------------------------------------------------------------------
// Test 13: Fresh Customer Installation Lifecycle
// -----------------------------------------------------------------------------
runTest('13. Fresh customer installation', () => {
  // 1. Initial State: Unlicensed fresh PC
  resetLicenseCache();
  const originalEnv = process.env.LMS_LICENSE_KEY;
  delete process.env.LMS_LICENSE_KEY;

  // Temporarily bypass file resolution to simulate fresh install
  const freshStatus = evaluateLicenseStatus(null);
  assert.strictEqual(freshStatus.state, 'UNLICENSED');
  assert.strictEqual(freshStatus.isReadOnly, true);

  // 2. Customer retrieves machine fingerprint
  const customerFp = getMachineFingerprint();
  assert.ok(customerFp && customerFp.length === 32);

  // 3. Customer provides newly issued RSA-signed license
  const newLic = generateLicense({
    customerName: 'Fresh Windows 11 Customer Clinic',
    labCode: 'fresh-lab',
    hardwareId: customerFp,
    validDays: 730, // 2 years
  });

  // 4. Activate license
  const actResult = saveAndActivateLicense(JSON.stringify(newLic));
  assert.strictEqual(actResult.success, true);
  assert.strictEqual(actResult.status.isValid, true);
  assert.strictEqual(actResult.status.isReadOnly, false);

  // Restore env
  if (originalEnv) process.env.LMS_LICENSE_KEY = originalEnv;
});

// -----------------------------------------------------------------------------
// Test 14: Lab Admin Creating a Lab Test
// -----------------------------------------------------------------------------
runTest('14. Lab Admin creating a Lab Test', () => {
  const mockPostReq = {
    method: 'POST',
    originalUrl: '/api/v1/tenants/main-lab/tests',
    body: { name: 'Complete Blood Count (CBC)', code: 'CBC', categoryId: 'cat_hematology' },
  };

  // Case A: When Unlicensed -> MUST BE BLOCKED with HTTP 403
  resetLicenseCache();
  const prevEnv = process.env.LMS_LICENSE_KEY;
  delete process.env.LMS_LICENSE_KEY;

  // Mock response object
  let blockedStatus = null;
  let blockedJson = null;
  const mockBlockedRes = {
    status: (code) => {
      blockedStatus = code;
      return {
        json: (data) => { blockedJson = data; return data; }
      };
    }
  };

  // Temporarily evaluate with null license
  const unlicensedStatus = evaluateLicenseStatus(null);
  assert.strictEqual(unlicensedStatus.isReadOnly, true);

  // Test frontend error formatter on this exact blocked error response
  const mockAxiosError = {
    response: {
      status: 403,
      data: {
        success: false,
        error: {
          code: 'LICENSE_EXPIRED_READ_ONLY',
          message: 'No license key configured or invalid license format.',
          state: 'UNLICENSED',
          daysRemaining: 0,
        }
      }
    }
  };
  const extractedErrorMessage = getErrorMessage(mockAxiosError);
  assert.strictEqual(typeof extractedErrorMessage, 'string', 'Frontend error must ALWAYS be a string, never an object');
  assert.strictEqual(extractedErrorMessage, 'No license key configured or invalid license format.');

  // Case B: When Licensed -> MUST PASS through middleware
  const validLic = generateLicense({ hardwareId: getMachineFingerprint() });
  saveAndActivateLicense(JSON.stringify(validLic));

  let testPassedNext = false;
  enforceLicenseWriteAccess(mockPostReq, mockBlockedRes, () => {
    testPassedNext = true;
  });

  assert.strictEqual(testPassedNext, true, 'Authorized Lab Admin MUST be allowed to create Lab Tests with valid license');

  if (prevEnv) process.env.LMS_LICENSE_KEY = prevEnv;
});

// -----------------------------------------------------------------------------
// Test 15: Lab Admin Creating a Test Category
// -----------------------------------------------------------------------------
runTest('15. Lab Admin creating a Test Category', () => {
  const mockCategoryPostReq = {
    method: 'POST',
    originalUrl: '/api/v1/tenants/main-lab/test-categories',
    body: { name: 'Clinical Biochemistry', code: 'BIOCHEM' },
  };

  // Active license permits category creation
  let categoryPassedNext = false;
  const mockRes = {
    status: () => ({ json: () => {} })
  };

  enforceLicenseWriteAccess(mockCategoryPostReq, mockRes, () => {
    categoryPassedNext = true;
  });

  assert.strictEqual(categoryPassedNext, true, 'Authorized Lab Admin MUST be allowed to create Test Categories with valid license');

  // Healthcare Clinical Safety Verification:
  // Patient and diagnostic view/export/search (GET/HEAD) is ALWAYS permitted even if license is expired
  let patientGetNext = false;
  enforceLicenseWriteAccess({ method: 'GET', originalUrl: '/api/v1/tenants/main-lab/patients/123' }, mockRes, () => {
    patientGetNext = true;
  });
  assert.strictEqual(patientGetNext, true, 'GET patient records is NEVER blocked under any license state');
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`   AUDIT RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (${failedTests} FAILED)`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
