/**
 * Lab Management System (LMS) - Tenant Clinical & Operational Service
 * 
 * Manages clinical data strictly within each laboratory's isolated tenant database (`lms_lab_<tenantId>`).
 * 
 * SECURITY RULES:
 * 1. Scope all operations strictly to the server-verified tenantId.
 * 2. Cross-tenant queries are structurally impossible (bound to separate connection).
 * 3. Never expose clinical records to unauthorized platform users without tenant scope.
 * 4. Audit all security-sensitive actions (report approval/release, payment collection).
 * 5. Provide offline in-memory fallback for test execution.
 */

import crypto from 'crypto';
import tenantConnectionService from './tenantConnection.service.js';
import tenantUserService from './tenantUser.service.js';
import auditLogService from './auditLog.service.js';
import logger from '../utils/logger.js';

export class ClinicalServiceError extends Error {
  constructor(message, code = 'CLINICAL_ERROR', statusCode = 400) {
    super(message);
    this.name = 'ClinicalServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

class TenantClinicalService {
  constructor() {
    // In-memory fallback stores: tenantId -> Map<id, doc>
    this.memoryPatients = new Map();
    this.memoryOrders = new Map();
    this.memorySamples = new Map();
    this.memoryTests = new Map();
    this.memoryReports = new Map();
    this.memoryInvoices = new Map();
  }

  generateId(prefix) {
    return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
  }

  // -------------------------------------------------------------------------
  // PATIENTS MANAGEMENT (Receptionist, Lab Admin)
  // -------------------------------------------------------------------------
  async listPatients(tenantId, query = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const { search, limit = 50 } = query;
    const PatientModel = tenantConnectionService.getTenantPatientModel(tenantId);

    if (PatientModel) {
      const filter = { tenantId };
      if (search) {
        filter.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { mrn: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
        ];
      }
      const list = await PatientModel.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit, 10));
      return list.map((p) => p.toSafeJSON());
    }

    // In-memory fallback
    const tenantMap = this.memoryPatients.get(tenantId) || new Map();
    let list = Array.from(tenantMap.values());
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.firstName?.toLowerCase().includes(s) ||
          p.lastName?.toLowerCase().includes(s) ||
          p.mrn?.toLowerCase().includes(s)
      );
    }
    return list;
  }

  async createPatient(tenantId, data, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const { firstName, lastName, dob, gender, phone, email, address, medicalHistory } = data;

    if (!firstName || !lastName) {
      throw new ClinicalServiceError('Patient first and last names are required', 'VALIDATION_ERROR', 400);
    }
    if (!dob || !gender) {
      throw new ClinicalServiceError('Date of birth and gender are required', 'VALIDATION_ERROR', 400);
    }

    const PatientModel = tenantConnectionService.getTenantPatientModel(tenantId);
    const patientId = this.generateId('pat');
    const mrn = `MRN-${Date.now().toString().slice(-6)}`;

    if (PatientModel) {
      const doc = new PatientModel({
        patientId,
        tenantId,
        mrn,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dob,
        gender,
        phone: phone?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        address: address?.trim() || null,
        medicalHistory: medicalHistory?.trim() || null,
      });
      await doc.save();
      return doc.toSafeJSON();
    }

    // In-memory fallback
    if (!this.memoryPatients.has(tenantId)) this.memoryPatients.set(tenantId, new Map());
    const mock = {
      patientId,
      tenantId,
      mrn,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fullName: `${firstName.trim()} ${lastName.trim()}`,
      dob,
      gender,
      phone,
      email,
      address,
      medicalHistory,
      createdAt: new Date(),
      toSafeJSON() {
        return { ...this };
      },
    };
    this.memoryPatients.get(tenantId).set(patientId, mock);
    return mock;
  }

  async getPatientById(tenantId, patientId) {
    await tenantUserService.assertTenantReady(tenantId);
    const PatientModel = tenantConnectionService.getTenantPatientModel(tenantId);

    if (PatientModel) {
      const doc = await PatientModel.findOne({
        tenantId,
        $or: [{ patientId }, { mrn: patientId }],
      });
      return doc ? doc.toSafeJSON() : null;
    }

    const tenantMap = this.memoryPatients.get(tenantId);
    if (!tenantMap) return null;
    const direct = tenantMap.get(patientId);
    if (direct) return direct.toSafeJSON ? direct.toSafeJSON() : direct;
    for (const p of tenantMap.values()) {
      if (p.mrn === patientId || p.patientId === patientId) {
        return p.toSafeJSON ? p.toSafeJSON() : p;
      }
    }
    return null;
  }

  // -------------------------------------------------------------------------
  // LAB ORDERS MANAGEMENT (Receptionist, Lab Admin)
  // -------------------------------------------------------------------------
  async listOrders(tenantId, query = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const { status, priority, search, limit = 50 } = query;
    const OrderModel = tenantConnectionService.getTenantOrderModel(tenantId);

    if (OrderModel) {
      const filter = { tenantId };
      if (status) filter.orderStatus = status;
      if (priority) filter.priority = priority;
      if (search) {
        filter.$or = [
          { orderNumber: { $regex: search, $options: 'i' } },
          { patientName: { $regex: search, $options: 'i' } },
          { patientMrn: { $regex: search, $options: 'i' } },
        ];
      }
      const list = await OrderModel.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit, 10));
      return list.map((o) => o.toSafeJSON());
    }

    // In-memory fallback
    const tenantMap = this.memoryOrders.get(tenantId) || new Map();
    let list = Array.from(tenantMap.values());
    if (status) list = list.filter((o) => o.orderStatus === status);
    if (priority) list = list.filter((o) => o.priority === priority);
    return list;
  }

  async createOrder(tenantId, data, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const { patientId, priority = 'routine' } = data;

    const orderItems = (Array.isArray(data.items) && data.items.length > 0)
      ? data.items
      : (Array.isArray(data.tests) ? data.tests : []);

    let resolvedPatientName = data.patientName;
    let resolvedPatientMrn = data.patientMrn;

    if (!resolvedPatientName && patientId) {
      try {
        const p = await this.getPatientById(tenantId, patientId);
        if (p) {
          resolvedPatientName = p.fullName || `${p.firstName} ${p.lastName}`;
          resolvedPatientMrn = p.mrn;
        }
      } catch {}
    }

    if (!patientId || !resolvedPatientName) {
      throw new ClinicalServiceError('Patient identity is required for requisition order', 'VALIDATION_ERROR', 400);
    }
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      throw new ClinicalServiceError('At least one laboratory test item must be specified', 'VALIDATION_ERROR', 400);
    }

    const orderId = this.generateId('ord');
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;

    // Fetch test catalog to resolve server-side prices when omitted
    const catalogList = await this.listTestCatalog(tenantId);
    const catalogMap = new Map();
    for (const c of catalogList) {
      if (c.code) catalogMap.set(c.code.toUpperCase(), c);
    }

    const formattedItems = orderItems.map((it, idx) => {
      const codeKey = (it.testCode || it.code || '').trim().toUpperCase();
      const catalogMatch = catalogMap.get(codeKey);
      const resolvedPrice = (it.price !== undefined && it.price !== null && !isNaN(Number(it.price)))
        ? Number(it.price)
        : (catalogMatch ? Number(catalogMatch.price) || 0 : 0);
      const resolvedName = it.testName || it.name || (catalogMatch ? catalogMatch.name : 'Diagnostic Panel');
      const resolvedRef = it.referenceRange || (catalogMatch ? catalogMatch.referenceRange : 'Normal');

      return {
        itemId: `item_${idx + 1}`,
        testCode: codeKey || `TEST-${idx + 1}`,
        testName: resolvedName,
        price: resolvedPrice,
        status: 'ordered',
        resultValue: null,
        referenceRange: resolvedRef,
        isAbnormal: false,
      };
    });

    const totalAmount = formattedItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

    const orderingPhysician = data.orderingPhysician || data.physicianName || 'Attending Physician';
    const OrderModel = tenantConnectionService.getTenantOrderModel(tenantId);

    if (OrderModel) {
      const doc = new OrderModel({
        orderId,
        tenantId,
        orderNumber,
        patientId,
        patientName: resolvedPatientName.trim(),
        patientMrn: resolvedPatientMrn || 'MRN-PENDING',
        orderingPhysician,
        priority,
        items: formattedItems,
        totalAmount,
        paidAmount: 0,
        paymentStatus: 'unpaid',
        orderStatus: 'ordered',
        createdBy: actor.email || 'Receptionist',
      });
      await doc.save();

      // Automatically create a tracking sample for this order
      await this.createSampleForOrder(tenantId, doc.toSafeJSON());
      // Automatically create a billing invoice for this order
      await this.createInvoiceForOrder(tenantId, doc.toSafeJSON());

      return doc.toSafeJSON();
    }

    // In-memory fallback
    if (!this.memoryOrders.has(tenantId)) this.memoryOrders.set(tenantId, new Map());
    const mockOrder = {
      orderId,
      tenantId,
      orderNumber,
      patientId,
      patientName: resolvedPatientName.trim(),
      patientMrn: resolvedPatientMrn || 'MRN-PENDING',
      orderingPhysician,
      priority,
      items: formattedItems,
      totalAmount,
      paidAmount: 0,
      paymentStatus: 'unpaid',
      orderStatus: 'ordered',
      createdBy: actor.email || 'Receptionist',
      createdAt: new Date(),
      toSafeJSON() {
        return { ...this };
      },
    };
    this.memoryOrders.get(tenantId).set(orderId, mockOrder);
    await this.createSampleForOrder(tenantId, mockOrder);
    await this.createInvoiceForOrder(tenantId, mockOrder);
    return mockOrder;
  }

  // -------------------------------------------------------------------------
  // SAMPLES MANAGEMENT (Phlebotomist, Lab Tech, Pathologist)
  // -------------------------------------------------------------------------
  async listSamples(tenantId, query = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const { collectionStatus, processingStatus, limit = 50 } = query;
    const SampleModel = tenantConnectionService.getTenantSampleModel(tenantId);

    if (SampleModel) {
      const filter = { tenantId };
      if (collectionStatus) filter.collectionStatus = collectionStatus;
      if (processingStatus) filter.processingStatus = processingStatus;
      const list = await SampleModel.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit, 10));
      return list.map((s) => s.toSafeJSON());
    }

    const tenantMap = this.memorySamples.get(tenantId) || new Map();
    let list = Array.from(tenantMap.values());
    if (collectionStatus) list = list.filter((s) => s.collectionStatus === collectionStatus);
    if (processingStatus) list = list.filter((s) => s.processingStatus === processingStatus);
    return list;
  }

  async createSampleForOrder(tenantId, order) {
    const sampleId = this.generateId('smp');
    const barcode = `BAR-${order.orderNumber.replace('ORD-', '')}-01`;
    const SampleModel = tenantConnectionService.getTenantSampleModel(tenantId);

    if (SampleModel) {
      const sampleDoc = new SampleModel({
        sampleId,
        tenantId,
        barcode,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        patientName: order.patientName,
        sampleType: 'Whole Blood (EDTA)',
        container: 'Lavender Top Tube',
        collectionStatus: 'pending',
        processingStatus: 'pending',
      });
      await sampleDoc.save();
      return sampleDoc.toSafeJSON();
    }

    if (!this.memorySamples.has(tenantId)) this.memorySamples.set(tenantId, new Map());
    const mock = {
      sampleId,
      tenantId,
      barcode,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      patientName: order.patientName,
      sampleType: 'Whole Blood (EDTA)',
      container: 'Lavender Top Tube',
      collectionStatus: 'pending',
      processingStatus: 'pending',
      createdAt: new Date(),
      toSafeJSON() {
        return { ...this };
      },
    };
    this.memorySamples.get(tenantId).set(sampleId, mock);
    return mock;
  }

  async updateSampleStatus(tenantId, sampleId, updates, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const { collectionStatus, processingStatus, rejectionReason } = updates;
    const SampleModel = tenantConnectionService.getTenantSampleModel(tenantId);

    if (SampleModel) {
      const sample = await SampleModel.findOne({ tenantId, $or: [{ sampleId }, { barcode: sampleId }] });
      if (!sample) throw new ClinicalServiceError('Sample not found', 'SAMPLE_NOT_FOUND', 404);

      if (processingStatus) {
        if (sample.processingStatus === 'completed' && processingStatus !== 'completed') {
          throw new ClinicalServiceError('Cannot revert status of an already completed specimen', 'INVALID_STATUS_TRANSITION', 400);
        }
        if (sample.processingStatus === 'rejected' && processingStatus !== 'rejected') {
          throw new ClinicalServiceError('Cannot alter status of a rejected specimen', 'INVALID_STATUS_TRANSITION', 400);
        }
        sample.processingStatus = processingStatus;
        if (processingStatus === 'completed') {
          sample.verifiedAt = new Date();
          sample.verifiedBy = actor.email || 'Lab Technician';
        }
      }

      if (collectionStatus) {
        sample.collectionStatus = collectionStatus;
        if (collectionStatus === 'collected') {
          sample.collectedAt = new Date();
          sample.collectedBy = actor.email || 'Phlebotomist';
        }
      }
      if (rejectionReason) sample.rejectionReason = rejectionReason;

      await sample.save();
      return sample.toSafeJSON();
    }

    const tenantMap = this.memorySamples.get(tenantId);
    const sample = tenantMap?.get(sampleId);
    if (!sample) throw new ClinicalServiceError('Sample not found', 'SAMPLE_NOT_FOUND', 404);

    if (processingStatus) {
      if (sample.processingStatus === 'completed' && processingStatus !== 'completed') {
        throw new ClinicalServiceError('Cannot revert status of an already completed specimen', 'INVALID_STATUS_TRANSITION', 400);
      }
      if (sample.processingStatus === 'rejected' && processingStatus !== 'rejected') {
        throw new ClinicalServiceError('Cannot alter status of a rejected specimen', 'INVALID_STATUS_TRANSITION', 400);
      }
      sample.processingStatus = processingStatus;
    }
    if (collectionStatus) sample.collectionStatus = collectionStatus;
    if (rejectionReason) sample.rejectionReason = rejectionReason;
    return sample;
  }

  // -------------------------------------------------------------------------
  // TEST CATALOG (Lab Admin, Pathologist, Tech)
  // -------------------------------------------------------------------------
  async listTestCatalog(tenantId, query = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const TestModel = tenantConnectionService.getTenantTestCatalogModel(tenantId);

    if (TestModel) {
      let list = await TestModel.find({ tenantId, isActive: true }).sort({ category: 1, name: 1 });
      if (list.length === 0) {
        // Seed default tests for this tenant
        await this.seedDefaultTests(tenantId);
        list = await TestModel.find({ tenantId, isActive: true }).sort({ category: 1, name: 1 });
      }
      return list.map((t) => t.toSafeJSON());
    }

    if (!this.memoryTests.has(tenantId) || this.memoryTests.get(tenantId).size === 0) {
      await this.seedDefaultTests(tenantId);
    }
    return Array.from(this.memoryTests.get(tenantId).values());
  }

  async seedDefaultTests(tenantId) {
    const defaults = [
      { code: 'CBC', name: 'Complete Blood Count with Differential', category: 'Hematology', specimenType: 'Whole Blood', price: 25.00, turnaroundHours: 4 },
      { code: 'CMP', name: 'Comprehensive Metabolic Panel (14 Tests)', category: 'Biochemistry', specimenType: 'Serum', price: 45.00, turnaroundHours: 6 },
      { code: 'LIPID', name: 'Lipid Profile (Cholesterol, HDL, LDL, Triglycerides)', category: 'Biochemistry', specimenType: 'Serum', price: 35.00, turnaroundHours: 8 },
      { code: 'TSH', name: 'Thyroid Stimulating Hormone Ultra-Sensitive', category: 'Endocrinology', specimenType: 'Serum', price: 40.00, turnaroundHours: 12 },
      { code: 'HBA1C', name: 'Hemoglobin A1c Glycated Blood Monitor', category: 'Biochemistry', specimenType: 'Whole Blood', price: 30.00, turnaroundHours: 6 },
      { code: 'URINE', name: 'Routine Urinalysis with Microscopic Examination', category: 'Urinalysis', specimenType: 'Urine', price: 20.00, turnaroundHours: 2 },
    ];

    const TestModel = tenantConnectionService.getTenantTestCatalogModel(tenantId);
    if (TestModel) {
      for (const t of defaults) {
        const testId = this.generateId('tst');
        const doc = new TestModel({ testId, tenantId, ...t, isActive: true });
        await doc.save();
      }
      return;
    }

    if (!this.memoryTests.has(tenantId)) this.memoryTests.set(tenantId, new Map());
    for (const t of defaults) {
      const testId = this.generateId('tst');
      this.memoryTests.get(tenantId).set(testId, { testId, tenantId, ...t, isActive: true, toSafeJSON() { return { ...this }; } });
    }
  }

  async createTest(tenantId, data, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const { code, name, category, department, specimenType, price, turnaroundHours, referenceRange } = data;

    if (!code || !name) {
      throw new ClinicalServiceError('Test code and descriptive name are required', 'VALIDATION_ERROR', 400);
    }

    const testId = this.generateId('tst');
    const cleanCode = code.trim().toUpperCase();
    const TestModel = tenantConnectionService.getTenantTestCatalogModel(tenantId);

    if (TestModel) {
      const existing = await TestModel.findOne({ tenantId, code: cleanCode });
      if (existing) {
        throw new ClinicalServiceError(`Test with code '${cleanCode}' already exists in this catalog`, 'DUPLICATE_TEST', 409);
      }
      const doc = new TestModel({
        testId,
        tenantId,
        code: cleanCode,
        name: name.trim(),
        category: category?.trim() || 'General Pathology',
        department: department?.trim() || 'Laboratory Diagnostics',
        specimenType: specimenType?.trim() || 'Serum',
        price: Number(price) || 0,
        turnaroundHours: Number(turnaroundHours) || 24,
        referenceRange: referenceRange?.trim() || 'Standard clinical normal reference range',
        isActive: true,
      });
      await doc.save();
      return doc.toSafeJSON();
    }

    if (!this.memoryTests.has(tenantId)) this.memoryTests.set(tenantId, new Map());
    const mock = {
      testId,
      tenantId,
      code: cleanCode,
      name: name.trim(),
      category: category || 'General Pathology',
      department: department || 'Laboratory Diagnostics',
      specimenType: specimenType || 'Serum',
      price: Number(price) || 0,
      turnaroundHours: Number(turnaroundHours) || 24,
      referenceRange: referenceRange || 'Standard reference range',
      isActive: true,
      toSafeJSON() { return { ...this }; },
    };
    this.memoryTests.get(tenantId).set(testId, mock);
    return mock;
  }

  async getOrderById(tenantId, orderId) {
    await tenantUserService.assertTenantReady(tenantId);
    const OrderModel = tenantConnectionService.getTenantOrderModel(tenantId);
    if (OrderModel) {
      const doc = await OrderModel.findOne({ tenantId, $or: [{ orderId }, { orderNumber: orderId }] });
      return doc ? doc.toSafeJSON() : null;
    }
    const tenantMap = this.memoryOrders.get(tenantId);
    if (!tenantMap) return null;
    const direct = tenantMap.get(orderId);
    if (direct) return direct.toSafeJSON ? direct.toSafeJSON() : direct;
    for (const o of tenantMap.values()) {
      if (o.orderNumber === orderId || o.orderId === orderId) {
        return o.toSafeJSON ? o.toSafeJSON() : o;
      }
    }
    return null;
  }

  async recordOrderItemResult(tenantId, orderId, itemId, data, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const { resultValue, referenceRange, isAbnormal = false } = data;

    if (resultValue === undefined || resultValue === null || String(resultValue).trim() === '') {
      throw new ClinicalServiceError('Test result value must be provided and cannot be empty', 'VALIDATION_ERROR', 400);
    }

    const OrderModel = tenantConnectionService.getTenantOrderModel(tenantId);
    if (OrderModel) {
      const order = await OrderModel.findOne({ tenantId, $or: [{ orderId }, { orderNumber: orderId }] });
      if (!order) throw new ClinicalServiceError('Order not found', 'ORDER_NOT_FOUND', 404);

      const targetItem = order.items.find((it) => it.itemId === itemId || it.testCode === itemId);
      if (!targetItem) throw new ClinicalServiceError(`Test item '${itemId}' not found in order`, 'ITEM_NOT_FOUND', 404);

      targetItem.resultValue = String(resultValue).trim();
      targetItem.status = 'completed';
      targetItem.isAbnormal = Boolean(isAbnormal);
      if (referenceRange) targetItem.referenceRange = String(referenceRange).trim();

      const allDone = order.items.every((it) => it.status === 'completed' && it.resultValue);
      order.orderStatus = allDone ? 'completed' : 'in_analysis';

      await order.save();
      return order.toSafeJSON();
    }

    // In-memory fallback
    const tenantMap = this.memoryOrders.get(tenantId);
    let order = tenantMap?.get(orderId);
    if (!order && tenantMap) {
      for (const o of tenantMap.values()) {
        if (o.orderNumber === orderId) { order = o; break; }
      }
    }
    if (!order) throw new ClinicalServiceError('Order not found', 'ORDER_NOT_FOUND', 404);
    const targetItem = order.items.find((it) => it.itemId === itemId || it.testCode === itemId);
    if (!targetItem) throw new ClinicalServiceError(`Test item '${itemId}' not found in order`, 'ITEM_NOT_FOUND', 404);
    targetItem.resultValue = String(resultValue).trim();
    targetItem.status = 'completed';
    targetItem.isAbnormal = Boolean(isAbnormal);
    if (referenceRange) targetItem.referenceRange = String(referenceRange).trim();
    const allDone = order.items.every((it) => it.status === 'completed' && it.resultValue);
    order.orderStatus = allDone ? 'completed' : 'in_analysis';
    return order;
  }

  // -------------------------------------------------------------------------
  // DIAGNOSTIC REPORTS (Lab Tech, Report Reviewer / Pathologist)
  // -------------------------------------------------------------------------
  async listReports(tenantId, query = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const { status, limit = 50 } = query;
    const ReportModel = tenantConnectionService.getTenantReportModel(tenantId);

    if (ReportModel) {
      const filter = { tenantId };
      if (status) filter.status = status;
      const list = await ReportModel.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit, 10));
      return list.map((r) => r.toSafeJSON());
    }

    const tenantMap = this.memoryReports.get(tenantId) || new Map();
    let list = Array.from(tenantMap.values());
    if (status) list = list.filter((r) => r.status === status);
    return list;
  }

  async createReport(tenantId, data, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const { orderId } = data;

    let resolvedOrderNumber = data.orderNumber;
    let resolvedPatientName = data.patientName;
    let resolvedPatientMrn = data.patientMrn;
    let resolvedTestName = data.testName;

    if (orderId && (!resolvedPatientName || !resolvedTestName)) {
      try {
        const order = await this.getOrderById(tenantId, orderId);
        if (order) {
          resolvedOrderNumber = resolvedOrderNumber || order.orderNumber;
          resolvedPatientName = resolvedPatientName || order.patientName;
          resolvedPatientMrn = resolvedPatientMrn || order.patientMrn;
          resolvedTestName = resolvedTestName || order.items?.[0]?.testName || 'Diagnostic Panel';
        }
      } catch {}
    }

    if (!orderId || !resolvedPatientName || !resolvedTestName) {
      throw new ClinicalServiceError('Order, patient, and test name required for report draft', 'VALIDATION_ERROR', 400);
    }

    const reportId = this.generateId('rep');
    const reportNumber = `REP-${Date.now().toString().slice(-6)}`;
    const findings = data.findings || data.clinicalFindings || data.interpretations || 'Analyzer findings verified within reference thresholds.';
    const ReportModel = tenantConnectionService.getTenantReportModel(tenantId);

    if (ReportModel) {
      const doc = new ReportModel({
        reportId,
        tenantId,
        reportNumber,
        orderId,
        orderNumber: resolvedOrderNumber || 'ORD-GEN',
        patientName: resolvedPatientName,
        patientMrn: resolvedPatientMrn || 'MRN-GEN',
        testName: resolvedTestName,
        findings: String(findings).trim(),
        status: 'draft',
        draftedBy: actor.email || 'Lab Technician',
      });
      await doc.save();
      return doc.toSafeJSON();
    }

    if (!this.memoryReports.has(tenantId)) this.memoryReports.set(tenantId, new Map());
    const mock = {
      reportId,
      tenantId,
      reportNumber,
      orderId,
      orderNumber: resolvedOrderNumber || 'ORD-GEN',
      patientName: resolvedPatientName,
      patientMrn: resolvedPatientMrn || 'MRN-GEN',
      testName: resolvedTestName,
      findings: String(findings).trim(),
      status: 'draft',
      draftedBy: actor.email || 'Lab Technician',
      createdAt: new Date(),
      toSafeJSON() { return { ...this }; },
    };
    this.memoryReports.get(tenantId).set(reportId, mock);
    return mock;
  }

  async approveReport(tenantId, reportId, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const ReportModel = tenantConnectionService.getTenantReportModel(tenantId);

    if (ReportModel) {
      const report = await ReportModel.findOne({ tenantId, reportId });
      if (!report) throw new ClinicalServiceError('Report not found', 'REPORT_NOT_FOUND', 404);

      report.status = 'approved';
      report.reviewedBy = actor.email || 'Consultant Pathologist';
      await report.save();

      await auditLogService.recordEvent({
        action: 'REPORT_APPROVED',
        targetTenantId: tenantId,
        actorType: actor.accountType || 'TENANT_USER',
        actorEmail: actor.email,
        details: { reportId, reportNumber: report.reportNumber },
      });

      return report.toSafeJSON();
    }

    const tenantMap = this.memoryReports.get(tenantId);
    const report = tenantMap?.get(reportId);
    if (!report) throw new ClinicalServiceError('Report not found', 'REPORT_NOT_FOUND', 404);

    report.status = 'approved';
    report.reviewedBy = actor.email || 'Consultant Pathologist';
    return report;
  }

  async rejectReport(tenantId, reportId, reason, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    if (!reason || !reason.trim()) {
      throw new ClinicalServiceError('Rejection justification is required', 'VALIDATION_ERROR', 400);
    }
    const ReportModel = tenantConnectionService.getTenantReportModel(tenantId);

    if (ReportModel) {
      const report = await ReportModel.findOne({ tenantId, reportId });
      if (!report) throw new ClinicalServiceError('Report not found', 'REPORT_NOT_FOUND', 404);

      report.status = 'rejected';
      report.rejectionReason = reason.trim();
      report.reviewedBy = actor.email || 'Pathologist';
      await report.save();

      await auditLogService.recordEvent({
        action: 'REPORT_REJECTED',
        targetTenantId: tenantId,
        actorType: actor.accountType || 'TENANT_USER',
        actorEmail: actor.email,
        details: { reportId, reason },
      });

      return report.toSafeJSON();
    }

    const tenantMap = this.memoryReports.get(tenantId);
    const report = tenantMap?.get(reportId);
    if (!report) throw new ClinicalServiceError('Report not found', 'REPORT_NOT_FOUND', 404);
    report.status = 'rejected';
    report.rejectionReason = reason.trim();
    report.reviewedBy = actor.email;
    return report;
  }

  async releaseReport(tenantId, reportId, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const ReportModel = tenantConnectionService.getTenantReportModel(tenantId);

    if (ReportModel) {
      const report = await ReportModel.findOne({ tenantId, reportId });
      if (!report) throw new ClinicalServiceError('Report not found', 'REPORT_NOT_FOUND', 404);

      report.status = 'released';
      report.releasedBy = actor.email || 'Pathologist / Director';
      report.releasedAt = new Date();
      await report.save();

      await auditLogService.recordEvent({
        action: 'REPORT_RELEASED',
        targetTenantId: tenantId,
        actorType: actor.accountType || 'TENANT_USER',
        actorEmail: actor.email,
        details: { reportId, reportNumber: report.reportNumber },
      });

      return report.toSafeJSON();
    }

    const tenantMap = this.memoryReports.get(tenantId);
    const report = tenantMap?.get(reportId);
    if (!report) throw new ClinicalServiceError('Report not found', 'REPORT_NOT_FOUND', 404);

    report.status = 'released';
    report.releasedBy = actor.email;
    report.releasedAt = new Date();
    return report;
  }

  // -------------------------------------------------------------------------
  // BILLING & INVOICES (Accountant, Lab Admin)
  // -------------------------------------------------------------------------
  async createInvoiceForOrder(tenantId, order) {
    const invoiceId = this.generateId('inv');
    const invoiceNumber = `INV-${order.orderNumber.replace('ORD-', '')}`;
    const InvoiceModel = tenantConnectionService.getTenantInvoiceModel(tenantId);

    if (InvoiceModel) {
      const invoiceDoc = new InvoiceModel({
        invoiceId,
        tenantId,
        invoiceNumber,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        patientName: order.patientName,
        totalAmount: order.totalAmount,
        paidAmount: 0,
        balance: order.totalAmount,
        status: 'unpaid',
        payments: [],
      });
      await invoiceDoc.save();
      return invoiceDoc.toSafeJSON();
    }

    if (!this.memoryInvoices.has(tenantId)) this.memoryInvoices.set(tenantId, new Map());
    const mock = {
      invoiceId,
      tenantId,
      invoiceNumber,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      patientName: order.patientName,
      totalAmount: order.totalAmount,
      paidAmount: 0,
      balance: order.totalAmount,
      status: 'unpaid',
      payments: [],
      createdAt: new Date(),
      toSafeJSON() { return { ...this }; },
    };
    this.memoryInvoices.get(tenantId).set(invoiceId, mock);
    return mock;
  }

  async listInvoices(tenantId, query = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const { status, limit = 50 } = query;
    const InvoiceModel = tenantConnectionService.getTenantInvoiceModel(tenantId);

    if (InvoiceModel) {
      const filter = { tenantId };
      if (status) filter.status = status;
      const list = await InvoiceModel.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit, 10));
      return list.map((i) => i.toSafeJSON());
    }

    const tenantMap = this.memoryInvoices.get(tenantId) || new Map();
    let list = Array.from(tenantMap.values());
    if (status) list = list.filter((i) => i.status === status);
    return list;
  }

  async recordPayment(tenantId, invoiceId, paymentData, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const { amount, method = 'card', reference } = paymentData;
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      throw new ClinicalServiceError('Payment amount must be greater than zero', 'VALIDATION_ERROR', 400);
    }

    const InvoiceModel = tenantConnectionService.getTenantInvoiceModel(tenantId);
    const OrderModel = tenantConnectionService.getTenantOrderModel(tenantId);

    if (InvoiceModel) {
      const invoice = await InvoiceModel.findOne({ tenantId, invoiceId });
      if (!invoice) throw new ClinicalServiceError('Invoice not found', 'INVOICE_NOT_FOUND', 404);

      if (invoice.status === 'paid' || invoice.balance <= 0) {
        throw new ClinicalServiceError('Invoice is already fully settled', 'INVOICE_ALREADY_PAID', 400);
      }
      if (numAmount > invoice.balance) {
        throw new ClinicalServiceError(`Payment amount ($${numAmount}) exceeds outstanding invoice balance ($${invoice.balance})`, 'PAYMENT_EXCEEDS_BALANCE', 400);
      }
      if (reference && invoice.payments.some((p) => p.reference === reference)) {
        throw new ClinicalServiceError(`A payment with reference '${reference}' has already been processed`, 'DUPLICATE_PAYMENT', 409);
      }

      const paymentId = this.generateId('pay');
      invoice.paidAmount += numAmount;
      invoice.balance = Math.max(0, invoice.totalAmount - invoice.paidAmount);
      invoice.status = invoice.balance === 0 ? 'paid' : 'partially_paid';

      invoice.payments.push({
        paymentId,
        amount: numAmount,
        method,
        reference: reference || null,
        receivedBy: actor.email || 'Accountant',
        paidAt: new Date(),
      });

      await invoice.save();

      // Sync Order paymentStatus
      if (OrderModel && invoice.orderId) {
        await OrderModel.findOneAndUpdate(
          { tenantId, orderId: invoice.orderId },
          {
            $set: {
              paidAmount: invoice.paidAmount,
              paymentStatus: invoice.status,
            },
          }
        );
      }

      await auditLogService.recordEvent({
        action: 'PAYMENT_RECORDED',
        targetTenantId: tenantId,
        actorType: actor.accountType || 'TENANT_USER',
        actorEmail: actor.email,
        details: { invoiceId, invoiceNumber: invoice.invoiceNumber, amount: numAmount, method },
      });

      return invoice.toSafeJSON();
    }

    const tenantMap = this.memoryInvoices.get(tenantId);
    const invoice = tenantMap?.get(invoiceId);
    if (!invoice) throw new ClinicalServiceError('Invoice not found', 'INVOICE_NOT_FOUND', 404);

    if (invoice.status === 'paid' || invoice.balance <= 0) {
      throw new ClinicalServiceError('Invoice is already fully settled', 'INVOICE_ALREADY_PAID', 400);
    }
    if (numAmount > invoice.balance) {
      throw new ClinicalServiceError(`Payment amount ($${numAmount}) exceeds outstanding invoice balance ($${invoice.balance})`, 'PAYMENT_EXCEEDS_BALANCE', 400);
    }
    if (reference && invoice.payments.some((p) => p.reference === reference)) {
      throw new ClinicalServiceError(`A payment with reference '${reference}' has already been processed`, 'DUPLICATE_PAYMENT', 409);
    }

    const paymentId = this.generateId('pay');
    invoice.paidAmount += numAmount;
    invoice.balance = Math.max(0, invoice.totalAmount - invoice.paidAmount);
    invoice.status = invoice.balance === 0 ? 'paid' : 'partially_paid';
    invoice.payments.push({ paymentId, amount: numAmount, method, reference, receivedBy: actor.email, paidAt: new Date() });
    return invoice;
  }

  async getBillingSummary(tenantId) {
    await tenantUserService.assertTenantReady(tenantId);
    const InvoiceModel = tenantConnectionService.getTenantInvoiceModel(tenantId);

    if (InvoiceModel) {
      const invoices = await InvoiceModel.find({ tenantId });
      const totalRevenue = invoices.reduce((acc, i) => acc + (i.paidAmount || 0), 0);
      const totalOutstanding = invoices.reduce((acc, i) => acc + (i.balance || 0), 0);
      const paidCount = invoices.filter((i) => i.status === 'paid').length;
      const unpaidCount = invoices.filter((i) => i.status === 'unpaid').length;
      const partialCount = invoices.filter((i) => i.status === 'partially_paid').length;

      return {
        totalRevenue,
        totalOutstanding,
        paidCount,
        unpaidCount,
        partialCount,
        totalInvoices: invoices.length,
      };
    }

    const tenantMap = this.memoryInvoices.get(tenantId) || new Map();
    const invoices = Array.from(tenantMap.values());
    const totalRevenue = invoices.reduce((acc, i) => acc + (i.paidAmount || 0), 0);
    const totalOutstanding = invoices.reduce((acc, i) => acc + (i.balance || 0), 0);
    return {
      totalRevenue,
      totalOutstanding,
      paidCount: invoices.filter((i) => i.status === 'paid').length,
      unpaidCount: invoices.filter((i) => i.status === 'unpaid').length,
      partialCount: invoices.filter((i) => i.status === 'partially_paid').length,
      totalInvoices: invoices.length,
    };
  }

  // -------------------------------------------------------------------------
  // DASHBOARD AGGREGATED SUMMARY (Role-Specific)
  // -------------------------------------------------------------------------
  async getDashboardSummary(tenantId, role = 'lab_admin') {
    await tenantUserService.assertTenantReady(tenantId);

    const [patients, orders, samples, reports, billing] = await Promise.all([
      this.listPatients(tenantId, { limit: 10 }),
      this.listOrders(tenantId, { limit: 10 }),
      this.listSamples(tenantId, { limit: 10 }),
      this.listReports(tenantId, { limit: 10 }),
      this.getBillingSummary(tenantId),
    ]);

    const metrics = {
      totalPatients: patients.length,
      totalOrders: orders.length,
      pendingCollectionSamples: samples.filter((s) => s.collectionStatus === 'pending').length,
      inAnalysisSamples: samples.filter((s) => s.processingStatus === 'in_analysis').length,
      pendingReviewReports: reports.filter((r) => r.status === 'draft' || r.status === 'pending_review').length,
      releasedReports: reports.filter((r) => r.status === 'released').length,
      totalRevenue: billing.totalRevenue,
      totalOutstanding: billing.totalOutstanding,
    };

    return {
      role,
      metrics,
      recentPatients: patients.slice(0, 5),
      recentOrders: orders.slice(0, 5),
      recentSamples: samples.slice(0, 5),
      recentReports: reports.slice(0, 5),
    };
  }

  clearMemoryStore() {
    this.memoryPatients.clear();
    this.memoryOrders.clear();
    this.memorySamples.clear();
    this.memoryTests.clear();
    this.memoryReports.clear();
    this.memoryInvoices.clear();
  }
}

export const tenantClinicalService = new TenantClinicalService();
export default tenantClinicalService;
