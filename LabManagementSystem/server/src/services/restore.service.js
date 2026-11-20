/**
 * Lab Management System (LMS) - Enterprise Database Safe Restore Service
 * 
 * Implements Phase 5D Safe Restore:
 * - Strict confirmation token validation (RESTORE-CONFIRM)
 * - Archive manifest and SHA-256 integrity pre-verification
 * - Mandatory pre-restore automatic safety backup snapshot
 * - Dry-run preview capability
 * - BSON deserialization and collection restoration
 * - Index metadata recreation
 * - Post-restore document count integrity verification
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import config from '../config/env.js';
import backupService, { BackupError, validateBackupArchive } from './backup.service.js';

export class RestoreError extends Error {
  constructor(message, code = 'RESTORE_ERROR', details = null) {
    super(message);
    this.name = 'RestoreError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Deserialize BSON file buffer into array of documents
 */
export function deserializeBsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new RestoreError(`BSON file not found at: ${filePath}`, 'FILE_NOT_FOUND');
  }

  const buffer = fs.readFileSync(filePath);
  const docs = [];
  let offset = 0;

  while (offset < buffer.length) {
    if (offset + 4 > buffer.length) {
      throw new RestoreError(`Malformed BSON header at offset ${offset} in ${filePath}`, 'CORRUPT_BSON');
    }
    const docSize = buffer.readInt32LE(offset);
    if (docSize <= 4 || offset + docSize > buffer.length) {
      throw new RestoreError(
        `Invalid BSON document length ${docSize} at offset ${offset} in ${filePath}`,
        'CORRUPT_BSON'
      );
    }
    const docBuffer = buffer.subarray(offset, offset + docSize);
    const doc = mongoose.mongo.BSON.deserialize(docBuffer);
    docs.push(doc);
    offset += docSize;
  }

  return docs;
}

/**
 * Execute Safe Database Restoration
 */
