/**
 * Lab Management System (LMS) - Secure Tenant Database Cleanup Utility
 * 
 * DEFENSIVE SECURITY RULES:
 * 1. DRY-RUN BY DEFAULT: Any invocation without explicit destructive flags is strictly read-only.
 * 2. NO MASS / ARBITRARY DELETION: Never cleans across all tenant databases or preserves arbitrary counts.
 * 3. EXPLICIT TARGET REQUIRED: Must explicitly specify a single valid tenant database (--target-db or --tenant-id).
 * 4. TWO-FACTOR CONFIRMATION: Destructive operations require --confirm-delete.
 * 5. BACKUP PREREQUISITE: Destructive operations require verified backup evidence (--backup-verified and --backup-evidence=<path>).
 * 6. PRODUCTION ENVIRONMENT GUARD: Destructive execution in production is blocked unless --allow-production-deletion is passed.
 * 7. ZERO SECRET LEAKS: Sanitizes all connection URIs, credentials, and error messages.
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Custom Error Classes
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ProductionGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProductionGuardError';
  }
}

export class BackupPrerequisiteError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BackupPrerequisiteError';
  }
}

/**
 * Sanitize MongoDB URIs and credentials to prevent secret leakage in logs
 */
export function sanitizeUri(uri) {
  if (!uri || typeof uri !== 'string') return '[NO_URI_PROVIDED]';
  return uri
    .replace(/:([^@/]+)@/g, ':***@')
    .replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, '[DATABASE_URI_REDACTED]');
}

/**
 * Parse CLI arguments into structured options
 */
export function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    targetDb: null,
    tenantId: null,
    dryRun: true, // Safe default
    explicitDryRunFlag: false,
    confirmDelete: false,
    backupVerified: false,
    backupEvidence: null,
    allowProductionDeletion: false,
    showHelp: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      options.showHelp = true;
    } else if (arg.startsWith('--target-db=')) {
      options.targetDb = arg.slice('--target-db='.length).trim();
    } else if (arg === '--target-db' && i + 1 < argv.length) {
      options.targetDb = argv[++i].trim();
    } else if (arg.startsWith('--tenant-id=')) {
      options.tenantId = arg.slice('--tenant-id='.length).trim();
    } else if (arg === '--tenant-id' && i + 1 < argv.length) {
      options.tenantId = argv[++i].trim();
    } else if (arg === '--dry-run') {
      options.dryRun = true;
      options.explicitDryRunFlag = true;
    } else if (arg === '--confirm-delete') {
      options.confirmDelete = true;
    } else if (arg === '--backup-verified') {
      options.backupVerified = true;
    } else if (arg.startsWith('--backup-evidence=')) {
      options.backupEvidence = arg.slice('--backup-evidence='.length).trim();
    } else if (arg === '--backup-evidence' && i + 1 < argv.length) {
      options.backupEvidence = argv[++i].trim();
    } else if (arg === '--allow-production-deletion') {
      options.allowProductionDeletion = true;
    }
  }

  // If confirmDelete is passed and dryRun was not explicitly set to true, dryRun is deactivated
  if (options.confirmDelete && !options.explicitDryRunFlag) {
    options.dryRun = false;
  }

  return options;
}

/**
 * Validate that an explicit, safe target database is provided
 */
export function validateTarget(options = {}) {
  const { targetDb, tenantId } = options;

  if (!targetDb && !tenantId) {
    throw new ValidationError(
      'Target selection required: You must explicitly specify --target-db=<name> or --tenant-id=<id>.'
    );
  }

  if (targetDb && tenantId) {
    // Both provided: ensure they are consistent
    const cleanTenantId = tenantId.trim().toLowerCase();
    const expectedDb = `lms_lab_${cleanTenantId}`;
    if (targetDb.trim().toLowerCase() !== expectedDb) {
      throw new ValidationError(
        `Conflicting target options: --target-db '${targetDb}' does not match derived --tenant-id '${expectedDb}'.`
      );
    }
  }

  let finalDbName = '';

  if (targetDb) {
    finalDbName = targetDb.trim().toLowerCase();
  } else {
    const cleanId = tenantId.trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,64}$/.test(cleanId)) {
      throw new ValidationError(
        `Invalid tenant ID format: '${tenantId}'. Must contain 3-64 alphanumeric characters, underscores, or hyphens.`
      );
    }
    finalDbName = `lms_lab_${cleanId}`;
  }

  // Strict database naming guards
  const protectedDbs = ['admin', 'local', 'config', 'lms_master', 'test'];
  if (protectedDbs.includes(finalDbName) || finalDbName.startsWith('admin') || finalDbName.startsWith('local')) {
    throw new ValidationError(
      `Access Denied: Database '${finalDbName}' is a protected system or platform master database and can never be targeted for cleanup.`
    );
  }

  // Must strictly adhere to tenant database naming convention
  if (!/^lms_lab_[a-z0-9_-]{3,64}$/.test(finalDbName)) {
    throw new ValidationError(
      `Invalid tenant database name: '${finalDbName}'. Tenant databases must follow the pattern 'lms_lab_<tenantId>'.`
    );
  }

  return finalDbName;
}

