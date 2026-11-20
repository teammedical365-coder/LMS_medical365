/**
 * Lab Management System (LMS) - Local MongoDB Dedicated User Initialization
 * 
 * Executed once during first-boot of the MongoDB container.
 * Creates the dedicated application user on admin with readWriteAnyDatabase and dbAdminAnyDatabase
 * to allow dynamic provisioning of tenant databases (lms_lab_<tenantId>) and master database (lms_master).
 */

const appUser = process.env.MONGO_APP_USER || 'lms_app_user';
const appPassword = process.env.MONGO_APP_PASSWORD || 'lms_local_secure_pass';

const adminDb = db.getSiblingDB('admin');

// Check if user already exists
const existingUser = adminDb.getUser(appUser);
if (!existingUser) {
  adminDb.createUser({
    user: appUser,
    pwd: appPassword,
    roles: [
      { role: 'readWriteAnyDatabase', db: 'admin' },
      { role: 'dbAdminAnyDatabase', db: 'admin' },
      { role: 'clusterMonitor', db: 'admin' }
    ]
  });
  print(`[INIT-MONGO] Dedicated application user '${appUser}' successfully created with multi-tenant permissions.`);
} else {
  print(`[INIT-MONGO] User '${appUser}' already exists. Skipping creation.`);
}

// Ensure lms_master database exists and is initialized with master marker
const masterDb = db.getSiblingDB('lms_master');
masterDb.createCollection('_initialization_marker');
print('[INIT-MONGO] Master database (lms_master) ready.');
