/**
 * Lab Management System (LMS) - Lab Order Model (Prepared for Phase 2)
 */

import mongoose from 'mongoose';

const OrderItemSchema = new mongoose.Schema({
  testId: { type: String, required: true },
  testName: { type: String, required: true },
  testCode: { type: String, required: true },
  sampleType: { type: String, required: true }, // e.g. 'Serum', 'Whole Blood', 'Urine'
  price: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending_collection', 'collected', 'accessioned', 'in_analysis', 'verified', 'cancelled'],
    default: 'pending_collection',
  },
});

const LabOrderSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      trim: true,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
    },
    orderingPhysician: {
      type: String,
      trim: true,
    },
    priority: {
      type: String,
      enum: ['routine', 'urgent', 'stat'],
      default: 'routine',
    },
    items: [OrderItemSchema],
    orderStatus: {
      type: String,
      enum: ['ordered', 'in_progress', 'partially_verified', 'completed', 'cancelled'],
      default: 'ordered',
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partially_paid', 'paid'],
      default: 'unpaid',
    },
    totalAmount: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

LabOrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });

export const LabOrderModel = mongoose.models.LabOrder || mongoose.model('LabOrder', LabOrderSchema);
export default LabOrderModel;
