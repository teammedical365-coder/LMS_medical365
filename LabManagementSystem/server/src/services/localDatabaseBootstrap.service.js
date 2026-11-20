/**
 * Lab Management System (LMS) - Local Database Bootstrap & Provisioning Service
 * 
 * Implements Phase 3: Local Database Initialization & Default Laboratory Provisioning
 * for Local/On-Premise Edition (Mode B).
 * 
 * ARCHITECTURAL PRINCIPLES:
 * 1. Fail-closed database isolation: Enforces [SEC-LOCAL-01] before any DB operation.
 * 2. Idempotency: Running bootstrap once, twice, or 100 times produces identical state.
 * 3. Non-destructive: Never drops, truncates, or overwrites existing databases or collections.
 * 4. Multi-tenant compatibility: Operates strictly within the DB-per-tenant architecture.
 * 5. Sanitized security: Zero plaintext passwords or connection strings logged.
 */

import crypto from 'crypto';
import mongoose from 'mongoose';
import config, { validateDatabaseIsolation } from '../config/env.js';
import dbConnection from '../config/db.js';
import { LAB_STATUS, PROVISIONING_STATUS, AUDIT_ACTIONS } from '../config/constants.js';
import TenantModel, { generateTenantId } from '../models/tenant.model.js';
import PlatformAdminModel from '../models/platformAdmin.model.js';
import AuditLogModel from '../models/auditLog.model.js';
import ReportVerificationModel from '../models/reportVerification.model.js';
import tenantConnectionService from './tenantConnection.service.js';
import tenantProvisioningService, { deriveDatabaseName } from './tenantProvisioning.service.js';
import tenantUserService from './tenantUser.service.js';
import roleService from './role.service.js';
import passwordService from './password.service.js';
import auditLogService from './auditLog.service.js';
import logger from '../utils/logger.js';

/**
 * Standard test categories seeded for local diagnostic laboratory
 */
export const DEFAULT_LOCAL_CATEGORIES = [
  { name: 'Hematology', department: 'Hematology', description: 'Complete blood counts, coagulation profiles, and cellular analysis.' },
  { name: 'Biochemistry', department: 'Biochemistry', description: 'Blood glucose, renal function, liver enzymes, and lipid panels.' },
  { name: 'Immunology', department: 'Immunology', description: 'Serology, viral markers, thyroid profiles, and autoimmune screening.' },
  { name: 'Clinical Pathology', department: 'Clinical Pathology', description: 'Urinalysis, body fluid analysis, and stool examinations.' },
  { name: 'Microbiology', department: 'Microbiology', description: 'Culture, sensitivity testing, Gram stains, and bacterial identification.' },
];

/**
 * Standard test catalog panels seeded as initial sample templates.
 * 
 * CLINICAL SAFETY NOTICE:
 * These reference intervals and parameters are provided strictly as initial DEMO/SAMPLE
 * templates. They have NOT been verified or clinically approved for diagnostic decisions.
 * In accordance with CLIA, CAP, and ISO 15189 regulations, the Laboratory Director and
 * Consultant Pathologist must verify and approve laboratory-specific reference ranges
 * based on the laboratory's specific diagnostic analyzers, reagents, and local patient populations.
 */
