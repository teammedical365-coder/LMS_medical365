/**
 * Lab Management System (LMS) - Tenant User Model (Logical Tenant Database)
 * 
 * Stored strictly within each laboratory's dedicated logical database (`lms_lab_<tenantId>`).
 * Never searched globally across all tenant databases.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { USER_ROLES } from '../config/constants.js';

export const UserSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Security: Never returned in queries by default
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      default: USER_ROLES.LAB_TECHNICIAN,
      index: true,
    },
    roleId: {
      type: String,
      default: null,
      index: true,
    },
    department: {
      type: String,
      trim: true,
      default: null,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'deactivated', 'deleted'],
      default: 'active',
      index: true,
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

// Compound unique index ensuring email uniqueness within the tenant database
UserSchema.index({ tenantId: 1, email: 1 }, { unique: true });

/**
 * Compare plain text password against stored hash using constant-time bcrypt
 */
UserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash || !candidatePassword) return false;
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

/**
 * Safe JSON serialization: never leak password hash, internal version, or secrets
 */
UserSchema.methods.toSafeJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.passwordHash;
  delete obj.__v;
  return {
    id: obj._id,
    userId: obj.userId,
    tenantId: obj.tenantId,
    email: obj.email,
    fullName: obj.fullName,
    role: obj.role,
    roleId: obj.roleId || null,
    department: obj.department,
    phone: obj.phone,
    isActive: obj.isActive,
    isDeleted: Boolean(obj.isDeleted),
    status: obj.status || (obj.isDeleted ? 'deleted' : obj.isActive ? 'active' : 'deactivated'),
    deletedAt: obj.deletedAt || null,
    deletedBy: obj.deletedBy || null,
    lastLoginAt: obj.lastLoginAt,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
export default UserModel;
