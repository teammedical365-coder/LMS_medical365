/**
 * Lab Management System (LMS) - Platform Audit Event Service
 * 
 * Records critical platform management actions without leaking sensitive credentials,
 * passwords, tokens, or connection strings.
 */

import crypto from 'crypto';
import AuditLogModel from '../models/auditLog.model.js';
import dbConnection from '../config/db.js';
import logger from '../utils/logger.js';

class AuditLogService {
  constructor() {
    // In-memory fallback ring buffer (holds recent 100 events when DB is offline or in memory mode)
    this.memoryBuffer = [];
    this.maxBufferSize = 100;
  }

  /**
   * Sanitize metadata to guarantee zero secrets or credentials leak into audit stores
   */
  sanitizeMetadata(metadata = {}) {
    if (!metadata || typeof metadata !== 'object') return {};
    const sanitized = {};
    const disallowedKeys = [
      'password', 'passwordhash', 'secret', 'jwt', 'token', 'authorization',
      'key', 'apikey', 'dbconnectionstring', 'uri', 'connectionstring'
    ];

    for (const [k, v] of Object.entries(metadata)) {
      const lowerKey = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (disallowedKeys.some((blocked) => lowerKey.includes(blocked))) {
        sanitized[k] = '[REDACTED]';
      } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
        sanitized[k] = this.sanitizeMetadata(v);
      } else {
        sanitized[k] = v;
      }
    }
    return sanitized;
  }

  /**
   * Log a platform administration event
   */
  async logEvent({ action, targetTenantId = null, actor = {}, metadata = {}, req = null }) {
    const eventId = `evt_${crypto.randomBytes(8).toString('hex')}`;
    const cleanMetadata = this.sanitizeMetadata(metadata);

    const eventData = {
      eventId,
      action,
      targetTenantId,
      actor: {
        type: actor.type || (actor.id ? 'super_admin' : 'api_key'),
        id: actor.id || null,
        email: actor.email || null,
      },
      metadata: cleanMetadata,
      ipAddress: req?.ip || req?.socket?.remoteAddress || null,
      userAgent: req ? req.get('user-agent') : null,
      timestamp: new Date(),
    };

    // Store in memory ring buffer
    this.memoryBuffer.unshift(eventData);
    if (this.memoryBuffer.length > this.maxBufferSize) {
      this.memoryBuffer.pop();
    }

    // Persist to MongoDB if active
    if (dbConnection.getStatus().connected) {
      try {
        await AuditLogModel.create(eventData);
      } catch (err) {
        logger.warn('Failed to persist audit log to MongoDB, preserved in memory buffer', { error: err.message });
      }
    }

    logger.info(`[AUDIT] Action: ${action} | Tenant: ${targetTenantId || 'N/A'} | EventId: ${eventId}`);
    return eventData;
  }

  /**
   * Convenience alias for authentication and user management events
   */
  async recordEvent({ action, targetTenantId = null, actorType = 'SYSTEM', actorId = null, actorEmail = null, resource = null, details = {} } = {}) {
    return this.logEvent({
      action,
      targetTenantId,
      actor: {
        type: actorType,
        id: actorId,
        email: actorEmail,
      },
      metadata: {
        resource,
        ...details,
      },
    });
  }

  /**
   * Retrieve recent audit logs with pagination
   */
  async getAuditLogs({ tenantId = null, limit = 20, page = 1 } = {}) {
    const skip = (page - 1) * limit;

    if (dbConnection.getStatus().connected) {
      const query = tenantId ? { targetTenantId: tenantId } : {};
      const [items, total] = await Promise.all([
        AuditLogModel.find(query).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
        AuditLogModel.countDocuments(query),
      ]);
      return { items, total, page, limit };
    }

    // In-memory fallback
    let filtered = this.memoryBuffer;
    if (tenantId) {
      filtered = filtered.filter((e) => e.targetTenantId === tenantId);
    }
    const total = filtered.length;
    const items = filtered.slice(skip, skip + limit);
    return { items, total, page, limit };
  }
}

export const auditLogService = new AuditLogService();
export default auditLogService;
