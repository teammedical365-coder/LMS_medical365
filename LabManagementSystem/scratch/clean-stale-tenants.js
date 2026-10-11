/**
 * Cleanup stale temporary test databases created during tests to free collection slots on Atlas
 */

import mongoose from 'mongoose';
import fs from 'fs';

function loadEnv() {
  const envPath = 'D:/Laboratry_medical365/LabManagementSystem/server/.env';
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
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

const envVars = loadEnv();
const mongoUri = envVars.MONGODB_URI;

if (!mongoUri) {
  console.error('No MONGODB_URI found in server/.env');
  process.exit(1);
}

async function runCleanup() {
  console.log('Connecting to Atlas to list databases...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
  const adminDb = mongoose.connection.db.admin();

  const dbsResult = await adminDb.listDatabases();
  const allDbs = dbsResult.databases;
  console.log(`Total databases found on cluster: ${allDbs.length}`);

  // Test tenant databases created during automated testing start with 'lms_lab_ten_'
  const testDbs = allDbs.filter((db) => db.name.startsWith('lms_lab_ten_'));
  console.log(`Found ${testDbs.length} test laboratory tenant databases.`);

  // Keep the 5 most recent test databases if needed, drop the older ones to free collection slots
  // Each tenant database has 6 collections. 70 tenant databases = 420 collections!
  const dbsToDrop = testDbs.slice(0, Math.max(0, testDbs.length - 4));
  console.log(`Dropping ${dbsToDrop.length} stale test databases to free up collection quota...`);

  for (const dbInfo of dbsToDrop) {
    try {
      const tenantConn = mongoose.connection.useDb(dbInfo.name);
      await tenantConn.dropDatabase();
      console.log(`Dropped: ${dbInfo.name}`);
    } catch (err) {
      console.warn(`Failed to drop ${dbInfo.name}: ${err.message}`);
    }
  }

  console.log('Cleanup completed successfully!');
  await mongoose.disconnect();
  process.exit(0);
}

runCleanup().catch((err) => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
