/**
 * LMS Medical365 - Phase 5 Deployment, Backup, Restore & Licensing Test Suite
 * 
 * Verifies:
 * - Phase 5A: Windows Installer configuration & safety directives
 * - Phase 5B: Application Startup, Shutdown & Status script contracts
 * - Phase 5C: Enterprise BSON Backup, SHA-256 manifests, retention policy & disk check
 * - Phase 5D: Safe Restore, manifest validation, dry-run, mandatory confirmation token
 * - Phase 5E: Offline RSA-2048 Licensing, signature verification, tamper resistance,
 *             expiration handling, and healthcare read-only safety
 * - Phase 5F: Safe Update System configuration preservation
 * - Phase 5G: Management Dashboard Console integration
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import backupService, {
  computeFileSha256,
  resolveBackupDir,
  checkDiskSpace,
  pruneOldBackups,
  validateBackupArchive,
} from '../src/services/backup.service.js';

import restoreService, {
  deserializeBsonFile,
} from '../src/services/restore.service.js';

import licenseService, {
  canonicalizePayload,
  verifySignature,
  evaluateLicenseStatus,
  getMachineFingerprint,
  enforceLicenseWriteAccess,
  loadPublicKey,
} from '../src/services/license.service.js';

import { signPayload, generateLicense } from './generate-license.js';

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
    console.log(`  [PASS] Test ${totalTests}: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  [FAIL] Test ${totalTests}: ${name}`);
    console.error(`         ${err.message}`);
  }
}

async function runAsyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  [PASS] Test ${totalTests}: ${name}`);
  } catch (err) {
    failedTests++;
    console.error(`  [FAIL] Test ${totalTests}: ${name}`);
    console.error(`         ${err.message}`);
  }
}

console.log('\n======================================================================');
console.log('   LMS MEDICAL365 — PHASE 5 AUTOMATED VERIFICATION SUITE');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// 1. Phase 5B: Application Lifecycle Scripts
// -----------------------------------------------------------------------------
console.log('--- 1. Application Startup, Shutdown & Status Scripts (Phase 5B) ---');

runTest('start-lms.ps1 script exists and contains health timeout & IP detection', () => {
  const filePath = path.join(rootDir, 'scripts/start-lms.ps1');
  assert.ok(fs.existsSync(filePath), 'scripts/start-lms.ps1 must exist');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(content.includes('Get-DockerPath'), 'Must implement Docker CLI detection');
  assert.ok(content.includes('docker compose'), 'Must invoke docker compose');
  assert.ok(content.includes('Get-NetIPAddress'), 'Must determine central server LAN IP');
  assert.ok(content.includes('TimeoutSeconds'), 'Must support configurable health timeout');
});

runTest('stop-lms.ps1 script exists and preserves volumes while stopping services', () => {
  const filePath = path.join(rootDir, 'scripts/stop-lms.ps1');
  assert.ok(fs.existsSync(filePath), 'scripts/stop-lms.ps1 must exist');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(content.includes('lms_local_frontend'), 'Must stop frontend');
  assert.ok(content.includes('lms_local_backend'), 'Must stop backend');
  assert.ok(content.includes('lms_local_mongo'), 'Must stop mongo daemon safely');
  assert.ok(!content.includes('down -v'), 'Must NEVER run down -v (volume wipe)');
  assert.ok(!content.includes('volume rm'), 'Must NEVER run volume rm');
});

runTest('restart-lms.ps1 script cleanly chains stop and start', () => {
  const filePath = path.join(rootDir, 'scripts/restart-lms.ps1');
  assert.ok(fs.existsSync(filePath), 'scripts/restart-lms.ps1 must exist');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(content.includes('stop-lms.ps1'), 'Must invoke stop-lms.ps1');
  assert.ok(content.includes('start-lms.ps1'), 'Must invoke start-lms.ps1');
});

runTest('status-lms.ps1 enforces port isolation (Frontend: 80, Backend: 5000 internal, Mongo: 27017 internal)', () => {
  const filePath = path.join(rootDir, 'scripts/status-lms.ps1');
  assert.ok(fs.existsSync(filePath), 'scripts/status-lms.ps1 must exist');
  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(content.includes('lms_local_frontend'), 'Must probe frontend container');
  assert.ok(content.includes('lms_local_backend'), 'Must probe backend container');
  assert.ok(content.includes('lms_local_mongo'), 'Must probe mongo container');
  assert.ok(content.includes('5000 is INTERNAL ONLY'), 'Must check backend 5000 isolation');
  assert.ok(content.includes('27017 is INTERNAL ONLY'), 'Must check MongoDB 27017 isolation');
  assert.ok(content.includes('/api/health'), 'Must probe HTTP API endpoint');
});

// -----------------------------------------------------------------------------
// 2. Phase 5C: Automated Backup Service
// -----------------------------------------------------------------------------
console.log('\n--- 2. Automated Database Backup System (Phase 5C) ---');

runTest('resolveBackupDir forbids storage inside server/src or client/src', () => {
  assert.throws(() => {
    resolveBackupDir(path.resolve('server/src/backups'));
  }, /Backups must reside outside source code trees/);

  assert.throws(() => {
    resolveBackupDir(path.resolve('client/src/backups'));
  }, /Backups must reside outside source code trees/);

  const safePath = resolveBackupDir('backups/test');
  assert.ok(safePath.includes('backups'), 'Safe path outside src should be accepted');
});

runTest('checkDiskSpace reports sufficient space for valid paths', () => {
  const result = checkDiskSpace(rootDir, 1024 * 1024); // 1 MB check
  assert.strictEqual(result.sufficient, true);
});

runTest('computeFileSha256 calculates accurate cryptographic hash', () => {
  const tempFile = path.join(rootDir, '.test_sha_temp.txt');
  fs.writeFileSync(tempFile, 'LMS Medical365 Cryptographic Integrity Test', 'utf8');
  try {
    const sha = computeFileSha256(tempFile);
    assert.strictEqual(typeof sha, 'string');
    assert.strictEqual(sha.length, 64);
    // Known SHA-256 for this exact string
    const expected = crypto.createHash('sha256').update('LMS Medical365 Cryptographic Integrity Test').digest('hex');
    assert.strictEqual(sha, expected);
  } finally {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
});

runTest('pruneOldBackups prunes expired snapshots while protecting non-backup folders', () => {
  const testBase = path.join(rootDir, '.test_backups_prune');
  const oldBackupDir = path.join(testBase, 'lms_backup_2020-01-01T00-00-00');
  const freshBackupDir = path.join(testBase, 'lms_backup_2099-01-01T00-00-00');
  const protectedFolder = path.join(testBase, 'custom_user_folder');

  fs.mkdirSync(oldBackupDir, { recursive: true });
  fs.mkdirSync(freshBackupDir, { recursive: true });
  fs.mkdirSync(protectedFolder, { recursive: true });

  // Add manifest to old backup
  fs.writeFileSync(path.join(oldBackupDir, 'manifest.json'), JSON.stringify({ status: 'SUCCESS' }), 'utf8');
  // Backdate old folder mtime
  const pastTime = new Date('2020-01-01T00:00:00Z');
  fs.utimesSync(oldBackupDir, pastTime, pastTime);

  // Add manifest to fresh backup
  fs.writeFileSync(path.join(freshBackupDir, 'manifest.json'), JSON.stringify({ status: 'SUCCESS' }), 'utf8');

  try {
    const pruned = pruneOldBackups(testBase, 14);
    assert.strictEqual(pruned, 1, 'Should prune exactly 1 expired backup');
    assert.strictEqual(fs.existsSync(oldBackupDir), false, 'Expired backup must be deleted');
    assert.strictEqual(fs.existsSync(freshBackupDir), true, 'Fresh backup must be preserved');
    assert.strictEqual(fs.existsSync(protectedFolder), true, 'Non-backup folder must NEVER be deleted');
  } finally {
    fs.rmSync(testBase, { recursive: true, force: true });
  }
});

runTest('backup-lms.ps1 script exists and supports list, validate, and retention parameters', () => {
  const scriptPath = path.join(rootDir, 'scripts/backup-lms.ps1');
  assert.ok(fs.existsSync(scriptPath));
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.ok(content.includes('RetentionDays'), 'Must accept RetentionDays');
  assert.ok(content.includes('docker cp'), 'Must copy container backup snapshot to host storage');
  assert.ok(content.includes('List'), 'Must support -List parameter');
});

// -----------------------------------------------------------------------------
// 3. Phase 5D: Safe Restore System
// -----------------------------------------------------------------------------
console.log('\n--- 3. Safe Database Restore System (Phase 5D) ---');

runTest('validateBackupArchive detects missing files and manifest status', () => {
  const tempDir = path.join(rootDir, '.test_invalid_backup');
  fs.mkdirSync(tempDir, { recursive: true });
  try {
    // Missing manifest.json
    let res = validateBackupArchive(tempDir);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors[0].includes('manifest.json not found'));

    // Manifest with FAILED status
    fs.writeFileSync(path.join(tempDir, 'manifest.json'), JSON.stringify({ status: 'FAILED' }), 'utf8');
    res = validateBackupArchive(tempDir);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errors[0].includes('not \'SUCCESS\''));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

runTest('restoreBackup rejects execution when confirmation token is not RESTORE-CONFIRM', async () => {
  await assert.rejects(
    async () => {
      await restoreService.restoreBackup({
        backupPath: rootDir,
        confirmationToken: 'wrong-token',
        dryRun: false,
      });
    },
    /Missing or invalid confirmation token/
  );
});

runTest('restoreBackup dryRun previews plan without altering database', async () => {
  const dummyBackup = path.join(rootDir, '.test_dryrun_backup');
  const dummyDbDir = path.join(dummyBackup, 'lms_master');
  fs.mkdirSync(dummyDbDir, { recursive: true });

  const dummyBson = path.join(dummyDbDir, 'patients.bson');
  const dummyMeta = path.join(dummyDbDir, 'patients.metadata.json');
  fs.writeFileSync(dummyBson, Buffer.alloc(0));
  fs.writeFileSync(dummyMeta, JSON.stringify({ indexes: [] }));
  const hash = computeFileSha256(dummyBson);

  const manifest = {
    backupId: 'lms_backup_test_dryrun',
    status: 'SUCCESS',
    createdAt: new Date().toISOString(),
    databases: [
      {
        name: 'lms_master',
        collectionsCount: 1,
        documentsCount: 0,
        collections: [
          { name: 'patients', documents: 0, sha256: hash },
        ],
      },
    ],
  };
  fs.writeFileSync(path.join(dummyBackup, 'manifest.json'), JSON.stringify(manifest), 'utf8');

  try {
    const preview = await restoreService.restoreBackup({
      backupPath: dummyBackup,
      dryRun: true,
      logger: { info: () => {} },
    });
    assert.strictEqual(preview.mode, 'DRY_RUN');
    assert.strictEqual(preview.databasesToRestore.length, 1);
    assert.strictEqual(preview.databasesToRestore[0].database, 'lms_master');
  } finally {
    fs.rmSync(dummyBackup, { recursive: true, force: true });
  }
});

// -----------------------------------------------------------------------------
// 4. Phase 5E: Offline Asymmetric Licensing System
// -----------------------------------------------------------------------------
console.log('\n--- 4. Offline Asymmetric Licensing System (Phase 5E) ---');

runTest('canonicalizePayload creates identical strings regardless of object key order', () => {
  const obj1 = { z: 1, a: 2, m: { nestedB: true, nestedA: 'hello' } };
  const obj2 = { a: 2, m: { nestedA: 'hello', nestedB: true }, z: 1 };
  assert.strictEqual(canonicalizePayload(obj1), canonicalizePayload(obj2));
});

runTest('RSA-2048 signature verification succeeds with embedded public key', () => {
  const license = generateLicense({
    customerName: 'Metropolis Health Laboratory',
    labCode: 'metro-lab',
    validDays: 365,
  });

  const publicKeyPem = loadPublicKey();
  assert.ok(publicKeyPem, 'Public key PEM must load from server/src/config/licensePublicKey.pem');

  const isValid = verifySignature(license.payload, license.signature, publicKeyPem);
  assert.strictEqual(isValid, true, 'Cryptographic signature must be valid');
});

runTest('Tamper resistance: Altering any payload field invalidates the signature', () => {
  const license = generateLicense({
    customerName: 'Metropolis Health Laboratory',
    maxUsers: 10,
  });

  const publicKeyPem = loadPublicKey();

  // Tamper with maxUsers: try upgrading from 10 to 999 users without vendor signature
  const tamperedPayload = { ...license.payload, maxUsers: 999 };
  const isValid = verifySignature(tamperedPayload, license.signature, publicKeyPem);
  assert.strictEqual(isValid, false, 'Tampered payload must FAIL signature verification');

  // Tamper with customer name
  const tamperedCustomer = { ...license.payload, customer: { ...license.payload.customer, name: 'Pirated Lab' } };
  assert.strictEqual(verifySignature(tamperedCustomer, license.signature, publicKeyPem), false);
});

runTest('Tamper resistance: Altering signature string invalidates license', () => {
  const license = generateLicense();
  const publicKeyPem = loadPublicKey();
  const tamperedSignature = license.signature.substring(0, 10) + 'A' + license.signature.substring(11);
  const isValid = verifySignature(license.payload, tamperedSignature, publicKeyPem);
  assert.strictEqual(isValid, false, 'Tampered signature string must FAIL verification');
});

runTest('evaluateLicenseStatus recognizes ACTIVE license within valid period', () => {
  const license = generateLicense({ validDays: 365 });
  const status = evaluateLicenseStatus(license, { now: new Date() });
  assert.strictEqual(status.isValid, true);
  assert.strictEqual(status.state, 'ACTIVE');
  assert.strictEqual(status.isReadOnly, false);
  assert.ok(status.daysRemaining > 300);
});

runTest('evaluateLicenseStatus enters GRACE_PERIOD when expired within 14 days', () => {
  const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // Expired 5 days ago
  const validFromDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  const license = generateLicense({
    validDays: 300,
    gracePeriodDays: 14,
  });
  license.payload.validFrom = validFromDate.toISOString();
  license.payload.expiresAt = pastDate.toISOString();
  license.signature = signPayload(license.payload);

  const status = evaluateLicenseStatus(license, { now: new Date() });
  assert.strictEqual(status.isValid, true);
  assert.strictEqual(status.state, 'GRACE_PERIOD');
  assert.strictEqual(status.isReadOnly, false); // Remains operational in grace period
  assert.strictEqual(status.daysRemaining, 9); // 14 - 5 = 9 days remaining in grace period
});

runTest('evaluateLicenseStatus transitions to EXPIRED & READ-ONLY after grace period ends', () => {
  const pastExpired = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Expired 30 days ago (grace was 14)
  const license = generateLicense({
    validDays: 300,
    gracePeriodDays: 14,
  });
  license.payload.expiresAt = pastExpired.toISOString();
  license.signature = signPayload(license.payload);

  const status = evaluateLicenseStatus(license, { now: new Date() });
  assert.strictEqual(status.isValid, false);
  assert.strictEqual(status.state, 'EXPIRED');
  assert.strictEqual(status.isReadOnly, true);
  assert.ok(status.reason.includes('operating in Read-Only Mode'));
});

runTest('Healthcare Safety: Patient records are NEVER locked from view/print when license expired', () => {
  // Mock req/res for enforceLicenseWriteAccess middleware
  let nextCalled = false;
  const mockGetReq = { method: 'GET', originalUrl: '/api/v1/tenants/main-lab/patients' };
  const mockRes = {
    status: () => mockRes,
    json: () => mockRes,
  };

  enforceLicenseWriteAccess(mockGetReq, mockRes, () => {
    nextCalled = true;
  });

  assert.strictEqual(nextCalled, true, 'GET requests must ALWAYS proceed unconditionally even if license is expired');

  let headCalled = false;
  enforceLicenseWriteAccess({ method: 'HEAD', originalUrl: '/api/v1/tenants/main-lab/reports/123/pdf' }, mockRes, () => {
    headCalled = true;
  });
  assert.strictEqual(headCalled, true, 'HEAD / print preview requests must proceed unconditionally');
});

runTest('Hardware Fingerprint binding verifies matching ID or wildcard', () => {
  const hostHw = getMachineFingerprint();
  assert.ok(hostHw.length >= 16);

  // Wildcard license
  const wildcardLic = generateLicense({ hardwareId: '*' });
  const statusWild = evaluateLicenseStatus(wildcardLic, { hardwareId: hostHw });
  assert.strictEqual(statusWild.isValid, true);

  // Exact match
  const boundLic = generateLicense({ hardwareId: hostHw });
  const statusMatch = evaluateLicenseStatus(boundLic, { hardwareId: hostHw });
  assert.strictEqual(statusMatch.isValid, true);

  // Mismatched machine
  const mismatchLic = generateLicense({ hardwareId: 'DIFFERENT-MACHINE-1234' });
  const statusMismatch = evaluateLicenseStatus(mismatchLic, { hardwareId: hostHw });
  assert.strictEqual(statusMismatch.isValid, false);
  assert.strictEqual(statusMismatch.state, 'HARDWARE_MISMATCH');
  assert.strictEqual(statusMismatch.isReadOnly, true);
});

// -----------------------------------------------------------------------------
// 5. Phase 5F: Safe Update System
// -----------------------------------------------------------------------------
console.log('\n--- 5. Safe Application Update System (Phase 5F) ---');

runTest('update-lms.ps1 enforces pre-update backup and preserves local.env', () => {
  const updateScript = path.join(rootDir, 'scripts/update-lms.ps1');
  assert.ok(fs.existsSync(updateScript));
  const content = fs.readFileSync(updateScript, 'utf8');
  assert.ok(content.includes('backup-lms.ps1'), 'Must trigger automated pre-update backup snapshot');
  assert.ok(content.includes('local.env.bak'), 'Must preserve docker/local.env in staging backup');
  assert.ok(content.includes('license.key.bak'), 'Must preserve license key during update');
  assert.ok(content.includes('status-lms.ps1'), 'Must perform post-update status inspection');
  assert.ok(content.includes('restore-lms.ps1'), 'Must provide rollback instructions');
});

// -----------------------------------------------------------------------------
// 6. Phase 5G: Management Dashboard Console
// -----------------------------------------------------------------------------
console.log('\n--- 6. Management Operations Launcher (Phase 5G) ---');

runTest('manage-lms.ps1 provides full interactive operations menu', () => {
  const manageScript = path.join(rootDir, 'scripts/manage-lms.ps1');
  assert.ok(fs.existsSync(manageScript));
  const content = fs.readFileSync(manageScript, 'utf8');
  assert.ok(content.includes('status-lms.ps1'), 'Option for status check');
  assert.ok(content.includes('start-lms.ps1'), 'Option for starting services');
  assert.ok(content.includes('stop-lms.ps1'), 'Option for stopping services');
  assert.ok(content.includes('restart-lms.ps1'), 'Option for restart');
  assert.ok(content.includes('backup-lms.ps1'), 'Option for backup');
  assert.ok(content.includes('restore-lms.ps1'), 'Option for restore');
  assert.ok(content.includes('/api/v1/system/license'), 'Option for license query');
  assert.ok(content.includes('update-lms.ps1'), 'Option for safe update');
  assert.ok(content.includes('Start-Process'), 'Option for browser launch');
});

// -----------------------------------------------------------------------------
// 7. Phase 5A: Windows Installer Specification
// -----------------------------------------------------------------------------
console.log('\n--- 7. Windows Installer Specification (Phase 5A) ---');

runTest('Inno Setup script enforces 64-bit Windows, 10GB disk, elevation & data protection', () => {
  const issPath = path.join(rootDir, 'installer/build-installer.iss');
  assert.ok(fs.existsSync(issPath));
  const content = fs.readFileSync(issPath, 'utf8');
  assert.ok(content.includes('ArchitecturesAllowed=x64compatible'), 'Must require 64-bit Windows');
  assert.ok(content.includes('MinVersion=10.0'), 'Must require Windows 10/11');
  assert.ok(content.includes('PrivilegesRequired=admin'), 'Must require Administrator elevation');
  assert.ok(content.includes('ExtraDiskSpaceRequired=10737418240'), 'Must check 10 GB disk space');
  assert.ok(content.includes('onlyifdoesntexist uninsneveruninstall'), 'Must protect local.env and license.key');
  assert.ok(content.includes('IsDockerInstalled'), 'Must verify Docker Desktop presence in Pascal script');
  assert.ok(content.includes('netsh.exe') && content.includes('localport=80'), 'Must configure Port 80 firewall rule');
  assert.ok(content.includes('preserve all existing patient records'), 'Must prompt to preserve databases on uninstall');
});

runTest('launcher.bat exists to launch manage-lms.ps1 from desktop shortcut', () => {
  const batPath = path.join(rootDir, 'installer/launcher.bat');
  assert.ok(fs.existsSync(batPath));
  const content = fs.readFileSync(batPath, 'utf8');
  assert.ok(content.includes('manage-lms.ps1'));
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`Phase 5 Test Suite Finished: ${passedTests} / ${totalTests} Passed (${failedTests} Failed)`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
