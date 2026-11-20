/**
 * LMS Medical365 - Database Safe Restore CLI Runner
 * Invokes restore.service.js with CLI options
 */

import path from 'path';
import { restoreBackup } from '../src/services/restore.service.js';

async function main() {
  const args = process.argv.slice(2);
  let backupPath = null;
  let confirmToken = null;
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--backup=')) backupPath = a.slice(9);
    else if (a === '--backup' && i + 1 < args.length) backupPath = args[++i];
    else if (a.startsWith('--confirm=')) confirmToken = a.slice(10);
    else if (a === '--confirm' && i + 1 < args.length) confirmToken = args[++i];
    else if (a === '--dry-run') dryRun = true;
  }

  if (!backupPath) {
    console.error('Error: --backup=<path_to_backup_dir> is required.');
    process.exit(1);
  }

  if (!confirmToken && !dryRun) {
    console.error("Error: --confirm=RESTORE-CONFIRM is required for real restoration (or use --dry-run).");
    process.exit(1);
  }

  console.log(`[RESTORE] Initializing restoration from: ${backupPath}`);
  const result = await restoreBackup({
    backupPath,
    confirmationToken: confirmToken,
    dryRun,
    logger: console,
  });

  if (dryRun) {
    console.log('[RESTORE-PREVIEW]', JSON.stringify(result, null, 2));
  } else {
    console.log(`[RESTORE-SUCCESS] Restored ${result.totalDocumentsRestored} documents across ${result.databasesRestored.length} databases.`);
    if (result.safetyBackupId) {
      console.log(`[RESTORE-SAFETY] Pre-restore safety backup captured: ${result.safetyBackupId}`);
    }
  }
}

main().catch((err) => {
  console.error('[RESTORE-FAILED]', err.message);
  process.exit(1);
});
