/**
 * Automated Verification Suite for LMS Released Report Print & QR Verification
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
const TENANT_A_CODE = `pvr-a-${randSuffix}`;
const TENANT_B_CODE = `pvr-b-${randSuffix}`;

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
  console.log(`--- STARTING RELEASED REPORT PRINT & QR VERIFICATION TEST SUITE ---`);
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
  assert(saLogin.status === 200 && saLogin.data.data?.token, '1. Super Admin authentication', JSON.stringify(saLogin.data));
  const saToken = saLogin.data.data.token;
  const saHeaders = { Authorization: `Bearer ${saToken}` };

  // 2. Register Lab A
  const adminAEmail = `admin_a_${randSuffix}@pvra.local`;
  const regA = await request(
    'POST',
    '/super-admin/laboratories',
    {
      name: `Apex Diagnostic Labs ${randSuffix}`,
      code: TENANT_A_CODE,
      email: adminAEmail,
      phone: '+1-555-010-0010',
      adminEmail: adminAEmail,
      adminPassword: 'StaffSecurePass#2026',
      adminFullName: `Admin A ${randSuffix}`,
    },
    saHeaders
  );
  assert(regA.status === 201, '2. Provision Tenant A laboratory', JSON.stringify(regA.data));
  const tenantAId = regA.data.data.tenantId;

  // 3. Register Lab B
  const adminBEmail = `admin_b_${randSuffix}@pvrb.local`;
  const regB = await request(
    'POST',
    '/super-admin/laboratories',
    {
      name: `Beacon Path Lab ${randSuffix}`,
      code: TENANT_B_CODE,
      email: adminBEmail,
      phone: '+1-555-010-0020',
      adminEmail: adminBEmail,
      adminPassword: 'StaffSecurePass#2026',
      adminFullName: `Admin B ${randSuffix}`,
    },
    saHeaders
  );
  assert(regB.status === 201, '3. Provision Tenant B laboratory', JSON.stringify(regB.data));
  const tenantBId = regB.data.data.tenantId;

  // Wait for Atlas initialization
  await new Promise((r) => setTimeout(r, 2500));

  // 4. Login as Admin A
  const loginA = await request('POST', '/auth/laboratory/login', {
    organizationCode: TENANT_A_CODE,
    email: adminAEmail,
    password: 'StaffSecurePass#2026',
  });
  assert(loginA.status === 200, '4. Tenant A Admin login');
  const adminAToken = loginA.data.data.token;
  const adminAHeaders = { Authorization: `Bearer ${adminAToken}` };

  // Login as Admin B
  const loginB = await request('POST', '/auth/laboratory/login', {
    organizationCode: TENANT_B_CODE,
    email: adminBEmail,
    password: 'StaffSecurePass#2026',
  });
  const adminBToken = loginB.data.data.token;
  const adminBHeaders = { Authorization: `Bearer ${adminBToken}` };

  // 5. Create Pathologist and Receptionist in Tenant A
  const createPathologist = await request(
    'POST',
    `/tenants/${tenantAId}/users`,
    {
      fullName: 'Dr. Jane Pathologist',
      email: `path_${randSuffix}@pvra.local`,
      password: 'Pathologist@Secure2026!',
      role: 'pathologist',
    },
    adminAHeaders
  );
  assert(createPathologist.status === 201, '5. Create Pathologist user in Tenant A');

  const createRecept = await request(
    'POST',
    `/tenants/${tenantAId}/users`,
    {
      fullName: 'John Receptionist',
      email: `rec_${randSuffix}@pvra.local`,
      password: 'Receptionist@Secure2026!',
      role: 'receptionist',
    },
    adminAHeaders
  );
  assert(createRecept.status === 201, '6. Create Receptionist user in Tenant A');

  // Login Pathologist & Receptionist
  const loginPath = await request('POST', '/auth/laboratory/login', {
    organizationCode: TENANT_A_CODE,
    email: `path_${randSuffix}@pvra.local`,
    password: 'Pathologist@Secure2026!',
  });
  const pathToken = loginPath.data.data.token;
  const pathHeaders = { Authorization: `Bearer ${pathToken}` };

  const loginRec = await request('POST', '/auth/laboratory/login', {
    organizationCode: TENANT_A_CODE,
    email: `rec_${randSuffix}@pvra.local`,
    password: 'Receptionist@Secure2026!',
  });
  const recToken = loginRec.data.data.token;
  const recHeaders = { Authorization: `Bearer ${recToken}` };

  // 6. Setup Test with Parameters, Patient, Order, and Enter Results
  const testRes = await request(
    'POST',
    `/tenants/${tenantAId}/tests`,
    {
      code: `CBC-${randSuffix}`,
      name: 'Complete Blood Count Panel',
      price: 45,
      specimenType: 'Whole Blood (EDTA)',
      container: 'Lavender Top (EDTA)',
      parameters: [
        {
          parameterCode: 'WBC',
          name: 'White Blood Cell Count',
          unit: '10^3/uL',
          resultType: 'NUMERIC',
          referenceRanges: [{ lowNormal: 4.0, highNormal: 11.0 }],
        },
        {
          parameterCode: 'HGB',
          name: 'Hemoglobin',
          unit: 'g/dL',
          resultType: 'NUMERIC',
          referenceRanges: [{ lowNormal: 12.0, highNormal: 17.5 }],
        },
      ],
    },
    adminAHeaders
  );
  assert(testRes.status === 201, '7. Create test with structured parameters');

  const patRes = await request(
    'POST',
    `/tenants/${tenantAId}/patients`,
    {
      firstName: 'Arthur',
      lastName: 'Dent',
      gender: 'male',
      dob: '1984-03-11',
      phone: '+1-555-4242',
    },
    adminAHeaders
  );
  assert(patRes.status === 201, '8. Accession patient');
  const patient = patRes.data.data;

  const orderRes = await request(
    'POST',
    `/tenants/${tenantAId}/orders`,
    {
      patientId: patient.patientId,
      items: [{ testCode: `CBC-${randSuffix}` }],
    },
    adminAHeaders
  );
  assert(orderRes.status === 201, '9. Generate order requisition');
  const order = orderRes.data.data;
  const itemId = order.items[0].itemId;

  // Enter results
  await request(
    'PATCH',
    `/tenants/${tenantAId}/orders/${order.orderId}/items/${itemId}/result`,
    {
      parameterResults: [
        { parameterCode: 'WBC', value: 7.2 },
        { parameterCode: 'HGB', value: 14.8 },
      ],
    },
    adminAHeaders
  );

  // 7. Pathologist creates draft report
  const draftRep = await request(
    'POST',
    `/tenants/${tenantAId}/reports`,
    {
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      patientName: `${patient.firstName} ${patient.lastName}`,
      patientMrn: patient.mrn,
      testName: 'Complete Blood Count Panel',
      findings: 'Hematological parameters within normal diagnostic limits.',
    },
    pathHeaders
  );
  assert(draftRep.status === 201, '10. Pathologist drafts report');
  const reportId = draftRep.data.data.reportId;

  // 8. Pathologist verifies report
  const verifyRes = await request(
    'POST',
    `/tenants/${tenantAId}/reports/${reportId}/approve`,
    {
      findings: 'Confirmed within normal limits. Peripheral smear normal.',
      verificationNotes: 'Verified by Pathologist Jane.',
    },
    pathHeaders
  );
  assert(verifyRes.status === 200 && verifyRes.data.data.status === 'approved', '11. Pathologist verifies report to approved state');
  assert(!verifyRes.data.data.releasedAt, '12. Verification does not automatically release report');

  // 9. Unauthorized Receptionist cannot release report
  const recRelease = await request(
    'POST',
    `/tenants/${tenantAId}/reports/${reportId}/release`,
    {},
    recHeaders
  );
  assert(recRelease.status === 403, '13. Unauthorized receptionist cannot release report (403)');

  // 10. Tenant B cannot release Tenant A report (Cross-tenant isolation)
  const crossRelease = await request(
    'POST',
    `/tenants/${tenantAId}/reports/${reportId}/release`,
    {},
    adminBHeaders
  );
  assert(crossRelease.status === 403, '14. Cross-tenant isolation prevents Tenant B releasing Tenant A report (403)');

  // 11. Pathologist / Lab Admin releases report
  const releaseRes = await request(
    'POST',
    `/tenants/${tenantAId}/reports/${reportId}/release`,
    {},
    pathHeaders
  );
  assert(releaseRes.status === 200, '15. Authorized Pathologist releases report (200)');
  const releasedReport = releaseRes.data.data;
  assert(releasedReport.status === 'released', '16. Report status transitioned to released');
  assert(
    typeof releasedReport.verificationToken === 'string' && releasedReport.verificationToken.length >= 32,
    '17. Cryptographically unpredictable verification token generated on release',
    `Token: ${releasedReport.verificationToken}`
  );

  // 12. Public Report Verification Endpoint (Unauthenticated)
  const token = releasedReport.verificationToken;
  const publicVerify = await request('GET', `/public/verify-report/${token}`);
  assert(publicVerify.status === 200, '18. Public verification endpoint succeeds for released report token');
  assert(publicVerify.data.data?.valid === true, '19. Public endpoint reports valid: true');
  assert(publicVerify.data.data?.reportNumber === releasedReport.reportNumber, '20. Public endpoint matches official reportNumber');
  assert(publicVerify.data.data?.status === 'released', '21. Public endpoint reports release status');
  assert(!!publicVerify.data.data?.labName, '22. Public endpoint includes laboratory name');

  // 13. STRICT SECURITY: Confirm NO patient demographics or clinical test results are returned by public endpoint
  const pubData = publicVerify.data.data;
  const leaksPatient = pubData.patientName || pubData.patientMrn || pubData.patientId || pubData.mrn;
  const leaksResults = pubData.items || pubData.parameterResults || pubData.findings;
  assert(!leaksPatient, '23. Public endpoint STRICTLY DOES NOT leak patient demographics (HIPAA/Privacy compliant)');
  assert(!leaksResults, '24. Public endpoint STRICTLY DOES NOT leak clinical test results or findings');

  // 14. Invalid/Tampered Verification Token
  const invalidVerify = await request('GET', `/public/verify-report/tampered_token_xyz_9999`);
  assert(invalidVerify.status === 404, '25. Invalid or unknown verification token returns 404');
  assert(invalidVerify.data.data?.valid === false, '26. Invalid token payload returns valid: false');

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
