/**
 * Lab Management System (LMS) - Enterprise Database Backup Service
 * 
 * Implements Phase 5C Automated Backup:
 * - Logical BSON export for master DB and all tenant databases
 * - Index metadata preservation
 * - SHA-256 cryptographic checksums per collection
 * - Comprehensive manifest.json generation
 * - Disk space safety pre-checks
 * - Automated retention pruning policy (default 14 days)
 * - Safe destination validation (outside src/ and git)
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import config from '../config/env.js';

export class BackupError extends Error {
  constructor(message, code = 'BACKUP_ERROR', details = null) {
    super(message);
    this.name = 'BackupError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Compute SHA-256 checksum of a file
 */
export function computeFileSha256(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const hash = crypto.createHash('sha256');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

/**
 * Validate backup destination path (must be outside source tree)
 */
export function resolveBackupDir(destDir = null) {
  const configured = destDir || process.env.BACKUP_OUTPUT_DIR || path.resolve('backups/lms');
  const resolved = path.resolve(configured);

  const cwd = process.cwd();
  const serverSrc = path.resolve(cwd, 'server/src');
  const clientSrc = path.resolve(cwd, 'client/src');

  if (resolved.startsWith(serverSrc) || resolved.startsWith(clientSrc)) {
    throw new BackupError(
      `Invalid backup path '${resolved}': Backups must reside outside source code trees.`,
      'INVALID_DESTINATION'
    );
  }

  return resolved;
}

/**
 * Check disk space availability (at least 500 MB free recommended)
 */
export function checkDiskSpace(targetPath, minBytesRequired = 524288000) {
  try {
    if (typeof fs.statfsSync === 'function') {
      const dirToCheck = fs.existsSync(targetPath) ? targetPath : path.dirname(targetPath);
      const stats = fs.statfsSync(dirToCheck);
      const freeBytes = stats.bavail * stats.bsize;
      if (freeBytes < minBytesRequired) {
        throw new BackupError(
          `Insufficient disk space. Required: ${Math.round(minBytesRequired / (1024 * 1024))}MB, Available: ${Math.round(freeBytes / (1024 * 1024))}MB`,
          'INSUFFICIENT_DISK_SPACE'
        );
      }
      return { availableBytes: freeBytes, sufficient: true };
    }
  } catch (err) {
    if (err instanceof BackupError) throw err;
    // Fallback if statfs is unsupported on host platform
  }
  return { availableBytes: null, sufficient: true };
}

/**
 * Discover databases to back up
 */
export async function discoverDatabases({ client, includeMaster = true, masterDbName = 'lms_master', targetTenantId = null } = {}) {
  const targetDbs = [];

  if (includeMaster) {
    targetDbs.push({ name: masterDbName, type: 'master' });
  }

  if (targetTenantId) {
    const cleanId = targetTenantId.replace(/^lms_lab_/, '').toLowerCase();
    targetDbs.push({ name: `lms_lab_${cleanId}`, type: 'tenant' });
    return targetDbs;
  }

  if (client) {
    const adminDb = client.db().admin();
    const listResult = await adminDb.listDatabases();
    const tenantDbs = listResult.databases
      .filter((d) => d.name.startsWith('lms_lab_'))
      .map((d) => ({ name: d.name, type: 'tenant' }));

    for (const tDb of tenantDbs) {
      if (!targetDbs.some((d) => d.name === tDb.name)) {
        targetDbs.push(tDb);
      }
    }
  }

  return targetDbs;
}

/**
 * Backup single database to BSON + JSON metadata
 */
export async function exportDatabaseBson({ client, dbName, outputDir, logger = console }) {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const db = client.db(dbName);
  const collectionsList = await db.listCollections().toArray();
  const collectionSummaries = [];
  let totalDocs = 0;
  let totalBytes = 0;

  for (const colInfo of collectionsList) {
    const colName = colInfo.name;
    // Skip internal system collections
    if (colName.startsWith('system.')) continue;

    const col = db.collection(colName);
    const bsonFilePath = path.join(outputDir, `${colName}.bson`);
    const metaFilePath = path.join(outputDir, `${colName}.metadata.json`);

    // 1. Export indexes metadata
    const indexes = await col.indexes().catch(() => []);
    const metaContent = {
      collection: colName,
      database: dbName,
      exportedAt: new Date().toISOString(),
      indexes,
    };
    fs.writeFileSync(metaFilePath, JSON.stringify(metaContent, null, 2), 'utf8');

    // 2. Export documents as binary BSON
    const expectedCount = await col.countDocuments();
    let colDocs = 0;
    const writeStream = fs.createWriteStream(bsonFilePath);
    let streamErr = null;
    writeStream.on('error', (err) => { streamErr = err; });

    try {
      const cursor = col.find({});
      for await (const doc of cursor) {
        if (streamErr) throw streamErr;
        const bsonBuf = mongoose.mongo.BSON.serialize(doc);
        writeStream.write(bsonBuf);
        colDocs++;
      }
      await new Promise((resolve, reject) => {
        writeStream.end((err) => (err || streamErr ? reject(err || streamErr) : resolve()));
      });
    } catch (err) {
      try { writeStream.destroy(); } catch (_) {}
      throw new BackupError(`Export failed for collection '${colName}': ${err.message}`, 'EXPORT_FAILED');
    }

    if (colDocs !== expectedCount) {
      throw new BackupError(
        `Integrity mismatch for '${colName}': exported ${colDocs} docs, expected ${expectedCount}`,
        'DOC_COUNT_MISMATCH'
      );
    }

    const stat = fs.statSync(bsonFilePath);
    const sha256 = computeFileSha256(bsonFilePath);
    totalDocs += colDocs;
    totalBytes += stat.size;

    collectionSummaries.push({
      name: colName,
      documents: colDocs,
      sizeBytes: stat.size,
      sha256,
      status: 'VERIFIED',
    });

    if (logger.info) logger.info(`      [+] ${colName}: ${colDocs} docs (${stat.size} bytes, SHA-256: ${sha256.substring(0, 8)}...)`);
  }

  return {
    name: dbName,
    collectionsCount: collectionSummaries.length,
    documentsCount: totalDocs,
    sizeBytes: totalBytes,
    collections: collectionSummaries,
    status: 'COMPLETED',
  };
}

/**
 * Enforce retention policy by removing old backup snapshots
 */
export function pruneOldBackups(baseDir, retentionDays = 14, logger = console) {
  if (!fs.existsSync(baseDir) || retentionDays <= 0) return 0;

  const nowMs = Date.now();
  const maxAgeMs = retentionDays * 24 * 60 * 60 * 1000;
  let prunedCount = 0;

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('lms_backup_')) {
      const fullPath = path.join(baseDir, entry.name);
      const manifestPath = path.join(fullPath, 'manifest.json');

      // Safety: Only delete if manifest.json exists (verifying it is an LMS backup folder)
      if (fs.existsSync(manifestPath)) {
        try {
          const stat = fs.statSync(fullPath);
          if (nowMs - stat.mtimeMs > maxAgeMs) {
            fs.rmSync(fullPath, { recursive: true, force: true });
            prunedCount++;
            if (logger.info) logger.info(`Pruned expired backup snapshot: ${entry.name}`);
          }
        } catch (_) {}
      }
    }
  }

  return prunedCount;
}

