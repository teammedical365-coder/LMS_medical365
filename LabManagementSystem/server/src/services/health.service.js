/**
 * Lab Management System (LMS) - Health Service
 */

import config from '../config/env.js';
import dbConnection from '../config/db.js';

export class HealthService {
  /**
   * Generates sanitized health information without leaking secrets or environment variables
   */
  static getHealthStatus() {
    const dbStatus = dbConnection.getStatus();

    return {
      status: 'healthy',
      system: 'Lab Management System (LMS) API',
      version: '2.0.0',
      phase: 'Phase 2 - Super Admin & Multi-Tenant Laboratory Architecture',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: config.env,
      database: {
        prepared: true,
        connected: dbStatus.connected,
        state: dbStatus.state,
        note: dbStatus.connected
          ? 'Master registry connected to MongoDB.'
          : 'Master registry operating with offline/prepared storage. Live MongoDB connections enabled via DB_AUTO_CONNECT=true.',
      },
      multiTenant: {
        strategy: config.database.strategy,
        status: 'Super Admin and Multi-Tenant Architecture Active (Phase 2)',
      },
    };
  }
}

export default HealthService;
