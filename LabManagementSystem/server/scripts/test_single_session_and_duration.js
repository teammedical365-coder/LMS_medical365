/**
 * Test Suite: Verify Single-Device Session Enforcement & 7-Day Token Lifetime
 */

import jwt from 'jsonwebtoken';
import tokenService from '../src/services/token.service.js';
import authService from '../src/services/auth.service.js';
import config from '../src/config/env.js';
import dbConnection from '../src/config/db.js';
import PlatformAdminModel from '../src/models/platformAdmin.model.js';
import tenantConnectionService from '../src/services/tenantConnection.service.js';
import TenantModel from '../src/models/tenant.model.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n====================================================');
  console.log('TEST SUITE: 7-DAY EXPIRATION & SINGLE ACTIVE DEVICE');
  console.log('====================================================\n');

  // [TEST 1] Configuration Verification
  console.log('[1] Token Duration Configuration:');
  assert(tokenService.expiresIn === '7d' || tokenService.expiresIn === (process.env.JWT_EXPIRES_IN || '7d'), 'tokenService.expiresIn is 7d');
  const cookieOpts = tokenService.getCookieOptions();
  assert(cookieOpts.maxAge === 7 * 24 * 60 * 60 * 1000, 'Cookie maxAge is 604800000 ms (7 days)');

  // [TEST 2] Generated Token Expiry Check
  console.log('\n[2] Token Payload Expiry Claim:');
  const testAdmin = { adminId: 'adm_test_123', email: 'admintest@hospital.com', role: 'super_admin' };
  const token = tokenService.generatePlatformAdminToken(testAdmin, 'ses_test_1');
  const decoded = tokenService.verifyToken(token);
  assert(decoded.sessionId === 'ses_test_1', 'Token payload contains sessionId');
  const expiryDeltaHours = (decoded.exp - decoded.iat) / 3600;
  assert(Math.round(expiryDeltaHours) === 168, `Token lifespan is 168 hours (7 days, actual: ${expiryDeltaHours}h)`);

  // [TEST 3] Single Active Device Session Validation
  console.log('\n[3] Single-Device Session Validation (Platform Super Admin):');
  
  // Set session 1
  authService.setActiveSession('platform', 'adm_test_123', 'ses_device_1');
  
  const tokenDevice1 = tokenService.generatePlatformAdminToken(testAdmin, 'ses_device_1');
  const decodedDevice1 = tokenService.verifyToken(tokenDevice1);
  const isValidDev1Before = await authService.validateActiveSession(decodedDevice1);
  assert(isValidDev1Before === true, 'Device 1 session is initially VALID');

  // Device 2 logs in with same user account!
  authService.setActiveSession('platform', 'adm_test_123', 'ses_device_2');
  const tokenDevice2 = tokenService.generatePlatformAdminToken(testAdmin, 'ses_device_2');
  const decodedDevice2 = tokenService.verifyToken(tokenDevice2);

  // Device 1 attempts request after Device 2 login
  const isValidDev1After = await authService.validateActiveSession(decodedDevice1);
  assert(isValidDev1After === false, 'Device 1 session is now TERMINATED / INVALIDATED (Single Device Enforced)');

  // Device 2 attempts request
  const isValidDev2 = await authService.validateActiveSession(decodedDevice2);
  assert(isValidDev2 === true, 'Device 2 (latest device) session is VALID');

  // [TEST 4] Single Active Device Session Validation (Tenant Laboratory User)
  console.log('\n[4] Single-Device Session Validation (Tenant Laboratory Staff):');
  const testTenantUser = { userId: 'usr_staff_456', email: 'staff@alpha.com', role: 'lab_technician' };
  const tenantId = 'ten_test_lab';

  // Device A logs in
  authService.setActiveSession(tenantId, testTenantUser.userId, 'ses_phone');
  const tokenDeviceA = tokenService.generateTenantUserToken(testTenantUser, tenantId, 'ses_phone');
  const decodedDevA = tokenService.verifyToken(tokenDeviceA);
  const isDevAValid = await authService.validateActiveSession(decodedDevA);
  assert(isDevAValid === true, 'Device A (Phone) session is initially VALID');

  // Device B (Laptop) logs in with same account
  authService.setActiveSession(tenantId, testTenantUser.userId, 'ses_laptop');
  const tokenDeviceB = tokenService.generateTenantUserToken(testTenantUser, tenantId, 'ses_laptop');
  const decodedDevB = tokenService.verifyToken(tokenDeviceB);

  // Device A makes another request
  const isDevAAfter = await authService.validateActiveSession(decodedDevA);
  assert(isDevAAfter === false, 'Device A (Phone) is TERMINATED after Device B (Laptop) logged in');

  const isDevBValid = await authService.validateActiveSession(decodedDevB);
  assert(isDevBValid === true, 'Device B (Laptop) session is active and VALID');

  // [TEST 5] Logout Invalidation
  console.log('\n[5] Explicit Logout Invalidation:');
  await authService.logoutUser(decodedDevB);
  const isDevBAfterLogout = await authService.validateActiveSession(decodedDevB);
  assert(isDevBAfterLogout === false, 'Device B session is INVALIDATED upon logout');

  console.log('\n====================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
