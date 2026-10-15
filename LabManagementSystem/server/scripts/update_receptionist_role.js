import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');
  
  const client = mongoose.connection.getClient();
  const dbs = await client.db().admin().listDatabases();
  const labDbs = dbs.databases.filter(d => d.name.startsWith('lms_lab_'));
  
  for (const dbInfo of labDbs) {
    const db = client.db(dbInfo.name);
    const res = await db.collection('roles').updateOne(
      { code: 'receptionist' },
      { $addToSet: { permissions: { $each: ['samples:view', 'reports:view', 'billing:view', 'tests:view'] } } }
    );
    if (res.matchedCount > 0) {
      const updated = await db.collection('roles').findOne({ code: 'receptionist' });
      console.log(`Updated ${dbInfo.name} receptionist permissions:`, updated.permissions);
    }
  }
  
  await mongoose.disconnect();
  console.log('Done');
}

run().catch(console.error);
