/**
 * Phase 1 Verification Test Suite: Local Edition Foundation & Database Isolation
 */

import { validateDatabaseIsolation, validateConfig } from '../src/config/env.js';
import { isOriginAllowed } from '../src/app.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('PHASE 1 VERIFICATION: LOCAL EDITION FOUNDATION & ISOLATION');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // [TEST GROUP 1] Database Isolation Fail-Closed Verification
  // --------------------------------------------------------------------------
  console.log('[1] Fail-Closed Database Isolation in Local Edition:');

  // Test 1.1: Atlas SRV URI in Local Edition -> MUST FAIL
  const atlasSrv = 'mongodb+srv://teammedical365_db_user:password@cluster0.pbpahse.mongodb.net/?appName=Cluster0';
  const resAtlasSrv = validateDatabaseIsolation(atlasSrv, true);
  assert(resAtlasSrv.isValid === false, 'Local Edition strictly rejects mongodb+srv:// connection scheme');
  assert(resAtlasSrv.error.includes('SEC-LOCAL-01'), 'Local Edition rejection error includes [SEC-LOCAL-01]');

  // Test 1.2: Atlas domain in direct URI -> MUST FAIL
  const atlasDirect = 'mongodb://user:pass@cluster0.pbpahse.mongodb.net:27017/lms_master';
  const resAtlasDirect = validateDatabaseIsolation(atlasDirect, true);
  assert(resAtlasDirect.isValid === false, 'Local Edition strictly rejects *.mongodb.net Atlas clusters');

  // Test 1.3: External WAN domain -> MUST FAIL
  const externalWan = 'mongodb://user:pass@database.cloud-vendor.com:27017/lms_master';
  const resExternalWan = validateDatabaseIsolation(externalWan, true);
  assert(resExternalWan.isValid === false, 'Local Edition rejects arbitrary external internet domains');

  // Test 1.4: Local Docker Service Name "mongo" -> MUST PASS
  const localDockerUri = 'mongodb://lms_app_user:pass123@mongo:27017/lms_master?authSource=admin';
  const resLocalDocker = validateDatabaseIsolation(localDockerUri, true);
  assert(resLocalDocker.isValid === true, 'Local Edition permits internal Docker network host "mongo"');

  // Test 1.5: Localhost loopback -> MUST PASS
  const localLoopback = 'mongodb://127.0.0.1:27017/lms_master';
  const resLocalLoopback = validateDatabaseIsolation(localLoopback, true);
  assert(resLocalLoopback.isValid === true, 'Local Edition permits loopback address 127.0.0.1');

  // Test 1.6: Private LAN IP (192.168.1.100) -> MUST PASS
  const localLanIp = 'mongodb://lms_app_user:pass@192.168.1.100:27017/lms_master';
  const resLocalLanIp = validateDatabaseIsolation(localLanIp, true);
  assert(resLocalLanIp.isValid === true, 'Local Edition permits private RFC 1918 LAN IP (192.168.x.x)');

  // Test 1.7: Cloud Edition (Mode A) -> MUST ALLOW Atlas
  const cloudAtlasCheck = validateDatabaseIsolation(atlasSrv, false);
  assert(cloudAtlasCheck.isValid === true, 'Mode A (Cloud Edition) is untouched and continues to allow Atlas URIs');

  // --------------------------------------------------------------------------
  // [TEST GROUP 2] Full validateConfig Integration Verification
  // --------------------------------------------------------------------------
  console.log('\n[2] Full Configuration & Startup Assertion:');

  // Local config with Atlas URI -> MUST FAIL validateConfig
  const localConfigWithAtlas = {
    isProduction: true,
    isLocalEdition: true,
    jwt: { secret: 'a'.repeat(32) },
    cookie: { secret: 'b'.repeat(32) },
    superAdmin: { apiKey: 'c'.repeat(24) },
    corsOrigins: ['http://localhost'],
    database: { uri: atlasSrv, autoConnect: true },
  };
  const valLocalAtlas = validateConfig(localConfigWithAtlas);
  assert(valLocalAtlas.isValid === false, 'validateConfig rejects Atlas URI when isLocalEdition is true');
  assert(valLocalAtlas.errors.some((e) => e.includes('SEC-LOCAL-01')), 'validateConfig error list contains SEC-LOCAL-01');

  // Local config with correct local Docker Mongo URI -> MUST PASS
  const localConfigValid = {
    isProduction: true,
    isLocalEdition: true,
    jwt: { secret: 'a'.repeat(32) },
    cookie: { secret: 'b'.repeat(32) },
    superAdmin: { apiKey: 'c'.repeat(24) },
    corsOrigins: ['http://localhost'],
    database: { uri: localDockerUri, autoConnect: true },
  };
  const valLocalValid = validateConfig(localConfigValid);
  assert(valLocalValid.isValid === true, 'validateConfig succeeds for compliant Local Edition configuration');

  // --------------------------------------------------------------------------
  // [TEST GROUP 3] CORS & LAN Origin Evaluation
  // --------------------------------------------------------------------------
  console.log('\n[3] CORS & LAN Origin Evaluation:');

  // Test LAN origins in Local Edition (isLocal = true)
  const allowedLan1 = isOriginAllowed('http://192.168.1.50:80', [], true, true);
  assert(allowedLan1 === true, 'Local Edition allows LAN origin 192.168.1.50');

  const allowedLan2 = isOriginAllowed('http://10.0.0.12:80', [], true, true);
  assert(allowedLan2 === true, 'Local Edition allows LAN origin 10.0.0.12');

  const allowedLan3 = isOriginAllowed('http://172.16.5.20:80', [], true, true);
  assert(allowedLan3 === true, 'Local Edition allows LAN origin 172.16.5.20');

  const deniedExternal = isOriginAllowed('http://malicious-external-site.com', [], true, true);
  assert(deniedExternal === false, 'Local Edition blocks unauthorized external origins');

  // Test Cloud Edition strictness (isLocal = false)
  const deniedLanInCloud = isOriginAllowed('http://192.168.1.50:80', [], true, false);
  assert(deniedLanInCloud === false, 'Cloud Edition preserves strict CORS blocking of non-whitelisted origins');

  // --------------------------------------------------------------------------
  // [TEST GROUP 4] Docker Assets Verification
  // --------------------------------------------------------------------------
  console.log('\n[4] Docker Assets & Configuration Files:');

  const filesToCheck = [
    'client/Dockerfile',
    'client/nginx.conf',
    'server/Dockerfile',
    'docker-compose.local.yml',
    'docker/nginx.conf',
    'docker/local.env.example',
    'docker/mongo-init/init-mongo.js',
  ];

  for (const relPath of filesToCheck) {
    const fullPath = path.resolve(rootDir, relPath);
    const exists = fs.existsSync(fullPath);
    assert(exists, `Required asset exists: ${relPath}`);
  }

  // Verify compose contents
  const composePath = path.resolve(rootDir, 'docker-compose.local.yml');
  const composeContent = fs.readFileSync(composePath, 'utf8');
  assert(composeContent.includes('frontend:'), 'Compose defines frontend service');
  assert(composeContent.includes('backend:'), 'Compose defines backend service');
  assert(composeContent.includes('mongo:'), 'Compose defines mongo service');
  assert(composeContent.includes('lms_mongo_data:'), 'Compose defines persistent mongo volume');
  assert(composeContent.includes('lms_backup_data:'), 'Compose defines persistent backup volume');
  assert(composeContent.includes('lms_storage_data:'), 'Compose defines persistent storage volume');
  assert(composeContent.includes('lms_log_data:'), 'Compose defines persistent log volume');
  assert(composeContent.includes('lms_private_network:'), 'Compose defines private bridge network');

  // Verify security constraints in compose
  assert(composeContent.includes('${FRONTEND_PORT:-80}:80'), 'Nginx frontend publishes port 80');
  assert(!composeContent.match(/backend:[\s\S]*?ports:\s*\n\s*-\s*["']?\d+/), 'Backend port 5000 is NOT published to host/LAN');
  assert(!composeContent.match(/mongo:[\s\S]*?ports:\s*\n\s*-\s*["']?27017/), 'Mongo port 27017 is NOT published to host/LAN');

  console.log('\n===============================================================');
  console.log(`TOTAL CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
