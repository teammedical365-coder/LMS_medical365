/**
 * Lab Management System (LMS) - Database Connection Configuration
 * 
 * NOTE (Phase 1):
 * In Phase 1, the system runs with database integration prepared but offline.
 * No real or production database is connected, no migrations are run, and no collections are seeded.
 * Actual live MongoDB multi-tenant provisioning will be activated in a subsequent phase.
 */

import mongoose from 'mongoose';
import config from './env.js';
import { DB_CONNECTION_STATES } from './constants.js';

class DatabaseConnection {
  constructor() {
    this.isConnected = false;
    this.hasRegisteredListeners = false;
  }

  registerConnectionListeners() {
    if (this.hasRegisteredListeners) return;
    this.hasRegisteredListeners = true;

    mongoose.connection.on('connected', () => {
      this.isConnected = true;
    });

    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
    });

    mongoose.connection.on('error', () => {
      this.isConnected = false;
    });
  }

  /**
   * Sanitize error message to ensure no connection strings or passwords leak
   */
  sanitizeErrorMessage(message) {
    if (!message) return 'Unknown database error';
    return message
      .replace(/:([^@/]+)@/g, ':***@')
      .replace(/mongodb(\+srv)?:\/\/[^\s]+/gi, '[DATABASE_URI_REDACTED]');
  }

  /**
   * Connect to master MongoDB instance (when enabled by configuration)
   * Includes resilient retry with backoff for WAN / Atlas initial TLS handshakes
   */
  async connect() {
    this.registerConnectionListeners();

    if (!config.database.autoConnect) {
      console.log('ℹ️  [LMS DB] Database auto-connect is disabled in configuration. Running with offline/prepared state.');
      return { status: 'offline', message: 'Database auto-connect is disabled' };
    }

    if (!config.database.uri) {
      console.warn('⚠️  [LMS DB] No MONGODB_URI configured. Skipping connection.');
      return { status: 'skipped', message: 'No MONGODB_URI configured' };
    }

    // Reuse open connection if already connected
    if (this.isConnected && mongoose.connection.readyState === 1) {
      return {
        status: 'connected',
        host: mongoose.connection.host,
        dbName: mongoose.connection.name,
      };
    }

    // Await in-progress connection if connecting
    if (mongoose.connection.readyState === 2) {
      await new Promise((resolve) => mongoose.connection.once('open', resolve));
      this.isConnected = true;
      return {
        status: 'connected',
        host: mongoose.connection.host,
        dbName: mongoose.connection.name,
      };
    }

    const maxAttempts = 5;
    let lastError = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        console.log(`🔄 [LMS DB] Connecting to master database (${config.database.masterDbName || 'lms_master'}) [attempt ${attempt}/${maxAttempts}]...`);
        const connection = await mongoose.connect(config.database.uri, {
          dbName: config.database.masterDbName || 'lms_master',
          serverSelectionTimeoutMS: 15000,
          maxPoolSize: 10,
        });

        this.isConnected = true;
        console.log(`✅ [LMS DB] Master database connected successfully: ${connection.connection.name} on ${connection.connection.host}`);
        return {
          status: 'connected',
          host: connection.connection.host,
          dbName: connection.connection.name,
        };
      } catch (error) {
        lastError = error;
        this.isConnected = false;
        const sanitized = this.sanitizeErrorMessage(error.message);
        console.warn(`⚠️  [LMS DB] Connection attempt ${attempt}/${maxAttempts} failed: ${sanitized}`);
        if (attempt < maxAttempts) {
          const delayMs = attempt * 2000;
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    const sanitized = this.sanitizeErrorMessage(lastError?.message);
    console.error('❌ [LMS DB] Database connection failed after all attempts:', sanitized);
    throw new Error(`Database connection failed: ${sanitized}`);
  }

  /**
   * Disconnect from MongoDB instance
   */
  async disconnect() {
    if (this.isConnected || mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      this.isConnected = false;
      console.log('🔌 [LMS DB] Database disconnected.');
    }
  }

  /**
   * Get current database connection status
   */
  getStatus() {
    const readyState = mongoose.connection.readyState;
    const isLive = readyState === 1;
    this.isConnected = isLive;
    return {
      connected: isLive,
      state: DB_CONNECTION_STATES[readyState] || 'unknown',
      phase: isLive ? 'Live MongoDB Atlas Connected' : 'Prepared / Disconnected',
      dbName: isLive ? (mongoose.connection.name || config.database.masterDbName) : null,
      host: isLive ? mongoose.connection.host : null,
    };
  }
}

export const dbConnection = new DatabaseConnection();
export default dbConnection;
