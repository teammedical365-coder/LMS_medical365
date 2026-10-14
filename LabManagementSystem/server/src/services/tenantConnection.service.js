/**
 * Lab Management System (LMS) - Tenant Connection Service
 * 
 * Manages tenant-specific database connections and models.
 * 
 * SECURITY RULES:
 * 1. Derives tenant database names strictly on the server: `lms_lab_<tenantId>`.
 * 2. Never accepts client-provided database names.
 * 3. Keeps master database connection separate from tenant databases.
 * 4. Never falls back to another tenant database or the master database.
 * 5. Uses connection pooling/caching to prevent unbounded duplicate connections.
 * 6. Explicitly checks database connectivity: When no live MongoDB connection is
 *    configured, fails safely with 503 instead of simulating a successful live login.
 */

import mongoose from 'mongoose';
import config from '../config/env.js';
import dbConnection from '../config/db.js';
import { UserSchema } from '../models/user.model.js';
import { RoleSchema } from '../models/role.model.js';
import {
  PatientSchema,
  LabOrderSchema,
  SampleSchema,
  TestCatalogSchema,
  DiagnosticReportSchema,
  InvoiceSchema,
  RecollectionTaskSchema,
  TestCategorySchema,
} from '../models/clinical.models.js';
import logger from '../utils/logger.js';

