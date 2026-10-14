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
    dob: { type: String, trim: true, default: '' },
    age: { type: String, trim: true },
    gender: { type: String, enum: ['male', 'female', 'other'], required: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    bloodGroup: { type: String, trim: true, default: '' },
    orderingPhysician: { type: String, trim: true, default: '' },
    referredBy: { type: String, trim: true, default: '' },
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
    dateOfBirth: obj.dob,
    age: obj.age || '',
    gender: obj.gender,
    phone: obj.phone,
    email: obj.email,
    bloodGroup: obj.bloodGroup || '',
    orderingPhysician: obj.orderingPhysician || obj.referredBy || '',
    referredBy: obj.referredBy || obj.orderingPhysician || '',
    address: obj.address,
    medicalHistory: obj.medicalHistory,
    isActive: obj.isActive,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

// ---------------------------------------------------------------------------
// 2. Structured Test Parameter & Reference Range Schemas
// ---------------------------------------------------------------------------
export const ReferenceRangeSchema = new mongoose.Schema(
  {
    gender: {
      type: String,
      enum: ['MALE', 'FEMALE', 'BOTH'],
      default: 'BOTH',
    },
    ageMinDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    ageMaxDays: {
      type: Number,
      default: 47450, // ~130 years
      min: 0,
    },
    lowNormal: { type: Number, default: null },
    highNormal: { type: Number, default: null },
    criticalLow: { type: Number, default: null },
    criticalHigh: { type: Number, default: null },
    textRange: { type: String, default: null },
  },
  { _id: false }
);

export const TestParameterSchema = new mongoose.Schema(
  {
    parameterCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      default: '',
      trim: true,
    },
    resultType: {
      type: String,
      enum: ['NUMERIC', 'TEXT', 'OPTIONS'],
      default: 'NUMERIC',
    },
    options: {
      type: [String],
      default: [],
    },
    referenceRanges: {
      type: [ReferenceRangeSchema],
      default: [],
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 3. Lab Order Schema
// ---------------------------------------------------------------------------
const ParameterResultSchema = new mongoose.Schema(
  {
    parameterCode: { type: String, required: true },
    name: { type: String, default: '' },
    resultType: {
      type: String,
      enum: ['NUMERIC', 'TEXT', 'OPTIONS'],
      default: 'TEXT',
    },
    value: { type: mongoose.Schema.Types.Mixed, required: true },
    unit: { type: String, default: '' },
    referenceRange: { type: String, default: '' },
    isAbnormal: { type: Boolean, default: false },
    flag: { type: String, default: null },
    enteredAt: { type: Date, default: Date.now },
    enteredBy: { type: String, default: null },
  },
  { _id: false }
);

const OrderItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },
    testCode: { type: String, required: true },
    testName: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    specimenType: { type: String, default: 'Serum' },
    container: { type: String, default: 'Standard Tube' },
    sampleId: { type: String, default: null },
    barcode: { type: String, default: null },
    status: {
      type: String,
      enum: ['ordered', 'sample_collected', 'in_analysis', 'results_entered', 'completed', 'verified', 'cancelled'],
      default: 'ordered',
    },
    resultValue: { type: String, default: null },
    referenceRange: { type: String, default: null },
    isAbnormal: { type: Boolean, default: false },
    parameters: {
      type: [TestParameterSchema],
      default: [],
    },
    parameterResults: {
      type: [ParameterResultSchema],
      default: [],
    },
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
      enum: ['ordered', 'in_progress', 'in_analysis', 'results_entered', 'completed', 'cancelled'],
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
// 4. Specimen / Sample Schema (Multi-Tube Capable)
// ---------------------------------------------------------------------------
export const SampleSchema = new mongoose.Schema(
  {
    sampleId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    barcode: { type: String, required: true, trim: true },
    orderId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true, trim: true },
    patientId: { type: String, index: true },
    patientMrn: { type: String, trim: true },
    patientName: { type: String, required: true },
    sampleType: { type: String, required: true }, // e.g. Whole Blood (EDTA), Serum, Urine
    container: { type: String, default: 'Standard Tube' }, // e.g. Lavender Top (EDTA), Gold Top (SST)
    itemIds: { type: [String], default: [] },
    testCodes: { type: [String], default: [] },
    testNames: { type: [String], default: [] },
    tubeIndex: { type: Number, default: 1 },
    totalTubes: { type: Number, default: 1 },
    collectionStatus: {
      type: String,
      enum: ['pending', 'collected', 'received', 'rejected'],
      default: 'pending',
    },
    processingStatus: {
      type: String,
      enum: ['pending', 'in_analysis', 'results_entered', 'completed', 'recollection_requested'],
      default: 'pending',
    },
    collectedAt: { type: Date, default: null },
    collectedBy: { type: String, default: null },
    receivedAt: { type: Date, default: null },
    receivedBy: { type: String, default: null },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: String, default: null },
    rejectionReason: { type: String, default: null },
    rejectionNotes: { type: String, default: null },
    rejectedAt: { type: Date, default: null },
    rejectedBy: { type: String, default: null },
    recollectionTaskId: { type: String, default: null },
    parameterResults: {
      type: [ParameterResultSchema],
      default: [],
    },
    findings: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

SampleSchema.index({ tenantId: 1, barcode: 1 }, { unique: true });
SampleSchema.index({ tenantId: 1, orderId: 1 });

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
    patientId: obj.patientId,
    patientMrn: obj.patientMrn,
    patientName: obj.patientName,
    sampleType: obj.sampleType,
    container: obj.container,
    itemIds: obj.itemIds || [],
    testCodes: obj.testCodes || [],
    testNames: obj.testNames || [],
    tubeIndex: obj.tubeIndex || 1,
    totalTubes: obj.totalTubes || 1,
    collectionStatus: obj.collectionStatus,
    processingStatus: obj.processingStatus,
    collectedAt: obj.collectedAt,
    collectedBy: obj.collectedBy,
    receivedAt: obj.receivedAt,
    receivedBy: obj.receivedBy,
    verifiedAt: obj.verifiedAt,
    verifiedBy: obj.verifiedBy,
    rejectionReason: obj.rejectionReason,
    rejectionNotes: obj.rejectionNotes,
    rejectedAt: obj.rejectedAt,
    rejectedBy: obj.rejectedBy,
    recollectionTaskId: obj.recollectionTaskId,
    parameterResults: obj.parameterResults || [],
    findings: obj.findings || '',
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

// ---------------------------------------------------------------------------
// 5. Specimen Recollection Task Schema
// ---------------------------------------------------------------------------
export const RecollectionTaskSchema = new mongoose.Schema(
  {
    taskId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, index: true },
    orderNumber: { type: String, required: true },
    rejectedSampleId: { type: String, required: true, index: true },
    rejectedBarcode: { type: String, required: true },
    patientId: { type: String, default: '' },
    patientName: { type: String, required: true },
    patientMrn: { type: String, default: '' },
    sampleType: { type: String, required: true },
    container: { type: String, default: 'Standard Tube' },
    testCodes: { type: [String], default: [] },
    testNames: { type: [String], default: [] },
    reason: { type: String, required: true },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'recollected', 'resolved', 'cancelled'],
      default: 'pending',
    },
    requestedBy: { type: String, default: 'Lab Staff' },
    recollectedSampleId: { type: String, default: null },
    recollectedBarcode: { type: String, default: null },
    recollectedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

RecollectionTaskSchema.index({ tenantId: 1, taskId: 1 }, { unique: true });
RecollectionTaskSchema.index({ tenantId: 1, rejectedSampleId: 1 });

RecollectionTaskSchema.methods.toSafeJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.__v;
  return {
    id: obj._id,
    taskId: obj.taskId,
    tenantId: obj.tenantId,
    orderId: obj.orderId,
    orderNumber: obj.orderNumber,
    rejectedSampleId: obj.rejectedSampleId,
    rejectedBarcode: obj.rejectedBarcode,
    patientId: obj.patientId,
    patientName: obj.patientName,
    patientMrn: obj.patientMrn,
    sampleType: obj.sampleType,
    container: obj.container,
    testCodes: obj.testCodes || [],
    testNames: obj.testNames || [],
    reason: obj.reason,
    notes: obj.notes,
    status: obj.status,
    requestedBy: obj.requestedBy,
    recollectedSampleId: obj.recollectedSampleId,
    recollectedBarcode: obj.recollectedBarcode,
    recollectedAt: obj.recollectedAt,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

// ---------------------------------------------------------------------------
// 6. Test Catalog Item Schema
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
    container: { type: String, default: 'Standard Tube' },
    price: { type: Number, required: true, default: 0 },
    turnaroundHours: { type: Number, default: 24 },
    referenceRange: { type: String, default: 'Standard clinical reference range' },
    parameters: {
      type: [TestParameterSchema],
      default: [],
    },
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
    container: obj.container,
    price: obj.price,
    turnaroundHours: obj.turnaroundHours,
    referenceRange: obj.referenceRange,
    parameters: obj.parameters || [],
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
    items: { type: Array, default: [] },
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
    rejectionHistory: { type: Array, default: [] },
    verifiedAt: { type: Date, default: null },
    verificationNotes: { type: String, default: null },
    releasedAt: { type: Date, default: null },
    verificationToken: { type: String, default: null, sparse: true, index: true },
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
    items: obj.items || [],
    findings: obj.findings,
    status: obj.status,
    draftedBy: obj.draftedBy,
    reviewedBy: obj.reviewedBy,
    releasedBy: obj.releasedBy,
    rejectionReason: obj.rejectionReason,
    rejectionHistory: obj.rejectionHistory || [],
    verifiedAt: obj.verifiedAt,
    verificationNotes: obj.verificationNotes,
    releasedAt: obj.releasedAt,
    verificationToken: obj.verificationToken || null,
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
    method: {
      type: String,
      enum: ['cash', 'card', 'bank_transfer', 'cheque', 'upi', 'split'],
      default: 'card',
    },
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

// ---------------------------------------------------------------------------
// 7. Test Category Schema
// ---------------------------------------------------------------------------
export const TestCategorySchema = new mongoose.Schema(
  {
    categoryId: { type: String, required: true, index: true },
    tenantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    department: { type: String, default: 'Clinical Pathology' },
    description: { type: String, default: '' },
  },
  { timestamps: true }
);

TestCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

TestCategorySchema.methods.toSafeJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.__v;
  return {
    id: obj._id,
    categoryId: obj.categoryId,
    tenantId: obj.tenantId,
    name: obj.name,
    department: obj.department,
    description: obj.description,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
};

