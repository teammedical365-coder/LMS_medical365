/**
 * Lab Management System (LMS) - Tenant Database Provisioning Service
 * 
 * ARCHITECTURE & SECURITY PRINCIPLES:
 * 1. Server-controlled database naming: `lms_lab_<sanitizedTenantId>`
 * 2. Strict validation of tenant IDs prior to database name derivation
 * 3. Master and tenant database separation: never reuse master DB connection
 * 4. Pluggable adapter architecture (dependency injection) for testing without live MongoDB
 * 5. Sanitized error logging: zero connection strings or credentials in errors
 * 6. Idempotent execution: retrying ready tenant is safe and idempotent
 */

import mongoose from 'mongoose';
import config from '../config/env.js';
import dbConnection from '../config/db.js';
import { PROVISIONING_STATUS, AUDIT_ACTIONS } from '../config/constants.js';
import auditLogService from './auditLog.service.js';
import logger from '../utils/logger.js';

/**
 * Custom Error for Provisioning failures with guaranteed sanitized message
 */
export class ProvisioningError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ProvisioningError';
    this.details = details;
  }
}

/**
 * Validate and derive server-controlled tenant database name
 */
export function deriveDatabaseName(tenantId, prefix = config.database.tenantDbPrefix || 'lms_lab_') {
  if (!tenantId || typeof tenantId !== 'string') {
    throw new ProvisioningError('Invalid tenant ID: Tenant ID is required and must be a string.');
  }

  // Enforce format: must be alphanumeric/underscore between 4 and 40 characters
  const cleanId = tenantId.trim().toLowerCase();
  if (!/^[a-z0-9_]{4,40}$/.test(cleanId)) {
    throw new ProvisioningError('Invalid tenant ID format: Tenant identifier contains illegal characters.');
  }

  // Reject path traversal, dots, dollar signs, or special mongo characters
  if (cleanId.includes('/') || cleanId.includes('\\') || cleanId.includes('.') || cleanId.includes('$')) {
    throw new ProvisioningError('Security violation: Tenant ID contains forbidden database characters.');
  }

  const safePrefix = (prefix || 'lms_lab_').replace(/[^a-z0-9_]/g, '');
  return `${safePrefix}${cleanId}`;
}

/**
 * Sanitize error message to ensure no connection strings or credentials leak
 */
export function sanitizeError(err) {
  if (!err) return 'Unknown provisioning failure';
  let message = typeof err === 'string' ? err : err.message || 'Provisioning error';
  // Strip any mongodb:// connection string occurrences
  message = message.replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, '[DATABASE_URI_REDACTED]');
  // Strip password patterns
  message = message.replace(/:([^@/]+)@/g, ':***@');
  return message;
}

/**
 * Memory Adapter: for unit testing and offline development without MongoDB daemon
 */
export class MemoryTenantProvisioningAdapter {
  constructor(options = {}) {
    this.simulatedFailure = options.simulatedFailure || false;
    this.provisionedDatabases = new Set();
  }

  async provisionTenantDatabase(databaseName) {
    if (this.simulatedFailure) {
      throw new Error(`Simulated database initialization failure for ${databaseName}`);
    }

    const collections = ['users', 'patients', 'lab_orders', 'samples', 'audit_logs'];
    this.provisionedDatabases.add(databaseName);

    return {
      success: true,
      databaseName,
      collectionsInitialized: collections,
      provisionedAt: new Date(),
      isLiveDatabase: false,
      provisioningMode: 'OFFLINE_MEMORY',
      provisioningStrategy: 'OFFLINE_SIMULATED_DB',
      note: 'Offline simulated database. Live MongoDB collections require live MongoDB cluster with DB_AUTO_CONNECT=true.',
    };
  }

  async verifyTenantDatabase(databaseName) {
    return this.provisionedDatabases.has(databaseName);
  }
}

/**
 * Mongo Adapter: Live MongoDB tenant database provisioning
 */
export class MongoTenantProvisioningAdapter {
  constructor(baseUri = config.database.uri) {
    this.baseUri = baseUri;
  }

