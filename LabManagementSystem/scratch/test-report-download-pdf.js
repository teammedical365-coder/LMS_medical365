/**
 * Automated Verification Suite for LMS Download Released Report as PDF
 */

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
const BASE_URL = 'http://localhost:5000/api/v1';

const randSuffix = Math.floor(10000 + Math.random() * 90000);
const TENANT_A_CODE = `dl-a-${randSuffix}`;
const TENANT_B_CODE = `dl-b-${randSuffix}`;

async function request(method, path, body = null, headers = {}) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-bypass-rate-limit': 'test-bypass',
      ...headers,
    },
  };
  if (body) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE_URL}${path}`, opts);
  let data = null;
  const contentDisp = res.headers.get('content-disposition');
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }
  return { status: res.status, data, contentDisposition: contentDisp };
}

async function runTests() {
  console.log(`\n============================================================`);
  console.log(`--- STARTING LMS DOWNLOAD RELEASED REPORT AS PDF TEST SUITE ---`);
  console.log(`Tenant A Code: ${TENANT_A_CODE} | Tenant B Code: ${TENANT_B_CODE}`);
  console.log(`============================================================\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  // 1. Super Admin Authentication
  const superAdminEmail = envVars.BOOTSTRAP_ADMIN_EMAIL || envVars.SUPER_ADMIN_EMAIL || 'admin@lms-platform.local';
  const superAdminPass = envVars.BOOTSTRAP_ADMIN_PASSWORD || envVars.SUPER_ADMIN_PASSWORD || 'SuperAdminSecurePass!2026';

  const saLogin = await request('POST', '/auth/super-admin/login', {
    email: superAdminEmail,
    password: superAdminPass,
  });
  assert(saLogin.status === 200 && saLogin.data.data?.token, '1. Super Admin login');
  const saToken = saLogin.data.data.token;
  const saHeaders = { Authorization: `Bearer ${saToken}` };

  // 2. Provision Tenant A & B Laboratories
  const adminAEmail = `admin_a_${randSuffix}@dla.local`;
  const regA = await request(
    'POST',
    '/super-admin/laboratories',
    {
      name: `Metropolis Lab A ${randSuffix}`,
      code: TENANT_A_CODE,
      email: adminAEmail,
      phone: '+1-555-010-0033',
      adminEmail: adminAEmail,
      adminPassword: 'StaffSecurePass#2026',
      adminFullName: `Admin A ${randSuffix}`,
    },
    saHeaders
  );
  assert(regA.status === 201, '2. Provision Tenant A laboratory');
  const tenantAId = regA.data.data.tenantId;

  const adminBEmail = `admin_b_${randSuffix}@dlb.local`;
  const regB = await request(
    'POST',
    '/super-admin/laboratories',
    {
      name: `CityLab B ${randSuffix}`,
      code: TENANT_B_CODE,
      email: adminBEmail,
      phone: '+1-555-010-0044',
      adminEmail: adminBEmail,
      adminPassword: 'StaffSecurePass#2026',
      adminFullName: `Admin B ${randSuffix}`,
    },
    saHeaders
  );
  assert(regB.status === 201, '3. Provision Tenant B laboratory');
  const tenantBId = regB.data.data.tenantId;

  // Wait for Atlas initialization
  await new Promise((r) => setTimeout(r, 2500));

  // 3. Login as Admin A & Admin B
  const loginA = await request('POST', '/auth/laboratory/login', {
    organizationCode: TENANT_A_CODE,
    email: adminAEmail,
    password: 'StaffSecurePass#2026',
  });
  assert(loginA.status === 200, '4. Tenant A Admin login');
  const adminAToken = loginA.data.data.token;
  const adminAHeaders = { Authorization: `Bearer ${adminAToken}` };

  const loginB = await request('POST', '/auth/laboratory/login', {
    organizationCode: TENANT_B_CODE,
    email: adminBEmail,
    password: 'StaffSecurePass#2026',
  });
  assert(loginB.status === 200, '5. Tenant B Admin login');
  const adminBToken = loginB.data.data.token;
  const adminBHeaders = { Authorization: `Bearer ${adminBToken}` };

  // 4. Create Pathologist and Staff Users in Tenant A
  const pathUserRes = await request(
    'POST',
    `/tenants/${tenantAId}/users`,
    {
      fullName: 'Dr. Gregory House',
      email: `path_${randSuffix}@dla.local`,
      password: 'Pathologist@Secure2026!',
      role: 'pathologist',
    },
    adminAHeaders
  );
  assert(pathUserRes.status === 201, '6. Create Pathologist user in Tenant A');

  // Login Pathologist
  const loginPath = await request('POST', '/auth/laboratory/login', {
    organizationCode: TENANT_A_CODE,
    email: `path_${randSuffix}@dla.local`,
    password: 'Pathologist@Secure2026!',
  });
  const pathToken = loginPath.data.data.token;
  const pathHeaders = { Authorization: `Bearer ${pathToken}` };

  // 5. Create Test Catalog Item, Patient, Order, and Enter Results
  const testRes = await request(
    'POST',
    `/tenants/${tenantAId}/tests`,
    {
      code: `LIPID-${randSuffix}`,
      name: 'Lipid Profile Panel',
      price: 55,
      specimenType: 'Serum',
      parameters: [
        {
          parameterCode: 'CHOL',
          name: 'Total Cholesterol',
          unit: 'mg/dL',
          resultType: 'NUMERIC',
          referenceRanges: [{ lowNormal: 125, highNormal: 200 }],
        },
        {
          parameterCode: 'TRIG',
          name: 'Triglycerides',
          unit: 'mg/dL',
          resultType: 'NUMERIC',
          referenceRanges: [{ lowNormal: 50, highNormal: 150 }],
        },
      ],
    },
    adminAHeaders
  );
  assert(testRes.status === 201, '7. Create test panel with structured parameters');

  const patRes = await request(
    'POST',
    `/tenants/${tenantAId}/patients`,
    {
      firstName: 'Ford',
      lastName: 'Prefect',
      gender: 'male',
      dob: '1980-01-01',
      phone: '+1-555-0420',
    },
    adminAHeaders
  );
  assert(patRes.status === 201, '8. Create patient');
  const patient = patRes.data.data;

  const orderRes = await request(
    'POST',
    `/tenants/${tenantAId}/orders`,
    {
      patientId: patient.patientId,
      items: [{ testCode: `LIPID-${randSuffix}` }],
    },
    adminAHeaders
  );
  assert(orderRes.status === 201, '9. Generate lab order');
  const order = orderRes.data.data;
  const itemId = order.items[0].itemId;

  // Enter results
  await request(
    'PATCH',
    `/tenants/${tenantAId}/orders/${order.orderId}/items/${itemId}/result`,
    {
      parameterResults: [
        { parameterCode: 'CHOL', value: 185 },
        { parameterCode: 'TRIG', value: 130 },
      ],
    },
    adminAHeaders
  );

  // 6. Pathologist drafts report
  const draftRes = await request(
    'POST',
    `/tenants/${tenantAId}/reports`,
    {
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientMrn: patient.mrn,
      testName: 'Lipid Profile Panel',
      findings: 'Lipid levels within desirable cardiac risk ranges.',
    },
    pathHeaders
  );
  assert(draftRes.status === 201, '10. Pathologist drafts diagnostic report');
  const draftReport = draftRes.data.data;
  const reportId = draftReport.reportId;

  // 7. SECURITY: Block download of unreleased/draft report
  const unreleasedDownload = await request(
    'GET',
    `/tenants/${tenantAId}/reports/${reportId}/download`,
    null,
    adminAHeaders
  );
  assert(
    unreleasedDownload.status === 400,
    '11. Server blocks official download of unreleased report (400)',
    JSON.stringify(unreleasedDownload.data)
  );

  // 8. Pathologist verifies report to approved state
  const approveRes = await request(
    'POST',
    `/tenants/${tenantAId}/reports/${reportId}/approve`,
    {
      findings: 'Confirmed desirable lipid parameters.',
      verificationNotes: 'Reviewed and verified by Dr. House.',
    },
    pathHeaders
  );
  assert(approveRes.status === 200 && approveRes.data.data.status === 'approved', '12. Pathologist verifies report to approved status');

  // Verify approved (but not released) report STILL cannot be downloaded as official
  const approvedDownload = await request(
    'GET',
    `/tenants/${tenantAId}/reports/${reportId}/download`,
    null,
    adminAHeaders
  );
  assert(
    approvedDownload.status === 400,
    '13. Server blocks official download of approved but unreleased report (400)'
  );

  // 9. Pathologist releases report
  const releaseRes = await request(
    'POST',
    `/tenants/${tenantAId}/reports/${reportId}/release`,
    {},
    pathHeaders
  );
  assert(releaseRes.status === 200, '14. Authorized Pathologist releases report');
  const releasedReport = releaseRes.data.data;
  assert(releasedReport.status === 'released', '15. Report status transitioned to released');
  const verificationToken = releasedReport.verificationToken;
  assert(!!verificationToken, '16. Verification token generated upon release');

  // 10. Successful Official Download of Released Report
  const downloadRes = await request(
    'GET',
    `/tenants/${tenantAId}/reports/${reportId}/download`,
    null,
    adminAHeaders
  );
  assert(downloadRes.status === 200, '17. Authorized staff downloads released report (200)');
  assert(downloadRes.data.data?.status === 'released', '18. Download payload confirms released status');
  assert(
    downloadRes.data.data?.safeFilename &&
      downloadRes.data.data.safeFilename.startsWith('Report_') &&
      downloadRes.data.data.safeFilename.endsWith('.pdf'),
    '19. Server generates sanitized PDF filename based on report number',
    `Filename: ${downloadRes.data.data?.safeFilename}`
  );
  assert(
    downloadRes.contentDisposition && downloadRes.contentDisposition.includes('attachment'),
    '20. Server sets Content-Disposition attachment header',
    downloadRes.contentDisposition
  );

  // 11. SECURITY: Block unauthorized unauthenticated download
  const unauthDownload = await request(
    'GET',
    `/tenants/${tenantAId}/reports/${reportId}/download`,
    null,
    {} // No auth token
  );
  assert(unauthDownload.status === 401, '21. Unauthenticated download rejected (401 Unauthorized)');

  // 12. SECURITY: Block cross-tenant download (Tenant B cannot download Tenant A's report)
  const crossTenantDownload = await request(
    'GET',
    `/tenants/${tenantAId}/reports/${reportId}/download`,
    null,
    adminBHeaders // Tenant B credentials
  );
  assert(crossTenantDownload.status === 403, '22. Cross-tenant download blocked (403 Forbidden)');

  // 13. SECURITY: Confirm QR public verification is still fully functional
  const qrVerifyRes = await request('GET', `/public/verify-report/${verificationToken}`);
  assert(qrVerifyRes.status === 200 && qrVerifyRes.data.data?.valid === true, '23. Public QR verification succeeds for released report');
  assert(qrVerifyRes.data.data?.reportNumber === releasedReport.reportNumber, '24. Public QR verification matches official report number');

  // 14. SECURITY: Confirm public verification DOES NOT leak protected patient data
  const qrData = qrVerifyRes.data.data;
  const noPatientLeaks = !qrData.patientName && !qrData.patientMrn && !qrData.patientId;
  const noResultLeaks = !qrData.items && !qrData.parameterResults && !qrData.findings;
  assert(noPatientLeaks && noResultLeaks, '25. Public QR endpoint strictly preserves patient privacy');

  console.log(`\n============================================================`);
  console.log(`--- TEST RESULTS: ${passed} PASSED | ${failed} FAILED ---`);
  console.log(`============================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
