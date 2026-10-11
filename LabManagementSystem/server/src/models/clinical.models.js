/**
 * Lab Management System (LMS) - Tenant-Scoped Clinical & Operational Models
 * 
 * Stored strictly within each laboratory's dedicated tenant database (`lms_lab_<tenantId>`).
 * Never stored or mixed in the platform master database.
 */

import mongoose from 'mongoose';

// ---------------------------------------------------------------------------
// 1. Patient Schema
// ---------------------------------------------------------------------------
export const PatientSchema = new mongoose.Schema(
  {
    patientId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    mrn: { type: String, required: true, trim: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    dob: { type: String, required: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    medicalHistory: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

PatientSchema.index({ tenantId: 1, mrn: 1 }, { unique: true });

PatientSchema.methods.toSafeJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.__v;
  return {
    id: obj._id,
    patientId: obj.patientId,
    tenantId: obj.tenantId,
    mrn: obj.mrn,
    firstName: obj.firstName,
    lastName: obj.lastName,
    fullName: `${obj.firstName} ${obj.lastName}`,
    dob: obj.dob,
    gender: obj.gender,
    phone: obj.phone,
    email: obj.email,
    address: obj.address,
    medicalHistory: obj.medicalHistory,
    isActive: obj.isActive,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

// ---------------------------------------------------------------------------
// 2. Lab Order Schema
// ---------------------------------------------------------------------------
const OrderItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },
    testCode: { type: String, required: true },
    testName: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    status: {
      type: String,
      enum: ['ordered', 'sample_collected', 'in_analysis', 'verified', 'cancelled'],
      default: 'ordered',
    },
    resultValue: { type: String, default: null },
    referenceRange: { type: String, default: null },
    isAbnormal: { type: Boolean, default: false },
  },
  { _id: false }
);

export const LabOrderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true, trim: true },
    patientId: { type: String, required: true, index: true },
    patientName: { type: String, required: true, trim: true },
    patientMrn: { type: String, required: true, trim: true },
    orderingPhysician: { type: String, trim: true },
    priority: { type: String, enum: ['routine', 'urgent', 'stat'], default: 'routine' },
    items: [OrderItemSchema],
    totalAmount: { type: Number, required: true, default: 0 },
    paidAmount: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partially_paid', 'paid'],
      default: 'unpaid',
    },
    orderStatus: {
      type: String,
      enum: ['ordered', 'in_progress', 'completed', 'cancelled'],
      default: 'ordered',
    },
    createdBy: { type: String, default: 'staff' },
  },
  { timestamps: true }
);

LabOrderSchema.index({ tenantId: 1, orderNumber: 1 }, { unique: true });

LabOrderSchema.methods.toSafeJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.__v;
  return {
    id: obj._id,
    orderId: obj.orderId,
    tenantId: obj.tenantId,
    orderNumber: obj.orderNumber,
    patientId: obj.patientId,
    patientName: obj.patientName,
    patientMrn: obj.patientMrn,
    orderingPhysician: obj.orderingPhysician,
    priority: obj.priority,
    items: obj.items,
    totalAmount: obj.totalAmount,
    paidAmount: obj.paidAmount,
    balance: Math.max(0, obj.totalAmount - obj.paidAmount),
    paymentStatus: obj.paymentStatus,
    orderStatus: obj.orderStatus,
    createdBy: obj.createdBy,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

// ---------------------------------------------------------------------------
// 3. Specimen / Sample Schema
// ---------------------------------------------------------------------------
export const SampleSchema = new mongoose.Schema(
  {
    sampleId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    barcode: { type: String, required: true, trim: true },
    orderId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true, trim: true },
    patientName: { type: String, required: true },
    sampleType: { type: String, required: true }, // e.g. Whole Blood, Serum, Urine
    container: { type: String, default: 'Standard Tube' },
    collectionStatus: {
      type: String,
      enum: ['pending', 'collected', 'received', 'rejected'],
      default: 'pending',
    },
    processingStatus: {
      type: String,
      enum: ['pending', 'in_analysis', 'completed'],
      default: 'pending',
    },
    collectedAt: { type: Date, default: null },
    collectedBy: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: String, default: null },
    rejectionReason: { type: String, default: null },
  },
  { timestamps: true }
);

SampleSchema.index({ tenantId: 1, barcode: 1 }, { unique: true });

