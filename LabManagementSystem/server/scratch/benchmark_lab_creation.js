import mongoose from 'mongoose';
import config from '../src/config/env.js';
import dbConnection from '../src/config/db.js';
import { tenantProvisioningService } from '../src/services/tenantProvisioning.service.js';
import laboratoryManagementService from '../src/services/laboratoryManagement.service.js';
import tenantUserService from '../src/services/tenantUser.service.js';
import roleService from '../src/services/role.service.js';
import { LAB_STATUS, PROVISIONING_STATUS, USER_ROLES } from '../src/config/constants.js';

async function benchmark() {
  console.log('🔄 Connecting to MongoDB...');
  await dbConnection.connect(config.database.uri);
  console.log('✅ Connected to MongoDB Master');

  const testCode = `bm${Date.now().toString().slice(-6)}`;
  const labData = {
    code: testCode,
    name: `Benchmark Lab ${testCode}`,
    email: `bm_${testCode}@test.com`,
    plan: 'starter',
    initialAdmin: {
      fullName: 'Benchmark Admin',
      email: `admin_${testCode}@test.com`,
      password: 'AdminPassword123!',
    },
  };

  const actor = { type: 'PLATFORM_SUPER_ADMIN', id: 'benchmarker' };

  console.log(`\n--- BENCHMARKING LAB CREATION (${testCode}) ---`);
  const tStart = performance.now();

  try {
    const result = await laboratoryManagementService.registerLaboratory(labData, actor);
    const totalTime = performance.now() - tStart;
    console.log(`\n🎉 Registration Complete!`);
    console.log(`Total Time: ${totalTime.toFixed(2)} ms (${(totalTime / 1000).toFixed(2)} s)`);
    console.log(`Tenant ID: ${result.tenantId}`);
    console.log(`Provisioning Status: ${result.database?.provisioningStatus}`);
    console.log(`Lab Status: ${result.status}`);

    // Cleanup benchmark tenant
    console.log('\n🧹 Cleaning up benchmark tenant...');
    await laboratoryManagementService.deleteLaboratory(result.tenantId, actor);
    // Drop the test database
    const dbName = `lms_lab_${result.tenantId}`;
    const testDb = mongoose.connection.useDb(dbName, { useCache: true });
    await testDb.dropDatabase().catch(() => {});
    console.log(`✅ Cleaned up ${result.tenantId} and dropped ${dbName}`);
  } catch (err) {
    console.error('❌ Benchmark error:', err);
  } finally {
    await dbConnection.disconnect();
    process.exit(0);
  }
}

benchmark();
