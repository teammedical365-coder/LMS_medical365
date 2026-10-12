import mongoose from 'file:///d:/Laboratry_medical365/LabManagementSystem/server/node_modules/mongoose/index.js';
import config from 'file:///d:/Laboratry_medical365/LabManagementSystem/server/src/config/env.js';
import dbConnection from 'file:///d:/Laboratry_medical365/LabManagementSystem/server/src/config/db.js';
import { tenantProvisioningService } from 'file:///d:/Laboratry_medical365/LabManagementSystem/server/src/services/tenantProvisioning.service.js';
import laboratoryManagementService from 'file:///d:/Laboratry_medical365/LabManagementSystem/server/src/services/laboratoryManagement.service.js';
import tenantUserService from 'file:///d:/Laboratry_medical365/LabManagementSystem/server/src/services/tenantUser.service.js';
import roleService from 'file:///d:/Laboratry_medical365/LabManagementSystem/server/src/services/role.service.js';
import passwordService from 'file:///d:/Laboratry_medical365/LabManagementSystem/server/src/services/password.service.js';
import { LAB_STATUS, PROVISIONING_STATUS, USER_ROLES } from 'file:///d:/Laboratry_medical365/LabManagementSystem/server/src/config/constants.js';

async function main() {
  console.log('🔄 Connecting to MongoDB...');
  await dbConnection.connect(config.database.uri);
  console.log('✅ Connected to MongoDB Master');

  const lab = await laboratoryManagementService.getLaboratoryById('sms-01');
  console.log('Found lab:', lab.name, 'tenantId:', lab.tenantId, 'status:', lab.status, 'dbStatus:', lab.database?.provisioningStatus);

  // 1. Ensure provisioning is marked READY
  if (lab.database?.provisioningStatus !== PROVISIONING_STATUS.READY) {
    console.log('Provisioning database...');
    await tenantProvisioningService.provisionLaboratory(lab);
  }

  // 2. Transition status to ACTIVE
  if (lab.status !== LAB_STATUS.ACTIVE) {
    console.log('Transitioning status to ACTIVE...');
    await laboratoryManagementService.transitionStatus(
      lab.tenantId,
      LAB_STATUS.ACTIVE,
      'Activating laboratory after database provisioning completed',
      { type: 'PLATFORM_SUPER_ADMIN', id: 'super_admin' }
    );
    console.log('✅ Laboratory status transitioned to ACTIVE');
  }

  // 3. Check / Create lab_admin role if not present
  try {
    const roles = await roleService.listRoles(lab.tenantId);
    console.log('Existing roles in lab:', roles.map(r => r.code));
    const hasAdminRole = roles.some(r => r.code === 'lab_admin');
    if (!hasAdminRole) {
      console.log('Creating lab_admin role in tenant DB...');
      await roleService.createRole(lab.tenantId, {
        code: 'lab_admin',
        name: 'Laboratory Administrator',
        description: 'Full administrative access to laboratory operations',
        permissions: ['*'],
      }, { type: 'PLATFORM_SUPER_ADMIN', id: 'super_admin' });
      console.log('✅ lab_admin role created');
    }
  } catch (err) {
    console.log('Role check notice:', err.message);
  }

  // 4. Create or update user manish@testlab.com
  const existingUsers = await tenantUserService.listUsers(lab.tenantId);
  console.log('Current users count:', existingUsers.length);
  let adminUser = existingUsers.find(u => u.email === 'manish@testlab.com');

  if (!adminUser) {
    console.log('Creating initial admin user manish@testlab.com...');
    adminUser = await tenantUserService.createUser(
      lab.tenantId,
      {
        email: 'manish@testlab.com',
        fullName: 'Manish Administrator',
        password: 'Admin@123456',
        role: USER_ROLES.LAB_ADMIN,
        phone: '34234333333',
      },
      { type: 'PLATFORM_SUPER_ADMIN', id: 'super_admin' }
    );
    console.log('✅ Admin user created successfully:', adminUser.email, 'role:', adminUser.role);
  } else {
    console.log('Admin user already exists:', adminUser.email);
  }

  // Verify full lab profile
  const updatedLab = await laboratoryManagementService.getLaboratoryById(lab.tenantId);
  console.log('Updated Lab Status:', updatedLab.status);
  console.log('Updated Lab Admin:', updatedLab.adminUser?.email);
  console.log('Updated Lab Staff Count:', updatedLab.staffCount);

  process.exit(0);
}

main().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
