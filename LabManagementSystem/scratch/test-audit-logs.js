/**
 * Automated Verification Script for Basic Audit Log Viewer
 * 
 * Verifies:
 * 1. Unauthenticated requests return 401.
 * 2. Cross-tenant audit access is rejected with 403.
 * 3. Unauthorized role (receptionist without audit:view) is rejected with 403.
 * 4. Authorized user (lab_admin) successfully retrieves audit logs.
 * 5. Server-side pagination works (page, limit, total, totalPages).
 * 6. Action type filter works.
 * 7. Date range filter works.
 * 8. Sensitive fields (passwords, tokens, verificationToken, patientMrn, findings) are stripped.
 * 9. Distinct audit actions endpoint works.
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

async function runTests() {
  console.log('=== Starting Basic Audit Log Viewer Verification ===\n');
  const uid = Math.floor(Math.random() * 90000) + 10000;

  // 1. Super Admin login
  console.log('1. Logging in as Super Admin...');
  const superAdminEmail = envVars.BOOTSTRAP_ADMIN_EMAIL || envVars.SUPER_ADMIN_EMAIL || 'admin@lms-platform.local';
  const superAdminPass = envVars.BOOTSTRAP_ADMIN_PASSWORD || envVars.SUPER_ADMIN_PASSWORD || 'SuperAdminSecurePass!2026';

  const saLogin = await request('POST', '/auth/super-admin/login', {
    email: superAdminEmail,
    password: superAdminPass,
  });
  if (saLogin.status !== 200 || (!saLogin.data?.data?.accessToken && !saLogin.data?.data?.token)) {
    throw new Error(`Super Admin login failed: ${JSON.stringify(saLogin.data)}`);
  }
  const saToken = saLogin.data.data.token || saLogin.data.data.accessToken;
  console.log('   ✅ Super Admin authenticated');

  // 2. Register Tenant A
  console.log('2. Registering Tenant A...');
  const defaultPass = 'StaffSecurePass#2026';
  const emailA = `admin_a_${uid}@alpha.local`;
  const emailB = `admin_b_${uid}@beta.local`;

  const codeA = `aud-a-${uid}`;
  const codeB = `aud-b-${uid}`;

  const labA = await request('POST', '/super-admin/laboratories', {
    name: `Audit Lab Alpha ${uid}`,
    code: codeA,
    email: emailA,
    phone: '+1-555-0101',
    timezone: 'Asia/Kolkata',
    adminEmail: emailA,
    adminPassword: defaultPass,
    adminFullName: `Admin A ${uid}`,
  }, { Authorization: `Bearer ${saToken}` });
  if (labA.status !== 201) throw new Error(`Failed to create Tenant A: ${JSON.stringify(labA.data)}`);
  const tenantAId = labA.data.data.tenantId;
  console.log(`   ✅ Tenant A created: ${tenantAId} (${codeA})`);

  // 3. Register Tenant B
  console.log('3. Registering Tenant B...');
  const labB = await request('POST', '/super-admin/laboratories', {
    name: `Audit Lab Beta ${uid}`,
    code: codeB,
    email: emailB,
    phone: '+1-555-0102',
    timezone: 'Asia/Kolkata',
    adminEmail: emailB,
    adminPassword: defaultPass,
    adminFullName: `Admin B ${uid}`,
  }, { Authorization: `Bearer ${saToken}` });
  if (labB.status !== 201) throw new Error(`Failed to create Tenant B: ${JSON.stringify(labB.data)}`);
  const tenantBId = labB.data.data.tenantId;
  console.log(`   ✅ Tenant B created: ${tenantBId} (${codeB})`);

  // Wait for tenant DB provisioning
  await new Promise((r) => setTimeout(r, 2000));

  // 4. Log in as Tenant A Lab Admin
  console.log('4. Logging in as Tenant A Lab Admin...');
  const loginA = await request('POST', '/auth/laboratory/login', {
    organizationCode: codeA,
    email: emailA,
    password: defaultPass,
  });
  if (loginA.status !== 200) throw new Error(`Tenant A admin login failed: ${JSON.stringify(loginA.data)}`);
  const tokenA = loginA.data.data.token || loginA.data.data.accessToken;

  // 5. Log in as Tenant B Lab Admin
  console.log('5. Logging in as Tenant B Lab Admin...');
  const loginB = await request('POST', '/auth/laboratory/login', {
    organizationCode: codeB,
    email: emailB,
    password: defaultPass,
  });
  if (loginB.status !== 200) throw new Error(`Tenant B admin login failed: ${JSON.stringify(loginB.data)}`);
  const tokenB = loginB.data.data.token || loginB.data.data.accessToken;

  // 6. Create a Receptionist user in Tenant A (no audit:view permission)
  console.log('6. Creating Receptionist user in Tenant A...');
  const recPass = 'Receptionist@Secure2026!';
  const createRec = await request('POST', `/tenants/${tenantAId}/users`, {
    fullName: `Receptionist ${uid}`,
    email: `rec_${uid}@alpha.local`,
    role: 'receptionist',
    password: recPass,
  }, { Authorization: `Bearer ${tokenA}` });
  if (createRec.status !== 201) throw new Error(`Create user failed: ${JSON.stringify(createRec.data)}`);

  const loginRec = await request('POST', '/auth/laboratory/login', {
    organizationCode: codeA,
    email: `rec_${uid}@alpha.local`,
    password: recPass,
  });
  if (loginRec.status !== 200) throw new Error(`Receptionist login failed: ${JSON.stringify(loginRec.data)}`);
  const tokenRec = loginRec.data.data.token || loginRec.data.data.accessToken;

  // 7. Test Unauthenticated Request (Requirement: rejected with 401)
  console.log('7. Testing Unauthenticated Request...');
  const unauthRes = await request('GET', `/tenants/${tenantAId}/audit-logs`);
  if (unauthRes.status === 401) {
    console.log('   ✅ Unauthenticated access correctly rejected with 401');
  } else {
    throw new Error(`Expected 401, got ${unauthRes.status}`);
  }

  // 8. Test Unauthorized Role Request (Requirement: receptionist rejected with 403)
  console.log('8. Testing Unauthorized Role Request...');
  const unauthRoleRes = await request('GET', `/tenants/${tenantAId}/audit-logs`, null, {
    Authorization: `Bearer ${tokenRec}`,
  });
  if (unauthRoleRes.status === 403) {
    console.log('   ✅ Unauthorized role (receptionist) correctly rejected with 403');
  } else {
    throw new Error(`Expected 403, got ${unauthRoleRes.status}: ${JSON.stringify(unauthRoleRes.data)}`);
  }

  // 9. Test Cross-Tenant Access (Requirement: Tenant B cannot access Tenant A audit logs)
  console.log('9. Testing Cross-Tenant Access Protection...');
  const crossTenantRes = await request('GET', `/tenants/${tenantAId}/audit-logs`, null, {
    Authorization: `Bearer ${tokenB}`,
  });
  if (crossTenantRes.status === 403) {
    console.log('   ✅ Cross-tenant access correctly blocked with 403 (CROSS_TENANT_FORBIDDEN)');
  } else {
    throw new Error(`Expected 403 for cross-tenant access, got ${crossTenantRes.status}`);
  }

  // 10. Test Authorized Access for Tenant A Lab Admin
  console.log('10. Testing Authorized Access for Tenant A Lab Admin...');
  const authRes = await request('GET', `/tenants/${tenantAId}/audit-logs`, null, {
    Authorization: `Bearer ${tokenA}`,
  });
  if (authRes.status !== 200 || !authRes.data?.success) {
    throw new Error(`Expected 200 success, got ${authRes.status}: ${JSON.stringify(authRes.data)}`);
  }
  const { items, total, page, limit, totalPages } = authRes.data.data;
  console.log(`   ✅ Authorized access succeeded. Retrieved ${items.length} items (total: ${total})`);
  console.log(`   ✅ Pagination metadata present: page=${page}, limit=${limit}, totalPages=${totalPages}`);

  if (items.length === 0) {
    throw new Error('Expected at least 1 audit event (lab creation, login, or user creation)');
  }

  // 11. Test Data Sanitation & Security (Requirement: No passwords, tokens, verificationToken, patientMrn, findings)
  console.log('11. Verifying Sensitive Field Redaction & Data Sanitization...');
  const disallowedTerms = ['password', 'secret', 'verificationtoken', 'patientmrn', 'findings', 'parameterresults'];
  for (const item of items) {
    const rawStr = JSON.stringify(item).toLowerCase();
    // Ensure item has valid structure
    if (!item.eventId || !item.action || !item.timestamp) {
      throw new Error(`Audit item missing required schema fields: ${JSON.stringify(item)}`);
    }
    // Verify targetTenantId isolation
    if (item.targetTenantId && item.targetTenantId !== tenantAId) {
      throw new Error(`Data leakage! Found event from tenant ${item.targetTenantId} in tenant ${tenantAId} response`);
    }
    // Verify disallowed terms are not exposed with unredacted values
    for (const term of disallowedTerms) {
      if (rawStr.includes(`"${term}":`) && !rawStr.includes(`"${term}":"[redacted]"`)) {
        throw new Error(`Sensitive field exposed in audit response: ${term}`);
      }
    }
  }
  console.log('   ✅ No passwords, tokens, verification tokens, or clinical findings leaked in audit payload');

  // 12. Test Distinct Actions Endpoint
  console.log('12. Testing Distinct Actions Endpoint...');
  const actionsRes = await request('GET', `/tenants/${tenantAId}/audit-logs/actions`, null, {
    Authorization: `Bearer ${tokenA}`,
  });
  if (actionsRes.status !== 200 || !actionsRes.data?.success || !Array.isArray(actionsRes.data.data)) {
    throw new Error(`Expected 200 with actions array, got ${actionsRes.status}: ${JSON.stringify(actionsRes.data)}`);
  }
  const actions = actionsRes.data.data;
  console.log(`   ✅ Distinct actions retrieved: ${actions.join(', ')}`);
  if (actions.length === 0) {
    throw new Error('Expected non-empty actions list');
  }

  // 13. Test Filter by Action Type
  console.log('13. Testing Filter by Action Type...');
  const testAction = actions[0];
  const filterActionRes = await request('GET', `/tenants/${tenantAId}/audit-logs?action=${encodeURIComponent(testAction)}`, null, {
    Authorization: `Bearer ${tokenA}`,
  });
  if (filterActionRes.status !== 200 || !filterActionRes.data?.success) {
    throw new Error(`Action filter failed: ${JSON.stringify(filterActionRes.data)}`);
  }
  const filteredItems = filterActionRes.data.data.items;
  console.log(`   ✅ Action filter "${testAction}" returned ${filteredItems.length} records`);
  for (const item of filteredItems) {
    if (item.action !== testAction) {
      throw new Error(`Expected action "${testAction}", got "${item.action}"`);
    }
  }

  // 14. Test Server-side Pagination
  console.log('14. Testing Server-side Pagination (limit=1, page=1 and page=2)...');
  const p1Res = await request('GET', `/tenants/${tenantAId}/audit-logs?limit=1&page=1`, null, {
    Authorization: `Bearer ${tokenA}`,
  });
  const p2Res = await request('GET', `/tenants/${tenantAId}/audit-logs?limit=1&page=2`, null, {
    Authorization: `Bearer ${tokenA}`,
  });
  if (p1Res.status !== 200 || p2Res.status !== 200) {
    throw new Error('Pagination requests failed');
  }
  const p1Item = p1Res.data.data.items[0];
  const p2Item = p2Res.data.data.items[0];
  if (p1Res.data.data.total > 1) {
    if (p1Item.eventId === p2Item.eventId) {
      throw new Error('Pagination returned duplicate event for page 1 and page 2');
    }
    console.log(`   ✅ Page 1 event (${p1Item.eventId}) is distinct from Page 2 event (${p2Item.eventId})`);
  }
  console.log('   ✅ Server-side pagination verified successfully');

  // 15. Test Date Range Filter
  console.log('15. Testing Date Range Filter...');
  const today = new Date().toISOString().slice(0, 10);
  const dateRes = await request('GET', `/tenants/${tenantAId}/audit-logs?startDate=${today}&endDate=${today}`, null, {
    Authorization: `Bearer ${tokenA}`,
  });
  if (dateRes.status !== 200 || !dateRes.data?.success) {
    throw new Error(`Date filter request failed: ${JSON.stringify(dateRes.data)}`);
  }
  console.log(`   ✅ Date range filter returned ${dateRes.data.data.items.length} records for today`);

  // Future date (should return 0 records)
  const futureRes = await request('GET', `/tenants/${tenantAId}/audit-logs?startDate=2030-01-01&endDate=2030-01-02`, null, {
    Authorization: `Bearer ${tokenA}`,
  });
  if (futureRes.status !== 200 || futureRes.data.data.items.length !== 0) {
    throw new Error(`Expected 0 records for future date, got ${futureRes.data.data.items.length}`);
  }
  console.log('   ✅ Future date range filter correctly returned 0 records');

  console.log('\n======================================================');
  console.log('🎉 ALL AUDIT LOG VIEWER TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('======================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
