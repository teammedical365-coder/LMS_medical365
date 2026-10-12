import mongoose from '../server/node_modules/mongoose/index.js';
import config from '../server/src/config/env.js';

async function inspect() {
  await mongoose.connect(config.database.uri, { dbName: config.database.masterDbName });
  const db = mongoose.connection.db;
  const tenantsCollection = db.collection('tenants');

  const lab = await tenantsCollection.findOne({ code: 'sms-01' });
  console.log('=== SMS LAB FROM MASTER DB ===');
  console.log(JSON.stringify(lab, null, 2));

  if (lab) {
    const tenantDbName = lab.database?.name || `lms_lab_${lab.tenantId}`;
    const tenantConn = await mongoose.createConnection(config.database.uri, {
      dbName: tenantDbName,
      serverSelectionTimeoutMS: 10000,
    }).asPromise();

    const tdb = tenantConn.db;
    const collections = await tdb.listCollections().toArray();
    console.log('=== COLLECTIONS IN TENANT DB ===', collections.map(c => c.name));

    const users = await tdb.collection('users').find({}).toArray();
    console.log('=== USERS IN TENANT DB ===', users);

    const roles = await tdb.collection('roles').find({}).toArray();
    console.log('=== ROLES IN TENANT DB ===', roles);
    
    await tenantConn.close();
  }

  await mongoose.disconnect();
}

inspect().catch(console.error);