/**
 * Enforce environment safety guards
 */
export function checkEnvironmentGuard(options = {}, env = process.env) {
  const nodeEnv = (env.NODE_ENV || '').trim().toLowerCase();
  const appEnv = (env.APP_ENV || '').trim().toLowerCase();
  const isProduction = nodeEnv === 'production' || nodeEnv === 'prod' || appEnv === 'production';

  if (isProduction && !options.dryRun && options.confirmDelete) {
    if (!options.allowProductionDeletion) {
      throw new ProductionGuardError(
        'PRODUCTION GUARD TRIGGERED: Destructive database deletion is strictly disabled in production environments. ' +
        'Explicit authorization flag --allow-production-deletion is required under formal change control.'
      );
    }
  }

  return { isProduction };
}

/**
 * Validate backup and recovery prerequisites before any destructive deletion
 */
export function checkBackupPrerequisites(options = {}) {
  // If in dry-run mode, backup evidence is not strictly required to preview planned actions
  if (options.dryRun || !options.confirmDelete) {
    return { verified: false, dryRun: true };
  }

  if (!options.backupVerified) {
    throw new BackupPrerequisiteError(
      'BACKUP PREREQUISITE FAILED: Destructive deletion requires explicit --backup-verified confirmation.'
    );
  }

  if (!options.backupEvidence || typeof options.backupEvidence !== 'string') {
    throw new BackupPrerequisiteError(
      'BACKUP PREREQUISITE FAILED: Destructive deletion requires --backup-evidence=<path> pointing to an existing verified backup archive or manifest.'
    );
  }

  const resolvedEvidencePath = path.resolve(options.backupEvidence);
  if (!fs.existsSync(resolvedEvidencePath)) {
    throw new BackupPrerequisiteError(
      `BACKUP PREREQUISITE FAILED: Specified backup evidence file does not exist at: '${resolvedEvidencePath}'.`
    );
  }

  const stat = fs.statSync(resolvedEvidencePath);
  if (stat.size === 0) {
    throw new BackupPrerequisiteError(
      `BACKUP PREREQUISITE FAILED: Specified backup evidence file at '${resolvedEvidencePath}' is empty (0 bytes).`
    );
  }

  return {
    verified: true,
    evidencePath: resolvedEvidencePath,
    evidenceSizeBytes: stat.size,
  };
}

/**
 * Safely load environment configuration from server/.env
 */
export function loadEnv() {
  const envPath = path.resolve('server/.env');
  const altEnvPath = path.resolve('.env');
  const target = fs.existsSync(envPath) ? envPath : altEnvPath;
  if (!fs.existsSync(target)) return {};
  const content = fs.readFileSync(target, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx !== -1) {
      const k = trimmed.slice(0, idx).trim();
      let v = trimmed.slice(idx + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      env[k] = v;
    }
  }
  return env;
}

/**
 * Core cleanup orchestrator
 */
