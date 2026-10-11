/**
 * Lab Management System (LMS) - Patient Model (Prepared for Phase 2)
 */

import mongoose from 'mongoose';

const PatientSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    mrn: {
      type: String,
      required: true,
      trim: true,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: {
      street: String,
      city: String,
      postalCode: String,
    },
  },
  {
    timestamps: true,
  }
);

PatientSchema.index({ tenantId: 1, mrn: 1 }, { unique: true });

export const PatientModel = mongoose.models.Patient || mongoose.model('Patient', PatientSchema);
export default PatientModel;