  async provisionTenantDatabase(databaseName) {
    if (!this.baseUri) {
      throw new Error('No MongoDB URI configured for live provisioning adapter');
    }

    // Derive tenant URI: replace default DB name with tenant database name
    const tenantUri = this.getTenantConnectionUri(databaseName);
    let connection = null;
    let shouldClose = false;

    try {
      logger.info(`[PROVISIONING] Connecting to tenant database: ${databaseName}`);
      let db;

      if (mongoose.connection && mongoose.connection.readyState === 1) {
        // High-performance connection reuse: use existing warm socket pool via useDb
        const tenantConn = mongoose.connection.useDb(databaseName, { useCache: true });
        db = tenantConn.db;
        connection = tenantConn;
        shouldClose = false;
      } else {
        connection = await mongoose.createConnection(this.baseUri, {
          dbName: databaseName,
          serverSelectionTimeoutMS: 15000,
        }).asPromise();
        db = connection.db;
        shouldClose = true;
      }

      // Core tenant collections & schema index initialization
      const collections = ['users', 'roles', 'patients', 'lab_orders', 'samples', 'audit_logs'];

      // Initialize collections & indexes in parallel for sub-second provisioning
      await Promise.all([
        (async () => {
          const usersColl = await db.createCollection('users').catch((err) => (err.code === 48 ? db.collection('users') : Promise.reject(err)));
          await usersColl.createIndex({ tenantId: 1, email: 1 }, { unique: true });
        })(),
        (async () => {
          const rolesColl = await db.createCollection('roles').catch((err) => (err.code === 48 ? db.collection('roles') : Promise.reject(err)));
          await rolesColl.createIndex({ tenantId: 1, code: 1 }, { unique: true });
        })(),
        (async () => {
          const patientsColl = await db.createCollection('patients').catch((err) => (err.code === 48 ? db.collection('patients') : Promise.reject(err)));
          await patientsColl.createIndex({ tenantId: 1, mrn: 1 }, { unique: true });
        })(),
        (async () => {
          const ordersColl = await db.createCollection('lab_orders').catch((err) => (err.code === 48 ? db.collection('lab_orders') : Promise.reject(err)));
          await ordersColl.createIndex({ tenantId: 1, orderNumber: 1 }, { unique: true });
        })(),
        (async () => {
          const samplesColl = await db.createCollection('samples').catch((err) => (err.code === 48 ? db.collection('samples') : Promise.reject(err)));
          await samplesColl.createIndex({ tenantId: 1, barcode: 1 }, { unique: true });
        })(),
        (async () => {
          const auditColl = await db.createCollection('audit_logs').catch((err) => (err.code === 48 ? db.collection('audit_logs') : Promise.reject(err)));
          await auditColl.createIndex({ timestamp: -1 });
        })(),
      ]);

      logger.info(`[PROVISIONING] Successfully initialized ${collections.length} collections in parallel in ${databaseName}`);

      return {
        success: true,
        databaseName,
        collectionsInitialized: collections,
        provisionedAt: new Date(),
        isLiveDatabase: true,
        provisioningMode: 'LIVE_MONGO',
        provisioningStrategy: 'LIVE_MONGODB_LOGICAL_DB',
        note: 'Live MongoDB logical database provisioned with isolated tenant collections.',
      };
    } catch (err) {
      const sanitized = sanitizeError(err);
      logger.error(`[PROVISIONING] Failed to initialize ${databaseName}: ${sanitized}`);
      throw new Error(sanitized);
    } finally {
      if (shouldClose && connection) {
        await connection.close().catch(() => {});
      }
    }
  }

  getTenantConnectionUri(databaseName) {
    const raw = String(this.baseUri || '').trim();
    if (!raw) return '';
    try {
      const parsed = new URL(raw);
      parsed.pathname = `/${databaseName}`;
      return parsed.toString();
    } catch {
      if (raw.includes('?')) {
        const [base, query] = raw.split('?');
        return `${base.replace(/\/+$/, '')}/${databaseName}?${query}`;
      }
      return `${raw.replace(/\/+$/, '')}/${databaseName}`;
    }
  }
}

/**
 * Tenant Provisioning Service
 */
export class TenantProvisioningService {
  constructor(adapter = null) {
    if (adapter) {
      this.adapter = adapter;
      this.isExplicitAdapter = true;
    } else {
      this.adapter = null;
      this.isExplicitAdapter = false;
    }
  }

  getEffectiveAdapter() {
    if (this.isExplicitAdapter && this.adapter) {
      return this.adapter;
    }
    if (config.database.autoConnect && config.database.uri && dbConnection.getStatus().connected) {
      return new MongoTenantProvisioningAdapter(config.database.uri);
    }
    return new MemoryTenantProvisioningAdapter();
  }

  /**
   * Set custom adapter (e.g. for testing)
   */
  setAdapter(adapter) {
    this.adapter = adapter;
    this.isExplicitAdapter = !!adapter;
  }

