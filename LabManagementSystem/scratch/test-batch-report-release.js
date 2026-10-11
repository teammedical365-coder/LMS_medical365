/**
 * Automated Verification Suite for LMS Batch Report Release
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
const TENANT_A_CODE = `br-a-${randSuffix}`;
const TENANT_B_CODE = `br-b-${randSuffix}`;

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
  try {
    data = await res.json();
  } catch (_) {
    data = null;
  }
  return { status: res.status, data };
}

async function runTests() {
  console.log(`\n============================================================`);
  console.log(`--- STARTING LMS BATCH REPORT RELEASE TEST SUITE ---`);
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

  // 1. Super Admin Login
  const superAdminEmail = envVars.BOOTSTRAP_ADMIN_EMAIL || envVars.SUPER_ADMIN_EMAIL || 'admin@lms-platform.local';
  const superAdminPass = envVars.BOOTSTRAP_ADMIN_PASSWORD || envVars.SUPER_ADMIN_PASSWORD || 'SuperAdminSecurePass!2026';

  const saLogin = await request('POST', '/auth/super-admin/login', {
    email: superAdminEmail,
    password: superAdminPass,
  });
  assert(saLogin.status === 200 && saLogin.data.data?.token, '1. Super Admin login');
  const saToken = saLogin.data.data.token;
  const saHeaders = { Authorization: `Bearer ${saToken}` };

  // 2. Provision Tenant A & Tenant B Laboratories
  const adminAEmail = `admin_a_${randSuffix}@bra.local`;
  const regA = await request(
    'POST',
    '/super-admin/laboratories',
    {
      name: `Batch Lab A ${randSuffix}`,
      code: TENANT_A_CODE,
      email: adminAEmail,
      phone: '+1-555-010-0055',
      adminEmail: adminAEmail,
      adminPassword: 'StaffSecurePass#2026',
      adminFullName: `Admin A ${randSuffix}`,
    },
    saHeaders
  );
  assert(regA.status === 201, '2. Provision Tenant A laboratory');
  const tenantAId = regA.data.data.tenantId;

  const adminBEmail = `admin_b_${randSuffix}@brb.local`;
  const regB = await request(
    'POST',
    '/super-admin/laboratories',
    {
      name: `Batch Lab B ${randSuffix}`,
      code: TENANT_B_CODE,
      email: adminBEmail,
      phone: '+1-555-010-0066',
      adminEmail: adminBEmail,
      adminPassword: 'StaffSecurePass#2026',
      adminFullName: `Admin B ${randSuffix}`,
    },
    saHeaders
  );
  assert(regB.status === 201, '3. Provision Tenant B laboratory');
  const tenantBId = regB.data.data.tenantId;

  // Wait for Atlas initialization
  await new Promise((r) => setTimeout(r, 3000));

  // 3. Login as Admin A & Admin B (with retry for Atlas initial sync)
  let loginA = await request('POST', '/auth/laboratory/login', {
    organizationCode: TENANT_A_CODE,
    email: adminAEmail,
    password: 'StaffSecurePass#2026',
  });
  if (loginA.status !== 200) {
    await new Promise((r) => setTimeout(r, 2000));
    loginA = await request('POST', '/auth/laboratory/login', {
      organizationCode: TENANT_A_CODE,
      email: adminAEmail,
      password: 'StaffSecurePass#2026',
    });
  }
  assert(loginA.status === 200, '4. Tenant A Admin login');
  const adminAToken = loginA.data?.data?.token;
  const adminAHeaders = { Authorization: `Bearer ${adminAToken}` };

  let loginB = await request('POST', '/auth/laboratory/login', {
    organizationCode: TENANT_B_CODE,
    email: adminBEmail,
    password: 'StaffSecurePass#2026',
  });
  if (loginB.status !== 200) {
    await new Promise((r) => setTimeout(r, 2000));
    loginB = await request('POST', '/auth/laboratory/login', {
      organizationCode: TENANT_B_CODE,
      email: adminBEmail,
      password: 'StaffSecurePass#2026',
    });
  }
  assert(loginB.status === 200, '5. Tenant B Admin login');
  const adminBToken = loginB.data?.data?.token;
  const adminBHeaders = { Authorization: `Bearer ${adminBToken}` };

  // 4. Create Pathologist and Receptionist in Tenant A
  const createPath = await request(
    'POST',
    `/tenants/${tenantAId}/users`,
    {
      fullName: 'Dr. Sarah Connor',
      email: `path_${randSuffix}@bra.local`,
      password: 'Pathologist@Secure2026!',
      role: 'pathologist',
    },
    adminAHeaders
  );
  assert(createPath.status === 201, '6. Create Pathologist user in Tenant A');

  const createRec = await request(
    'POST',
    `/tenants/${tenantAId}/users`,
    {
      fullName: 'Bob Clerk',
      email: `rec_${randSuffix}@bra.local`,
      password: 'Receptionist@Secure2026!',
      role: 'receptionist',
    },
    adminAHeaders
  );
  assert(createRec.status === 201, '7. Create Receptionist user in Tenant A');

  // Login Pathologist & Receptionist
  const loginPath = await request('POST', '/auth/laboratory/login', {
    organizationCode: TENANT_A_CODE,
    email: `path_${randSuffix}@bra.local`,
    password: 'Pathologist@Secure2026!',
  });
  const pathToken = loginPath.data.data.token;
  const pathHeaders = { Authorization: `Bearer ${pathToken}` };

  const loginRec = await request('POST', '/auth/laboratory/login', {
    organizationCode: TENANT_A_CODE,
    email: `rec_${randSuffix}@bra.local`,
    password: 'Receptionist@Secure2026!',
  });
  const recToken = loginRec.data.data.token;
  const recHeaders = { Authorization: `Bearer ${recToken}` };

  // 5. Setup Test Catalog Item
  const testRes = await request(
    'POST',
    `/tenants/${tenantAId}/tests`,
    {
      code: `GLU-${randSuffix}`,
      name: 'Fasting Blood Glucose',
      price: 25,
      specimenType: 'Plasma',
      parameters: [
        {
          parameterCode: 'GLUC',
          name: 'Glucose',
          unit: 'mg/dL',
          resultType: 'NUMERIC',
          referenceRanges: [{ lowNormal: 70, highNormal: 99 }],
        },
      ],
    },
    adminAHeaders
  );
  assert(testRes.status === 201, '8. Create catalog test');

  // Helper to create complete order & report
  async function createPatientOrderAndReport(patientName, glucoseValue) {
    const pRes = await request(
      'POST',
      `/tenants/${tenantAId}/patients`,
      {
        firstName: patientName.split(' ')[0],
        lastName: patientName.split(' ')[1] || 'Patient',
        gender: 'female',
        dob: '1990-05-15',
        phone: '+1-555-0999',
      },
      adminAHeaders
    );
    const pat = pRes.data.data;

    const oRes = await request(
      'POST',
      `/tenants/${tenantAId}/orders`,
      {
        patientId: pat.patientId,
        items: [{ testCode: `GLU-${randSuffix}` }],
      },
      adminAHeaders
    );
    const ord = oRes.data.data;

    // Enter result
    await request(
      'PATCH',
      `/tenants/${tenantAId}/orders/${ord.orderId}/items/${ord.items[0].itemId}/result`,
      {
        parameterResults: [{ parameterCode: 'GLUC', value: glucoseValue }],
      },
      adminAHeaders
    );

    // Create report draft
    const repRes = await request(
      'POST',
      `/tenants/${tenantAId}/reports`,
      {
        orderId: ord.orderId,
        orderNumber: ord.orderNumber,
        patientName: `${pat.firstName} ${pat.lastName}`,
        patientMrn: pat.mrn,
        testName: 'Fasting Blood Glucose',
        findings: 'Normal fasting blood glucose level.',
      },
      pathHeaders
    );
    return repRes.data.data;
  }

  // Create 3 reports:
  // Report 1: Will be approved (eligible for release)
  // Report 2: Will be approved (eligible for release)
  // Report 3: Will remain draft (ineligible for release)
  const report1 = await createPatientOrderAndReport('Alice Walker', 88);
  const report2 = await createPatientOrderAndReport('Brenda Smith', 92);
  const report3 = await createPatientOrderAndReport('Charlie Draft', 95);

  assert(report1 && report2 && report3, '9. Created 3 test diagnostic reports');

  // Pathologist approves Report 1 and Report 2
  const app1 = await request('POST', `/tenants/${tenantAId}/reports/${report1.reportId}/approve`, { findings: 'Normal', verificationNotes: 'OK' }, pathHeaders);
  const app2 = await request('POST', `/tenants/${tenantAId}/reports/${report2.reportId}/approve`, { findings: 'Normal', verificationNotes: 'OK' }, pathHeaders);
  assert(app1.status === 200 && app2.status === 200, '10. Pathologist approves Report 1 and Report 2');

  // Report 3 is intentionally left as DRAFT

  // 6. SECURITY: Unauthenticated Batch Release Rejected (401)
  const unauthBatch = await request('POST', `/tenants/${tenantAId}/reports/batch-release`, { reportIds: [report1.reportId] });
  assert(unauthBatch.status === 401, '11. Unauthenticated batch release rejected (401 Unauthorized)');

  // 7. SECURITY: Unauthorized Receptionist Rejected (403)
  const recBatch = await request(
    'POST',
    `/tenants/${tenantAId}/reports/batch-release`,
    { reportIds: [report1.reportId] },
    recHeaders
  );
  assert(recBatch.status === 403, '12. Unauthorized receptionist rejected (403 Forbidden)');

  // 8. SECURITY: Cross-Tenant Batch Release Blocked (403)
  const crossTenantBatch = await request(
    'POST',
    `/tenants/${tenantAId}/reports/batch-release`,
    { reportIds: [report1.reportId] },
    adminBHeaders // Tenant B user targeting Tenant A
  );
  assert(crossTenantBatch.status === 403, '13. Cross-tenant batch release blocked (403 Forbidden)');

  // 9. Mixed Batch Release Execution (2 approved + 1 draft)
  const mixedBatch = await request(
    'POST',
    `/tenants/${tenantAId}/reports/batch-release`,
    { reportIds: [report1.reportId, report2.reportId, report3.reportId] },
    pathHeaders
  );
  assert(mixedBatch.status === 200, '14. Batch release endpoint executes successfully (200 OK)');
  const batchData = mixedBatch.data.data;
  assert(batchData.totalRequested === 3, '15. totalRequested count matches (3)');
  assert(batchData.releasedCount === 2, '16. releasedCount reflects only approved reports (2)');
  assert(batchData.failedCount === 1, '17. failedCount reflects rejected draft report (1)');

  const res1 = batchData.results.find((r) => r.reportId === report1.reportId);
  const res2 = batchData.results.find((r) => r.reportId === report2.reportId);
  const res3 = batchData.results.find((r) => r.reportId === report3.reportId);

  assert(res1 && res1.status === 'released' && res1.success === true, '18. Report 1 released in batch');
  assert(res2 && res2.status === 'released' && res2.success === true, '19. Report 2 released in batch');
  assert(res3 && res3.status === 'failed' && res3.success === false, '20. Report 3 (Draft) failed release in batch with safe error message');
  assert(res3?.error && res3.error.includes('approved'), '21. Report 3 error clearly explains report must be approved');

  // Verify Report 3 is still draft in database
  const rep3Check = await request('GET', `/tenants/${tenantAId}/reports`, null, pathHeaders);
  const rep3Doc = rep3Check.data.data.find((r) => r.reportId === report3.reportId);
  assert(rep3Doc?.status === 'draft', '22. Unreleased draft report remained in draft status in database');

  // 10. Verification Tokens & Public QR Verification for Batch-Released Reports
  assert(!!res1.verificationToken, '23. Batch-released Report 1 assigned unique verificationToken');
  assert(!!res2.verificationToken, '24. Batch-released Report 2 assigned unique verificationToken');
  assert(res1.verificationToken !== res2.verificationToken, '25. Verification tokens are distinct and unique');

  const verify1 = await request('GET', `/public/verify-report/${res1.verificationToken}`);
  const verify2 = await request('GET', `/public/verify-report/${res2.verificationToken}`);
  assert(verify1.status === 200 && verify1.data.data?.valid === true, '26. Public QR verification succeeds for Batch Report 1');
  assert(verify2.status === 200 && verify2.data.data?.valid === true, '27. Public QR verification succeeds for Batch Report 2');

  // 11. Already Released Reports Rejection in Batch
  const reReleaseBatch = await request(
    'POST',
    `/tenants/${tenantAId}/reports/batch-release`,
    { reportIds: [report1.reportId, report2.reportId] },
    pathHeaders
  );
  assert(reReleaseBatch.status === 200, '28. Second batch release attempt handled gracefully');
  assert(reReleaseBatch.data.data.releasedCount === 0, '29. Already released reports not re-released (0 released)');
  assert(reReleaseBatch.data.data.failedCount === 2, '30. Already released reports marked as failed (2 failed)');

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