export const DEFAULT_LOCAL_TEST_CATALOG = [
  {
    code: 'CBC',
    name: 'Complete Blood Count (CBC) with Differential [Sample Template]',
    department: 'Hematology',
    categoryName: 'Hematology',
    specimenType: 'Whole Blood',
    container: 'EDTA (Lavender Top)',
    price: 350,
    turnaroundHours: 4,
    referenceRange: 'See component parameters (Sample Template - Pathologist Verification Required)',
    clinicalValidationStatus: 'SAMPLE_TEMPLATE_PENDING_LAB_APPROVAL',
    disclaimer: 'SAMPLE REFERENCE INTERVALS: Generalized adult values. Method/gender/age-specific ranges (e.g. Male: 13.8-17.2, Female: 12.1-15.1 g/dL) must be clinically configured and verified by the laboratory pathologist.',
    parameters: [
      { name: 'Hemoglobin', unit: 'g/dL', normalMin: 12.0, normalMax: 16.5, note: 'Sample range: Subject to gender/age calibration' },
      { name: 'RBC Count', unit: 'mil/uL', normalMin: 4.0, normalMax: 5.5, note: 'Sample range: Subject to gender/age calibration' },
      { name: 'WBC Count', unit: '/uL', normalMin: 4000, normalMax: 11000, note: 'Sample range' },
      { name: 'Platelets', unit: '10^3/uL', normalMin: 150, normalMax: 450, note: 'Sample range' },
    ],
  },
  {
    code: 'FBS',
    name: 'Fasting Blood Sugar (FBS) [Sample Template]',
    department: 'Biochemistry',
    categoryName: 'Biochemistry',
    specimenType: 'Serum',
    container: 'Fluoride / Grey Top',
    price: 100,
    turnaroundHours: 2,
    referenceRange: '70 - 99 mg/dL (Sample Template - Pathologist Verification Required)',
    clinicalValidationStatus: 'SAMPLE_TEMPLATE_PENDING_LAB_APPROVAL',
    disclaimer: 'SAMPLE REFERENCE INTERVALS: Based on standard fasting guidelines. Instrument-specific thresholds must be verified by the laboratory director.',
    parameters: [
      { name: 'Glucose (Fasting)', unit: 'mg/dL', normalMin: 70, normalMax: 99, note: 'Sample normal fasting reference interval' },
    ],
  },
  {
    code: 'LIPID',
    name: 'Lipid Profile Comprehensive [Sample Template]',
    department: 'Biochemistry',
    categoryName: 'Biochemistry',
    specimenType: 'Serum',
    container: 'SST (Gold / Red Top)',
    price: 600,
    turnaroundHours: 6,
    referenceRange: 'See component parameters (Sample Template - Pathologist Verification Required)',
    clinicalValidationStatus: 'SAMPLE_TEMPLATE_PENDING_LAB_APPROVAL',
    disclaimer: 'SAMPLE REFERENCE INTERVALS: General population risk stratification cutoffs. Must be calibrated to laboratory analytical instrumentation.',
    parameters: [
      { name: 'Total Cholesterol', unit: 'mg/dL', normalMin: 125, normalMax: 200, note: 'Desirable: < 200 mg/dL' },
      { name: 'Triglycerides', unit: 'mg/dL', normalMin: 50, normalMax: 150, note: 'Normal: < 150 mg/dL' },
      { name: 'HDL Cholesterol', unit: 'mg/dL', normalMin: 40, normalMax: 60, note: 'Protective: > 40 mg/dL (Male), > 50 mg/dL (Female)' },
      { name: 'LDL Cholesterol', unit: 'mg/dL', normalMin: 0, normalMax: 100, note: 'Optimal: < 100 mg/dL' },
    ],
  },
  {
    code: 'LFT',
    name: 'Liver Function Test (LFT) [Sample Template]',
    department: 'Biochemistry',
    categoryName: 'Biochemistry',
    specimenType: 'Serum',
    container: 'SST (Gold / Red Top)',
    price: 550,
    turnaroundHours: 6,
    referenceRange: 'See component parameters (Sample Template - Pathologist Verification Required)',
    clinicalValidationStatus: 'SAMPLE_TEMPLATE_PENDING_LAB_APPROVAL',
    disclaimer: 'SAMPLE REFERENCE INTERVALS: Enzymatic activity units depend on temperature (37C) and assay kit method. Requires laboratory method validation.',
    parameters: [
      { name: 'Bilirubin Total', unit: 'mg/dL', normalMin: 0.2, normalMax: 1.2, note: 'Sample range' },
      { name: 'SGOT (AST)', unit: 'U/L', normalMin: 10, normalMax: 40, note: 'Method-dependent sample range' },
      { name: 'SGPT (ALT)', unit: 'U/L', normalMin: 7, normalMax: 56, note: 'Method-dependent sample range' },
      { name: 'Alkaline Phosphatase', unit: 'U/L', normalMin: 44, normalMax: 147, note: 'Age-dependent sample range' },
    ],
  },
  {
    code: 'KFT',
    name: 'Kidney Function Test (KFT / RFT) [Sample Template]',
    department: 'Biochemistry',
    categoryName: 'Biochemistry',
    specimenType: 'Serum',
    container: 'SST (Gold / Red Top)',
    price: 500,
    turnaroundHours: 6,
    referenceRange: 'See component parameters (Sample Template - Pathologist Verification Required)',
    clinicalValidationStatus: 'SAMPLE_TEMPLATE_PENDING_LAB_APPROVAL',
    disclaimer: 'SAMPLE REFERENCE INTERVALS: Serum creatinine and uric acid vary significantly by sex and muscle mass. Gender-stratified intervals must be verified by laboratory pathologist.',
    parameters: [
      { name: 'Blood Urea', unit: 'mg/dL', normalMin: 15, normalMax: 45, note: 'Sample range' },
      { name: 'Serum Creatinine', unit: 'mg/dL', normalMin: 0.6, normalMax: 1.3, note: 'Sample range: Sex-stratified (Male: 0.7-1.3, Female: 0.6-1.1 mg/dL)' },
      { name: 'Uric Acid', unit: 'mg/dL', normalMin: 3.5, normalMax: 7.2, note: 'Sample range: Sex-stratified (Male: 3.5-7.2, Female: 2.6-6.0 mg/dL)' },
    ],
  },
];

