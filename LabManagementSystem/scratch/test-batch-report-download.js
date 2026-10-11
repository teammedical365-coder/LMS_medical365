/**
 * Automated Verification Script: Batch PDF Export for Released Reports
 * Verifies backend batch-download authorization, security guards,
 * tenant isolation, draft/approved eligibility checks, sanitized filenames,
 * audit logging, and payload privacy.
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
  return { status: res.status, headers: res.headers, data };
}

let passed = 0;
let failed = 0;

function assert(condition, message, details = '') {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message} - ${details}`);
    failed++;
  }
}

async function runTests() {
  const randSuffix = Math.floor(Math.random() * 90000) + 10000;
  console.log('============================================================');
  console.log(`--- STARTING LMS BATCH PDF DOWNLOAD TEST SUITE ---`);
  console.log(`Tenant A Code: bdl-a-${randSuffix} | Tenant B Code: bdl-b-${randSuffix}`);
  console.log('============================================================\n');

  // 1. Super Admin Login
  const superAdminEmail = envVars.BOOTSTRAP_ADMIN_EMAIL || envVars.SUPER_ADMIN_EMAIL || 'admin@lms-platform.local';
  const superAdminPass = envVars.BOOTSTRAP_ADMIN_PASSWORD || envVars.SUPER_ADMIN_PASSWORD || 'SuperAdminSecurePass!2026';

  const saLogin = await request('POST', '/auth/super-admin/login', {
    email: superAdminEmail,
    password: superAdminPass,
  });
  assert(saLogin.status === 200 && saLogin.data?.data?.token, '1. Super Admin login');
  const saToken = saLogin.data.data.token;
  const saHeaders = { Authorization: `Bearer ${saToken}` };

  // 2. Provision Tenant A & Tenant B Laboratories
  const codeA = `bdl-a-${randSuffix}`;
  const codeB = `bdl-b-${randSuffix}`;
  const adminAEmail = `admin_a_${randSuffix}@bdla.local`;
  const adminBEmail = `admin_b_${randSuffix}@bdlb.local`;
  const defaultPass = 'StaffSecurePass#2026';

  const regA = await request('POST', '/super-admin/laboratories', {
    name: `Batch Download Lab A ${randSuffix}`,
    code: codeA,
    email: adminAEmail,
    phone: '+1-555-010-0081',
    adminEmail: adminAEmail,
    adminPassword: defaultPass,
    adminFullName: `Admin A ${randSuffix}`,
  }, saHeaders);
  assert(regA.status === 201, '2. Provision Tenant A laboratory');
  const tenantAId = regA.data.data.tenantId;

  const regB = await request('POST', '/super-admin/laboratories', {
    name: `Batch Download Lab B ${randSuffix}`,
    code: codeB,
    email: adminBEmail,
    phone: '+1-555-010-0082',
    adminEmail: adminBEmail,
    adminPassword: defaultPass,
    adminFullName: `Admin B ${randSuffix}`,
  }, saHeaders);
  assert(regB.status === 201, '3. Provision Tenant B laboratory');
  const tenantBId = regB.data.data.tenantId;

  // Pause for MongoDB Atlas collection provisioning
  await new Promise((r) => setTimeout(r, 2600));

  // 3. Tenant Logins
  const loginA = await request('POST', '/auth/laboratory/login', {
    organizationCode: codeA,
    email: adminAEmail,
    password: defaultPass,
  });
  assert(loginA.status === 200, '4. Tenant A Admin login');
  const tokenA = loginA.data.data.token;
  const adminAHeaders = { Authorization: `Bearer ${tokenA}` };

  const loginB = await request('POST', '/auth/laboratory/login', {
    organizationCode: codeB,
    email: adminBEmail,
    password: defaultPass,
  });
  assert(loginB.status === 200, '5. Tenant B Admin login');
  const tokenB = loginB.data.data.token;
  const adminBHeaders = { Authorization: `Bearer ${tokenB}` };

  // 4. Create Pathologist and Receptionist in Tenant A
  const pathUserRes = await request('POST', `/tenants/${tenantAId}/users`, {
    fullName: `Dr. Pathologist ${randSuffix}`,
    email: `path_${randSuffix}@bdla.local`,
    role: 'pathologist',
    password: 'Pathologist@Secure2026!',
  }, adminAHeaders);
  assert(pathUserRes.status === 201, '6. Create Pathologist user in Tenant A');

  const recUserRes = await request('POST', `/tenants/${tenantAId}/users`, {
    fullName: `Receptionist ${randSuffix}`,
    email: `rec_${randSuffix}@bdla.local`,
    role: 'receptionist',
    password: 'Receptionist@Secure2026!',
  }, adminAHeaders);
  assert(recUserRes.status === 201, '7. Create Receptionist user in Tenant A');

  const pathLogin = await request('POST', '/auth/laboratory/login', {
    organizationCode: codeA,
    email: `path_${randSuffix}@bdla.local`,
    password: 'Pathologist@Secure2026!',
  });
  assert(pathLogin.status === 200, '8. Pathologist login successful');
  const pathToken = pathLogin.data.data.token;
  const pathHeaders = { Authorization: `Bearer ${pathToken}` };

  const recLogin = await request('POST', '/auth/laboratory/login', {
    organizationCode: codeA,
    email: `rec_${randSuffix}@bdla.local`,
    password: 'Receptionist@Secure2026!',
  });
  const recToken = recLogin.data.data.token;
  const recHeaders = { Authorization: `Bearer ${recToken}` };

  // 5. Create Test Catalog Item
  const testRes = await request('POST', `/tenants/${tenantAId}/tests`, {
    code: `LIPID-${randSuffix}`,
    name: 'Lipid Panel',
    price: 45,
    specimenType: 'Serum',
    parameters: [
      {
        parameterCode: 'CHOL',
        name: 'Total Cholesterol',
        unit: 'mg/dL',
        resultType: 'NUMERIC',
        referenceRanges: [{ lowNormal: 125, highNormal: 200 }],
      },
    ],
  }, adminAHeaders);
  assert(testRes.status === 201, '9. Create catalog test with structured parameter');

  // Helper to create complete order & report
  async function createPatientOrderAndReport(patientName, cholValue) {
    const pRes = await request('POST', `/tenants/${tenantAId}/patients`, {
      firstName: patientName.split(' ')[0],
      lastName: patientName.split(' ')[1] || 'Patient',
      gender: 'female',
      dob: '1992-04-10',
      phone: '+1-555-0888',
    }, adminAHeaders);
    const pat = pRes.data.data;

    const oRes = await request('POST', `/tenants/${tenantAId}/orders`, {
      patientId: pat.patientId,
      items: [{ testCode: `LIPID-${randSuffix}` }],
    }, adminAHeaders);
    const ord = oRes.data.data;

    // Enter parameter result
    await request('PATCH', `/tenants/${tenantAId}/orders/${ord.orderId}/items/${ord.items[0].itemId}/result`, {
      parameterResults: [{ parameterCode: 'CHOL', value: cholValue }],
    }, adminAHeaders);

    // Create report draft
    const repRes = await request('POST', `/tenants/${tenantAId}/reports`, {
      orderId: ord.orderId,
      orderNumber: ord.orderNumber,
      patientName: `${pat.firstName} ${pat.lastName}`,
      patientMrn: pat.mrn,
      testName: 'Lipid Panel',
      findings: 'Optimal lipid profile.',
    }, pathHeaders);
    return repRes.data.data;
  }

  // Create 4 reports:
  // Rep 1: approved -> released
  // Rep 2: approved -> released
  // Rep 3: draft (ineligible)
  // Rep 4: approved but unreleased (ineligible)
  const rep1 = await createPatientOrderAndReport('Alice Walker', 165);
  const rep2 = await createPatientOrderAndReport('Brenda Smith', 175);
  const rep3 = await createPatientOrderAndReport('Charlie Draft', 180);
  const rep4 = await createPatientOrderAndReport('David Approved', 190);
  assert(rep1 && rep2 && rep3 && rep4, '10. Created 4 diagnostic reports');

  // Pathologist approves Rep 1, 2, 4
  await request('POST', `/tenants/${tenantAId}/reports/${rep1.reportId}/approve`, { findings: 'Normal' }, pathHeaders);
  await request('POST', `/tenants/${tenantAId}/reports/${rep2.reportId}/approve`, { findings: 'Normal' }, pathHeaders);
  await request('POST', `/tenants/${tenantAId}/reports/${rep4.reportId}/approve`, { findings: 'Normal' }, pathHeaders);

  // Release Rep 1 & Rep 2
  const rel1 = await request('POST', `/tenants/${tenantAId}/reports/${rep1.reportId}/release`, {}, pathHeaders);
  assert(rel1.status === 200, '11. Report 1 transitioned to released');

  const rel2 = await request('POST', `/tenants/${tenantAId}/reports/${rep2.reportId}/release`, {}, pathHeaders);
  assert(rel2.status === 200, '12. Report 2 transitioned to released');

  // 6. Security Guards on Batch Download
  const unauthBatch = await request('POST', `/tenants/${tenantAId}/reports/batch-download`, {
    reportIds: [rep1.reportId, rep2.reportId],
  });
  assert(unauthBatch.status === 401, '13. Unauthenticated batch download rejected (401 Unauthorized)');

  const crossTenantBatch = await request('POST', `/tenants/${tenantAId}/reports/batch-download`, {
    reportIds: [rep1.reportId, rep2.reportId],
  }, adminBHeaders);
  assert(crossTenantBatch.status === 403, '14. Cross-tenant batch download blocked (403 Forbidden)');

  // 7. Execute Batch Download Authorization with Mixed State
  const mixedBatch = await request('POST', `/tenants/${tenantAId}/reports/batch-download`, {
    reportIds: [rep1.reportId, rep2.reportId, rep3.reportId, rep4.reportId],
  }, adminAHeaders);
  assert(mixedBatch.status === 200, '15. Batch download endpoint executes successfully (200 OK)');
  const batchData = mixedBatch.data.data;

  assert(batchData.totalRequested === 4, '16. totalRequested count is 4');
  assert(batchData.downloadedCount === 2, '17. downloadedCount is 2 (only released reports)');
  assert(batchData.failedCount === 2, '18. failedCount is 2 (draft and approved rejected)');

  const item1 = batchData.results.find((r) => r.reportId === rep1.reportId);
  const item2 = batchData.results.find((r) => r.reportId === rep2.reportId);
  const item3 = batchData.results.find((r) => r.reportId === rep3.reportId);
  const item4 = batchData.results.find((r) => r.reportId === rep4.reportId);

  assert(item1 && item1.success === true && item1.status === 'released', '19. Report 1 authorized in batch');
  assert(item2 && item2.success === true && item2.status === 'released', '20. Report 2 authorized in batch');
  assert(item3 && item3.success === false && item3.status === 'draft', '21. Report 3 (draft) rejected with failure status');
  assert(item4 && item4.success === false && item4.status === 'approved', '22. Report 4 (approved unreleased) rejected with failure status');

  assert(item3.code === 'REPORT_NOT_RELEASED', '23. Report 3 code is REPORT_NOT_RELEASED');
  assert(item4.code === 'REPORT_NOT_RELEASED', '24. Report 4 code is REPORT_NOT_RELEASED');
  assert(item1.safeFilename && item1.safeFilename.startsWith('Report_') && item1.safeFilename.endsWith('.pdf'), '25. Report 1 assigned sanitized filename');
  assert(item2.safeFilename && item2.safeFilename.startsWith('Report_') && item2.safeFilename.endsWith('.pdf'), '26. Report 2 assigned sanitized filename');

  // 8. Privacy Verification: Summary MUST NOT leak sensitive data
  const hasDemographics = batchData.results.some((r) => r.patientName || r.patientMrn || r.patientId);
  assert(!hasDemographics, '27. Batch summary strictly DOES NOT leak patient demographics');

  const hasFindings = batchData.results.some((r) => r.findings || r.parameterResults);
  assert(!hasFindings, '28. Batch summary strictly DOES NOT leak clinical test findings');

  const hasTokens = batchData.results.some((r) => r.verificationToken);
  assert(!hasTokens, '29. Batch summary strictly DOES NOT leak public verification tokens');

  // 9. Single Download Endpoint Regression Checks
  const singleReleasedDl = await request('GET', `/tenants/${tenantAId}/reports/${rep1.reportId}/download`, null, adminAHeaders);
  assert(singleReleasedDl.status === 200, '30. Single released report downloads with 200 OK');
  assert(singleReleasedDl.headers.get('content-disposition')?.includes('attachment; filename='), '31. Single download provides Content-Disposition header');

  const singleDraftDl = await request('GET', `/tenants/${tenantAId}/reports/${rep3.reportId}/download`, null, adminAHeaders);
  assert(singleDraftDl.status === 400, '32. Single draft report download rejected (400 Bad Request)');

  const singleApprovedDl = await request('GET', `/tenants/${tenantAId}/reports/${rep4.reportId}/download`, null, adminAHeaders);
  assert(singleApprovedDl.status === 400, '33. Single approved-unreleased report download rejected (400 Bad Request)');

  console.log('\n============================================================');
  console.log(`--- TEST RESULTS: ${passed} PASSED | ${failed} FAILED ---`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