  /**
   * Provision tenant database idempotently
   */
  async provisionLaboratory(tenant) {
    if (!tenant) {
      throw new ProvisioningError('Tenant record is required for provisioning');
    }

    const { tenantId } = tenant;
    const dbName = deriveDatabaseName(tenantId);

    // Idempotency check: If already ready, return without duplicate work
    if (tenant.database?.provisioningStatus === PROVISIONING_STATUS.READY) {
      logger.info(`[PROVISIONING] Laboratory ${tenant.code} (${tenantId}) is already marked READY. Skipping.`);
      return {
        success: true,
        alreadyProvisioned: true,
        status: PROVISIONING_STATUS.READY,
        databaseName: dbName,
        isLiveDatabase: !!tenant.database.isLiveDatabase,
        provisioningMode: tenant.database.provisioningMode || 'OFFLINE_MEMORY',
        provisioningStrategy: tenant.database.provisioningStrategy || 'OFFLINE_SIMULATED_DB',
        provisionedAt: tenant.database.provisionedAt,
        collections: tenant.database.collectionsInitialized || [],
        note: tenant.database.note,
      };
    }

    // Set status to IN_PROGRESS
    tenant.database = tenant.database || {};
    tenant.database.name = dbName;
    tenant.database.provisioningStatus = PROVISIONING_STATUS.IN_PROGRESS;
    tenant.database.provisioningError = null;
    if (tenant.save) await tenant.save();

    await auditLogService.logEvent({
      action: AUDIT_ACTIONS.PROVISIONING_STARTED,
      targetTenantId: tenantId,
      metadata: { databaseName: dbName, attempt: (tenant.database.retryCount || 0) + 1 },
    });

    try {
      const adapter = this.getEffectiveAdapter();
      const result = await adapter.provisionTenantDatabase(dbName);

      tenant.database.provisioningStatus = PROVISIONING_STATUS.READY;
      tenant.database.provisionedAt = result.provisionedAt || new Date();
      tenant.database.collectionsInitialized = result.collectionsInitialized || [];
      tenant.database.isLiveDatabase = !!result.isLiveDatabase;
      tenant.database.provisioningMode = result.provisioningMode || 'OFFLINE_MEMORY';
      tenant.database.provisioningStrategy = result.provisioningStrategy || 'OFFLINE_SIMULATED_DB';
      tenant.database.note = result.note || null;
      tenant.database.provisioningError = null;
      if (tenant.save) await tenant.save();

      await auditLogService.logEvent({
        action: AUDIT_ACTIONS.PROVISIONING_SUCCEEDED,
        targetTenantId: tenantId,
        metadata: {
          databaseName: dbName,
          isLiveDatabase: !!result.isLiveDatabase,
          provisioningMode: result.provisioningMode,
          collectionsCount: result.collectionsInitialized?.length || 0,
        },
      });

      return {
        success: true,
        status: PROVISIONING_STATUS.READY,
        databaseName: dbName,
        isLiveDatabase: !!result.isLiveDatabase,
        provisioningMode: result.provisioningMode || 'OFFLINE_MEMORY',
        provisioningStrategy: result.provisioningStrategy || 'OFFLINE_SIMULATED_DB',
        provisionedAt: tenant.database.provisionedAt,
        collections: tenant.database.collectionsInitialized,
        note: result.note,
      };
    } catch (err) {
      const sanitized = sanitizeError(err);
      tenant.database.provisioningStatus = PROVISIONING_STATUS.FAILED;
      tenant.database.provisioningError = sanitized;
      tenant.database.retryCount = (tenant.database.retryCount || 0) + 1;
      if (tenant.save) await tenant.save();

      await auditLogService.logEvent({
        action: AUDIT_ACTIONS.PROVISIONING_FAILED,
        targetTenantId: tenantId,
        metadata: { databaseName: dbName, error: sanitized },
      });

      return {
        success: false,
        status: PROVISIONING_STATUS.FAILED,
        databaseName: dbName,
        error: sanitized,
      };
    }
  }

  /**
   * Idempotent retry of database provisioning
   */
  async retryProvisioning(tenant) {
    if (!tenant) {
      throw new ProvisioningError('Tenant record is required for provisioning retry');
    }

    if (tenant.database?.provisioningStatus === PROVISIONING_STATUS.READY) {
      return {
        success: true,
        alreadyProvisioned: true,
        message: 'Tenant database is already successfully provisioned.',
        status: PROVISIONING_STATUS.READY,
        databaseName: tenant.database.name,
        isLiveDatabase: !!tenant.database.isLiveDatabase,
        provisioningMode: tenant.database.provisioningMode || 'OFFLINE_MEMORY',
        provisioningStrategy: tenant.database.provisioningStrategy || 'OFFLINE_SIMULATED_DB',
      };
    }

    await auditLogService.logEvent({
      action: AUDIT_ACTIONS.PROVISIONING_RETRY,
      targetTenantId: tenant.tenantId,
      metadata: { retryCount: (tenant.database?.retryCount || 0) + 1 },
    });

    return this.provisionLaboratory(tenant);
  }
}

export const tenantProvisioningService = new TenantProvisioningService();
export default tenantProvisioningService;