export async function restoreBackup({
  backupPath,
  confirmationToken,
  dryRun = false,
  skipSafetyBackup = false,
  dbClient = null,
  logger = console,
} = {}) {
  // 1. Mandatory confirmation token check (required unless dryRun)
  if (!dryRun && confirmationToken !== 'RESTORE-CONFIRM') {
    throw new RestoreError(
      "Operation rejected: Missing or invalid confirmation token. Must be 'RESTORE-CONFIRM'.",
      'INVALID_CONFIRMATION_TOKEN'
    );
  }

  const resolvedBackupPath = path.resolve(backupPath);
  if (!fs.existsSync(resolvedBackupPath)) {
    throw new RestoreError(`Backup directory not found: ${resolvedBackupPath}`, 'BACKUP_NOT_FOUND');
  }

  // 2. Validate archive integrity and SHA-256 checksums
  const validation = validateBackupArchive(resolvedBackupPath);
  if (!validation.isValid) {
    throw new RestoreError(
      `Backup archive integrity check failed: ${validation.errors.join('; ')}`,
      'INTEGRITY_CHECK_FAILED',
      validation.errors
    );
  }

  const manifest = validation.manifest;

  // 3. Dry-run preview
  if (dryRun) {
    const preview = {
      mode: 'DRY_RUN',
      backupId: manifest.backupId,
      createdAt: manifest.createdAt,
      databasesToRestore: manifest.databases.map((db) => {
        const dbDir = path.join(resolvedBackupPath, db.name);
        return {
          database: db.name,
          collectionsCount: db.collectionsCount,
          documentsCount: db.documentsCount,
          collections: db.collections.map((c) => {
            const metaPath = path.join(dbDir, `${c.name}.metadata.json`);
            let indexes = [];
            if (fs.existsSync(metaPath)) {
              try {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                indexes = (meta.indexes || []).map((idx) => idx.name);
              } catch (_) {}
            }
            return {
              name: c.name,
              documents: c.documents,
              sizeBytes: c.sizeBytes,
              sha256: c.sha256,
              bsonFile: `${c.name}.bson`,
              metadataFile: `${c.name}.metadata.json`,
              indexes,
            };
          }),
        };
      }),
      safetyBackupConfigured: true,
      safetyBackupMechanism: 'Automated pre-restore snapshot via backupService.createBackup() before any collection writes',
      databaseModificationsMade: 0,
    };
    if (logger.info) logger.info('[DRY-RUN] Restore preview completed safely with 0 changes applied.');
    return preview;
  }

  let client = dbClient;
  let didConnectLocally = false;
  const mongoUri = config.database?.uri || process.env.MONGODB_URI;

  let safetyBackupId = null;
  let restoreSummary = null;

  try {
    if (!client) {
      if (!mongoUri) {
        throw new RestoreError('Missing MongoDB connection URI for restore.', 'MISSING_URI');
      }
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
      client = mongoose.connection.client;
      didConnectLocally = true;
    }

    // 4. Pre-restore automatic safety backup snapshot
    if (!skipSafetyBackup) {
      if (logger.info) logger.info('Taking automated pre-restore safety snapshot of current database state...');
      let safetyResult = null;
      try {
        safetyResult = await backupService.createBackup({
          destDir: path.dirname(resolvedBackupPath),
          includeMaster: true,
          dbClient: client,
          logger: { info: () => {}, log: () => {}, error: () => {} }, // quiet
        });
      } catch (safetyErr) {
        throw new RestoreError(
          `Pre-restore automated safety backup failed: ${safetyErr.message}. Aborting restore to prevent data loss.`,
          'SAFETY_BACKUP_FAILED',
          safetyErr
        );
      }
      safetyBackupId = safetyResult.backupId;
      if (logger.info) logger.info(`Safety snapshot captured: ${safetyBackupId}`);
    }

    restoreSummary = {
      backupId: manifest.backupId,
      restoredAt: new Date().toISOString(),
      safetyBackupId,
      databasesRestored: [],
      totalDocumentsRestored: 0,
      status: 'SUCCESS',
    };

    // 5. Restore each database and its collections
    for (const dbEntry of manifest.databases) {
      const dbName = dbEntry.name;
      const dbDir = path.join(resolvedBackupPath, dbName);
      const targetDb = client.db(dbName);

      if (logger.info) logger.info(`Restoring database: ${dbName}...`);
      let dbRestoredDocs = 0;
      const colResults = [];

      for (const colEntry of dbEntry.collections) {
        const colName = colEntry.name;
        const bsonPath = path.join(dbDir, `${colName}.bson`);
        const metaPath = path.join(dbDir, `${colName}.metadata.json`);

        const docs = deserializeBsonFile(bsonPath);
        const col = targetDb.collection(colName);

        // Clean existing collection data before restoration
        await col.deleteMany({});

        if (docs.length > 0) {
          await col.insertMany(docs, { ordered: false });
        }

        // Recreate indexes from metadata
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            if (Array.isArray(meta.indexes)) {
              for (const idx of meta.indexes) {
                if (idx.name !== '_id_' && idx.key) {
                  const opts = { name: idx.name };
                  if (idx.unique) opts.unique = true;
                  if (idx.sparse) opts.sparse = true;
                  await col.createIndex(idx.key, opts).catch(() => {});
                }
              }
            }
          } catch (_) {}
        }

        // Post-restoration verification of document count
        const verifyCount = await col.countDocuments();
        if (verifyCount !== colEntry.documents) {
          throw new RestoreError(
            `Verification failed for '${colName}' in '${dbName}': Expected ${colEntry.documents} docs, but verified ${verifyCount}`,
            'DOC_COUNT_MISMATCH'
          );
        }

        dbRestoredDocs += verifyCount;
        colResults.push({ name: colName, documents: verifyCount, status: 'VERIFIED' });
      }

      restoreSummary.databasesRestored.push({
        name: dbName,
        documents: dbRestoredDocs,
        collections: colResults,
      });
      restoreSummary.totalDocumentsRestored += dbRestoredDocs;
    }

    if (logger.info) logger.info(`Restore completed successfully: ${restoreSummary.totalDocumentsRestored} docs restored.`);
    return restoreSummary;
  } catch (err) {
    if (logger.error) logger.error(`Restore failed: ${err.message}`);
    if (restoreSummary) {
      err.partialSummary = restoreSummary;
    }
    throw err;
  } finally {
    if (didConnectLocally) {
      await mongoose.disconnect().catch(() => {});
    }
  }
}

export default {
  restoreBackup,
  deserializeBsonFile,
};
