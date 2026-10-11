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
   * Retrieve recent audit logs with pagination and filters
   */
  async getAuditLogs({ tenantId = null, action = null, startDate = null, endDate = null, limit = 20, page = 1 } = {}) {
    const cleanLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const cleanPage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (cleanPage - 1) * cleanLimit;

    if (dbConnection.getStatus().connected) {
      const query = {};
      if (tenantId) {
        query.targetTenantId = tenantId;
      }
      if (action && typeof action === 'string' && action.trim()) {
        query.action = action.trim();
      }
      if (startDate || endDate) {
        query.timestamp = {};
        if (startDate) {
          const s = new Date(startDate);
          if (!isNaN(s.getTime())) query.timestamp.$gte = s;
        }
        if (endDate) {
          const e = new Date(endDate);
          if (!isNaN(e.getTime())) {
            if (typeof endDate === 'string' && endDate.length <= 10) {
              e.setUTCHours(23, 59, 59, 999);
            }
            query.timestamp.$lte = e;
          }
        }
      }

      const [items, total] = await Promise.all([
        AuditLogModel.find(query).sort({ timestamp: -1 }).skip(skip).limit(cleanLimit).lean(),
        AuditLogModel.countDocuments(query),
      ]);

      const sanitizedItems = items.map((it) => sanitizeAuditRecord(it));
      const totalPages = Math.ceil(total / cleanLimit) || 1;

      return {
        items: sanitizedItems,
        total,
        page: cleanPage,
        limit: cleanLimit,
        totalPages,
      };
    }

    // In-memory fallback
    let filtered = [...this.memoryBuffer];
    if (tenantId) {
      filtered = filtered.filter((e) => e.targetTenantId === tenantId);
    }
    if (action && typeof action === 'string' && action.trim()) {
      filtered = filtered.filter((e) => e.action === action.trim());
    }
    if (startDate) {
      const s = new Date(startDate);
      if (!isNaN(s.getTime())) {
        filtered = filtered.filter((e) => new Date(e.timestamp) >= s);
      }
    }
    if (endDate) {
      const e = new Date(endDate);
      if (!isNaN(e.getTime())) {
        if (typeof endDate === 'string' && endDate.length <= 10) {
          e.setUTCHours(23, 59, 59, 999);
        }
        filtered = filtered.filter((e) => new Date(e.timestamp) <= e);
      }
    }

    const total = filtered.length;
    const items = filtered.slice(skip, skip + cleanLimit).map((it) => sanitizeAuditRecord(it));
    const totalPages = Math.ceil(total / cleanLimit) || 1;

    return {
      items,
      total,
      page: cleanPage,
      limit: cleanLimit,
      totalPages,
    };
  }

  /**
   * Retrieve unique audit action types for filter dropdown
   */
  async getDistinctActions(tenantId = null) {
    if (dbConnection.getStatus().connected) {
      try {
        const query = tenantId ? { targetTenantId: tenantId } : {};
        const distinct = await AuditLogModel.distinct('action', query);
        return distinct.filter(Boolean).sort();
      } catch (err) {
        logger.warn('Failed to query distinct audit actions from DB', { error: err.message });
      }
    }

    let filtered = this.memoryBuffer;
    if (tenantId) {
      filtered = filtered.filter((e) => e.targetTenantId === tenantId);
    }
    return Array.from(new Set(filtered.map((e) => e.action))).filter(Boolean).sort();
  }
}

/**
 * Strips secrets, tokens, patient demographics, and sensitive findings from audit record before return
 */
export function sanitizeAuditRecord(record) {
  if (!record) return null;
  const rawMeta = typeof record.metadata === 'object' && record.metadata !== null ? record.metadata : {};
  const meta = { ...rawMeta };

  // Strip sensitive fields
  const sensitiveKeys = [
    'password', 'passwordhash', 'secret', 'jwt', 'token', 'authorization',
    'key', 'apikey', 'dbconnectionstring', 'uri', 'connectionstring',
    'verificationtoken', 'patientname', 'patientmrn', 'dob', 'phone', 'address',
    'gender', 'findings', 'parameterresults', 'resultvalue', 'clinicalnotes',
    'rejectionnotes', 'notes'
  ];

  for (const k of Object.keys(meta)) {
    const normalized = k.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (sensitiveKeys.some((blocked) => normalized.includes(blocked))) {
      delete meta[k];
    }
  }

  // Derive human-readable resource reference
  const resource =
    rawMeta.reportNumber || rawMeta.reportId ||
    rawMeta.orderNumber || rawMeta.orderId ||
    rawMeta.invoiceNumber || rawMeta.invoiceId ||
    rawMeta.barcode || rawMeta.sampleId ||
    rawMeta.userId || rawMeta.email ||
    rawMeta.labCode || rawMeta.code ||
    rawMeta.resource || null;

  // Derive normalized outcome
  let outcome = rawMeta.outcome || rawMeta.status || null;
  if (!outcome) {
    const act = (record.action || '').toUpperCase();
    if (act.includes('SUCCESS') || act.includes('APPROVED') || act.includes('RELEASED') || act.includes('SUCCEEDED') || act.includes('ACTIVATED') || act.includes('DOWNLOADED') || act.includes('RECORDED') || act.includes('CREATED')) {
      outcome = 'success';
    } else if (act.includes('FAILED') || act.includes('ERROR')) {
      outcome = 'failed';
    } else if (act.includes('REJECTED')) {
      outcome = 'rejected';
    } else {
      outcome = 'info';
    }
  }

  return {
    eventId: record.eventId,
    action: record.action,
    targetTenantId: record.targetTenantId || null,
    actor: {
      type: record.actor?.type || 'SYSTEM',
      id: record.actor?.id || null,
      email: record.actor?.email || null,
    },
    resource,
    outcome,
    metadata: meta,
    ipAddress: record.ipAddress || null,
    userAgent: record.userAgent || null,
    timestamp: record.timestamp,
  };
}

export const auditLogService = new AuditLogService();
export default auditLogService;

