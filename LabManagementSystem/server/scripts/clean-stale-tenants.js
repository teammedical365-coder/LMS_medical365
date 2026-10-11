import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

function loadEnv() {
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

const envVars = loadEnv();
const mongoUri = envVars.MONGODB_URI;

async function runCleanup() {
  console.log('Connecting to Atlas...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  const adminDb = mongoose.connection.db.admin();

  const dbsResult = await adminDb.listDatabases();
  const allDbs = dbsResult.databases;
  const testDbs = allDbs.filter((db) => db.name.startsWith('lms_lab_ten_'));
  console.log(`Found ${testDbs.length} test databases. Dropping collections in older ones...`);

  // Drop collections in older test databases (keep 6 most recent)
  const dbsToClean = testDbs.slice(0, Math.max(0, testDbs.length - 6));
  let totalDropped = 0;

  for (const dbInfo of dbsToClean) {
    try {
      const tenantDb = mongoose.connection.client.db(dbInfo.name);
      const collections = await tenantDb.listCollections().toArray();
      for (const col of collections) {
        try {
          await tenantDb.collection(col.name).drop();
          totalDropped++;
        } catch (colErr) {
          // ignore already dropped
        }
      }
      console.log(`Cleaned collections in: ${dbInfo.name}`);
    } catch (err) {
      console.warn(`Error on ${dbInfo.name}: ${err.message}`);
    }
  }

  console.log(`Successfully dropped ${totalDropped} collections!`);
  await mongoose.disconnect();
  process.exit(0);
}

runCleanup().catch((err) => {
  console.error('Cleanup error:', err);
  process.exit(1);
});
