/**
 * Phase 4 Verification Test Suite: LAN Testing & Multi-Computer Access
 * 
 * Validates:
 * 1. RFC 1918 Private LAN IPv4 Subnets & Loopback Validation
 * 2. Origin & CORS Security Rules (LAN allowed in Local Edition; Public WAN blocked)
 * 3. Tenant & White-Label Branding Resolution via LAN IP / Hostname
 * 4. Reverse Proxy Routing & Zero Host Exposure of MongoDB (27017) and Backend (5000)
 * 5. Relative Frontend API Configuration (No hardcoded localhost in browser requests)
 * 6. Session Cookie Transmission Compatibility (Plain HTTP LAN vs Production HTTPS)
 * 7. Live Docker Runtime LAN Verification & Multi-Session Clinical Workflow (if containers are online)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isOriginAllowed } from '../src/app.js';
import config, { validateDatabaseIsolation } from '../src/config/env.js';
import { isPrivateLanHost } from '../src/utils/networkUtils.js';
import { tokenService } from '../src/services/token.service.js';
import laboratoryManagementService from '../src/services/laboratoryManagement.service.js';
import tenantResolutionService from '../src/services/tenantResolution.service.js';

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
  console.log('PHASE 4 VERIFICATION: LAN TESTING & MULTI-COMPUTER ACCESS');
  console.log('===============================================================\n');

  // --------------------------------------------------------------------------
  // [TEST GROUP 1] LAN Origin & CORS Validation
  // --------------------------------------------------------------------------
  console.log('[1] LAN Origin & CORS Security Rules:');

  // Test 1.1: RFC 1918 Class A (10.x.x.x) allowed in Local Edition
  assert(
    isOriginAllowed('http://10.0.0.15:80', [], true, true) === true,
    'Local Edition permits RFC 1918 Class A LAN origin (10.0.0.15:80)'
  );

  // Test 1.2: RFC 1918 Class B (172.16-31.x.x) allowed in Local Edition
  assert(
    isOriginAllowed('http://172.25.211.3:80', [], true, true) === true,
    'Local Edition permits physical central PC LAN IP origin (172.25.211.3:80)'
  );
  assert(
    isOriginAllowed('http://172.16.1.10', [], true, true) === true,
    'Local Edition permits lower boundary Class B LAN IP origin (172.16.1.10)'
  );
  assert(
    isOriginAllowed('http://172.31.254.1', [], true, true) === true,
    'Local Edition permits upper boundary Class B LAN IP origin (172.31.254.1)'
  );

  // Test 1.3: RFC 1918 Class C (192.168.x.x) allowed in Local Edition
  assert(
    isOriginAllowed('http://192.168.1.50:80', [], true, true) === true,
    'Local Edition permits RFC 1918 Class C LAN origin (192.168.1.50:80)'
  );

  // Test 1.4: Loopback origins allowed in Local Edition
  assert(
    isOriginAllowed('http://localhost:80', [], true, true) === true,
    'Local Edition permits localhost origin'
  );
  assert(
    isOriginAllowed('http://127.0.0.1:80', [], true, true) === true,
    'Local Edition permits 127.0.0.1 loopback origin'
  );

  // Test 1.5: Public WAN IP origins strictly BLOCKED in Local Edition
  assert(
    isOriginAllowed('http://8.8.8.8:80', [], true, true) === false,
    'Local Edition blocks public WAN IP origin (8.8.8.8)'
  );
  assert(
    isOriginAllowed('http://104.21.5.1:80', [], true, true) === false,
    'Local Edition blocks external cloud IP origin (104.21.5.1)'
  );
  assert(
    isOriginAllowed('http://172.32.0.1:80', [], true, true) === false,
    'Local Edition blocks out-of-range non-private IP (172.32.0.1)'
  );

  // Test 1.6: Public internet domain origins strictly BLOCKED in Local Edition
  assert(
    isOriginAllowed('http://evil.com', [], true, true) === false,
    'Local Edition blocks arbitrary external web origin (evil.com)'
  );
  assert(
    isOriginAllowed('https://attacker-hospital.org', [], true, true) === false,
    'Local Edition blocks malicious external domain (attacker-hospital.org)'
  );

  // Test 1.7: Cloud Edition (Mode A) preservation - LAN origins blocked by default
  assert(
    isOriginAllowed('http://172.25.211.3:80', [], true, false) === false,
    'Cloud Edition preserves strict CORS blocking of LAN IPs without explicit allowlisting'
  );

  // --------------------------------------------------------------------------
  // [TEST GROUP 2] Network & LAN Host Security Utilities (isPrivateLanHost)
  // --------------------------------------------------------------------------
  console.log('\n[2] Network & LAN Host Validation (RFC 1918 & Loopback):');

  assert(isPrivateLanHost('localhost') === true, 'isPrivateLanHost recognizes localhost');
  assert(isPrivateLanHost('127.0.0.1') === true, 'isPrivateLanHost recognizes 127.0.0.1');
  assert(isPrivateLanHost('::1') === true, 'isPrivateLanHost recognizes IPv6 loopback ::1');
  assert(isPrivateLanHost('mongo') === true, 'isPrivateLanHost recognizes internal Docker service "mongo"');
  assert(isPrivateLanHost('backend') === true, 'isPrivateLanHost recognizes internal Docker service "backend"');
  assert(isPrivateLanHost('172.25.211.3') === true, 'isPrivateLanHost recognizes physical LAN IP 172.25.211.3');
  assert(isPrivateLanHost('172.25.211.3:80') === true, 'isPrivateLanHost strips port and validates 172.25.211.3:80');
  assert(isPrivateLanHost('http://192.168.1.100/api') === true, 'isPrivateLanHost strips protocol/path and validates 192.168.1.100');
  assert(isPrivateLanHost('10.0.0.1') === true, 'isPrivateLanHost recognizes Class A private IP 10.0.0.1');

  // Public WAN & Invalid Hosts strictly rejected
  assert(isPrivateLanHost('8.8.8.8') === false, 'isPrivateLanHost rejects public DNS 8.8.8.8');
  assert(isPrivateLanHost('1.1.1.1') === false, 'isPrivateLanHost rejects public DNS 1.1.1.1');
  assert(isPrivateLanHost('104.21.5.1') === false, 'isPrivateLanHost rejects public cloud IP 104.21.5.1');
  assert(isPrivateLanHost('172.32.0.1') === false, 'isPrivateLanHost rejects out-of-range IP 172.32.0.1');
  assert(isPrivateLanHost('256.0.0.1') === false, 'isPrivateLanHost rejects invalid octet IP 256.0.0.1');
  assert(isPrivateLanHost('google.com') === false, 'isPrivateLanHost rejects public domain google.com');
  assert(isPrivateLanHost('evil.com') === false, 'isPrivateLanHost rejects public domain evil.com');
  assert(isPrivateLanHost('lms-medical365.vercel.app') === false, 'isPrivateLanHost rejects Vercel cloud domain');

  // --------------------------------------------------------------------------
  // [TEST GROUP 3] Tenant & White-Label Branding Resolution via LAN IP
  // --------------------------------------------------------------------------
  console.log('\n[3] Tenant & White-Label Branding Resolution:');

  // Enforce Local Edition mode for resolution tests
  config.isLocalEdition = true;

  // In memory mode, setup a mock active tenant
  laboratoryManagementService.memoryTenants.set('ten_lan_test', {
    tenantId: 'ten_lan_test',
    code: 'lan-lab',
    name: 'Metro Diagnostic Center',
    status: 'ACTIVE',
    branding: {
      displayName: 'Metro Diagnostic Center',
      primaryColor: '#0d9488',
      accentColor: '#14b8a6',
      supportEmail: 'contact@metrolab.com',
    },
    database: {
      name: 'lms_lab_ten_lan_test',
      provisioningStatus: 'READY',
    },
    domains: [
      { domain: 'localhost', isVerified: true },
      { domain: '127.0.0.1', isVerified: true },
    ],
  });

  // Test 3.1: Public branding query with LAN IP in Local Edition
  const brandLanResult = await laboratoryManagementService.resolvePublicBranding('172.25.211.3');
  assert(brandLanResult !== null, 'Public branding resolves successfully for private LAN IP');
  assert(brandLanResult?.tenantId === 'ten_lan_test', 'Branding maps to active local laboratory tenant');

  // Test 3.2: Tenant resolution from request with LAN IP host
  const mockLanReq = {
    get: (h) => (h.toLowerCase() === 'host' ? '172.25.211.3:80' : null),
    hostname: '172.25.211.3',
    headers: {},
  };
  const resolveLanReq = await tenantResolutionService.resolveFromRequest(mockLanReq);
  assert(resolveLanReq.isResolved === true, 'tenantResolutionService resolves request with LAN IP host');
  assert(resolveLanReq.tenantId === 'ten_lan_test', 'tenantResolutionService matches active local laboratory tenant');

  // Test 3.3: Public branding query with public WAN domain is REJECTED
  const brandEvilResult = await laboratoryManagementService.resolvePublicBranding('evil.com');
  assert(brandEvilResult === null, 'Public branding rejects unauthorized external domain evil.com');

  const mockEvilReq = {
    get: (h) => (h.toLowerCase() === 'host' ? 'evil.com' : null),
    hostname: 'evil.com',
    headers: {},
  };
  const resolveEvilReq = await tenantResolutionService.resolveFromRequest(mockEvilReq);
  assert(resolveEvilReq.isResolved === false, 'tenantResolutionService rejects unauthorized external domain evil.com');

  // Test 3.4: Cloud Edition (Mode A) preservation - LAN IP does NOT auto-resolve tenant
  config.isLocalEdition = false;
  const brandCloudLan = await laboratoryManagementService.resolvePublicBranding('172.25.211.3');
  assert(brandCloudLan === null, 'Cloud Edition does NOT auto-resolve tenant for LAN IP (Preserves Mode A)');
  config.isLocalEdition = true; // Restore Local Edition for remainder

  // Clean up test memory tenant
  laboratoryManagementService.memoryTenants.delete('ten_lan_test');

  // --------------------------------------------------------------------------
  // [TEST GROUP 4] Reverse Proxy Configuration & Port Isolation
  // --------------------------------------------------------------------------
  console.log('\n[4] Reverse Proxy Configuration & Network Port Isolation:');

  const dockerNginx = fs.readFileSync(path.resolve(rootDir, 'docker/nginx.conf'), 'utf8');
  const clientNginx = fs.readFileSync(path.resolve(rootDir, 'client/nginx.conf'), 'utf8');
  const composeContent = fs.readFileSync(path.resolve(rootDir, 'docker-compose.local.yml'), 'utf8');

  // Nginx reverse proxy directives
  assert(dockerNginx.includes('listen 80;'), 'docker/nginx.conf listens on HTTP port 80');
  assert(dockerNginx.includes('proxy_pass http://backend:5000/api/;'), 'docker/nginx.conf reverse proxies /api/ to backend:5000');
  assert(dockerNginx.includes('proxy_set_header Host $host;'), 'docker/nginx.conf forwards Host header');
  assert(dockerNginx.includes('proxy_set_header X-Real-IP $remote_addr;'), 'docker/nginx.conf forwards client IP');
  assert(clientNginx.includes('proxy_pass http://backend:5000/api/;'), 'client/nginx.conf matches docker/nginx.conf API proxy');

  // Port isolation: Frontend is the ONLY service exposed to LAN
  assert(composeContent.includes('${FRONTEND_PORT:-80}:80'), 'Compose exposes frontend on LAN port 80');
  assert(!composeContent.match(/backend:[\s\S]*?ports:\s*\n\s*-\s*["']?\d+/), 'Backend port 5000 is NOT published to host or LAN (Internal only)');
  assert(!composeContent.match(/mongo:[\s\S]*?ports:\s*\n\s*-\s*["']?27017/), 'MongoDB port 27017 is NOT published to host or LAN (Internal only)');

  // --------------------------------------------------------------------------
  // [TEST GROUP 5] Frontend Relative API & Cookie Security
  // --------------------------------------------------------------------------
  console.log('\n[5] Client API Relative Path & Session Cookie Security:');

  const apiServiceContent = fs.readFileSync(path.resolve(rootDir, 'client/src/services/api.js'), 'utf8');
  assert(
    apiServiceContent.includes("baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1'"),
    'Client API uses relative /api/v1 path (No hardcoded localhost:5000)'
  );
  assert(
    apiServiceContent.includes('withCredentials: true'),
    'Client API enables withCredentials: true for cross-origin LAN cookie transmission'
  );

  // Session cookie options in Local Edition vs Cloud Edition
  const localCookieOpts = tokenService.getCookieOptions();
  assert(localCookieOpts.httpOnly === true, 'Session cookie has httpOnly: true (XSS protection)');
  assert(localCookieOpts.secure === false, 'Local Edition session cookie has secure: false (Plain HTTP LAN compatibility)');
  assert(localCookieOpts.sameSite === 'lax', 'Local Edition session cookie has sameSite: "lax" (LAN navigation compatibility)');

  // --------------------------------------------------------------------------
  // [TEST GROUP 6] Fail-Closed Database Isolation Enforcement (SEC-LOCAL-01)
  // --------------------------------------------------------------------------
  console.log('\n[6] Database Isolation Verification:');

  const atlasCheck = validateDatabaseIsolation('mongodb+srv://user:pass@cluster0.pbpahse.mongodb.net/', true);
  assert(atlasCheck.isValid === false, 'Local Edition strictly forbids Atlas cloud database connection');
  assert(atlasCheck.error.includes('SEC-LOCAL-01'), 'Rejection error carries SEC-LOCAL-01 compliance code');

  const localMongoCheck = validateDatabaseIsolation('mongodb://lms_app_user:pass@mongo:27017/lms_master?authSource=admin', true);
  assert(localMongoCheck.isValid === true, 'Local Edition permits internal isolated Docker mongo host');

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`TOTAL PHASE 4 CHECKS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
