/**
 * LMS Medical365 - Database Backup CLI Runner
 * Invokes backup.service.js with CLI options
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { createBackup, listBackups, validateBackupArchive } from '../src/services/backup.service.js';

async function main() {
  const args = process.argv.slice(2);
  let destDir = null;
  let retentionDays = 14;
  let targetTenantId = null;
  let isList = false;
  let validatePath = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--dest=')) destDir = a.slice(7);
    else if (a === '--dest' && i + 1 < args.length) destDir = args[++i];
    else if (a.startsWith('--retention-days=')) retentionDays = parseInt(a.slice(17), 10);
    else if (a.startsWith('--tenant-id=')) targetTenantId = a.slice(12);
    else if (a === '--list') isList = true;
    else if (a.startsWith('--validate=')) validatePath = a.slice(11);
  }

  if (isList) {
    const list = listBackups(destDir);
    console.log(JSON.stringify(list, null, 2));
    return;
  }

  if (validatePath) {
    const res = validateBackupArchive(validatePath);
    console.log(JSON.stringify(res, null, 2));
    if (!res.isValid) process.exit(1);
    return;
  }

  console.log('[BACKUP] Starting LMS database backup process...');
  const result = await createBackup({
    destDir,
    retentionDays,
    targetTenantId,
    logger: console,
  });

  console.log(`[BACKUP-SUCCESS] Backup ID: ${result.backupId}`);
  console.log(`[BACKUP-PATH] Path: ${result.backupDir}`);
  console.log(`[BACKUP-SUMMARY] Databases: ${result.manifest.summary.totalDatabases}, Docs: ${result.manifest.summary.totalDocuments}`);
}

main().catch((err) => {
  console.error('[BACKUP-FAILED]', err.message);
  process.exit(1);
});
