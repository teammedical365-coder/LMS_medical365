import http from 'http';
import tokenService from '../src/services/token.service.js';

// Generate tokens for both platform admin and tenant lab admin
const superAdminToken = tokenService.generatePlatformAdminToken({
  adminId: 'super_admin_benchmarker',
  email: 'admin@medical365.com',
  role: 'super_admin',
});

const activeTenantId = 'ten_d8436e4d882e';

const tenantToken = tokenService.generateTenantUserToken(
  {
    userId: 'usr_benchmarker',
    email: 'admin@jaipurlab.com',
    role: 'lab_admin',
  },
  activeTenantId
);

const clinicalToken = tokenService.generateTenantUserToken(
  {
    userId: 'usr_clinical_bench',
    email: 'staff@jaipurlab.com',
    role: 'receptionist',
  },
  activeTenantId
);

function makeRequest(path, customToken = superAdminToken) {
  return new Promise((resolve) => {
    const start = performance.now();
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${customToken}`,
          Accept: 'application/json',
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          const latency = performance.now() - start;
          resolve({ path, statusCode: res.statusCode, latency, bytes: body.length });
        });
      }
    );

    req.on('error', (err) => {
      const latency = performance.now() - start;
      resolve({ path, error: err.message, latency });
    });

    req.end();
  });
}

async function runBenchmark() {
  console.log('====================================================');
  console.log('LMS CORE API ENDPOINT BENCHMARK SUITE');
  console.log('====================================================\n');

  const endpoints = [
    '/api/v1/health',
    '/api/v1/super-admin/overview',
    '/api/v1/super-admin/laboratories?page=1&limit=10',
    '/api/v1/super-admin/roles',
    `/api/v1/tenants/${activeTenantId}/dashboard-summary`,
    `/api/v1/tenants/${activeTenantId}/patients`,
    `/api/v1/tenants/${activeTenantId}/orders?limit=50`,
    `/api/v1/tenants/${activeTenantId}/samples?limit=50`,
    `/api/v1/tenants/${activeTenantId}/reports?limit=50`,
    `/api/v1/tenants/${activeTenantId}/tests`,
  ];

  const results = {};

  for (const ep of endpoints) {
    const latencies = [];
    let statusCode = 200;
    let byteSize = 0;

    let reqToken = superAdminToken;
    if (ep.includes('/patients') || ep.includes('/orders') || ep.includes('/samples')) {
      reqToken = clinicalToken;
    } else if (ep.includes('/tenants/')) {
      reqToken = tenantToken;
    }
    // Run 5 requests per endpoint (1 warm-up + 4 measured)
    for (let i = 0; i < 5; i++) {
      const res = await makeRequest(ep, reqToken);
      statusCode = res.statusCode;
      byteSize = res.bytes || 0;
      if (i > 0) { // discard first cold connection round-trip for warm p50/p95
        latencies.push(res.latency);
      }
    }

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[latencies.length - 1]; // max of measured set
    results[ep] = { statusCode, p50, p95, byteSize };

    console.log(
      `✓ ${ep.padEnd(52)} | HTTP ${statusCode} | p50: ${p50.toFixed(1).padStart(5)} ms | p95: ${p95.toFixed(1).padStart(5)} ms | ${(byteSize / 1024).toFixed(1).padStart(5)} KB`
    );
  }

  console.log('\n====================================================');
  console.log('BENCHMARK COMPLETE');
  console.log('====================================================');
}

runBenchmark();
