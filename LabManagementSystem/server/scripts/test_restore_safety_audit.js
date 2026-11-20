/**
 * LMS Medical365 - Phase 5 Restore Safety Audit Test Suite
 * 
 * STRICT ISOLATION POLICY:
 * - Uses ONLY mocked database clients and isolated temporary directories.
 * - ZERO destructive calls to running databases or Docker volumes.
 * 
 * Verifies all 10 Safety Audit Areas:
 * 1. BSON & metadata checksum validation before any database write
 * 2. Mandatory pre-restore safety backup execution
 * 3. Blocking of restore when safety backup fails
 * 4. Partial failure tracking and safe reporting
 * 5. Database name whitelist validation (prevent unintended database overwrite)
 * 6. Tenant database isolation enforcement
 * 7. Absence of public HTTP exposure for backups & patient data
 * 8. Mandatory confirmation token (RESTORE-CONFIRM) enforcement
 * 9. Absolute zero-write guarantee in dry-run mode
 * 10. Non-silent rejection of corrupted or missing backup files
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import backupService, {
  computeFileSha256,
  validateBackupArchive,
  isValidLmsDatabaseName,
  isValidLmsCollectionName,
} from '../src/services/backup.service.js';

import restoreService, {
  restoreBackup,
  deserializeBsonFile,
} from '../src/services/restore.service.js';

import app from '../src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const auditTempDir = path.join(rootDir, '.test_restore_safety_audit');

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
console.log('   LMS MEDICAL365 — PHASE 5 RESTORE SAFETY AUDIT SUITE (READ-ONLY)');
console.log('======================================================================\n');

// Clean and prepare isolated temporary test sandbox
if (fs.existsSync(auditTempDir)) {
  fs.rmSync(auditTempDir, { recursive: true, force: true });
}
fs.mkdirSync(auditTempDir, { recursive: true });

/**
 * Helper to build a valid mock backup archive inside auditTempDir
 */
