/**
 * Lab Management System (LMS) - Report Verification Registry Model (Master Database)
 * 
 * Stores minimal public authenticity records for released diagnostic reports.
 * 
 * SECURITY RULES:
 * 1. Tokens are cryptographically generated 48-char random hex strings.
 * 2. NEVER store patient names, MRNs, diagnostic parameter results, findings, or secrets here.
 * 3. Only public authenticity metadata is stored: labName, reportNumber, release status, releasedAt.
 */

import mongoose from 'mongoose';

export const ReportVerificationSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    labName: {
      type: String,
      required: true,
      trim: true,
    },
    reportNumber: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      default: 'released',
      trim: true,
    },
    releasedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const ReportVerificationModel =
  mongoose.models.ReportVerification ||
  mongoose.model('ReportVerification', ReportVerificationSchema);

export default ReportVerificationModel;