SampleSchema.methods.toSafeJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.__v;
  return {
    id: obj._id,
    sampleId: obj.sampleId,
    tenantId: obj.tenantId,
    barcode: obj.barcode,
    orderId: obj.orderId,
    orderNumber: obj.orderNumber,
    patientName: obj.patientName,
    sampleType: obj.sampleType,
    container: obj.container,
    collectionStatus: obj.collectionStatus,
    processingStatus: obj.processingStatus,
    collectedAt: obj.collectedAt,
    collectedBy: obj.collectedBy,
    verifiedAt: obj.verifiedAt,
    verifiedBy: obj.verifiedBy,
    rejectionReason: obj.rejectionReason,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

// ---------------------------------------------------------------------------
// 4. Test Catalog Item Schema
// ---------------------------------------------------------------------------
export const TestCatalogSchema = new mongoose.Schema(
  {
    testId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    code: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    category: { type: String, default: 'General' },
    department: { type: String, default: 'Clinical Pathology' },
    specimenType: { type: String, default: 'Serum' },
    price: { type: Number, required: true, default: 0 },
    turnaroundHours: { type: Number, default: 24 },
    referenceRange: { type: String, default: 'Standard clinical reference range' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

TestCatalogSchema.index({ tenantId: 1, code: 1 }, { unique: true });

TestCatalogSchema.methods.toSafeJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.__v;
  return {
    id: obj._id,
    testId: obj.testId,
    tenantId: obj.tenantId,
    code: obj.code,
    name: obj.name,
    category: obj.category,
    department: obj.department,
    specimenType: obj.specimenType,
    price: obj.price,
    turnaroundHours: obj.turnaroundHours,
    referenceRange: obj.referenceRange,
    isActive: obj.isActive,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

// ---------------------------------------------------------------------------
// 5. Diagnostic Pathology Report Schema
// ---------------------------------------------------------------------------
export const DiagnosticReportSchema = new mongoose.Schema(
  {
    reportId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    reportNumber: { type: String, required: true, trim: true },
    orderId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true, trim: true },
    patientName: { type: String, required: true },
    patientMrn: { type: String, required: true },
    testName: { type: String, required: true },
    findings: { type: String, default: 'Specimen processed normally without pathological flags.' },
    status: {
      type: String,
      enum: ['draft', 'pending_review', 'approved', 'released', 'rejected'],
      default: 'draft',
    },
    draftedBy: { type: String, default: 'Lab Technician' },
    reviewedBy: { type: String, default: null },
    releasedBy: { type: String, default: null },
    rejectionReason: { type: String, default: null },
    releasedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

DiagnosticReportSchema.index({ tenantId: 1, reportNumber: 1 }, { unique: true });

DiagnosticReportSchema.methods.toSafeJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.__v;
  return {
    id: obj._id,
    reportId: obj.reportId,
    tenantId: obj.tenantId,
    reportNumber: obj.reportNumber,
    orderId: obj.orderId,
    orderNumber: obj.orderNumber,
    patientName: obj.patientName,
    patientMrn: obj.patientMrn,
    testName: obj.testName,
    findings: obj.findings,
    status: obj.status,
    draftedBy: obj.draftedBy,
    reviewedBy: obj.reviewedBy,
    releasedBy: obj.releasedBy,
    rejectionReason: obj.rejectionReason,
    releasedAt: obj.releasedAt,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

// ---------------------------------------------------------------------------
// 6. Billing Invoice Schema
// ---------------------------------------------------------------------------
const PaymentRecordSchema = new mongoose.Schema(
  {
    paymentId: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, enum: ['cash', 'card', 'insurance', 'online'], default: 'card' },
    reference: { type: String, default: null },
    receivedBy: { type: String, default: 'Accountant' },
    paidAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

export const InvoiceSchema = new mongoose.Schema(
  {
    invoiceId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    invoiceNumber: { type: String, required: true, trim: true },
    orderId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true, trim: true },
    patientName: { type: String, required: true },
    totalAmount: { type: Number, required: true, default: 0 },
    paidAmount: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['unpaid', 'partially_paid', 'paid', 'refunded'],
      default: 'unpaid',
    },
    payments: [PaymentRecordSchema],
  },
  { timestamps: true }
);

InvoiceSchema.index({ tenantId: 1, invoiceNumber: 1 }, { unique: true });

InvoiceSchema.methods.toSafeJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.__v;
  return {
    id: obj._id,
    invoiceId: obj.invoiceId,
    tenantId: obj.tenantId,
    invoiceNumber: obj.invoiceNumber,
    orderId: obj.orderId,
    orderNumber: obj.orderNumber,
    patientName: obj.patientName,
    totalAmount: obj.totalAmount,
    paidAmount: obj.paidAmount,
    balance: obj.balance,
    status: obj.status,
    payments: obj.payments,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};
