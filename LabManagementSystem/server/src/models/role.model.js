/**
 * Lab Management System (LMS) - Tenant Role Model
 * 
 * Stored strictly within each laboratory's tenant database (`lms_lab_<tenantId>`).
 * Provides dynamic, customizable role definitions and granular permission assignments.
 */

import mongoose from 'mongoose';

export const RoleSchema = new mongoose.Schema(
  {
    roleId: {
      type: String,
      required: true,
      index: true,
    },
    tenantId: {
      type: String,
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    dashboardPath: {
      type: String,
      default: '/dashboard',
      trim: true,
    },
    navigationItems: {
      type: [String],
      default: ['dashboard'],
    },
    permissions: {
      type: [String],
      default: [],
    },
    isSystemDefault: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring unique role code per tenant
RoleSchema.index({ tenantId: 1, code: 1 }, { unique: true });

RoleSchema.methods.toSafeJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.__v;
  return {
    id: obj._id,
    roleId: obj.roleId,
    tenantId: obj.tenantId,
    code: obj.code,
    name: obj.name,
    description: obj.description,
    dashboardPath: obj.dashboardPath,
    navigationItems: obj.navigationItems,
    permissions: obj.permissions,
    isSystemDefault: obj.isSystemDefault,
    isActive: obj.isActive,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

export const RoleModel = mongoose.models.Role || mongoose.model('Role', RoleSchema);
export default RoleModel;
