/**
 * Lab Management System (LMS) - Platform Audit Event Model (Master DB)
 */

import mongoose from 'mongoose';
import { AUDIT_ACTIONS } from '../config/constants.js';

const AuditLogSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: Object.values(AUDIT_ACTIONS),
      index: true,
    },
    targetTenantId: {
      type: String,
      index: true,
      default: null,
    },
    actor: {
      type: {
        type: String,
        enum: ['super_admin', 'api_key', 'system', 'unauthenticated', 'PLATFORM_SUPER_ADMIN', 'TENANT_USER'],
        default: 'super_admin',
      },
      id: { type: String, default: null },
      email: { type: String, default: null },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

AuditLogSchema.index({ targetTenantId: 1, timestamp: -1 });

export const AuditLogModel = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
export default AuditLogModel;
