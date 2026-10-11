/**
 * Automated Verification Script: LMS Dashboard — Basic Report Turnaround Time (TAT)
 *
 * Tests:
 * 1. Lab configured IANA timezone is prioritized and invalid client timezones are rejected without silent UTC fallback.
 * 2. Accurate TAT calculation for known start (sample collection/receipt) and end (report release) timestamps.
 * 3. Average TAT computation across multiple eligible reports.
 * 4. Reports released outside today's local calendar day are strictly excluded.
 * 5. Reports with missing start timestamps or missing release timestamps are excluded.
 * 6. Reports with invalid chronology (release before collection) are excluded.
 * 7. When no eligible reports exist, display 'N/A' (not 0 minutes / 0m).
 * 8. Tenant isolation: Tenant B sees 'N/A' and cannot access Tenant A's metrics.
 * 9. Security & RBAC: Unauthenticated (401), unauthorized/cross-tenant (403), Super Admin without tenant context (403).
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
  console.log(`--- STARTING LMS REPORT TURNAROUND TIME (TAT) TEST SUITE ---`);
  console.log(`Tenant A Code: tat-a-${randSuffix} | Tenant B Code: tat-b-${randSuffix}`);
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

  // 2. Provision Tenant A & Tenant B Laboratories with explicit Timezones
  const codeA = `tat-a-${randSuffix}`;
  const codeB = `tat-b-${randSuffix}`;
  const adminAEmail = `admin_a_${randSuffix}@tata.local`;
  const adminBEmail = `admin_b_${randSuffix}@tatb.local`;
  const defaultPass = 'StaffSecurePass#2026';

  // Tenant A configured with Asia/Kolkata
  let regA = await request('POST', '/super-admin/laboratories', {
    name: `TAT Lab A ${randSuffix}`,
    code: codeA,
    email: adminAEmail,
    phone: '+1-555-010-0081',
    timezone: 'Asia/Kolkata',
    adminEmail: adminAEmail,
    adminPassword: defaultPass,
    adminFullName: `Admin A ${randSuffix}`,
  }, saHeaders);
  if (regA.status !== 201) {
    await new Promise((r) => setTimeout(r, 2500));
    regA = await request('POST', '/super-admin/laboratories', {
      name: `TAT Lab A ${randSuffix}`,
      code: codeA,
      email: adminAEmail,
      phone: '+1-555-010-0081',
      timezone: 'Asia/Kolkata',
      adminEmail: adminAEmail,
      adminPassword: defaultPass,
      adminFullName: `Admin A ${randSuffix}`,
    }, saHeaders);
  }
  assert(regA.status === 201, '2. Provision Tenant A laboratory with timezone Asia/Kolkata');
  const tenantAId = regA.data.data.tenantId;

  // Tenant B configured with America/New_York
  let regB = await request('POST', '/super-admin/laboratories', {
    name: `TAT Lab B ${randSuffix}`,
    code: codeB,
    email: adminBEmail,
    phone: '+1-555-010-0082',
    timezone: 'America/New_York',
    adminEmail: adminBEmail,
    adminPassword: defaultPass,
    adminFullName: `Admin B ${randSuffix}`,
  }, saHeaders);
  if (regB.status !== 201) {
    await new Promise((r) => setTimeout(r, 2500));
    regB = await request('POST', '/super-admin/laboratories', {
      name: `TAT Lab B ${randSuffix}`,
      code: codeB,
      email: adminBEmail,
      phone: '+1-555-010-0082',
      timezone: 'America/New_York',
      adminEmail: adminBEmail,
      adminPassword: defaultPass,
      adminFullName: `Admin B ${randSuffix}`,
    }, saHeaders);
  }
  assert(regB.status === 201, '3. Provision Tenant B laboratory with timezone America/New_York');
  const tenantBId = regB.data.data.tenantId;

  // Pause for MongoDB Atlas collection provisioning
  await new Promise((r) => setTimeout(r, 3500));

  // 3. Login as Admin A & Admin B
  let loginA = await request('POST', '/auth/laboratory/login', {
    organizationCode: codeA,
    email: adminAEmail,
    password: defaultPass,
  });
  if (loginA.status !== 200) {
    await new Promise((r) => setTimeout(r, 2500));
    loginA = await request('POST', '/auth/laboratory/login', {
      organizationCode: codeA,
      email: adminAEmail,
      password: defaultPass,
    });
  }
  assert(loginA.status === 200, '4. Tenant A Admin login');
  const tokenA = loginA.data?.data?.token;
  const adminAHeaders = { Authorization: `Bearer ${tokenA}` };

  let loginB = await request('POST', '/auth/laboratory/login', {
    organizationCode: codeB,
    email: adminBEmail,
    password: defaultPass,
  });
  if (loginB.status !== 200) {
    await new Promise((r) => setTimeout(r, 2500));
    loginB = await request('POST', '/auth/laboratory/login', {
      organizationCode: codeB,
      email: adminBEmail,
      password: defaultPass,
    });
  }
  assert(loginB.status === 200, '5. Tenant B Admin login');
  const tokenB = loginB.data?.data?.token;
  const adminBHeaders = { Authorization: `Bearer ${tokenB}` };

  // 4. Create Pathologist in Tenant A
  const pathUserRes = await request('POST', `/tenants/${tenantAId}/users`, {
    fullName: `Dr. Pathologist ${randSuffix}`,
    email: `path_${randSuffix}@tata.local`,
    role: 'pathologist',
    password: 'Pathologist@Secure2026!',
  }, adminAHeaders);
  assert(pathUserRes.status === 201, '6. Create Pathologist in Tenant A');

  const pathLogin = await request('POST', '/auth/laboratory/login', {
    organizationCode: codeA,
    email: `path_${randSuffix}@tata.local`,
    password: 'Pathologist@Secure2026!',
  });
  assert(pathLogin.status === 200, '7. Pathologist login successful');
  const pathToken = pathLogin.data.data.token;
  const pathHeaders = { Authorization: `Bearer ${pathToken}` };

  // 5. Test Empty State for TAT (No released reports exist yet)
  const initialTatRes = await request('GET', `/tenants/${tenantAId}/dashboard/today-tat`, null, adminAHeaders);
  assert(initialTatRes.status === 200, '8. Initial TAT query returns 200 OK');
  assert(initialTatRes.data.data.averageTatMinutes === null, '9. Initial averageTatMinutes is null when no released reports exist');
  assert(initialTatRes.data.data.formattedTat === 'N/A', '10. Initial formattedTat is strictly "N/A" (not 0 minutes or 0m)');
  assert(initialTatRes.data.data.eligibleReportsCount === 0, '11. Initial eligibleReportsCount is 0');

  // 6. Test Timezone Handling Requirement 5:
  // "Use the lab's configured IANA timezone where available. Validate client-provided timezone values and avoid silently using UTC when a valid lab timezone is configured."
  assert(initialTatRes.data.data.timeZone === 'Asia/Kolkata', `12. Lab A uses configured timezone Asia/Kolkata by default. Actual: ${initialTatRes.data.data.timeZone}`);

  // Query with invalid client timezone -> must NOT fall back to UTC, must preserve lab's configured timezone
  const invalidTzRes = await request('GET', `/tenants/${tenantAId}/dashboard/today-tat?timezone=INVALID/TIMEZONE`, null, adminAHeaders);
  assert(invalidTzRes.status === 200, '13. Request with invalid timezone query succeeds');
  assert(invalidTzRes.data.data.timeZone === 'Asia/Kolkata', `14. Invalid client timezone rejected; valid lab timezone Asia/Kolkata preserved. Actual: ${invalidTzRes.data.data.timeZone}`);

  // Query Tenant B -> must use Tenant B's configured America/New_York
  const tenantBTatRes = await request('GET', `/tenants/${tenantBId}/dashboard/today-tat`, null, adminBHeaders);
  assert(tenantBTatRes.data.data.timeZone === 'America/New_York', `15. Tenant B uses its configured America/New_York timezone. Actual: ${tenantBTatRes.data.data.timeZone}`);

  // 7. Setup Test Catalog Item
  const testRes = await request('POST', `/tenants/${tenantAId}/tests`, {
    code: `CHEM-${randSuffix}`,
    name: 'Clinical Chemistry Panel',
    price: 45,
    specimenType: 'Serum',
    parameters: [
      {
        parameterCode: 'GLU',
        name: 'Glucose Fasting',
        unit: 'mg/dL',
        resultType: 'NUMERIC',
        referenceRanges: [{ lowNormal: 70, highNormal: 99 }],
      },
    ],
  }, adminAHeaders);
  assert(testRes.status === 201, '16. Create catalog test');

  // Helper to create patient and order
  async function createOrder(patientName) {
    const pRes = await request('POST', `/tenants/${tenantAId}/patients`, {
      firstName: patientName.split(' ')[0],
      lastName: patientName.split(' ')[1] || 'Patient',
      gender: 'male',
      dob: '1988-04-12',
      phone: '+1-555-0188',
    }, adminAHeaders);
    const pat = pRes.data.data;

    const oRes = await request('POST', `/tenants/${tenantAId}/orders`, {
      patientId: pat.patientId,
      items: [{ testCode: `CHEM-${randSuffix}` }],
    }, adminAHeaders);
    return { pat, ord: oRes.data.data };
  }

  // 8. Connect to MongoDB Atlas to insert controlled timestamp records
  const { default: mongoose } = await import('../server/node_modules/mongoose/index.js');
  const conn = await mongoose.createConnection(envVars.MONGODB_URI).asPromise();
  const tenantADb = conn.useDb(`lms_lab_${tenantAId}`);

  const now = new Date();

  // Report 1: Known TAT = 135 minutes (2 hours 15 minutes)
  // Collected at now - 135 mins, Released at now
  const order1 = await createOrder('Patient One');
  const ord1Id = order1.ord.orderId;
  const smp1Res = await request('GET', `/tenants/${tenantAId}/samples?orderId=${ord1Id}`, null, adminAHeaders);
  const smp1Id = smp1Res.data.data[0].sampleId;

  const collectedTime1 = new Date(now.getTime() - 135 * 60 * 1000);
  const releasedTime1 = new Date(now.getTime());

  await tenantADb.collection('samples').updateOne(
    { sampleId: smp1Id },
    { $set: { collectionStatus: 'collected', collectedAt: collectedTime1 } }
  );

  // Enter results for Order 1
  await request('PATCH', `/tenants/${tenantAId}/orders/${ord1Id}/items/${order1.ord.items[0].itemId}/result`, {
    parameterResults: [{ parameterCode: 'GLU', value: 92 }],
  }, adminAHeaders);

  // Create and release Report 1 with known release timestamp
  const rep1Res = await request('POST', `/tenants/${tenantAId}/reports`, {
    orderId: ord1Id,
    orderNumber: order1.ord.orderNumber,
    patientName: 'Patient One',
    patientMrn: order1.pat.mrn,
    testName: 'Clinical Chemistry Panel',
    findings: 'Normal glucose level',
  }, pathHeaders);
  const rep1Id = rep1Res.data.data.reportId;
  await request('POST', `/tenants/${tenantAId}/reports/${rep1Id}/approve`, {}, pathHeaders);
  await request('POST', `/tenants/${tenantAId}/reports/${rep1Id}/release`, {}, pathHeaders);

  await tenantADb.collection('diagnosticreports').updateOne(
    { reportId: rep1Id },
    { $set: { releasedAt: releasedTime1 } }
  );

  // Check TAT with single report: 135 minutes -> 2h 15m
  const tat1Res = await request('GET', `/tenants/${tenantAId}/dashboard/today-tat`, null, adminAHeaders);
  assert(tat1Res.status === 200, '17. TAT query with Report 1 returns 200 OK');
  assert(tat1Res.data.data.eligibleReportsCount === 1, `18. Eligible reports count is 1. Actual: ${tat1Res.data.data.eligibleReportsCount}`);
  assert(tat1Res.data.data.averageTatMinutes === 135, `19. Average TAT minutes is 135. Actual: ${tat1Res.data.data.averageTatMinutes}`);
  assert(tat1Res.data.data.formattedTat === '2h 15m', `20. Formatted TAT displays clearly as "2h 15m". Actual: ${tat1Res.data.data.formattedTat}`);

  // Report 2: Known TAT = 75 minutes (1 hour 15 minutes)
  // Collected at now - 75 mins, Released at now
  const order2 = await createOrder('Patient Two');
  const ord2Id = order2.ord.orderId;
  const smp2Res = await request('GET', `/tenants/${tenantAId}/samples?orderId=${ord2Id}`, null, adminAHeaders);
  const smp2Id = smp2Res.data.data[0].sampleId;

  const collectedTime2 = new Date(now.getTime() - 75 * 60 * 1000);
  const releasedTime2 = new Date(now.getTime());

  await tenantADb.collection('samples').updateOne(
    { sampleId: smp2Id },
    { $set: { collectionStatus: 'collected', collectedAt: collectedTime2 } }
  );

  await request('PATCH', `/tenants/${tenantAId}/orders/${ord2Id}/items/${order2.ord.items[0].itemId}/result`, {
    parameterResults: [{ parameterCode: 'GLU', value: 88 }],
  }, adminAHeaders);

  const rep2Res = await request('POST', `/tenants/${tenantAId}/reports`, {
    orderId: ord2Id,
    orderNumber: order2.ord.orderNumber,
    patientName: 'Patient Two',
    patientMrn: order2.pat.mrn,
    testName: 'Clinical Chemistry Panel',
    findings: 'Normal glucose',
  }, pathHeaders);
  const rep2Id = rep2Res.data.data.reportId;
  await request('POST', `/tenants/${tenantAId}/reports/${rep2Id}/approve`, {}, pathHeaders);
  await request('POST', `/tenants/${tenantAId}/reports/${rep2Id}/release`, {}, pathHeaders);

  await tenantADb.collection('diagnosticreports').updateOne(
    { reportId: rep2Id },
    { $set: { releasedAt: releasedTime2 } }
  );

  // Check Average TAT across Report 1 (135m) and Report 2 (75m):
  // Average = (135 + 75) / 2 = 105 minutes = 1h 45m
  const tat2Res = await request('GET', `/tenants/${tenantAId}/dashboard/today-tat`, null, adminAHeaders);
  assert(tat2Res.data.data.eligibleReportsCount === 2, `21. Eligible reports count across both reports is 2. Actual: ${tat2Res.data.data.eligibleReportsCount}`);
  assert(tat2Res.data.data.averageTatMinutes === 105, `22. Average TAT is exactly 105 minutes. Actual: ${tat2Res.data.data.averageTatMinutes}`);
  assert(tat2Res.data.data.formattedTat === '1h 45m', `23. Formatted average TAT is "1h 45m". Actual: ${tat2Res.data.data.formattedTat}`);

  // 9. Negative Test Cases: Invalid or Excluded Records
  // Case A: Report released 3 days ago (MUST be excluded)
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 3600 * 1000);
  await tenantADb.collection('diagnosticreports').insertOne({
    reportId: `rep_past_${randSuffix}`,
    tenantId: tenantAId,
    reportNumber: `RPT-PAST-${randSuffix}`,
    orderId: `ord_past_${randSuffix}`,
    orderNumber: `ORD-PAST-${randSuffix}`,
    patientName: 'Past Date Patient',
    patientMrn: 'MRN-PAST',
    testName: 'Clinical Chemistry Panel',
    status: 'released',
    releasedAt: threeDaysAgo,
    createdAt: threeDaysAgo,
  });

  // Case B: Report released today but sample has NO collectedAt and NO receivedAt (MUST be excluded)
  await tenantADb.collection('samples').insertOne({
    sampleId: `smp_nostart_${randSuffix}`,
    tenantId: tenantAId,
    barcode: `BAR-NOSTART-${randSuffix}`,
    orderId: `ord_nostart_${randSuffix}`,
    orderNumber: `ORD-NOSTART-${randSuffix}`,
    patientName: 'No Start Patient',
    sampleType: 'Serum',
    collectionStatus: 'pending',
    collectedAt: null,
    receivedAt: null,
    createdAt: now,
  });
  await tenantADb.collection('diagnosticreports').insertOne({
    reportId: `rep_nostart_${randSuffix}`,
    tenantId: tenantAId,
    reportNumber: `RPT-NOSTART-${randSuffix}`,
    orderId: `ord_nostart_${randSuffix}`,
    orderNumber: `ORD-NOSTART-${randSuffix}`,
    patientName: 'No Start Patient',
    patientMrn: 'MRN-NOSTART',
    testName: 'Clinical Chemistry Panel',
    status: 'released',
    releasedAt: now,
    createdAt: now,
  });

  // Case C: Report with invalid inverted chronology (releasedAt earlier than collectedAt)
  await tenantADb.collection('samples').insertOne({
    sampleId: `smp_inverted_${randSuffix}`,
    tenantId: tenantAId,
    barcode: `BAR-INVERTED-${randSuffix}`,
    orderId: `ord_inverted_${randSuffix}`,
    orderNumber: `ORD-INVERTED-${randSuffix}`,
    patientName: 'Inverted Patient',
    sampleType: 'Serum',
    collectionStatus: 'collected',
    collectedAt: new Date(now.getTime() + 60 * 60 * 1000), // collected in future
    createdAt: now,
  });
  await tenantADb.collection('diagnosticreports').insertOne({
    reportId: `rep_inverted_${randSuffix}`,
    tenantId: tenantAId,
    reportNumber: `RPT-INVERTED-${randSuffix}`,
    orderId: `ord_inverted_${randSuffix}`,
    orderNumber: `ORD-INVERTED-${randSuffix}`,
    patientName: 'Inverted Patient',
    patientMrn: 'MRN-INVERTED',
    testName: 'Clinical Chemistry Panel',
    status: 'released',
    releasedAt: now,
    createdAt: now,
  });

  await conn.close();

  // Verify TAT remains 105 minutes across the 2 valid reports (the 3 invalid/out-of-range ones excluded)
  const tatFilteredRes = await request('GET', `/tenants/${tenantAId}/dashboard/today-tat`, null, adminAHeaders);
  assert(tatFilteredRes.data.data.eligibleReportsCount === 2, `24. Ineligible/invalid records strictly excluded (count stays 2). Actual: ${tatFilteredRes.data.data.eligibleReportsCount}`);
  assert(tatFilteredRes.data.data.averageTatMinutes === 105, `25. Average TAT remains 105 minutes. Actual: ${tatFilteredRes.data.data.averageTatMinutes}`);
  assert(tatFilteredRes.data.data.formattedTat === '1h 45m', `26. Formatted TAT remains "1h 45m". Actual: ${tatFilteredRes.data.data.formattedTat}`);

  // 10. Verify Main Dashboard & Today Summary endpoints include TAT
  const mainDashRes = await request('GET', `/tenants/${tenantAId}/dashboard-summary`, null, adminAHeaders);
  assert(mainDashRes.status === 200, '27. Main dashboard summary returns 200 OK');
  assert(mainDashRes.data.data.todaySummary.formattedTat === '1h 45m', '28. todaySummary in main dashboard includes formattedTat');
  assert(mainDashRes.data.data.todaySummary.averageTatMinutes === 105, '29. todaySummary in main dashboard includes averageTatMinutes');
  assert(mainDashRes.data.data.metrics.formattedTat === '1h 45m', '30. metrics in main dashboard includes formattedTat');

  const todaySumRes = await request('GET', `/tenants/${tenantAId}/dashboard/today-summary`, null, adminAHeaders);
  assert(todaySumRes.status === 200, '31. GET /dashboard/today-summary returns 200 OK');
  assert(todaySumRes.data.data.formattedTat === '1h 45m', '32. /dashboard/today-summary includes formattedTat');
  assert(todaySumRes.data.data.averageTatMinutes === 105, '33. /dashboard/today-summary includes averageTatMinutes');

  // 11. Security & Tenant Isolation
  // Tenant B has no released reports -> formattedTat is 'N/A', averageTatMinutes is null
  const bSummary = await request('GET', `/tenants/${tenantBId}/dashboard/today-tat`, null, adminBHeaders);
  assert(bSummary.status === 200, '34. Tenant B today-tat returns 200 OK');
  assert(bSummary.data.data.averageTatMinutes === null, '35. Tenant B sees null averageTatMinutes (Tenant A isolated)');
  assert(bSummary.data.data.formattedTat === 'N/A', '36. Tenant B sees "N/A" (Tenant A isolated)');
  assert(bSummary.data.data.eligibleReportsCount === 0, '37. Tenant B sees 0 eligible reports');

  // Cross-tenant access blocked (Tenant B cannot read Tenant A's TAT)
  const crossTenant = await request('GET', `/tenants/${tenantAId}/dashboard/today-tat`, null, adminBHeaders);
  assert(crossTenant.status === 403, '38. Cross-tenant access blocked (403 Forbidden)');

  // Unauthenticated request rejected
  const unauth = await request('GET', `/tenants/${tenantAId}/dashboard/today-tat`);
  assert(unauth.status === 401, '39. Unauthenticated request rejected (401 Unauthorized)');

  // Super Admin direct access without tenant context rejected
  const saDirect = await request('GET', `/tenants/${tenantAId}/dashboard/today-tat`, null, saHeaders);
  assert(saDirect.status === 403, '40. Super Admin without tenant context rejected (403 Forbidden)');

  console.log('\n============================================================');
  console.log(`--- TEST RESULTS: ${passed} PASSED | ${failed} FAILED ---`);
  console.log('============================================================\n');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Unhandled test failure:', err);
  process.exit(1);
});