export class TenantConnectionError extends Error {
  constructor(message, code = 'TENANT_CONNECTION_ERROR', statusCode = 500) {
    super(message);
    this.name = 'TenantConnectionError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class TenantConnectionService {
  constructor() {
    // Cache map: databaseName -> tenant connection instance
    this.connectionCache = new Map();
    // Test-only memory store for isolated unit tests that opt in
    this.testMemoryStore = new Map(); // tenantId -> Map<userId, userDoc>
    this.allowTestMemoryMode = false;
  }

  /**
   * Set test-only memory mode for test suites
   */
  setTestMemoryMode(allowed) {
    this.allowTestMemoryMode = !!allowed;
  }

  /**
   * Derive tenant database name safely
   * Pattern: lms_lab_<sanitized_tenantId>
   * @param {string} tenantId 
   * @returns {string}
   */
  deriveDatabaseName(tenantId) {
    if (!tenantId || typeof tenantId !== 'string') {
      throw new TenantConnectionError('Invalid tenant identifier', 'INVALID_TENANT_ID', 400);
    }

    const cleanId = tenantId.trim().toLowerCase();
    // Validate format: letters, numbers, underscores, hyphens only
    if (!/^[a-z0-9_-]{3,64}$/.test(cleanId)) {
      throw new TenantConnectionError(
        'Tenant identifier contains invalid characters for database naming',
        'INVALID_TENANT_ID',
        400
      );
    }

    return `lms_lab_${cleanId}`;
  }

  /**
   * Check if live MongoDB connection is available
   */
  isLiveMongoConnected() {
    return dbConnection.getStatus().connected && mongoose.connection.readyState === 1;
  }

  /**
   * Get or create a cached tenant database connection
   * @param {string} tenantId 
   * @returns {mongoose.Connection}
   */
  getTenantConnection(tenantId) {
    if (!this.isLiveMongoConnected()) {
      if (this.allowTestMemoryMode) {
        return null; // Signals test-memory fallback
      }
      throw new TenantConnectionError(
        'Live MongoDB database is not connected. Operation requires an active database connection.',
        'DATABASE_UNAVAILABLE',
        503
      );
    }

    const dbName = this.deriveDatabaseName(tenantId);

    // Reuse existing connection from pool
    if (this.connectionCache.has(dbName)) {
      return this.connectionCache.get(dbName);
    }

    try {
      // Use useDb with useCache: true to reuse underlying socket pool
      const tenantConn = mongoose.connection.useDb(dbName, { useCache: true });
      this.connectionCache.set(dbName, tenantConn);
      logger.info(`[TENANT DB] Bound cached connection to tenant database: ${dbName}`);
      return tenantConn;
    } catch (err) {
      logger.error(`[TENANT DB] Failed to bind connection for ${dbName}:`, err);
      throw new TenantConnectionError(
        `Failed to establish tenant database connection: ${err.message}`,
        'TENANT_CONNECTION_FAILED',
        500
      );
    }
  }

  /**
   * Get UserModel bound strictly to the given tenant's database
   * @param {string} tenantId 
   * @returns {mongoose.Model}
   */
  getTenantUserModel(tenantId) {
    const conn = this.getTenantConnection(tenantId);
    if (!conn) {
      // Offline test memory mode
      return null;
    }

    if (conn.models.User) {
      return conn.models.User;
    }

    return conn.model('User', UserSchema);
  }

  /**
   * Get RoleModel bound strictly to the given tenant's database
   * @param {string} tenantId 
   * @returns {mongoose.Model}
   */
  getTenantRoleModel(tenantId) {
    const conn = this.getTenantConnection(tenantId);
    if (!conn) {
      // Offline test memory mode
      return null;
    }

    if (conn.models.Role) {
      return conn.models.Role;
    }

    return conn.model('Role', RoleSchema);
  }

  /**
   * Get PatientModel bound strictly to the tenant's database
   */
  getTenantPatientModel(tenantId) {
    const conn = this.getTenantConnection(tenantId);
    if (!conn) return null;
    return conn.models.Patient || conn.model('Patient', PatientSchema);
  }

  /**
   * Get LabOrderModel bound strictly to the tenant's database
   */
  getTenantOrderModel(tenantId) {
    const conn = this.getTenantConnection(tenantId);
    if (!conn) return null;
    return conn.models.LabOrder || conn.model('LabOrder', LabOrderSchema);
  }

  /**
   * Get SampleModel bound strictly to the tenant's database
   */
  getTenantSampleModel(tenantId) {
    const conn = this.getTenantConnection(tenantId);
    if (!conn) return null;
    return conn.models.Sample || conn.model('Sample', SampleSchema);
  }

  /**
   * Get TestCatalogModel bound strictly to the tenant's database
   */
  getTenantTestCatalogModel(tenantId) {
    const conn = this.getTenantConnection(tenantId);
    if (!conn) return null;
    return conn.models.TestCatalogItem || conn.model('TestCatalogItem', TestCatalogSchema);
  }

  /**
   * Get TestCategoryModel bound strictly to the tenant's database
   */
  getTenantTestCategoryModel(tenantId) {
    const conn = this.getTenantConnection(tenantId);
    if (!conn) return null;
    return conn.models.TestCategory || conn.model('TestCategory', TestCategorySchema);
  }

  /**
   * Get DiagnosticReportModel bound strictly to the tenant's database
   */
  getTenantReportModel(tenantId) {
    const conn = this.getTenantConnection(tenantId);
    if (!conn) return null;
    return conn.models.DiagnosticReport || conn.model('DiagnosticReport', DiagnosticReportSchema);
  }

  /**
   * Get InvoiceModel bound strictly to the tenant's database
   */
  getTenantInvoiceModel(tenantId) {
    const conn = this.getTenantConnection(tenantId);
    if (!conn) return null;
    return conn.models.Invoice || conn.model('Invoice', InvoiceSchema);
  }

  /**
   * Get RecollectionTaskModel bound strictly to the tenant's database
   */
  getTenantRecollectionTaskModel(tenantId) {
    const conn = this.getTenantConnection(tenantId);
    if (!conn) return null;
    return conn.models.RecollectionTask || conn.model('RecollectionTask', RecollectionTaskSchema);
  }

  /**
   * Close and clear tenant connection pool (used during graceful shutdown or tests)
   */
  clearConnections() {
    this.connectionCache.clear();
    this.testMemoryStore.clear();
  }
}

export const tenantConnectionService = new TenantConnectionService();
export default tenantConnectionService;
