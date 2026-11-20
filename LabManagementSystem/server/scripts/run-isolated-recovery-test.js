/**
 * LMS Medical365 - Phase 5 Isolated Backup & Restore Recovery Test Runner
 * 
 * STRICT COMPLIANCE:
 * - Uses ONLY the disposable MongoDB container on port 27019.
 * - NEVER touches lms_local_mongo or port 27017.
 * - Uses 100% synthetic records (zero real patient data).
 * - Executes actual full backup, simulated data loss/corruption, and actual restore.
 * - Verifies pre-restore safety snapshot and post-restore document fidelity.
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

import backupService, {
  validateBackupArchive,
} from '../src/services/backup.service.js';

import restoreService from '../src/services/restore.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

const DISPOSABLE_PORT = 27019;
const DISPOSABLE_URI = `mongodb://disp_root_admin:disp_root_pass_2026_safe@127.0.0.1:${DISPOSABLE_PORT}/lms_master?authSource=admin`;
const DISPOSABLE_BACKUP_DIR = path.join(rootDir, 'backups/disposable_recovery_test');

const SYNTH_TENANT_ID = 'synth_recovery_test';
const SYNTH_TENANT_DB = `lms_lab_${SYNTH_TENANT_ID}`;
const MASTER_DB = 'lms_master';

console.log('\n======================================================================');
console.log('   LMS MEDICAL365 — PHASE 5 ISOLATED BACKUP & RESTORE RECOVERY TEST');
console.log('======================================================================\n');

async function runRecoveryTest() {
  console.log('[STAGE A] Verifying Environment Isolation & Safeguards...');
  assert.ok(DISPOSABLE_URI.includes('27019'), 'Disposable URI must strictly connect to port 27019');
  assert.ok(!DISPOSABLE_URI.includes('27017'), 'Must NEVER target port 27017');
  assert.ok(!DISPOSABLE_URI.includes('mongo:'), 'Must NEVER target container DNS mongo');

  console.log(`Connecting to isolated disposable container at 127.0.0.1:${DISPOSABLE_PORT}...`);
  await mongoose.connect(DISPOSABLE_URI, { serverSelectionTimeoutMS: 5000 });
  const client = mongoose.connection.client;

  // Confirm running database is fresh/isolated
  const adminDb = client.db().admin();
  const dbList = await adminDb.listDatabases();
  const existingNames = dbList.databases.map((d) => d.name);
  console.log(`Disposable MongoDB databases: ${existingNames.join(', ')}`);
  assert.ok(!existingNames.includes('lms_lab_ten_f1a9410eb62a'), 'Production tenant database must NOT exist on disposable container');

  // Clean disposable backup directory
  if (fs.existsSync(DISPOSABLE_BACKUP_DIR)) {
    fs.rmSync(DISPOSABLE_BACKUP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DISPOSABLE_BACKUP_DIR, { recursive: true });

  console.log('\n[STAGE B] Seeding Synthetic Records (Master + Tenant DB)...');
  const masterDb = client.db(MASTER_DB);
  const tenantDb = client.db(SYNTH_TENANT_DB);

  // Clean any previous test data on disposable databases
  await masterDb.dropDatabase().catch(() => {});
  await tenantDb.dropDatabase().catch(() => {});

  // 1. Seed Master DB
  console.log('  -> Seeding lms_master (tenants, platformadmins, auditlogs)...');
  await masterDb.collection('tenants').insertOne({
    tenantId: SYNTH_TENANT_ID,
    name: 'Synthetic Clinical Diagnostic Laboratory',
    code: 'synth-lab',
    status: 'active',
    database: { name: SYNTH_TENANT_DB, provisioningStatus: 'ready' },
    createdAt: new Date(),
  });
  await masterDb.collection('tenants').createIndex({ tenantId: 1 }, { unique: true });

  await masterDb.collection('platformadmins').insertOne({
    adminId: 'synth_admin_001',
    fullName: 'Synthetic Platform Administrator',
    email: 'synthadmin@test.local',
    createdAt: new Date(),
  });
  await masterDb.collection('platformadmins').createIndex({ adminId: 1 }, { unique: true });

  await masterDb.collection('auditlogs').insertMany([
    { eventId: 'EVT-SYNTH-01', action: 'SYNTH_ADMIN_LOGIN', targetTenantId: SYNTH_TENANT_ID, timestamp: new Date() },
    { eventId: 'EVT-SYNTH-02', action: 'SYNTH_LAB_PROVISIONED', targetTenantId: SYNTH_TENANT_ID, timestamp: new Date() },
  ]);
  await masterDb.collection('auditlogs').createIndex({ eventId: 1 });

  // 2. Seed Tenant DB
  console.log('  -> Seeding lms_lab_synth_recovery_test (patients, orders, samples, invoices, users, categories)...');
  const synthPatients = [
    { patientId: 'SYNTH-PAT-001', tenantId: SYNTH_TENANT_ID, fullName: 'Synthetic Patient Alpha', mrn: 'SYNTH-MRN-001', gender: 'female', age: 29 },
    { patientId: 'SYNTH-PAT-002', tenantId: SYNTH_TENANT_ID, fullName: 'Synthetic Patient Beta', mrn: 'SYNTH-MRN-002', gender: 'male', age: 52 },
    { patientId: 'SYNTH-PAT-003', tenantId: SYNTH_TENANT_ID, fullName: 'Synthetic Patient Gamma', mrn: 'SYNTH-MRN-003', gender: 'female', age: 37 },
  ];
  await tenantDb.collection('patients').insertMany(synthPatients);
  await tenantDb.collection('patients').createIndex({ patientId: 1 }, { unique: true });
  await tenantDb.collection('patients').createIndex({ tenantId: 1, mrn: 1 });

  const synthOrders = [
    { orderId: 'SYNTH-ORD-001', orderNumber: 'ORD-SYNTH-001', tenantId: SYNTH_TENANT_ID, patientId: 'SYNTH-PAT-001', status: 'collected', totalAmount: 1500 },
    { orderId: 'SYNTH-ORD-002', orderNumber: 'ORD-SYNTH-002', tenantId: SYNTH_TENANT_ID, patientId: 'SYNTH-PAT-002', status: 'completed', totalAmount: 2800 },
  ];
  await tenantDb.collection('laborders').insertMany(synthOrders);
  await tenantDb.collection('laborders').createIndex({ orderId: 1 }, { unique: true });

  const synthSamples = [
    { sampleId: 'SYNTH-SMP-001', barcode: 'BC-SYNTH-001', tenantId: SYNTH_TENANT_ID, orderId: 'SYNTH-ORD-001', patientId: 'SYNTH-PAT-001', sampleType: 'Whole Blood' },
    { sampleId: 'SYNTH-SMP-002', barcode: 'BC-SYNTH-002', tenantId: SYNTH_TENANT_ID, orderId: 'SYNTH-ORD-002', patientId: 'SYNTH-PAT-002', sampleType: 'Serum' },
  ];
  await tenantDb.collection('samples').insertMany(synthSamples);
  await tenantDb.collection('samples').createIndex({ sampleId: 1 }, { unique: true });

  const synthInvoices = [
    { invoiceNumber: 'INV-SYNTH-001', tenantId: SYNTH_TENANT_ID, orderId: 'SYNTH-ORD-001', amount: 1500, status: 'paid', paidAt: new Date() },
    { invoiceNumber: 'INV-SYNTH-002', tenantId: SYNTH_TENANT_ID, orderId: 'SYNTH-ORD-002', amount: 2800, status: 'unpaid', dueAt: new Date() },
  ];
  await tenantDb.collection('invoices').insertMany(synthInvoices);
  await tenantDb.collection('invoices').createIndex({ invoiceNumber: 1 }, { unique: true });

  const synthUsers = [
    { userId: 'SYNTH-USR-001', tenantId: SYNTH_TENANT_ID, fullName: 'Synthetic Technician One', email: 'tech1@synth.local', role: 'technician' },
    { userId: 'SYNTH-USR-002', tenantId: SYNTH_TENANT_ID, fullName: 'Synthetic Pathologist Two', email: 'path2@synth.local', role: 'pathologist' },
  ];
  await tenantDb.collection('users').insertMany(synthUsers);
  await tenantDb.collection('users').createIndex({ userId: 1 }, { unique: true });

  const synthCategories = [
    { categoryId: 'CAT-01', tenantId: SYNTH_TENANT_ID, name: 'Complete Blood Count (CBC)' },
    { categoryId: 'CAT-02', tenantId: SYNTH_TENANT_ID, name: 'Comprehensive Metabolic Panel (CMP)' },
    { categoryId: 'CAT-03', tenantId: SYNTH_TENANT_ID, name: 'Lipid Panel' },
    { categoryId: 'CAT-04', tenantId: SYNTH_TENANT_ID, name: 'Liver Function Tests (LFT)' },
    { categoryId: 'CAT-05', tenantId: SYNTH_TENANT_ID, name: 'Renal Function Tests (RFT)' },
  ];
  await tenantDb.collection('testcategories').insertMany(synthCategories);
  await tenantDb.collection('testcategories').createIndex({ categoryId: 1 }, { unique: true });

  // Record baseline counts
  const baseline = {
    master: {
      tenants: await masterDb.collection('tenants').countDocuments(),
      platformadmins: await masterDb.collection('platformadmins').countDocuments(),
      auditlogs: await masterDb.collection('auditlogs').countDocuments(),
    },
    tenant: {
      patients: await tenantDb.collection('patients').countDocuments(),
      laborders: await tenantDb.collection('laborders').countDocuments(),
      samples: await tenantDb.collection('samples').countDocuments(),
      invoices: await tenantDb.collection('invoices').countDocuments(),
      users: await tenantDb.collection('users').countDocuments(),
      testcategories: await tenantDb.collection('testcategories').countDocuments(),
    },
  };
  const totalBaselineDocs = 1 + 1 + 2 + 3 + 2 + 2 + 2 + 2 + 5; // 20
  console.log(`Baseline Synthetic Counts Verified: ${totalBaselineDocs} documents across 2 databases.`);
  assert.strictEqual(baseline.tenant.patients, 3);
  assert.strictEqual(baseline.tenant.laborders, 2);
  assert.strictEqual(baseline.tenant.invoices, 2);

  console.log('\n[STAGE C] Executing Actual Backup of Synthetic Databases...');
  const backupResult = await backupService.createBackup({
    destDir: DISPOSABLE_BACKUP_DIR,
    includeMaster: true,
    dbClient: client,
    logger: console,
  });

  console.log(`Backup completed: ${backupResult.backupId}`);
  assert.strictEqual(backupResult.manifest.status, 'SUCCESS');
  assert.strictEqual(backupResult.manifest.summary.totalDocuments, totalBaselineDocs);
  assert.strictEqual(backupResult.manifest.summary.totalDatabases, 2);

  // Validate backup archive integrity via SHA-256
  console.log('Validating backup archive manifest and SHA-256 checksums...');
  const archiveValidation = validateBackupArchive(backupResult.backupDir);
  assert.strictEqual(archiveValidation.isValid, true, 'Archive must be 100% cryptographically valid');
  assert.strictEqual(archiveValidation.errors.length, 0);
  console.log('  ✓ SHA-256 Checksums Verified across all generated BSON files.');

  console.log('\n[STAGE D] Simulating Realistic Data Loss & Record Corruption...');
  // 1. Delete all patients
  console.log('  -> Simulating catastrophic deletion: Dropping all patient records...');
  await tenantDb.collection('patients').deleteMany({});
  const patCountAfterDrop = await tenantDb.collection('patients').countDocuments();
  assert.strictEqual(patCountAfterDrop, 0, 'Patients collection must be empty');

  // 2. Delete all invoices
  console.log('  -> Simulating billing table loss: Dropping all invoices...');
  await tenantDb.collection('invoices').deleteMany({});
  const invCountAfterDrop = await tenantDb.collection('invoices').countDocuments();
  assert.strictEqual(invCountAfterDrop, 0, 'Invoices collection must be empty');

  // 3. Delete master audit logs
  console.log('  -> Simulating audit log wipe in lms_master...');
  await masterDb.collection('auditlogs').deleteMany({});
  const auditCountAfterDrop = await masterDb.collection('auditlogs').countDocuments();
  assert.strictEqual(auditCountAfterDrop, 0, 'Audit logs must be empty');

  // 4. Corrupt order records
  console.log('  -> Simulating record corruption: Setting order status to CORRUPTED_RECORD...');
  await tenantDb.collection('laborders').updateMany({}, { $set: { status: 'CORRUPTED_RECORD', totalAmount: -9999 } });
  const corruptedOrder = await tenantDb.collection('laborders').findOne({ orderNumber: 'ORD-SYNTH-001' });
  assert.strictEqual(corruptedOrder.status, 'CORRUPTED_RECORD');

  console.log('Data loss and corruption confirmed. Ready to execute safe recovery.');

  console.log('\n[STAGE E] Executing Safe Restore from Backup...');
  const restoreResult = await restoreService.restoreBackup({
    backupPath: backupResult.backupDir,
    confirmationToken: 'RESTORE-CONFIRM',
    dryRun: false,
    dbClient: client,
    logger: console,
  });

  console.log(`Restore completed: ${restoreResult.totalDocumentsRestored} documents restored.`);
  assert.strictEqual(restoreResult.status, 'SUCCESS');
  assert.strictEqual(restoreResult.totalDocumentsRestored, totalBaselineDocs);
  assert.ok(restoreResult.safetyBackupId, 'Pre-restore safety snapshot must be captured');

  console.log('\n[STAGE F] Verifying Complete Data Recovery & Record Fidelity...');
  // 1. Verify Patients
  const restoredPatients = await tenantDb.collection('patients').find().toArray();
  console.log(`  -> Restored Patients: ${restoredPatients.length} (expected 3)`);
  assert.strictEqual(restoredPatients.length, 3);
  const alphaPatient = restoredPatients.find((p) => p.patientId === 'SYNTH-PAT-001');
  assert.ok(alphaPatient);
  assert.strictEqual(alphaPatient.fullName, 'Synthetic Patient Alpha');
  assert.strictEqual(alphaPatient.mrn, 'SYNTH-MRN-001');

  // 2. Verify Invoices
  const restoredInvoices = await tenantDb.collection('invoices').find().toArray();
  console.log(`  -> Restored Invoices: ${restoredInvoices.length} (expected 2)`);
  assert.strictEqual(restoredInvoices.length, 2);
  const invOne = restoredInvoices.find((i) => i.invoiceNumber === 'INV-SYNTH-001');
  assert.ok(invOne);
  assert.strictEqual(invOne.amount, 1500);
  assert.strictEqual(invOne.status, 'paid');

  // 3. Verify Orders (corruption reversed)
  const restoredOrders = await tenantDb.collection('laborders').find().toArray();
  console.log(`  -> Restored Lab Orders: ${restoredOrders.length} (expected 2)`);
  assert.strictEqual(restoredOrders.length, 2);
  const orderOne = restoredOrders.find((o) => o.orderNumber === 'ORD-SYNTH-001');
  assert.ok(orderOne);
  assert.strictEqual(orderOne.status, 'collected'); // Proves corruption was reversed
  assert.strictEqual(orderOne.totalAmount, 1500);

  // 4. Verify Master Audit Logs
  const restoredAuditLogs = await masterDb.collection('auditlogs').find().toArray();
  console.log(`  -> Restored Master Audit Logs: ${restoredAuditLogs.length} (expected 2)`);
  assert.strictEqual(restoredAuditLogs.length, 2);
  assert.ok(restoredAuditLogs.some((l) => l.eventId === 'EVT-SYNTH-01'));

  // 5. Verify Indexes were reconstructed
  const patientIndexes = await tenantDb.collection('patients').indexes();
  console.log(`  -> Restored Patient Indexes: ${patientIndexes.map((i) => i.name).join(', ')}`);
  assert.ok(patientIndexes.some((i) => i.name === 'patientId_1'));
  assert.ok(patientIndexes.some((i) => i.name === 'tenantId_1_mrn_1'));

  console.log('\n[STAGE G] Safe Teardown of Disposable Test Environment...');
  await masterDb.dropDatabase();
  await tenantDb.dropDatabase();
  await mongoose.disconnect();
  console.log('Disposable databases dropped. Disconnected cleanly from 127.0.0.1:27019.');

  // Clean test backup files
  if (fs.existsSync(DISPOSABLE_BACKUP_DIR)) {
    fs.rmSync(DISPOSABLE_BACKUP_DIR, { recursive: true, force: true });
    console.log('Disposable backup files cleaned.');
  }

  console.log('\n======================================================================');
  console.log('🎉 ISOLATED BACKUP & RESTORE RECOVERY TEST: 100% PASSED');
  console.log('======================================================================\n');
}

runRecoveryTest().catch((err) => {
  console.error('\n❌ RECOVERY TEST FAILED:', err);
  process.exit(1);
});