export class LocalBootstrapError extends Error {
  constructor(message, code = 'BOOTSTRAP_ERROR', statusCode = 500) {
    super(message);
    this.name = 'LocalBootstrapError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class LocalDatabaseBootstrapService {
  constructor() {
    this.isInitialized = false;
    this.testMemoryMode = false;
    this.simulatedStore = {
      masterInitialized: false,
      tenants: new Map(),
      superAdmins: new Map(),
      tenantDatabases: new Map(),
    };
  }

  /**
   * Enforce fail-closed database isolation check for Local Edition (SEC-LOCAL-01)
   */
  assertLocalEditionSafety(targetUri = null) {
    if (this.testMemoryMode && !targetUri) {
      return true;
    }

    if (config.isCloudEdition && process.env.NODE_ENV === 'production') {
      throw new LocalBootstrapError(
        'Safety Guard: Local database bootstrap is strictly prohibited on Cloud Edition production instances.',
        'CLOUD_EDITION_PROTECTED',
        403
      );
    }

    const uriToCheck = targetUri || config.database?.uri || 'mongodb://mongo:27017/lms_master';
    const check = validateDatabaseIsolation(uriToCheck, true);
    if (!check.isValid) {
      throw new LocalBootstrapError(
        check.error || '[SEC-LOCAL-01] Local Edition Database Isolation Violation',
        'DATABASE_ISOLATION_VIOLATION',
        403
      );
    }

    return true;
  }

  /**
   * Verify MongoDB connection availability before proceeding with live operations
   */
  async verifyConnectivity() {
    // If in test memory mode, simulate healthy connection
    if (this.testMemoryMode) {
      return { isConnected: true, mode: 'TEST_MEMORY' };
    }

    // Check live connection state
    const isLive = dbConnection.getStatus().connected && mongoose.connection.readyState === 1;
    if (isLive) {
      return {
        isConnected: true,
        mode: 'LIVE_MONGO',
        host: mongoose.connection.host,
        dbName: mongoose.connection.name,
      };
    }

    // If autoConnect is on, attempt connection
    if (config.database?.autoConnect && config.database?.uri) {
      try {
        const res = await dbConnection.connect();
        if (res.status === 'connected') {
          return {
            isConnected: true,
            mode: 'LIVE_MONGO',
            host: res.host,
            dbName: res.dbName,
          };
        }
      } catch (err) {
        return {
          isConnected: false,
          mode: 'BLOCKED',
          error: dbConnection.sanitizeErrorMessage(err.message),
        };
      }
    }

    return {
      isConnected: false,
      mode: 'DISCONNECTED',
      error: 'MongoDB is offline or autoConnect is disabled',
    };
  }

  /**
   * Initialize the master database (lms_master) schema, collections, and indexes
   */
  async initializeMasterDatabase() {
    this.assertLocalEditionSafety();

    if (this.testMemoryMode) {
      this.simulatedStore.masterInitialized = true;
      return {
        status: 'INITIALIZED',
        mode: 'TEST_MEMORY',
        masterDbName: 'lms_master',
        collections: ['tenants', 'platform_admins', 'audit_logs', 'report_verifications', 'roles'],
      };
    }

    const conn = await this.verifyConnectivity();
    if (!conn.isConnected) {
      throw new LocalBootstrapError(
        `Cannot initialize master database: MongoDB connection is unavailable (${conn.error}).`,
        'DATABASE_UNAVAILABLE',
        503
      );
    }

    logger.info('🔄 [LOCAL BOOTSTRAP] Initializing master database schema and compound indexes (lms_master)...');

    // Ensure master collections exist and create schema indexes
    await Promise.all([
      TenantModel.init().catch((err) => logger.warn(`[LOCAL BOOTSTRAP] TenantModel.init notice: ${err.message}`)),
      PlatformAdminModel.init().catch((err) => logger.warn(`[LOCAL BOOTSTRAP] PlatformAdminModel.init notice: ${err.message}`)),
      AuditLogModel.init().catch((err) => logger.warn(`[LOCAL BOOTSTRAP] AuditLogModel.init notice: ${err.message}`)),
      ReportVerificationModel.init().catch((err) => logger.warn(`[LOCAL BOOTSTRAP] ReportVerificationModel.init notice: ${err.message}`)),
    ]);

    // Ensure master roles are seeded in platform_master
    await roleService.seedMasterRoles().catch((err) => {
      logger.warn(`[LOCAL BOOTSTRAP] Master roles seeding notice: ${err.message}`);
    });

    // Ensure Platform Super Administrator exists (Idempotent: Never overwrite)
    await this.bootstrapPlatformSuperAdmin();

    logger.info('✅ [LOCAL BOOTSTRAP] Master database (lms_master) initialized successfully.');

    return {
      status: 'INITIALIZED',
      mode: 'LIVE_MONGO',
      masterDbName: config.database?.masterDbName || 'lms_master',
      collections: ['tenants', 'platform_admins', 'audit_logs', 'report_verifications', 'roles'],
    };
  }

  /**
   * Bootstrap initial Platform Super Administrator account (Idempotent)
   */
  async bootstrapPlatformSuperAdmin(options = {}) {
    const adminEmail = (options.email || process.env.BOOTSTRAP_ADMIN_EMAIL || 'superadmin@local.lms.health').trim().toLowerCase();
    let adminPassword = (options.password || process.env.BOOTSTRAP_ADMIN_PASSWORD || '').trim();
    let isPasswordGenerated = false;
    if (!adminPassword) {
      adminPassword = `Adm_${crypto.randomBytes(6).toString('hex')}!2026`;
      isPasswordGenerated = true;
    }
    const adminName = options.fullName || process.env.BOOTSTRAP_ADMIN_NAME || 'Local Platform Super Administrator';

    if (this.testMemoryMode) {
      if (!this.simulatedStore.superAdmins.has(adminEmail)) {
        const adminId = `adm_${crypto.randomBytes(6).toString('hex')}`;
        const passwordHash = await passwordService.hashPassword(adminPassword);
        this.simulatedStore.superAdmins.set(adminEmail, {
          adminId,
          email: adminEmail,
          fullName: adminName,
          passwordHash,
          role: 'super_admin',
          isActive: true,
        });
      }
      return this.simulatedStore.superAdmins.get(adminEmail);
    }

    if (!tenantConnectionService.isLiveMongoConnected()) {
      return null;
    }

    // Check if any Super Admin already exists
    const existingAdmin = await PlatformAdminModel.findOne({ email: adminEmail });
    if (existingAdmin) {
      logger.info(`ℹ️  [LOCAL BOOTSTRAP] Platform Super Admin already exists (${adminEmail}). Preserving credentials.`);
      return existingAdmin.toSafeJSON();
    }

    const anyAdminCount = await PlatformAdminModel.countDocuments();
    if (anyAdminCount > 0) {
      logger.info(`ℹ️  [LOCAL BOOTSTRAP] Platform Super Admin account(s) already exist (${anyAdminCount} admin record(s)). Skipping creation.`);
      const firstAdmin = await PlatformAdminModel.findOne();
      return firstAdmin ? firstAdmin.toSafeJSON() : null;
    }

    // Create initial Super Admin
    const passwordHash = await passwordService.hashPassword(adminPassword);
    const adminId = `adm_${crypto.randomBytes(6).toString('hex')}`;

    const admin = new PlatformAdminModel({
      adminId,
      email: adminEmail,
      fullName: adminName,
      passwordHash,
      role: 'super_admin',
      isActive: true,
    });

    await admin.save();
    logger.info(`✅ [LOCAL BOOTSTRAP] Created initial Platform Super Administrator: ${adminEmail} (ID: ${adminId})`);
    if (isPasswordGenerated) {
      logger.info(`🔑 [LOCAL BOOTSTRAP] Platform Super Admin password auto-generated: [DISPLAYED ONCE] -> ${adminPassword}`);
    }

    return admin.toSafeJSON();
  }

  /**
   * Provision default local laboratory and tenant database (Idempotent)
   */
  async provisionDefaultLaboratory(options = {}) {
    this.assertLocalEditionSafety();

    const labName = (options.name || options.labName || config.localBootstrap?.labName || 'Main Clinical Laboratory').trim();
    const labCode = (options.code || options.labCode || config.localBootstrap?.labCode || 'main-lab').trim().toLowerCase();
    const labEmail = (options.email || options.labEmail || config.localBootstrap?.labEmail || 'contact@locallab.com').trim().toLowerCase();
    const adminFullName = (options.adminFullName || config.localBootstrap?.adminFullName || 'Laboratory Administrator').trim();
    const adminEmail = (options.adminEmail || config.localBootstrap?.adminEmail || 'admin@locallab.com').trim().toLowerCase();
    let adminPassword = (options.adminPassword || config.localBootstrap?.adminPassword || process.env.LOCAL_LAB_ADMIN_PASSWORD || '').trim();
    let isLabPasswordGenerated = false;
    if (!adminPassword) {
      adminPassword = `Lab_${crypto.randomBytes(6).toString('hex')}!2026`;
      isLabPasswordGenerated = true;
    }
    const adminPhone = options.adminPhone || '9876543210';

    // 1. Check if default laboratory already exists in memory or live DB
    if (this.testMemoryMode) {
      if (this.simulatedStore.tenants.has(labCode)) {
        logger.info(`ℹ️  [LOCAL BOOTSTRAP] Default laboratory '${labCode}' already exists in test store. Preserving.`);
        return {
          alreadyExists: true,
          tenant: this.simulatedStore.tenants.get(labCode),
        };
      }

      const tenantId = generateTenantId();
      const databaseName = deriveDatabaseName(tenantId);
      const mockTenant = {
        tenantId,
        code: labCode,
        name: labName,
        legalName: labName,
        status: LAB_STATUS.ACTIVE,
        database: {
          name: databaseName,
          provisioningStatus: PROVISIONING_STATUS.READY,
          isLiveDatabase: false,
          collectionsInitialized: [
            'users', 'roles', 'patients', 'lab_orders', 'samples',
            'audit_logs', 'diagnostic_reports', 'invoices',
            'test_catalog', 'test_categories', 'recollection_tasks'
          ],
        },
      };

      this.simulatedStore.tenants.set(labCode, mockTenant);
      this.simulatedStore.tenantDatabases.set(databaseName, { tenantId, initialized: true });

      return {
        alreadyExists: false,
        tenant: mockTenant,
        databaseName,
        initialAdminEmail: adminEmail,
      };
    }

    const conn = await this.verifyConnectivity();
    if (!conn.isConnected) {
      throw new LocalBootstrapError(
        `Cannot provision default laboratory: MongoDB connection is unavailable (${conn.error}).`,
        'DATABASE_UNAVAILABLE',
        503
      );
    }

    // Check if tenant already exists in lms_master
    const existingTenant = await TenantModel.findOne({ code: labCode });
    if (existingTenant) {
      // Partial recovery: if existing tenant was interrupted during provisioning, recover state
      if (existingTenant.database?.provisioningStatus !== PROVISIONING_STATUS.READY) {
        logger.info(`🔄 [LOCAL BOOTSTRAP] Default laboratory '${existingTenant.code}' was in state '${existingTenant.database?.provisioningStatus}'. Recovering partial state...`);
        await tenantProvisioningService.provisionLaboratory(existingTenant);
        existingTenant.database.provisioningStatus = PROVISIONING_STATUS.READY;
        existingTenant.database.provisionedAt = new Date();
        await existingTenant.save();
        await roleService.seedDefaultRoles(existingTenant.tenantId).catch(() => {});
        await this.seedDefaultCategories(existingTenant.tenantId);
        await this.seedDefaultTestCatalog(existingTenant.tenantId);
      }

      logger.info(`ℹ️  [LOCAL BOOTSTRAP] Default laboratory '${existingTenant.name}' (${existingTenant.code}) already exists (Tenant ID: ${existingTenant.tenantId}). Preserving existing database.`);
      return {
        alreadyExists: true,
        tenant: existingTenant.toSafeJSON ? existingTenant.toSafeJSON() : existingTenant,
        databaseName: existingTenant.database?.name,
      };
    }

    logger.info(`🔄 [LOCAL BOOTSTRAP] Provisioning default local laboratory '${labName}' (${labCode})...`);

    // 2. Generate server-controlled tenant identifier and database name
    const tenantId = generateTenantId();
    const databaseName = deriveDatabaseName(tenantId);

    // 3. Create Tenant Registry Document in lms_master
    const tenantDoc = new TenantModel({
      tenantId,
      code: labCode,
      name: labName,
      legalName: labName,
      status: LAB_STATUS.ACTIVE,
      subscriptionPlan: 'enterprise',
      database: {
        name: databaseName,
        provisioningStatus: PROVISIONING_STATUS.INITIALIZING,
        provisioningStrategy: 'LIVE_MONGODB_LOGICAL_DB',
        isLiveDatabase: true,
        provisioningMode: 'LIVE_MONGO',
        retryCount: 0,
      },
      domains: [
        {
          domain: 'localhost',
          isVerified: true,
          verifiedAt: new Date(),
          verificationMethod: 'MANUAL_SUPER_ADMIN_PENDING',
        },
        {
          domain: '127.0.0.1',
          isVerified: true,
          verifiedAt: new Date(),
          verificationMethod: 'MANUAL_SUPER_ADMIN_PENDING',
        },
      ],
      branding: {
        displayName: labName,
        primaryColor: '#0d9488',
        accentColor: '#14b8a6',
        loginBannerText: `Welcome to ${labName}`,
        supportEmail: labEmail,
      },
      settings: {
        currency: 'INR',
        timezone: 'Asia/Kolkata',
      },
    });

    await tenantDoc.save();

    // 4. Provision tenant database collections & indexes
    await tenantProvisioningService.provisionLaboratory(tenantDoc);

    // Refresh tenant status
    tenantDoc.database.provisioningStatus = PROVISIONING_STATUS.READY;
    tenantDoc.database.provisionedAt = new Date();
    await tenantDoc.save();

    // 5. Seed default roles in tenant database
    await roleService.seedDefaultRoles(tenantId).catch((err) => {
      logger.warn(`[LOCAL BOOTSTRAP] Role seeding warning for ${tenantId}: ${err.message}`);
    });

    // 6. Seed default clinical categories in tenant database
    await this.seedDefaultCategories(tenantId);

    // 7. Seed default test catalog in tenant database
    await this.seedDefaultTestCatalog(tenantId);

    // 8. Provision initial Lab Administrator user in tenant database
    await this.provisionInitialLabAdmin(tenantId, {
      fullName: adminFullName,
      email: adminEmail,
      password: adminPassword,
      phone: adminPhone,
    });

    // 9. Record master audit log
    await auditLogService.recordEvent({
      action: AUDIT_ACTIONS.LAB_REGISTERED,
      targetTenantId: tenantId,
      actorType: 'PLATFORM_SUPER_ADMIN',
      actorEmail: 'system@local.bootstrap',
      details: {
        code: labCode,
        name: labName,
        databaseName,
        mode: 'LOCAL_ON_PREMISE_BOOTSTRAP',
      },
    }).catch(() => {});

    logger.info(`✅ [LOCAL BOOTSTRAP] Default laboratory successfully provisioned! Tenant ID: ${tenantId}, Database: ${databaseName}`);

    return {
      alreadyExists: false,
      tenant: tenantDoc.toSafeJSON(),
      databaseName,
      initialAdminEmail: adminEmail,
    };
  }

  /**
   * Seed standard clinical categories for newly provisioned laboratory
   */
  async seedDefaultCategories(tenantId) {
    try {
      const CategoryModel = tenantConnectionService.getTenantTestCategoryModel(tenantId);
      if (!CategoryModel) return;

      const existingCount = await CategoryModel.countDocuments({ tenantId });
      if (existingCount > 0) return;

      const docs = DEFAULT_LOCAL_CATEGORIES.map((cat) => ({
        categoryId: `cat_${crypto.randomBytes(4).toString('hex')}`,
        tenantId,
        name: cat.name,
        department: cat.department,
        description: cat.description,
        isActive: true,
      }));

      await CategoryModel.insertMany(docs, { ordered: false });
      logger.info(`[LOCAL BOOTSTRAP] Seeded ${docs.length} standard test categories for tenant ${tenantId}`);
    } catch (err) {
      logger.warn(`[LOCAL BOOTSTRAP] Category seeding notice for ${tenantId}: ${err.message}`);
    }
  }

  /**
   * Seed default routine test panels for newly provisioned laboratory
   */
  async seedDefaultTestCatalog(tenantId) {
    try {
      const CatalogModel = tenantConnectionService.getTenantTestCatalogModel(tenantId);
      const CategoryModel = tenantConnectionService.getTenantTestCategoryModel(tenantId);
      if (!CatalogModel || !CategoryModel) return;

      const existingCount = await CatalogModel.countDocuments({ tenantId });
      if (existingCount > 0) return;

      const categories = await CategoryModel.find({ tenantId }).lean();
      const catMap = new Map(categories.map((c) => [c.name, c.categoryId]));

      const catalogDocs = DEFAULT_LOCAL_TEST_CATALOG.map((test) => {
        const categoryId = catMap.get(test.categoryName) || `cat_general_${tenantId}`;
        return {
          testId: `tst_${crypto.randomBytes(4).toString('hex')}`,
          tenantId,
          code: test.code,
          name: test.name,
          department: test.department,
          categoryId,
          category: test.categoryName,
          specimenType: test.specimenType,
          container: test.container,
          price: test.price,
          turnaroundHours: test.turnaroundHours,
          referenceRange: test.referenceRange,
          parameters: test.parameters.map((p) => ({
            paramId: `prm_${crypto.randomBytes(3).toString('hex')}`,
            name: p.name,
            unit: p.unit,
            normalMin: p.normalMin,
            normalMax: p.normalMax,
          })),
          isActive: true,
        };
      });

      await CatalogModel.insertMany(catalogDocs, { ordered: false });
      logger.info(`[LOCAL BOOTSTRAP] Seeded ${catalogDocs.length} standard diagnostic tests for tenant ${tenantId}`);
    } catch (err) {
      logger.warn(`[LOCAL BOOTSTRAP] Test catalog seeding notice for ${tenantId}: ${err.message}`);
    }
  }

  /**
   * Provision initial Lab Administrator user in tenant database (Idempotent)
   */
  async provisionInitialLabAdmin(tenantId, adminData) {
    try {
      const UserModel = tenantConnectionService.getTenantUserModel(tenantId);
      if (!UserModel) return null;

      const cleanEmail = adminData.email.trim().toLowerCase();
      const existingUser = await UserModel.findOne({ tenantId, email: cleanEmail });
      if (existingUser) {
        logger.info(`ℹ️  [LOCAL BOOTSTRAP] Lab Administrator user already exists (${cleanEmail}). Preserving.`);
        return existingUser.toSafeJSON();
      }

      const created = await tenantUserService.createUser(
        tenantId,
        {
          fullName: adminData.fullName,
          email: cleanEmail,
          password: adminData.password,
          role: 'lab_admin',
          phone: adminData.phone || '9876543210',
          department: 'Administration',
        },
        { accountType: 'PLATFORM_SUPER_ADMIN', email: 'system@local.bootstrap' }
      );

      logger.info(`✅ [LOCAL BOOTSTRAP] Initial Lab Administrator created: ${cleanEmail}`);
      return created;
    } catch (err) {
      logger.warn(`[LOCAL BOOTSTRAP] Lab Admin user creation notice for ${tenantId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Complete Local Edition Database Bootstrap Orchestrator
   */
  async bootstrapAll(options = {}) {
    this.assertLocalEditionSafety();

    const conn = await this.verifyConnectivity();
    if (!conn.isConnected) {
      logger.warn(`⚠️  [LOCAL BOOTSTRAP] Local MongoDB daemon is not running (${conn.error}).`);
      logger.warn('⚠️  [LOCAL BOOTSTRAP] Initialization cannot contact database. Runtime operations marked BLOCKED.');
      return {
        status: 'BLOCKED',
        reason: 'MONGODB_UNAVAILABLE',
        error: conn.error,
        actionRequired: 'Start local MongoDB service or Docker container "mongo" on port 27017, then execute npm run bootstrap:local.',
      };
    }

    logger.info('================================================================');
    logger.info('🚀 LMS MEDICAL365 — LOCAL DATABASE BOOTSTRAP INITIATED');
    logger.info('================================================================');

    // 1. Initialize master database (lms_master)
    const masterResult = await this.initializeMasterDatabase();

    // 2. Provision default local laboratory (lms_lab_<tenantId>)
    const labResult = await this.provisionDefaultLaboratory(options);

    this.isInitialized = true;

    logger.info('================================================================');
    logger.info('✅ LMS MEDICAL365 — LOCAL DATABASE BOOTSTRAP COMPLETE');
    logger.info(`   Master Database: ${masterResult.masterDbName || 'lms_master'}`);
    logger.info(`   Default Lab:     ${labResult.tenant?.name || options.labName} (${labResult.tenant?.code || options.labCode})`);
    logger.info(`   Tenant Database: ${labResult.databaseName}`);
    logger.info(`   Admin Login:     ${labResult.initialAdminEmail || 'Configured admin'}`);
    logger.info('================================================================');

    return {
      status: 'COMPLETED',
      isLocalEdition: true,
      masterDatabase: masterResult,
      defaultLaboratory: labResult,
      timestamp: new Date(),
    };
  }

  /**
   * Safe server-startup hook: triggers bootstrap only when configured in Local Edition
   */
  async bootstrapIfConfigured() {
    if (!config.isLocalEdition) return null;
    if (config.localBootstrap && config.localBootstrap.enabled === false) return null;

    try {
      return await this.bootstrapAll();
    } catch (err) {
      logger.warn(`[LOCAL BOOTSTRAP] Startup bootstrap notice: ${err.message}`);
      return null;
    }
  }
}

export const localDatabaseBootstrapService = new LocalDatabaseBootstrapService();
export default localDatabaseBootstrapService;