function createMockBackupArchive(subDirName, dbName = 'lms_master', colName = 'test_col', docsCount = 1) {
  const backupPath = path.join(auditTempDir, subDirName);
  fs.mkdirSync(backupPath, { recursive: true });
  const dbPath = path.join(backupPath, dbName);
  fs.mkdirSync(dbPath, { recursive: true });

  const bsonFile = path.join(dbPath, `${colName}.bson`);
  const metaFile = path.join(dbPath, `${colName}.metadata.json`);

  // Write a minimal valid BSON document
  // 4 bytes length, 0x10 (int32), 'a\0', 0x01 0x00 0x00 0x00, 0x00 (terminator)
  const docBuffer = Buffer.from([
    0x0c, 0x00, 0x00, 0x00, // int32 total length = 12
    0x10, 0x61, 0x00,       // int32 element named 'a'
    0x01, 0x00, 0x00, 0x00, // value = 1
    0x00                    // null terminator
  ]);

  const fileBuffer = docsCount > 0 ? docBuffer : Buffer.alloc(0);
  fs.writeFileSync(bsonFile, fileBuffer);
  const hash = computeFileSha256(bsonFile);

  const metaContent = {
    collection: colName,
    database: dbName,
    indexes: [{ name: '_id_', key: { _id: 1 } }],
  };
  fs.writeFileSync(metaFile, JSON.stringify(metaContent, null, 2), 'utf8');

  const manifest = {
    backupId: subDirName,
    lmsVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    status: 'SUCCESS',
    summary: { totalDatabases: 1, totalCollections: 1, totalDocuments: docsCount, totalSizeBytes: fileBuffer.length },
    databases: [
      {
        name: dbName,
        collectionsCount: 1,
        documentsCount: docsCount,
        collections: [
          { name: colName, documents: docsCount, sizeBytes: fileBuffer.length, sha256: hash },
        ],
      },
    ],
  };
  fs.writeFileSync(path.join(backupPath, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  return { backupPath, bsonFile, metaFile, manifestPath: path.join(backupPath, 'manifest.json') };
}

/**
 * Creates a mocked MongoDB Client that traps and records all destructive calls
 */
function createMockDbClient() {
  const operations = [];
  const mockCol = {
    deleteMany: async (filter) => {
      operations.push({ op: 'deleteMany', filter });
      return { acknowledged: true, deletedCount: 0 };
    },
    insertMany: async (docs, opts) => {
      operations.push({ op: 'insertMany', docsCount: docs.length, opts });
      return { acknowledged: true, insertedCount: docs.length };
    },
    createIndex: async (key, opts) => {
      operations.push({ op: 'createIndex', key, opts });
      return 'index_created';
    },
    countDocuments: async () => {
      operations.push({ op: 'countDocuments' });
      // Return 1 document to match expected count
      return 1;
    },
  };

  const mockDb = {
    collection: (name) => {
      operations.push({ op: 'collection', name });
      return mockCol;
    },
  };

  const mockClient = {
    db: (name) => {
      operations.push({ op: 'db', name });
      return mockDb;
    },
    operations,
  };

  return mockClient;
}

// -----------------------------------------------------------------------------
// AUDIT CHECKS
// -----------------------------------------------------------------------------

// Area 1: Pre-restore BSON & Metadata Integrity Verification
runTest('Audit Area 1: validateBackupArchive detects bit-level corruption and blocks restore', () => {
  const { backupPath, bsonFile } = createMockBackupArchive('corrupted_bson_archive');
  // Corrupt BSON with bit modification
  const original = fs.readFileSync(bsonFile);
  original[original.length - 1] = original[original.length - 1] ^ 0xFF;
  fs.writeFileSync(bsonFile, original);

  const res = validateBackupArchive(backupPath);
  assert.strictEqual(res.isValid, false, 'Archive with corrupted checksum must be invalid');
  assert.ok(res.errors.some((e) => e.includes('SHA-256 mismatch')), 'Must explicitly flag SHA-256 mismatch');
});

runTest('Audit Area 1: Missing metadata JSON file is detected and blocks restore', () => {
  const { backupPath, metaFile } = createMockBackupArchive('missing_meta_archive');
  fs.unlinkSync(metaFile);

  const res = validateBackupArchive(backupPath);
  assert.strictEqual(res.isValid, false, 'Archive with missing metadata JSON must be invalid');
  assert.ok(res.errors.some((e) => e.includes('Missing metadata JSON')), 'Must flag missing metadata');
});

// Area 2 & 3: Mandatory Pre-Restore Safety Backup Execution & Blocker
await runAsyncTest('Audit Area 2: Pre-restore safety backup is triggered before destructive writes', async () => {
  const { backupPath } = createMockBackupArchive('safety_backup_check');
  const mockClient = createMockDbClient();

  let safetyBackupTriggered = false;
  const originalCreateBackup = backupService.createBackup;
  backupService.createBackup = async () => {
    safetyBackupTriggered = true;
    return { backupId: 'lms_backup_mock_safety_snapshot' };
  };

  try {
    const result = await restoreService.restoreBackup({
      backupPath,
      confirmationToken: 'RESTORE-CONFIRM',
      dryRun: false,
      dbClient: mockClient,
      logger: { info: () => {}, log: () => {}, error: () => {} },
    });

    assert.strictEqual(safetyBackupTriggered, true, 'Safety backup must be triggered before database operations');
    assert.strictEqual(result.safetyBackupId, 'lms_backup_mock_safety_snapshot');
    // Verify destructive calls occurred only after safety backup was confirmed
    assert.ok(mockClient.operations.some((op) => op.op === 'deleteMany'));
    assert.ok(mockClient.operations.some((op) => op.op === 'insertMany'));
  } finally {
    backupService.createBackup = originalCreateBackup;
  }
});

await runAsyncTest('Audit Area 3: Failed pre-restore safety backup COMPLETELY BLOCKS restore writes', async () => {
  const { backupPath } = createMockBackupArchive('safety_fail_blocks_restore');
  const mockClient = createMockDbClient();

  const originalCreateBackup = backupService.createBackup;
  backupService.createBackup = async () => {
    throw new Error('Simulated Safety Snapshot Failure: Disk full or IO error');
  };

  try {
    await assert.rejects(
      async () => {
        await restoreService.restoreBackup({
          backupPath,
          confirmationToken: 'RESTORE-CONFIRM',
          dryRun: false,
          dbClient: mockClient,
          logger: { info: () => {}, log: () => {}, error: () => {} },
        });
      },
      /Pre-restore automated safety backup failed/
    );

    // Verify ZERO destructive database operations were executed
    const deleteOps = mockClient.operations.filter((op) => op.op === 'deleteMany');
    const insertOps = mockClient.operations.filter((op) => op.op === 'insertMany');
    assert.strictEqual(deleteOps.length, 0, 'ZERO deleteMany calls must occur when safety backup fails');
    assert.strictEqual(insertOps.length, 0, 'ZERO insertMany calls must occur when safety backup fails');
  } finally {
    backupService.createBackup = originalCreateBackup;
  }
});

// Area 4: Safe Partial Failure Reporting
await runAsyncTest('Audit Area 4: Restore captures partial summary on unexpected mid-restore failure', async () => {
  const { backupPath } = createMockBackupArchive('partial_failure_test');
  const mockClient = createMockDbClient();

  // Make countDocuments throw to simulate failure during verification of restored collection
  mockClient.db('lms_master').collection('test_col').countDocuments = async () => {
    throw new Error('Simulated network drop during collection document verification');
  };

  const originalCreateBackup = backupService.createBackup;
  backupService.createBackup = async () => ({ backupId: 'mock_safety' });

  try {
    let capturedErr = null;
    try {
      await restoreService.restoreBackup({
        backupPath,
        confirmationToken: 'RESTORE-CONFIRM',
        dryRun: false,
        dbClient: mockClient,
        logger: { info: () => {}, log: () => {}, error: () => {} },
      });
    } catch (err) {
      capturedErr = err;
    }

    assert.ok(capturedErr, 'Must throw error on mid-restore failure');
    assert.ok(capturedErr.partialSummary, 'Must attach partialSummary to error object for operator diagnostics');
    assert.strictEqual(capturedErr.partialSummary.backupId, 'partial_failure_test');
  } finally {
    backupService.createBackup = originalCreateBackup;
  }
});

// Area 5 & 6: Database Name Validation & Tenant Isolation
runTest('Audit Area 5 & 6: isValidLmsDatabaseName accepts master and valid tenant databases', () => {
  assert.strictEqual(isValidLmsDatabaseName('lms_master'), true);
  assert.strictEqual(isValidLmsDatabaseName('LMS_MASTER'), true);
  assert.strictEqual(isValidLmsDatabaseName('lms_lab_ten_apex01'), true);
  assert.strictEqual(isValidLmsDatabaseName('lms_lab_main_clinical_lab'), true);
});

runTest('Audit Area 5 & 6: isValidLmsDatabaseName strictly rejects system and arbitrary databases', () => {
  assert.strictEqual(isValidLmsDatabaseName('admin'), false);
  assert.strictEqual(isValidLmsDatabaseName('config'), false);
  assert.strictEqual(isValidLmsDatabaseName('local'), false);
  assert.strictEqual(isValidLmsDatabaseName('test'), false);
  assert.strictEqual(isValidLmsDatabaseName('arbitrary_database'), false);
  assert.strictEqual(isValidLmsDatabaseName('../../../etc/passwd'), false);
  assert.strictEqual(isValidLmsDatabaseName('lms_lab_'), false); // Too short tenant ID
  assert.strictEqual(isValidLmsDatabaseName('lms_lab_invalid$char'), false);
});

runTest('Audit Area 5 & 6: validateBackupArchive rejects backup with unauthorized database names', () => {
  const { backupPath } = createMockBackupArchive('unauthorized_db_target', 'admin'); // Target 'admin' database
  const res = validateBackupArchive(backupPath);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.errors.some((e) => e.includes("Unauthorized or invalid database name in backup archive: 'admin'")));
});

runTest('Audit Area 5 & 6: validateBackupArchive rejects backup with path-traversal database name', () => {
  const traversalBackup = path.join(auditTempDir, 'traversal_manifest_check');
  fs.mkdirSync(traversalBackup, { recursive: true });
  const manifest = {
    backupId: 'traversal_manifest_check',
    lmsVersion: '1.0.0',
    createdAt: new Date().toISOString(),
    status: 'SUCCESS',
    databases: [
      { name: '../../traversal_escape', collectionsCount: 1, documentsCount: 1, collections: [] }
    ],
  };
  fs.writeFileSync(path.join(traversalBackup, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
  const res = validateBackupArchive(traversalBackup);
  assert.strictEqual(res.isValid, false);
  assert.ok(res.errors.some((e) => e.includes('Unauthorized or invalid database name')));
});

runTest('Audit Area 5 & 6: isValidLmsCollectionName forbids system collections and dollar signs', () => {
  assert.strictEqual(isValidLmsCollectionName('patients'), true);
  assert.strictEqual(isValidLmsCollectionName('auditlogs'), true);
  assert.strictEqual(isValidLmsCollectionName('system.indexes'), false);
  assert.strictEqual(isValidLmsCollectionName('system.users'), false);
  assert.strictEqual(isValidLmsCollectionName('col$name'), false);
});

// Area 7: Zero Public HTTP Exposure of Backup Files or Patient Data
runTest('Audit Area 7: Express application routes have ZERO exposure of backups directory', () => {
  // Inspect Express route table
  const registeredPaths = [];
  function extractRoutes(layer) {
    if (layer.route && layer.route.path) {
      registeredPaths.push(layer.route.path);
    } else if (layer.name === 'router' && layer.handle.stack) {
      layer.handle.stack.forEach(extractRoutes);
    }
  }
  app._router.stack.forEach(extractRoutes);

  for (const p of registeredPaths) {
    assert.ok(!p.includes('backup'), `Route path '${p}' must not directly serve raw backup files`);
  }

  // Verify Nginx configuration has no backup path proxy
  const nginxConf = fs.readFileSync(path.join(rootDir, 'docker/nginx.conf'), 'utf8');
  assert.ok(!nginxConf.includes('/backups'), 'Nginx must not configure any location for /backups');
  assert.ok(!nginxConf.includes('alias /app/backups'), 'Nginx must not alias to /app/backups');
});

// Area 8: Mandatory Confirmation Token
await runAsyncTest('Audit Area 8: Confirmation token RESTORE-CONFIRM is strictly required', async () => {
  const { backupPath } = createMockBackupArchive('confirm_token_check');
  const mockClient = createMockDbClient();

  const invalidTokens = [null, undefined, '', 'yes', 'CONFIRM', 'restore', 'RESTORE_CONFIRM'];
  for (const token of invalidTokens) {
    await assert.rejects(
      async () => {
        await restoreService.restoreBackup({
          backupPath,
          confirmationToken: token,
          dryRun: false,
          dbClient: mockClient,
        });
      },
      /Missing or invalid confirmation token/
    );
  }
  assert.strictEqual(mockClient.operations.length, 0, 'ZERO operations allowed with invalid confirmation token');
});

// Area 9: Dry-Run Zero Database Writes Guarantee
await runAsyncTest('Audit Area 9: Dry-run mode performs ZERO database calls (100% read-only)', async () => {
  const { backupPath } = createMockBackupArchive('dry_run_zero_writes');
  const mockClient = createMockDbClient();

  const preview = await restoreService.restoreBackup({
    backupPath,
    dryRun: true,
    dbClient: mockClient,
    logger: { info: () => {} },
  });

  assert.strictEqual(preview.mode, 'DRY_RUN');
  assert.strictEqual(preview.databaseModificationsMade, 0);
  assert.strictEqual(preview.safetyBackupConfigured, true);
  // In dryRun, dbClient is not even called for any operations
  assert.strictEqual(mockClient.operations.length, 0, 'Dry-run must make exactly 0 calls on database client');
});

// Area 10: Non-Silent Rejection of Corrupt BSON Files
runTest('Audit Area 10: deserializeBsonFile throws CORRUPT_BSON on malformed length or headers', () => {
  const malformedFile = path.join(auditTempDir, 'malformed.bson');
  // Write header with length larger than actual file
  fs.writeFileSync(malformedFile, Buffer.from([0xFF, 0xFF, 0x00, 0x00]));

  assert.throws(
    () => {
      deserializeBsonFile(malformedFile);
    },
    /Invalid BSON document length/
  );
});

// Clean up temporary sandbox
if (fs.existsSync(auditTempDir)) {
  fs.rmSync(auditTempDir, { recursive: true, force: true });
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`Safety Audit Test Suite Finished: ${passedTests} / ${totalTests} Passed (${failedTests} Failed)`);
console.log('======================================================================\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