export async function executeCleanup({
  options = {},
  dbClient = null,
  env = process.env,
  logger = console,
} = {}) {
  const targetDbName = validateTarget(options);

  const isDryRun = options.dryRun === true || !options.confirmDelete;

  if (!isDryRun) {
    checkEnvironmentGuard(options, env);
    checkBackupPrerequisites(options);
  }

  logger.log('----------------------------------------------------------------------');
  logger.log('🛡️  LMS Secure Tenant Database Cleanup');
  logger.log('----------------------------------------------------------------------');
  logger.log(`🎯 Target Database: ${targetDbName}`);
  logger.log(`⚙️  Execution Mode: ${isDryRun ? 'DRY-RUN (Safe - Zero changes)' : 'DESTRUCTIVE DELETION'}`);

  let client = dbClient;
  let didConnectLocally = false;

  try {
    if (!client) {
      const envVars = loadEnv();
      const mongoUri = envVars.MONGODB_URI || env.MONGODB_URI;
      if (!mongoUri) {
        throw new Error('No MONGODB_URI configured in environment.');
      }
      logger.log(`📡 Connecting to cluster: ${sanitizeUri(mongoUri)}`);
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
      client = mongoose.connection.client;
      didConnectLocally = true;
    }

    const tenantDb = client.db(targetDbName);
    const collections = await tenantDb.listCollections().toArray();

    logger.log(`📦 Discovered ${collections.length} collections in target database '${targetDbName}':`);
    for (const col of collections) {
      logger.log(`   - ${col.name}`);
    }

    if (isDryRun) {
      logger.log('\n🔍 [DRY-RUN PREVIEW OF PLANNED ACTIONS]:');
      for (const col of collections) {
        logger.log(`   [DRY-RUN] Would drop collection: '${col.name}' in database '${targetDbName}'`);
      }
      logger.log('\n✅ [DRY-RUN COMPLETE] Zero collections were dropped. No database changes were made.');
      logger.log('   To execute real deletion, you must explicitly supply:');
      logger.log('   --confirm-delete --backup-verified --backup-evidence=<path_to_backup>');

      return {
        success: true,
        mode: 'DRY_RUN',
        targetDb: targetDbName,
        collectionsEvaluated: collections.map((c) => c.name),
        droppedCount: 0,
      };
    }

    // DESTRUCTIVE EXECUTION: Only reached if dryRun is false, confirmation is present, and backup is verified
    logger.log(`\n⚠️  [DESTRUCTIVE EXECUTION COMMENCING] Dropping collections in '${targetDbName}'...`);
    let droppedCount = 0;

    for (const col of collections) {
      await tenantDb.collection(col.name).drop();
      droppedCount++;
      logger.log(`   🗑️  Dropped collection: '${col.name}'`);
    }

    logger.log(`\n✅ [DESTRUCTIVE COMPLETE] Successfully dropped ${droppedCount} collections in '${targetDbName}'.`);

    return {
      success: true,
      mode: 'DESTRUCTIVE',
      targetDb: targetDbName,
      collectionsDropped: droppedCount,
    };
  } finally {
    if (didConnectLocally) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

/**
 * Print CLI Usage Guidelines
 */
export function printHelp(logger = console) {
  logger.log(`
LMS Secure Tenant Database Cleanup Utility

Usage:
  node server/scripts/clean-stale-tenants.js --target-db=<database_name> [options]
  node server/scripts/clean-stale-tenants.js --tenant-id=<tenant_id> [options]

Target Options (Exactly one required):
  --target-db=<name>           Specific tenant database name (must start with 'lms_lab_')
  --tenant-id=<id>             Tenant identifier (derives 'lms_lab_<id>')

Safety & Confirmation Flags:
  --dry-run                    Preview mode without making changes (DEFAULT)
  --confirm-delete             Explicit authorization required for destructive deletion
  --backup-verified            Affirm that a verified backup exists for this tenant
  --backup-evidence=<path>     Path to non-empty backup archive or manifest file
  --allow-production-deletion  Required override if running in production under change control
  --help, -h                   Display this help message

Examples:
  # Safe dry-run preview (Default):
  node server/scripts/clean-stale-tenants.js --target-db=lms_lab_ten_test123

  # Safe dry-run by tenant ID:
  node server/scripts/clean-stale-tenants.js --tenant-id=ten_test123

  # Destructive execution with verified backup evidence:
  node server/scripts/clean-stale-tenants.js --target-db=lms_lab_ten_test123 \\
    --confirm-delete --backup-verified --backup-evidence=./backups/ten_test123.archive.gz
`);
}

/**
 * CLI Entrypoint
 */
export async function runCli() {
  const options = parseArgs(process.argv.slice(2));

  if (options.showHelp) {
    printHelp();
    return process.exit(0);
  }

  try {
    await executeCleanup({ options });
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ [CLEANUP FAILED]: ${err.message}\n`);
    if (err instanceof ValidationError) {
      printHelp();
    }
    process.exit(1);
  }
}

// Auto-run when executed directly via node CLI
const currentFilePath = fileURLToPath(import.meta.url);
const executedFilePath = process.argv[1] ? path.resolve(process.argv[1]) : '';

if (executedFilePath === path.resolve(currentFilePath)) {
  runCli();
}
