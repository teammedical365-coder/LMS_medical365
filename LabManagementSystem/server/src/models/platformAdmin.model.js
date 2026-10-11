/**
 * Lab Management System (LMS) - Platform Administrator Model (Master DB)
 * 
 * Stores global platform super-administrators in the platform master database.
 * Never stores laboratory patient, clinical, or order records.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const PlatformAdminSchema = new mongoose.Schema(
  {
    adminId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Security: Never returned by default queries
    },
    role: {
      type: String,
      enum: ['super_admin', 'platform_support'],
      default: 'super_admin',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Compare plain text password against stored hash using constant-time bcrypt
 */
PlatformAdminSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash || !candidatePassword) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Safe JSON serialization: never leak password hash, internal version, or sensitive secrets
 */
PlatformAdminSchema.methods.toSafeJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.passwordHash;
  delete obj.__v;
  return {
    id: obj._id,
    adminId: obj.adminId,
    email: obj.email,
    fullName: obj.fullName,
    role: obj.role,
    isActive: obj.isActive,
    lastLoginAt: obj.lastLoginAt,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

export const PlatformAdminModel = mongoose.models.PlatformAdmin || mongoose.model('PlatformAdmin', PlatformAdminSchema);
export default PlatformAdminModel;
