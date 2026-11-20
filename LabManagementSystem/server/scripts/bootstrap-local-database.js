#!/usr/bin/env node
/**
 * Lab Management System (LMS) - Local Database Bootstrap CLI Script
 * 
 * Usage:
 *   node server/scripts/bootstrap-local-database.js [options]
 * 
 * Options:
 *   --labName <name>          Laboratory display name (default: Main Clinical Laboratory)
 *   --labCode <code>          Unique laboratory code (default: main-lab)
 *   --labEmail <email>        Laboratory contact email (default: contact@locallab.com)
 *   --adminName <name>        Administrator full name (default: Laboratory Administrator)
 *   --adminEmail <email>      Administrator login email (default: admin@locallab.com)
 *   --adminPassword <pass>    Administrator initial password (default: LocalLabAdmin@123)
 *   --dry-run                 Simulate initialization without connecting to MongoDB
 */

import config, { validateDatabaseIsolation } from '../src/config/env.js';
import dbConnection from '../src/config/db.js';
import localDatabaseBootstrapService from '../src/services/localDatabaseBootstrap.service.js';

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--labName' && args[i + 1]) options.labName = args[++i];
    else if (args[i] === '--labCode' && args[i + 1]) options.labCode = args[++i];
    else if (args[i] === '--labEmail' && args[i + 1]) options.labEmail = args[++i];
    else if (args[i] === '--adminName' && args[i + 1]) options.adminFullName = args[++i];
    else if (args[i] === '--adminEmail' && args[i + 1]) options.adminEmail = args[++i];
    else if (args[i] === '--adminPassword' && args[i + 1]) {
      options.adminPassword = args[++i];
      console.warn('⚠️  [SECURITY WARNING]: Passing passwords via command-line flags (--adminPassword) exposes sensitive credentials in system process tables and shell history.');
      console.warn('   Recommended alternative: configure LOCAL_LAB_ADMIN_PASSWORD in your docker/local.env file.\n');
    }
    else if (args[i] === '--dry-run') options.dryRun = true;
  }
  return options;
}

async function run() {
  console.log('\n================================================================');
  console.log('  LMS MEDICAL365 — LOCAL DATABASE BOOTSTRAP UTILITY');
  console.log('================================================================\n');

  const options = parseArgs();

  // 1. Enforce fail-closed database isolation check (SEC-LOCAL-01)
  console.log('[1/4] Enforcing Local Edition database security isolation...');
  const isolationCheck = validateDatabaseIsolation(config.database?.uri, true);
  if (!isolationCheck.isValid) {
    console.error(`❌ [SEC-LOCAL-01 FATAL]: ${isolationCheck.error}`);
    console.error('Bootstrap refused: Local Edition cannot point to Atlas or external databases.');
    process.exit(1);
  }
  console.log('  ✓ Local Edition database isolation verified (Direct local MongoDB only).');

  // 2. Dry run check
  if (options.dryRun) {
    console.log('\n[DRY RUN] Executing simulated bootstrap in memory...');
    localDatabaseBootstrapService.testMemoryMode = true;
    const dryResult = await localDatabaseBootstrapService.bootstrapAll(options);
    console.log('\n[DRY RUN RESULT]:', JSON.stringify(dryResult, null, 2));
    console.log('\n✅ Dry run completed successfully without errors.\n');
    process.exit(0);
  }

  // 3. Connect to local MongoDB
  console.log('\n[2/4] Connecting to local MongoDB instance...');
  let connected = false;
  try {
    const connResult = await dbConnection.connect();
    if (connResult.status === 'connected') {
      connected = true;
      console.log(`  ✓ Connected to local MongoDB master database: ${connResult.dbName} (${connResult.host})`);
    }
  } catch (err) {
    console.warn(`  ⚠️  Connection failed: ${dbConnection.sanitizeErrorMessage(err.message)}`);
  }

  if (!connected) {
    console.log('\n================================================================');
    console.log('  STATUS: BLOCKED — LOCAL MONGODB UNAVAILABLE');
    console.log('================================================================');
    console.log('Local MongoDB Community service is not running on port 27017.');
    console.log('To complete live database initialization:');
    console.log('  1. Start local MongoDB Community service (net start MongoDB) OR');
    console.log('  2. Start MongoDB Docker container (docker compose -f docker-compose.local.yml up -d mongo)');
    console.log('  3. Re-run: npm run bootstrap:local');
    console.log('================================================================\n');
    process.exit(0);
  }

  // 4. Execute Bootstrap
  console.log('\n[3/4] Initializing master database and default laboratory...');
  try {
    const result = await localDatabaseBootstrapService.bootstrapAll(options);

    console.log('\n[4/4] Finalizing and recording audit trail...');
    console.log('\n================================================================');
    console.log('  BOOTSTRAP RESULT: SUCCESS');
    console.log('================================================================');
    console.log(`  Master Database:   ${result.masterDatabase?.masterDbName || 'lms_master'}`);
    console.log(`  Laboratory Name:   ${result.defaultLaboratory?.tenant?.name}`);
    console.log(`  Laboratory Code:   ${result.defaultLaboratory?.tenant?.code}`);
    console.log(`  Tenant Database:   ${result.defaultLaboratory?.databaseName}`);
    console.log(`  Admin Login Email: ${result.defaultLaboratory?.initialAdminEmail || 'Configured email'}`);
    console.log(`  Admin Password:    [PROTECTED - Configured in environment]`);
    console.log('================================================================\n');

    await dbConnection.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(`\n❌ [BOOTSTRAP ERROR]: ${err.message}`);
    await dbConnection.disconnect().catch(() => {});
    process.exit(1);
  }
}

run();
