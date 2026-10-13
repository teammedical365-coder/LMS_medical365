import mongoose from 'mongoose';
import config from '../src/config/env.js';
import dbConnection from '../src/config/db.js';

async function updateLabAdminPermissions() {
  console.log('🔄 Connecting to MongoDB...');
  await dbConnection.connect(config.database.uri);
  console.log('✅ Connected to Master DB');

  const adminDb = mongoose.connection.db.admin();
  const dbs = await adminDb.listDatabases();
  const tenantDbs = dbs.databases.filter(d => d.name.startsWith('lms_lab_'));

  console.log(`Found ${tenantDbs.length} tenant databases to inspect:`, tenantDbs.map(d => d.name));

  const allowedNav = ['dashboard', 'tests', 'reports', 'billing', 'users'];
  const disallowedPrefixes = ['patients:', 'orders:', 'samples:', 'audit:', 'settings:'];

  for (const dbInfo of tenantDbs) {
    const dbName = dbInfo.name;
    const client = mongoose.connection.getClient();
    const tenantDb = client.db(dbName);
    const rolesCol = tenantDb.collection('roles');

    const adminRoles = await rolesCol.find({ code: { $in: ['lab_admin', 'lab_director'] } }).toArray();

    for (const roleDoc of adminRoles) {
      const filteredPerms = (roleDoc.permissions || []).filter(
        p => !disallowedPrefixes.some(prefix => p.startsWith(prefix))
      );

      console.log(`[${dbName}] Updating role ${roleDoc.code}:`);
      console.log(`  Previous navigationItems:`, roleDoc.navigationItems);
      console.log(`  New navigationItems:`, allowedNav);
      console.log(`  Previous perm count: ${roleDoc.permissions?.length}, New perm count: ${filteredPerms.length}`);

      await rolesCol.updateOne(
        { _id: roleDoc._id },
        {
          $set: {
            navigationItems: allowedNav,
            permissions: filteredPerms,
            updatedAt: new Date()
          }
        }
      );
    }
  }

  console.log('🎉 Successfully updated all lab_admin roles across all tenant databases!');
  process.exit(0);
}

updateLabAdminPermissions().catch(err => {
  console.error('❌ Error during update:', err);
  process.exit(1);
});