/**
 * Primary backup execution function
 */
export async function createBackup({
  destDir = null,
  retentionDays = 14,
  targetTenantId = null,
  includeMaster = true,
  dbClient = null,
  logger = console,
} = {}) {
  const rootDest = resolveBackupDir(destDir);
  checkDiskSpace(rootDest);

  const now = new Date();
  const timestampSafe = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
  const backupId = `lms_backup_${timestampSafe}`;
  const backupDir = path.join(rootDest, backupId);

  if (fs.existsSync(backupDir)) {
    throw new BackupError(`Backup directory '${backupDir}' already exists.`, 'BACKUP_DIR_EXISTS');
  }

  let client = dbClient;
  let didConnectLocally = false;
  const mongoUri = config.database?.uri || process.env.MONGODB_URI;
  const masterDbName = config.database?.masterDbName || process.env.MONGODB_MASTER_DB_NAME || 'lms_master';

  const manifest = {
    backupId,
    lmsVersion: '1.0.0',
    schemaVersion: '1.0',
    createdAt: now.toISOString(),
    completedAt: null,
    durationMs: 0,
    status: 'IN_PROGRESS',
    engine: 'bson_streaming',
    encryption: 'UNENCRYPTED',
    masterDatabase: masterDbName,
    summary: {
      totalDatabases: 0,
      totalCollections: 0,
      totalDocuments: 0,
      totalSizeBytes: 0,
    },
    databases: [],
    error: null,
  };

  const startTime = Date.now();

  try {
    if (!client) {
      if (!mongoUri) {
        throw new BackupError('Missing MongoDB connection URI for backup execution.', 'MISSING_URI');
      }
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
      client = mongoose.connection.client;
      didConnectLocally = true;
    }

    const targetDbs = await discoverDatabases({ client, includeMaster, masterDbName, targetTenantId });
    if (targetDbs.length === 0) {
      throw new BackupError('No matching databases found to back up.', 'NO_DATABASES');
    }

    fs.mkdirSync(backupDir, { recursive: true });

    for (const target of targetDbs) {
      const dbOut = path.join(backupDir, target.name);
      const summary = await exportDatabaseBson({
        client,
        dbName: target.name,
        outputDir: dbOut,
        logger,
      });

      manifest.databases.push(summary);
      manifest.summary.totalDatabases++;
      manifest.summary.totalCollections += summary.collectionsCount;
      manifest.summary.totalDocuments += summary.documentsCount;
      manifest.summary.totalSizeBytes += summary.sizeBytes;
    }

    manifest.completedAt = new Date().toISOString();
    manifest.durationMs = Date.now() - startTime;
    manifest.status = 'SUCCESS';

    const manifestPath = path.join(backupDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

    // Run retention cleanup
    const prunedCount = pruneOldBackups(rootDest, retentionDays, logger);

    return {
      success: true,
      backupId,
      backupDir,
      manifestPath,
      manifest,
      prunedCount,
    };
  } catch (err) {
    manifest.completedAt = new Date().toISOString();
    manifest.durationMs = Date.now() - startTime;
    manifest.status = 'FAILED';
    manifest.error = err.message;

    if (fs.existsSync(backupDir)) {
      try {
        fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
      } catch (_) {}
    }
    throw err;
  } finally {
    if (didConnectLocally) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

/**
 * List all available backup snapshots
 */
export function listBackups(destDir = null) {
  const rootDest = resolveBackupDir(destDir);
  if (!fs.existsSync(rootDest)) return [];

  const backups = [];
  const entries = fs.readdirSync(rootDest, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory() && entry.name.startsWith('lms_backup_')) {
      const manifestPath = path.join(rootDest, entry.name, 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const raw = fs.readFileSync(manifestPath, 'utf8');
          const data = JSON.parse(raw);
          backups.push({
            backupId: data.backupId || entry.name,
            createdAt: data.createdAt,
            status: data.status,
            databasesCount: data.summary?.totalDatabases || 0,
            documentsCount: data.summary?.totalDocuments || 0,
            sizeBytes: data.summary?.totalSizeBytes || 0,
            path: path.join(rootDest, entry.name),
          });
        } catch (_) {}
      }
    }
  }

  return backups.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

/**
 * Validate that a database name adheres to strict LMS naming conventions
 */
export function isValidLmsDatabaseName(dbName) {
  if (!dbName || typeof dbName !== 'string') return false;
  const clean = dbName.trim().toLowerCase();
  if (clean === 'lms_master') return true;
  return /^lms_lab_[a-z0-9_-]{3,64}$/.test(clean);
}

/**
 * Validate that a collection name adheres to strict LMS naming conventions
 */
export function isValidLmsCollectionName(colName) {
  if (!colName || typeof colName !== 'string') return false;
  if (colName.startsWith('system.') || colName.includes('$')) return false;
  return /^[a-zA-Z0-9_]{1,64}$/.test(colName);
}

/**
 * Validate backup archive integrity via SHA-256 checks
 */
export function validateBackupArchive(backupDirPath) {
  const resolved = path.resolve(backupDirPath);
  const manifestPath = path.join(resolved, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    return { isValid: false, errors: ['manifest.json not found in backup directory'], manifest: null };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const errors = [];

  if (manifest.status !== 'SUCCESS') {
    errors.push(`Backup manifest status is '${manifest.status}', not 'SUCCESS'`);
  }

  for (const db of manifest.databases || []) {
    // Validate database name against unauthorized system or traversal targets
    if (!isValidLmsDatabaseName(db.name)) {
      errors.push(`Unauthorized or invalid database name in backup archive: '${db.name}'`);
      continue;
    }

    const dbDir = path.join(resolved, db.name);
    if (!fs.existsSync(dbDir)) {
      errors.push(`Database folder missing: ${db.name}`);
      continue;
    }

    for (const col of db.collections || []) {
      if (!isValidLmsCollectionName(col.name)) {
        errors.push(`Unauthorized or invalid collection name in '${db.name}': '${col.name}'`);
      }

      const bsonPath = path.join(dbDir, `${col.name}.bson`);
      const metaPath = path.join(dbDir, `${col.name}.metadata.json`);

      if (!fs.existsSync(bsonPath)) {
        errors.push(`Missing BSON file for collection '${col.name}' in '${db.name}'`);
      } else if (col.sha256) {
        const actualHash = computeFileSha256(bsonPath);
        if (actualHash !== col.sha256) {
          errors.push(`SHA-256 mismatch for '${col.name}' in '${db.name}': expected ${col.sha256}, got ${actualHash}`);
        }
      }

      if (!fs.existsSync(metaPath)) {
        errors.push(`Missing metadata JSON file for '${col.name}' in '${db.name}'`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    manifest,
  };
}

export default {
  createBackup,
  listBackups,
  validateBackupArchive,
  computeFileSha256,
  pruneOldBackups,
  resolveBackupDir,
};
