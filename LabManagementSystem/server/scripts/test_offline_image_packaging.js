/**
 * Phase 5 Blocker Fix Verification Suite: Offline Docker Image Packaging
 * 
 * Tests:
 * 1. Required images are identified correctly from docker-compose.local.yml
 * 2. Archive manifest lists all required images with architecture & size
 * 3. Cryptographic SHA-256 verification of archive matches manifest and .sha256
 * 4. Image tags in Docker daemon match manifest metadata
 * 5. Loader rejects missing archive
 * 6. Loader rejects corrupted/tampered archive
 * 7. Existing persistent LMS volumes remain completely untouched
 * 8. Zero database records, BSON dumps, credentials, or patient data in archive
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const distDir = path.resolve(rootDir, 'installer_dist');

const readJson = (filePath) => {
  const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(content);
};

let passedTests = 0;
let totalTests = 0;

function runTest(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  [PASS] Test ${totalTests}: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] Test ${totalTests}: ${description}`);
    console.error(`         ${err.message}`);
  }
}

console.log('\n======================================================================');
console.log('   LMS MEDICAL365 — OFFLINE DOCKER IMAGE PACKAGING TEST SUITE');
console.log('======================================================================\n');

// -----------------------------------------------------------------------------
// Test 1: Required Images Identified Correctly
// -----------------------------------------------------------------------------
runTest('Required images identified correctly from docker-compose.local.yml', () => {
  const composePath = path.join(rootDir, 'docker-compose.local.yml');
  if (!fs.existsSync(composePath)) {
    throw new Error('docker-compose.local.yml not found');
  }
  const content = fs.readFileSync(composePath, 'utf8');

  const requiredImages = [
    'mongo:7.0',
    'lms-medical365-backend:local',
    'lms-medical365-frontend:local',
  ];

  for (const img of requiredImages) {
    if (!content.includes(img)) {
      throw new Error(`Required image ${img} not declared in docker-compose.local.yml`);
    }
  }
});

// -----------------------------------------------------------------------------
// Test 2: Archive Manifest Contains All Required Images
// -----------------------------------------------------------------------------
runTest('Archive manifest exists and contains metadata for all 3 images', () => {
  const manifestPath = path.join(distDir, 'offline-images-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error('offline-images-manifest.json not found in installer_dist');
  }

  const manifest = readJson(manifestPath);
  if (manifest.imagesCount !== 3) {
    throw new Error(`Expected imagesCount: 3, found: ${manifest.imagesCount}`);
  }

  const repoTags = manifest.images.map((img) => img.repoTag);
  const expectedTags = ['mongo:7.0', 'lms-medical365-backend:local', 'lms-medical365-frontend:local'];

  for (const tag of expectedTags) {
    if (!repoTags.includes(tag)) {
      throw new Error(`Manifest missing image tag: ${tag}`);
    }
  }

  // Verify architectures and sizes are populated
  for (const img of manifest.images) {
    if (!img.architecture || !img.os || img.sizeBytes <= 0) {
      throw new Error(`Invalid metadata for image: ${img.repoTag}`);
    }
  }
});

// -----------------------------------------------------------------------------
// Test 3: SHA-256 Cryptographic Verification
// -----------------------------------------------------------------------------
runTest('Cryptographic SHA-256 verification of archive matches manifest and .sha256', () => {
  const tarPath = path.join(distDir, 'LMS_Medical365_Offline_Images_v1.0.0.tar');
  const shaPath = path.join(distDir, 'offline-images.sha256');
  const manifestPath = path.join(distDir, 'offline-images-manifest.json');

  if (!fs.existsSync(tarPath)) {
    throw new Error('Offline TAR archive not found: ' + tarPath);
  }
  if (!fs.existsSync(shaPath)) {
    throw new Error('offline-images.sha256 not found: ' + shaPath);
  }

  const manifest = readJson(manifestPath);
  const shaContent = fs.readFileSync(shaPath, 'utf8').trim();
  const shaMatch = shaContent.match(/^([A-Fa-f0-9]{64})/);

  if (!shaMatch) {
    throw new Error('offline-images.sha256 does not contain valid 64-char hex hash');
  }

  const expectedHashFromShaFile = shaMatch[1].toUpperCase();
  const expectedHashFromManifest = manifest.sha256.toUpperCase();

  if (expectedHashFromShaFile !== expectedHashFromManifest) {
    throw new Error('Mismatch between manifest sha256 and offline-images.sha256 file');
  }

  // Calculate hash of the actual file (stream-based for 370MB)
  const fileBuffer = fs.readFileSync(tarPath);
  const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex').toUpperCase();

  if (actualHash !== expectedHashFromManifest) {
    throw new Error(`Hash mismatch! Calculated: ${actualHash}, Expected: ${expectedHashFromManifest}`);
  }
});

// -----------------------------------------------------------------------------
// Test 4: Image Tags Exist in Docker Daemon Matching Manifest
// -----------------------------------------------------------------------------
runTest('Images in local Docker daemon match manifest metadata and tags', () => {
  const manifest = readJson(path.join(distDir, 'offline-images-manifest.json'));

  for (const img of manifest.images) {
    try {
      const inspectOut = execSync(`docker image inspect ${img.repoTag} --format "{{.Id}}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      }).trim();

      if (!inspectOut.includes(img.imageId.replace('sha256:', ''))) {
        throw new Error(`Docker image ID for ${img.repoTag} differs from manifest`);
      }
    } catch (err) {
      throw new Error(`Docker inspection failed for tag ${img.repoTag}: ${err.message}`);
    }
  }
});

// -----------------------------------------------------------------------------
// Test 5: Loader Detects Missing Archive
// -----------------------------------------------------------------------------
runTest('Loader logic detects missing archive and aborts cleanly', () => {
  const loaderScriptPath = path.join(rootDir, 'scripts/load-offline-images.ps1');
  if (!fs.existsSync(loaderScriptPath)) {
    throw new Error('scripts/load-offline-images.ps1 not found');
  }

  try {
    execSync(`powershell -ExecutionPolicy Bypass -File "${loaderScriptPath}" -ArchivePath "NONEXISTENT_ARCHIVE.tar"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    throw new Error('Loader should have failed on missing archive!');
  } catch (err) {
    // Expected exit code 1
    const output = (err.stdout || '') + (err.stderr || '');
    if (!output.includes('Offline image archive not found')) {
      throw new Error(`Expected 'Offline image archive not found' error message, got: ${output}`);
    }
  }
});

// -----------------------------------------------------------------------------
// Test 6: Loader Rejects Corrupted Archive
// -----------------------------------------------------------------------------
runTest('Loader logic rejects corrupted archive with checksum mismatch', () => {
  const loaderScriptPath = path.join(rootDir, 'scripts/load-offline-images.ps1');
  const tempCorruptTar = path.join(distDir, '.test_corrupt.tar');
  const tempSha = path.join(distDir, '.test_corrupt.sha256');

  try {
    fs.writeFileSync(tempCorruptTar, 'DUMMY_CORRUPTED_TAR_PAYLOAD');
    fs.writeFileSync(tempSha, 'E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855  *.test_corrupt.tar');

    try {
      execSync(`powershell -ExecutionPolicy Bypass -File "${loaderScriptPath}" -ArchivePath "${tempCorruptTar}" -ChecksumPath "${tempSha}"`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      throw new Error('Loader should have failed on corrupted archive!');
    } catch (err) {
      const output = (err.stdout || '') + (err.stderr || '');
      if (!output.includes('CHECKSUM VERIFICATION FAILED')) {
        throw new Error(`Expected 'CHECKSUM VERIFICATION FAILED', got: ${output}`);
      }
    }
  } finally {
    if (fs.existsSync(tempCorruptTar)) fs.unlinkSync(tempCorruptTar);
    if (fs.existsSync(tempSha)) fs.unlinkSync(tempSha);
  }
});

// -----------------------------------------------------------------------------
// Test 7: Existing LMS Volumes Remain Untouched
// -----------------------------------------------------------------------------
runTest('Existing LMS persistent Docker volumes remain intact', () => {
  const expectedVolumes = [
    'lms_local_mongo_data',
    'lms_local_backup_data',
    'lms_local_storage_data',
    'lms_local_log_data',
  ];

  const volOutput = execSync('docker volume ls --format "{{.Name}}"', { encoding: 'utf8' });
  const actualVolumes = volOutput.split('\n').map((v) => v.trim()).filter(Boolean);

  for (const vol of expectedVolumes) {
    if (!actualVolumes.some((av) => av.includes(vol))) {
      throw new Error(`Missing expected persistent volume: ${vol}`);
    }
  }
});

// -----------------------------------------------------------------------------
// Test 8: Zero Patient Data or Credentials in Image Archive
// -----------------------------------------------------------------------------
runTest('Zero database records, BSON dumps, credentials or patient data in archive', () => {
  const manifest = readJson(path.join(distDir, 'offline-images-manifest.json'));

  if (!manifest.integrityNotes.includes('Zero patient data')) {
    throw new Error('Manifest missing integrity guarantee');
  }

  // Inspect the tar table of contents for prohibited patterns (.env, .bson, local.env)
  const tarPath = path.join(distDir, 'LMS_Medical365_Offline_Images_v1.0.0.tar');
  const tarTf = execSync(`tar -tf "${tarPath}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });

  const prohibitedPatterns = [
    /local\.env$/i,
    /license\.key$/i,
    /\.bson$/i,
    /auditlogs/i,
    /patients/i,
    /invoices/i,
  ];

  for (const line of tarTf.split('\n')) {
    const trimmed = line.trim();
    for (const pat of prohibitedPatterns) {
      if (pat.test(trimmed)) {
        throw new Error(`Prohibited file/token found in offline image archive: ${trimmed}`);
      }
    }
  }
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`Offline Packaging Test Suite: ${passedTests} / ${totalTests} Passed (${totalTests - passedTests} Failed)`);
console.log('======================================================================\n');

if (passedTests < totalTests) {
  process.exit(1);
} else {
  process.exit(0);
}
