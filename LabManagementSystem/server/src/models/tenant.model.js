/**
 * Lab Management System (LMS) - Laboratory Tenant Model (Master Registry)
 * 
 * Master Database Responsibility:
 * Stores registered laboratories, custom domains, database provisioning state,
 * branding configurations, and lifecycle status.
 * 
 * SECURITY RULES:
 * 1. Internal tenant IDs are server-generated; never accepted from untrusted users.
 * 2. Database names are server-derived (`lms_lab_<tenantId>`).
 * 3. Never store database credentials, passwords, or secrets in this model.
 */

import mongoose from 'mongoose';
import crypto from 'crypto';
import { LAB_STATUS, PROVISIONING_STATUS } from '../config/constants.js';

/**
 * Generate a cryptographically random, predictable internal tenant identifier
 */
export function generateTenantId() {
  const randomSuffix = crypto.randomBytes(6).toString('hex');
  return `ten_${randomSuffix}`;
}

/**
 * Normalize and sanitize domain hostnames
 */
export function normalizeDomain(rawDomain) {
  if (!rawDomain || typeof rawDomain !== 'string') return null;
  // Strip protocol, port, path, and whitespace; lowercase
  let clean = rawDomain.trim().toLowerCase();
  clean = clean.replace(/^[a-z]+:\/\//, ''); // strip http:// or https://
  clean = clean.split('/')[0];               // strip path
  clean = clean.split(':')[0];               // strip port
  clean = clean.replace(/\.$/, '');          // strip trailing dot
  return clean || null;
}

export function generateDomainVerificationToken(domain, tenantId) {
  const hash = crypto.createHash('sha256').update(`${tenantId}:${domain}`).digest('hex').substring(0, 32);
  return `lms-verify-${hash}`;
}

const AddressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true, default: '' },
    city: { type: String, trim: true, default: '' },
    state: { type: String, trim: true, default: '' },
    postalCode: { type: String, trim: true, default: '' },
    country: { type: String, trim: true, default: 'US' },
  },
  { _id: false }
);

const DomainMappingSchema = new mongoose.Schema(
  {
    domain: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verifiedAt: {
      type: Date,
      default: null,
    },
    verificationToken: {
      type: String,
      default: null,
    },
    verificationMethod: {
      type: String,
      enum: ['DNS_TXT', 'DNS_CNAME', 'MANUAL_SUPER_ADMIN_PENDING'],
      default: 'DNS_TXT',
    },
    verificationError: {
      type: String,
      default: null,
    },
    lastCheckedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const DatabaseProvisioningSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    provisioningStatus: {
      type: String,
      enum: Object.values(PROVISIONING_STATUS),
      default: PROVISIONING_STATUS.NOT_STARTED,
      index: true,
    },
    provisioningStrategy: {
      type: String,
      default: 'OFFLINE_SIMULATED_DB',
    },
    isLiveDatabase: {
      type: Boolean,
      default: false,
    },
    provisioningMode: {
      type: String,
      default: 'OFFLINE_MEMORY',
    },
    note: {
      type: String,
      default: null,
    },
    provisionedAt: {
      type: Date,
      default: null,
    },
    provisioningError: {
      type: String,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    collectionsInitialized: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const BrandingSchema = new mongoose.Schema(
  {
    displayName: { type: String, default: null, trim: true },
    primaryColor: { type: String, default: '#2563EB' },
    accentColor: { type: String, default: '#22C1DC' },
    logoUrl: { type: String, default: null },
    faviconUrl: { type: String, default: null },
    loginBannerText: { type: String, default: null, trim: true },
    supportEmail: { type: String, default: null, trim: true, lowercase: true },
  },
  { _id: false }
);

const TenantSchema = new mongoose.Schema(
  {
    tenantId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      immutable: true,
    },
    code: {
      type: String,
      required: [true, 'Laboratory code is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [2, 'Laboratory code must be at least 2 characters'],
      maxlength: [30, 'Laboratory code must not exceed 30 characters'],
      match: [/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Laboratory code must be lowercase alphanumeric with optional hyphens'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Laboratory name is required'],
      trim: true,
      maxlength: [100, 'Laboratory name must not exceed 100 characters'],
    },
    legalName: {
      type: String,
      trim: true,
      default: null,
      maxlength: [120, 'Legal name must not exceed 120 characters'],
    },
    email: {
      type: String,
      required: [true, 'Contact email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid contact email address'],
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    address: {
      type: AddressSchema,
      default: () => ({}),
    },
    timezone: {
      type: String,
      default: 'UTC',
      trim: true,
    },
    locale: {
      type: String,
      default: 'en-US',
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(LAB_STATUS),
      default: LAB_STATUS.PENDING,
      index: true,
    },
    plan: {
      type: String,
      enum: ['starter', 'standard', 'enterprise'],
      default: 'standard',
    },
    branding: {
      type: BrandingSchema,
      default: () => ({}),
    },
    domains: {
      type: [DomainMappingSchema],
      default: [],
    },
    database: {
      type: DatabaseProvisioningSchema,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
TenantSchema.index({ 'domains.domain': 1 }, { sparse: true });
TenantSchema.index({ status: 1, 'database.provisioningStatus': 1 });

/**
 * Safe JSON transform: never leak internal DB connection strings or raw secrets
 */
TenantSchema.methods.toSafeJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.__v;
  // Return safe sanitized representation
  return {
    id: obj._id,
    tenantId: obj.tenantId,
    code: obj.code,
    name: obj.name,
    legalName: obj.legalName,
    email: obj.email,
    phone: obj.phone,
    address: obj.address,
    timezone: obj.timezone,
    locale: obj.locale,
    status: obj.status,
    plan: obj.plan,
    branding: obj.branding,
    domains: obj.domains,
    database: {
      provisioningStatus: obj.database?.provisioningStatus,
      provisioningStrategy: obj.database?.provisioningStrategy || 'OFFLINE_SIMULATED_DB',
      isLiveDatabase: !!obj.database?.isLiveDatabase,
      provisioningMode: obj.database?.provisioningMode || 'OFFLINE_MEMORY',
      note: obj.database?.note || null,
      provisionedAt: obj.database?.provisionedAt,
      provisioningError: obj.database?.provisioningError,
      retryCount: obj.database?.retryCount,
      collectionsInitialized: obj.database?.collectionsInitialized,
      // Note: Do not expose raw internal database connection strings
    },
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

export const TenantModel = mongoose.models.Tenant || mongoose.model('Tenant', TenantSchema);
export default TenantModel;
