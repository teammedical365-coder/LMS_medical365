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
import laboratoryManagementService from './laboratoryManagement.service.js';
import auditLogService from './auditLog.service.js';
import ReportVerificationModel from '../models/reportVerification.model.js';
import { resolveSpecimenContainer, generateBarcodeSvg, generate50x25Label } from '../utils/barcode128.js';
import { classifyResult, parseReferenceRange, isGenericReferenceRange } from '../utils/clinicalClassification.js';
import logger from '../utils/logger.js';
import { HTTP_STATUS } from '../config/constants.js';

export class ClinicalServiceError extends Error {
  constructor(message, code = 'CLINICAL_ERROR', statusCode = 400) {
    super(message);
    this.name = 'ClinicalServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const MAX_SEARCH_LENGTH = 100;

/**
 * Escapes regex metacharacters in user-supplied strings for safe MongoDB regex queries.
 * Converts characters [.*+?^${}()|[\]\\] into literal escaped characters.
 */
export function escapeRegex(string) {
  if (typeof string !== 'string') return '';
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Sanitizes and validates a search query parameter for clinical search operations.
 * - Handles empty / whitespace-only input by returning ''
 * - Enforces maximum character length of 100 characters
 * - Escapes regex metacharacters for literal matching
 */
export function sanitizeSearchQuery(input, maxLength = MAX_SEARCH_LENGTH) {
  if (input === null || input === undefined) return '';
  if (typeof input !== 'string') return '';

  const trimmed = input.trim();
  if (trimmed.length === 0) return '';

  if (trimmed.length > maxLength) {
    throw new ClinicalServiceError(
      `Search query must not exceed ${maxLength} characters`,
      'SEARCH_QUERY_TOO_LONG',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  return escapeRegex(trimmed);
}

export function isValidIanaTimezone(tz) {
  if (!tz || typeof tz !== 'string' || !tz.trim()) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch (_) {
    return false;
  }
}

export function formatTatDuration(minutes) {
  if (minutes === null || minutes === undefined || isNaN(minutes) || minutes < 0) {
    return 'N/A';
  }
  const totalMins = Math.round(minutes);
  if (totalMins < 60) {
    return `${totalMins}m`;
  }
  const hours = Math.floor(totalMins / 60);
  const remainingMins = totalMins % 60;
  if (remainingMins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMins}m`;
}

export function calculateAge(dobString) {
  if (!dobString) return '';
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return String(dobString);
  const now = new Date();
  let years = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    years--;
  }
  return years >= 0 ? `${years} Y` : '';
}

/**
 * Validates and sanitizes structured test parameter definitions and age/gender reference ranges.
 * Enforces field contracts, demographic bounds, and prevents overlapping intervals.
 */
export function validateAndSanitizeParameters(parametersInput) {
  if (!parametersInput) return [];
  if (!Array.isArray(parametersInput)) {
    throw new ClinicalServiceError('Parameters must be an array of parameter definitions', 'VALIDATION_ERROR', 400);
  }

  const seenCodes = new Set();
  const sanitized = [];

  for (let i = 0; i < parametersInput.length; i++) {
    const p = parametersInput[i];
    if (!p || typeof p !== 'object') {
      throw new ClinicalServiceError(`Parameter at index ${i} is invalid`, 'VALIDATION_ERROR', 400);
    }

    const parameterCode = String(p.parameterCode || p.code || '').trim().toUpperCase();
    if (!parameterCode) {
      throw new ClinicalServiceError(`Parameter at index ${i} requires a parameterCode`, 'VALIDATION_ERROR', 400);
    }
    if (seenCodes.has(parameterCode)) {
      throw new ClinicalServiceError(`Duplicate parameterCode '${parameterCode}' in test definition`, 'VALIDATION_ERROR', 400);
    }
    seenCodes.add(parameterCode);

    const name = String(p.name || '').trim();
    if (!name) {
      throw new ClinicalServiceError(`Parameter '${parameterCode}' requires a descriptive name`, 'VALIDATION_ERROR', 400);
    }

    const rawType = String(p.resultType || 'NUMERIC').trim().toUpperCase();
    if (!['NUMERIC', 'TEXT', 'OPTIONS'].includes(rawType)) {
      throw new ClinicalServiceError(`Parameter '${parameterCode}' has invalid resultType '${p.resultType}'. Allowed values: NUMERIC, TEXT, OPTIONS`, 'VALIDATION_ERROR', 400);
    }

    let options = [];
    if (rawType === 'OPTIONS') {
      if (!Array.isArray(p.options) || p.options.length === 0) {
        throw new ClinicalServiceError(`Parameter '${parameterCode}' of type OPTIONS must have at least one allowed option`, 'VALIDATION_ERROR', 400);
      }
      options = p.options.map((o) => String(o).trim()).filter(Boolean);
      if (options.length === 0) {
        throw new ClinicalServiceError(`Parameter '${parameterCode}' has empty allowed options`, 'VALIDATION_ERROR', 400);
      }
    }

    const unit = String(p.unit || '').trim();
    const displayOrder = Number(p.displayOrder) || i + 1;

    // Validate referenceRanges
    const rawRanges = Array.isArray(p.referenceRanges) ? p.referenceRanges : [];
    const sanitizedRanges = [];

    for (let rIdx = 0; rIdx < rawRanges.length; rIdx++) {
      const r = rawRanges[rIdx];
      if (!r || typeof r !== 'object') continue;

      const gender = String(r.gender || 'BOTH').trim().toUpperCase();
      if (!['MALE', 'FEMALE', 'BOTH'].includes(gender)) {
        throw new ClinicalServiceError(`Parameter '${parameterCode}' range #${rIdx + 1} has invalid gender '${r.gender}'`, 'VALIDATION_ERROR', 400);
      }

      const ageMinDays = r.ageMinDays !== undefined && r.ageMinDays !== null ? Number(r.ageMinDays) : 0;
      const ageMaxDays = r.ageMaxDays !== undefined && r.ageMaxDays !== null ? Number(r.ageMaxDays) : 47450;

      if (isNaN(ageMinDays) || ageMinDays < 0) {
        throw new ClinicalServiceError(`Parameter '${parameterCode}' range #${rIdx + 1}: ageMinDays must be non-negative`, 'VALIDATION_ERROR', 400);
      }
      if (isNaN(ageMaxDays) || ageMaxDays < 0) {
        throw new ClinicalServiceError(`Parameter '${parameterCode}' range #${rIdx + 1}: ageMaxDays must be non-negative`, 'VALIDATION_ERROR', 400);
      }
      if (ageMinDays > ageMaxDays) {
        throw new ClinicalServiceError(`Parameter '${parameterCode}' range #${rIdx + 1}: ageMinDays (${ageMinDays}) cannot exceed ageMaxDays (${ageMaxDays})`, 'VALIDATION_ERROR', 400);
      }

      let lowNormal = r.lowNormal !== undefined && r.lowNormal !== null && r.lowNormal !== '' ? Number(r.lowNormal) : null;
      let highNormal = r.highNormal !== undefined && r.highNormal !== null && r.highNormal !== '' ? Number(r.highNormal) : null;
      let criticalLow = r.criticalLow !== undefined && r.criticalLow !== null && r.criticalLow !== '' ? Number(r.criticalLow) : null;
      let criticalHigh = r.criticalHigh !== undefined && r.criticalHigh !== null && r.criticalHigh !== '' ? Number(r.criticalHigh) : null;

      if (lowNormal !== null && isNaN(lowNormal)) lowNormal = null;
      if (highNormal !== null && isNaN(highNormal)) highNormal = null;
      if (criticalLow !== null && isNaN(criticalLow)) criticalLow = null;
      if (criticalHigh !== null && isNaN(criticalHigh)) criticalHigh = null;

      if (lowNormal !== null && highNormal !== null && lowNormal > highNormal) {
        throw new ClinicalServiceError(`Parameter '${parameterCode}' range #${rIdx + 1}: lowNormal (${lowNormal}) cannot exceed highNormal (${highNormal})`, 'VALIDATION_ERROR', 400);
      }
      if (criticalLow !== null && lowNormal !== null && criticalLow > lowNormal) {
        throw new ClinicalServiceError(`Parameter '${parameterCode}' range #${rIdx + 1}: criticalLow (${criticalLow}) cannot exceed lowNormal (${lowNormal})`, 'VALIDATION_ERROR', 400);
      }
      if (criticalHigh !== null && highNormal !== null && criticalHigh < highNormal) {
        throw new ClinicalServiceError(`Parameter '${parameterCode}' range #${rIdx + 1}: criticalHigh (${criticalHigh}) cannot be less than highNormal (${highNormal})`, 'VALIDATION_ERROR', 400);
      }

      const textRange = r.textRange !== undefined && r.textRange !== null ? String(r.textRange).trim() : null;

      // Check overlap with prior ranges of matching gender
      for (const prior of sanitizedRanges) {
        if (prior.gender === gender) {
          const overlap = Math.max(prior.ageMinDays, ageMinDays) <= Math.min(prior.ageMaxDays, ageMaxDays);
          if (overlap) {
            throw new ClinicalServiceError(`Parameter '${parameterCode}': Overlapping age interval for gender '${gender}' between [${prior.ageMinDays}-${prior.ageMaxDays}] and [${ageMinDays}-${ageMaxDays}]`, 'VALIDATION_ERROR', 400);
          }
        }
      }

      sanitizedRanges.push({
        gender,
        ageMinDays,
        ageMaxDays,
        lowNormal,
        highNormal,
        criticalLow,
        criticalHigh,
        textRange,
      });
    }

    sanitized.push({
      parameterCode,
      name,
      unit,
      resultType: rawType,
      options,
      referenceRanges: sanitizedRanges,
      displayOrder,
    });
  }

  return sanitized;
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
    this.memoryRecollections = new Map();
    this.memoryVerifications = new Map();
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
    const sanitizedSearch = sanitizeSearchQuery(search);

    if (PatientModel) {
      const filter = { tenantId };
      if (sanitizedSearch) {
        filter.$or = [
          { firstName: { $regex: sanitizedSearch, $options: 'i' } },
          { lastName: { $regex: sanitizedSearch, $options: 'i' } },
          { mrn: { $regex: sanitizedSearch, $options: 'i' } },
          { phone: { $regex: sanitizedSearch, $options: 'i' } },
        ];
      }
      const list = await PatientModel.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit, 10));
      return list.map((p) => p.toSafeJSON());
    }

    // In-memory fallback
    const tenantMap = this.memoryPatients.get(tenantId) || new Map();
    let list = Array.from(tenantMap.values());
    if (sanitizedSearch) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (p) =>
          p.firstName?.toLowerCase().includes(s) ||
          p.lastName?.toLowerCase().includes(s) ||
          p.mrn?.toLowerCase().includes(s) ||
          p.phone?.toLowerCase().includes(s)
      );
    }
    return list;
  }

  async createPatient(tenantId, data, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const dob = data.dob || data.dateOfBirth || (data.age ? `Age: ${data.age}` : '');
    const { firstName, lastName, gender, phone, email, address, medicalHistory, bloodGroup, age } = data;

    if (!firstName || !lastName) {
      throw new ClinicalServiceError('Patient first and last names are required', 'VALIDATION_ERROR', 400);
    }
    if (!dob || !gender) {
      throw new ClinicalServiceError('Date of birth (or age) and gender are required', 'VALIDATION_ERROR', 400);
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
        age: age ? String(age).trim() : null,
        gender: (gender || 'other').toString().toLowerCase(),
        phone: phone?.trim() || null,
        email: email?.trim().toLowerCase() || null,
        bloodGroup: bloodGroup?.trim() || 'O+',
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
      dateOfBirth: dob,
      age: age ? String(age).trim() : '',
      gender,
      phone,
      email,
      bloodGroup: bloodGroup || 'O+',
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

  async registerPatientWithOrder(tenantId, data, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);

    // 1. Create Patient Demographics
    const patientData = {
      firstName: data.firstName,
      lastName: data.lastName,
      dob: data.dob || data.dateOfBirth || (data.age ? `Age: ${data.age}` : ''),
      age: data.age,
      gender: data.gender,
      phone: data.phone,
      email: data.email,
      bloodGroup: data.bloodGroup || 'O+',
      address: data.address,
      medicalHistory: data.medicalHistory,
    };
    const patient = await this.createPatient(tenantId, patientData, actor);

    // 2. Check if test items/orders are specified
    const orderItems = (Array.isArray(data.items) && data.items.length > 0)
      ? data.items
      : (Array.isArray(data.tests) ? data.tests : []);

    let order = null;
    let invoice = null;

    if (orderItems.length > 0) {
      // 3. Create Order with items, pricing, payment collection
      const orderPayload = {
        patientId: patient.patientId,
        patientName: patient.fullName || `${patient.firstName} ${patient.lastName}`,
        patientMrn: patient.mrn,
        orderingPhysician: data.orderingPhysician || data.physicianName || 'Attending Physician',
        priority: data.priority || 'routine',
        items: orderItems,
        paidAmount: data.paidAmount,
        paymentMethod: data.paymentMethod || 'cash',
        paymentReference: data.paymentReference || null,
      };

      order = await this.createOrder(tenantId, orderPayload, actor);

      // Re-fetch invoice generated for this order
      const InvoiceModel = tenantConnectionService.getTenantInvoiceModel(tenantId);
      if (InvoiceModel) {
        const invDoc = await InvoiceModel.findOne({ tenantId, orderId: order.orderId });
        if (invDoc) invoice = invDoc.toSafeJSON();
      } else if (this.memoryInvoices.has(tenantId)) {
        const invList = Array.from(this.memoryInvoices.get(tenantId).values());
        invoice = invList.find((i) => i.orderId === order.orderId) || null;
      }
    }

    return {
      patient,
      order,
      invoice,
    };
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
    const sanitizedSearch = sanitizeSearchQuery(search);

    if (OrderModel) {
      const filter = { tenantId };
      if (status) filter.orderStatus = status;
      if (priority) filter.priority = priority;
      if (sanitizedSearch) {
        filter.$or = [
          { orderNumber: { $regex: sanitizedSearch, $options: 'i' } },
          { patientName: { $regex: sanitizedSearch, $options: 'i' } },
          { patientMrn: { $regex: sanitizedSearch, $options: 'i' } },
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
    if (sanitizedSearch) {
      const s = search.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.orderNumber?.toLowerCase().includes(s) ||
          o.patientName?.toLowerCase().includes(s) ||
          o.patientMrn?.toLowerCase().includes(s)
      );
    }
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

    if ((!resolvedPatientName || !resolvedPatientMrn) && patientId) {
      try {
        const p = await this.getPatientById(tenantId, patientId);
        if (p) {
          if (!resolvedPatientName) resolvedPatientName = p.fullName || `${p.firstName} ${p.lastName}`;
          if (!resolvedPatientMrn) resolvedPatientMrn = p.mrn;
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
      const rawCatRef = catalogMatch?.referenceRange;
      const resolvedRef = (it.referenceRange && !isGenericReferenceRange(it.referenceRange))
        ? it.referenceRange
        : (rawCatRef && !isGenericReferenceRange(rawCatRef))
          ? rawCatRef
          : null;
      const resolvedDept = it.department || catalogMatch?.department || 'Clinical Pathology';

      // Immutable snapshot of structured parameters from catalog at time of requisition
      const paramSnapshot = (catalogMatch?.parameters && Array.isArray(catalogMatch.parameters) && catalogMatch.parameters.length > 0)
        ? JSON.parse(JSON.stringify(catalogMatch.parameters))
        : (Array.isArray(it.parameters) && it.parameters.length > 0 ? JSON.parse(JSON.stringify(it.parameters)) : []);

      const rawSpecimen = it.specimenType || (catalogMatch ? catalogMatch.specimenType : 'Serum');
      const rawContainer = it.container || (catalogMatch ? catalogMatch.container : null);
      const resolvedContainer = resolveSpecimenContainer(rawSpecimen, rawContainer);

      return {
        itemId: `item_${idx + 1}`,
        testCode: codeKey || `TEST-${idx + 1}`,
        testName: resolvedName,
        department: resolvedDept,
        price: resolvedPrice,
        specimenType: rawSpecimen,
        container: resolvedContainer,
        sampleId: null,
        barcode: null,
        status: 'ordered',
        resultValue: null,
        referenceRange: resolvedRef,
        isAbnormal: false,
        parameters: paramSnapshot,
      };
    });

    const totalAmount = formattedItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);

    const orderingPhysician = data.orderingPhysician || data.physicianName || 'Attending Physician';
    const OrderModel = tenantConnectionService.getTenantOrderModel(tenantId);

    // Initial payment at order creation / intake
    const initialPaid = Math.max(0, Math.min(totalAmount, Number(data.paidAmount) || 0));
    const paymentStatus = (initialPaid >= totalAmount && totalAmount > 0)
      ? 'paid'
      : (initialPaid > 0 ? 'partially_paid' : 'unpaid');
    const paymentMethod = data.paymentMethod || 'cash';
    const paymentReference = data.paymentReference || null;

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
        paidAmount: initialPaid,
        paymentStatus,
        orderStatus: 'ordered',
        createdBy: actor.email || 'Receptionist',
      });
      await doc.save();

      // Automatically derive and create multi-tube tracking samples for this order
      await this.createSamplesForOrder(tenantId, doc.toSafeJSON());
      // Automatically create a billing invoice for this order with initial payment
      await this.createInvoiceForOrder(tenantId, doc.toSafeJSON(), {
        paidAmount: initialPaid,
        paymentMethod,
        paymentReference,
        actor,
      });

      // Re-fetch to return order with linked sampleIds/barcodes
      const refreshedDoc = await OrderModel.findOne({ tenantId, orderId });
      return (refreshedDoc || doc).toSafeJSON();
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
      paidAmount: initialPaid,
      paymentStatus,
      orderStatus: 'ordered',
      createdBy: actor.email || 'Receptionist',
      createdAt: new Date(),
      toSafeJSON() {
        return { ...this };
      },
    };
    this.memoryOrders.get(tenantId).set(orderId, mockOrder);
    await this.createSamplesForOrder(tenantId, mockOrder);
    await this.createInvoiceForOrder(tenantId, mockOrder, {
      paidAmount: initialPaid,
      paymentMethod,
      paymentReference,
      actor,
    });
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

  async createSamplesForOrder(tenantId, order) {
    const SampleModel = tenantConnectionService.getTenantSampleModel(tenantId);
    const OrderModel = tenantConnectionService.getTenantOrderModel(tenantId);

    // 1. Idempotency Check: If samples already exist for this order, return existing records
    if (SampleModel) {
      const existing = await SampleModel.find({ tenantId, orderId: order.orderId }).sort({ tubeIndex: 1 });
      if (existing.length > 0) {
        return existing.map((s) => s.toSafeJSON());
      }
    } else {
      const tenantMap = this.memorySamples.get(tenantId);
      if (tenantMap) {
        const existing = Array.from(tenantMap.values())
          .filter((s) => s.orderId === order.orderId)
          .sort((a, b) => (a.tubeIndex || 1) - (b.tubeIndex || 1));
        if (existing.length > 0) {
          return existing;
        }
      }
    }

    // 2. Multi-Tube Derivation based on specimenType and container requirements
    const items = Array.isArray(order.items) && order.items.length > 0
      ? order.items
      : [{
          itemId: 'item_1',
          testCode: 'GENERAL',
          testName: 'General Specimen',
          specimenType: 'Whole Blood (EDTA)',
          container: 'Lavender Top (EDTA)',
        }];

    // Group items: tests sharing compatible specimenType and container share one tube
    const tubeGroups = new Map();
    for (const item of items) {
      const specType = (item.specimenType || 'Serum').trim();
      const cont = resolveSpecimenContainer(specType, item.container);
      const groupKey = `${specType.toLowerCase()}:::${cont.toLowerCase()}`;

      if (!tubeGroups.has(groupKey)) {
        tubeGroups.set(groupKey, {
          specimenType: specType,
          container: cont,
          items: [],
        });
      }
      tubeGroups.get(groupKey).items.push(item);
    }

    const groups = Array.from(tubeGroups.values());
    const totalTubes = groups.length;
    const cleanOrderNum = (order.orderNumber || 'ORD-000').replace('ORD-', '');
    const createdSamples = [];
    const itemToSampleMap = new Map();

    for (let i = 0; i < totalTubes; i++) {
      const group = groups[i];
      const tubeIndex = i + 1;
      const sampleId = this.generateId('smp');
      const barcode = `BAR-${cleanOrderNum}-${String(tubeIndex).padStart(2, '0')}`;
      const itemIds = group.items.map((it) => it.itemId);
      const testCodes = group.items.map((it) => it.testCode);
      const testNames = group.items.map((it) => it.testName);

      for (const it of group.items) {
        itemToSampleMap.set(it.itemId, { sampleId, barcode });
      }

      const sampleData = {
        sampleId,
        tenantId,
        barcode,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        patientId: order.patientId || '',
        patientMrn: order.patientMrn || '',
        patientName: order.patientName,
        sampleType: group.specimenType,
        container: group.container,
        itemIds,
        testCodes,
        testNames,
        tubeIndex,
        totalTubes,
        collectionStatus: 'pending',
        processingStatus: 'pending',
      };

      if (SampleModel) {
        const sampleDoc = new SampleModel(sampleData);
        await sampleDoc.save();
        createdSamples.push(sampleDoc.toSafeJSON());
      } else {
        if (!this.memorySamples.has(tenantId)) this.memorySamples.set(tenantId, new Map());
        const mock = {
          ...sampleData,
          createdAt: new Date(),
          toSafeJSON() { return { ...this }; },
        };
        this.memorySamples.get(tenantId).set(sampleId, mock);
        createdSamples.push(mock);
      }
    }

    // 3. Link sampleId and barcode onto order items
    if (OrderModel) {
      const orderDoc = await OrderModel.findOne({ tenantId, orderId: order.orderId });
      if (orderDoc && Array.isArray(orderDoc.items)) {
        for (const it of orderDoc.items) {
          const mapping = itemToSampleMap.get(it.itemId);
          if (mapping) {
            it.sampleId = mapping.sampleId;
            it.barcode = mapping.barcode;
          }
        }
        await orderDoc.save();
      }
    }

    return createdSamples;
  }

  // Backward compatibility alias for single-sample consumers
  async createSampleForOrder(tenantId, order) {
    const samples = await this.createSamplesForOrder(tenantId, order);
    return Array.isArray(samples) && samples.length > 0 ? samples[0] : samples;
  }

  async getSampleBarcodeLabel(tenantId, sampleId) {
    await tenantUserService.assertTenantReady(tenantId);
    const SampleModel = tenantConnectionService.getTenantSampleModel(tenantId);
    let sample = null;

    if (SampleModel) {
      const doc = await SampleModel.findOne({ tenantId, $or: [{ sampleId }, { barcode: sampleId }] });
      if (doc) sample = doc.toSafeJSON();
    } else {
      const tenantMap = this.memorySamples.get(tenantId);
      if (tenantMap) {
        sample = tenantMap.get(sampleId) || Array.from(tenantMap.values()).find((s) => s.barcode === sampleId);
      }
    }

    if (!sample) {
      throw new ClinicalServiceError(`Specimen '${sampleId}' not found`, 'SAMPLE_NOT_FOUND', 404);
    }

    let tenantBranding = { name: 'Laboratory' };
    try {
      const lab = await laboratoryManagementService.getLaboratoryById(tenantId);
      if (lab) tenantBranding = lab;
    } catch {}

    return generate50x25Label(sample, tenantBranding);
  }

  async getOrderBarcodeLabels(tenantId, orderId) {
    await tenantUserService.assertTenantReady(tenantId);
    const SampleModel = tenantConnectionService.getTenantSampleModel(tenantId);
    let samples = [];

    if (SampleModel) {
      const docs = await SampleModel.find({ tenantId, $or: [{ orderId }, { orderNumber: orderId }] }).sort({ tubeIndex: 1 });
      samples = docs.map((d) => d.toSafeJSON());
    } else {
      const tenantMap = this.memorySamples.get(tenantId);
      if (tenantMap) {
        samples = Array.from(tenantMap.values())
          .filter((s) => s.orderId === orderId || s.orderNumber === orderId)
          .sort((a, b) => (a.tubeIndex || 1) - (b.tubeIndex || 1));
      }
    }

    if (samples.length === 0) {
      throw new ClinicalServiceError(`No specimen tubes found for order '${orderId}'`, 'SAMPLES_NOT_FOUND', 404);
    }

    let tenantBranding = { name: 'Laboratory' };
    try {
      const lab = await laboratoryManagementService.getLaboratoryById(tenantId);
      if (lab) tenantBranding = lab;
    } catch {}

    return samples.map((s) => generate50x25Label(s, tenantBranding));
  }

  async updateSampleStatus(tenantId, sampleId, updates, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const { collectionStatus, processingStatus, rejectionReason, rejectionNotes, notes } = updates;

    const validProcessingStatuses = ['pending', 'in_analysis', 'results_entered', 'completed', 'recollection_requested'];
    const validCollectionStatuses = ['pending', 'collected', 'received', 'rejected'];

    if (processingStatus && !validProcessingStatuses.includes(processingStatus)) {
      if (processingStatus === 'received') {
        throw new ClinicalServiceError(
          "'received' is a specimen collection/receipt state, not a valid analyzer processingStatus. Use collectionStatus: 'received' to record specimen receipt.",
          'INVALID_PROCESSING_STATUS',
          400
        );
      }
      throw new ClinicalServiceError(
        `Invalid processing status: '${processingStatus}'. Valid values are: ${validProcessingStatuses.join(', ')}`,
        'INVALID_PROCESSING_STATUS',
        400
      );
    }

    if (collectionStatus && !validCollectionStatuses.includes(collectionStatus)) {
      throw new ClinicalServiceError(
        `Invalid collection status: '${collectionStatus}'. Valid values are: ${validCollectionStatuses.join(', ')}`,
        'INVALID_COLLECTION_STATUS',
        400
      );
    }

    // Strict Separation of Duties (SoD): Phlebotomists / sample_collection roles can only mark specimens as collected
    const userRole = (actor?.role || '').toLowerCase();
    const isSampleCollector = ['sample_collection', 'phlebotomist', 'sample_collector', 'phlebotomy'].includes(userRole);
    if (isSampleCollector) {
      if (processingStatus) {
        throw new ClinicalServiceError(
          'Separation of Duties (SoD) violation: Phlebotomists and sample collection personnel cannot modify analyzer processing status',
          'SOD_VIOLATION_PROCESSING',
          403
        );
      }
      if (collectionStatus && collectionStatus !== 'collected') {
        throw new ClinicalServiceError(
          'Separation of Duties (SoD) violation: Phlebotomists and sample collection personnel cannot receive or reject specimens at laboratory bench',
          'SOD_VIOLATION_RECEIPT',
          403
        );
      }
    }

    const SampleModel = tenantConnectionService.getTenantSampleModel(tenantId);
    const RecollectionModel = tenantConnectionService.getTenantRecollectionTaskModel(tenantId);

    if (SampleModel) {
      const sample = await SampleModel.findOne({ tenantId, $or: [{ sampleId }, { barcode: sampleId }] });
      if (!sample) throw new ClinicalServiceError('Sample not found', 'SAMPLE_NOT_FOUND', 404);

      if (processingStatus) {
        if (processingStatus !== 'recollection_requested' && sample.collectionStatus !== 'received') {
          throw new ClinicalServiceError(
            'Sample must be received in lab before analysis',
            'SOD_VIOLATION_UNRECEIVED_ANALYSIS',
            403
          );
        }
        if (sample.processingStatus === 'completed' && processingStatus !== 'completed') {
          throw new ClinicalServiceError('Cannot revert status of an already completed specimen', 'INVALID_STATUS_TRANSITION', 400);
        }
        if (sample.processingStatus === 'rejected' && processingStatus !== 'rejected' && processingStatus !== 'recollection_requested') {
          throw new ClinicalServiceError('Cannot alter status of a rejected specimen', 'INVALID_STATUS_TRANSITION', 400);
        }
        if (processingStatus === 'completed' && sample.processingStatus !== 'results_entered' && sample.processingStatus !== 'completed') {
          throw new ClinicalServiceError(
            'Cannot mark specimen as completed before test analyte results have been recorded. Please enter results first.',
            'RESULTS_REQUIRED_FOR_COMPLETION',
            400
          );
        }
        sample.processingStatus = processingStatus;
        if (processingStatus === 'completed') {
          sample.verifiedAt = new Date();
          sample.verifiedBy = actor.email || 'Lab Technician';
        }
      }

      if (collectionStatus) {
        if (collectionStatus === 'rejected') {
          const finalReason = (rejectionReason || updates.reason || '').trim();
          if (!finalReason) {
            throw new ClinicalServiceError('A clinical rejection reason is mandatory when rejecting a specimen', 'REJECTION_REASON_REQUIRED', 400);
          }
          sample.collectionStatus = 'rejected';
          sample.processingStatus = 'recollection_requested';
          sample.rejectionReason = finalReason;
          sample.rejectionNotes = (rejectionNotes || notes || '').trim();
          sample.rejectedAt = new Date();
          sample.rejectedBy = actor.email || 'Lab Technician';

          // Idempotent Recollection Task Creation
          if (RecollectionModel) {
            let existingTask = await RecollectionModel.findOne({ tenantId, rejectedSampleId: sample.sampleId });
            if (!existingTask) {
              const taskId = this.generateId('rec');
              const taskDoc = new RecollectionModel({
                taskId,
                tenantId,
                orderId: sample.orderId,
                orderNumber: sample.orderNumber,
                rejectedSampleId: sample.sampleId,
                rejectedBarcode: sample.barcode,
                patientId: sample.patientId || '',
                patientName: sample.patientName,
                patientMrn: sample.patientMrn || '',
                sampleType: sample.sampleType,
                container: sample.container,
                testCodes: sample.testCodes || [],
                testNames: sample.testNames || [],
                reason: finalReason,
                notes: sample.rejectionNotes,
                status: 'pending',
                requestedBy: actor.email || 'Lab Technician',
              });
              await taskDoc.save();
              sample.recollectionTaskId = taskId;
            } else {
              sample.recollectionTaskId = existingTask.taskId;
            }
          }
        } else if (collectionStatus === 'received') {
          if (sample.collectionStatus === 'received') {
            // Idempotent duplicate receipt - return safely
          } else if (sample.collectionStatus === 'rejected') {
            throw new ClinicalServiceError(
              'Cannot receive a rejected specimen without recollection',
              'INVALID_SAMPLE_STATE',
              400
            );
          } else if (sample.collectionStatus !== 'collected') {
            throw new ClinicalServiceError(
              'Specimen must be collected by phlebotomy before central laboratory receipt',
              'SOD_VIOLATION_UNCOLLECTED_SPECIMEN',
              400
            );
          } else {
            // Central receipt and triage in lab
            sample.collectionStatus = 'received';
            sample.receivedAt = new Date();
            sample.receivedBy = actor.email || 'Accessioning Technician';
          }
        } else if (collectionStatus === 'collected') {
          if (sample.collectionStatus === 'received') {
            throw new ClinicalServiceError(
              'Specimen already received in laboratory cannot revert to collected',
              'INVALID_SAMPLE_STATE',
              400
            );
          }
          sample.collectionStatus = 'collected';
          sample.collectedAt = new Date();
          sample.collectedBy = actor.email || 'Phlebotomist';
        } else {
          sample.collectionStatus = collectionStatus;
        }
      }

      await sample.save();
      return sample.toSafeJSON();
    }

    // In-memory fallback
    const tenantMap = this.memorySamples.get(tenantId);
    let sample = tenantMap?.get(sampleId);
    if (!sample && tenantMap) {
      sample = Array.from(tenantMap.values()).find((s) => s.barcode === sampleId);
    }
    if (!sample) throw new ClinicalServiceError('Sample not found', 'SAMPLE_NOT_FOUND', 404);

    if (processingStatus) {
      if (processingStatus !== 'recollection_requested' && sample.collectionStatus !== 'received') {
        throw new ClinicalServiceError(
          'Sample must be received in lab before analysis',
          'SOD_VIOLATION_UNRECEIVED_ANALYSIS',
          403
        );
      }
      if (sample.processingStatus === 'completed' && processingStatus !== 'completed') {
        throw new ClinicalServiceError('Cannot revert status of an already completed specimen', 'INVALID_STATUS_TRANSITION', 400);
      }
      if (processingStatus === 'completed' && sample.processingStatus !== 'results_entered' && sample.processingStatus !== 'completed') {
        throw new ClinicalServiceError(
          'Cannot mark specimen as completed before test analyte results have been recorded. Please enter results first.',
          'RESULTS_REQUIRED_FOR_COMPLETION',
          400
        );
      }
      sample.processingStatus = processingStatus;
    }
    if (collectionStatus) {
      if (collectionStatus === 'rejected') {
        const finalReason = (rejectionReason || updates.reason || '').trim();
        if (!finalReason) {
          throw new ClinicalServiceError('A clinical rejection reason is mandatory when rejecting a specimen', 'REJECTION_REASON_REQUIRED', 400);
        }
        sample.collectionStatus = 'rejected';
        sample.processingStatus = 'recollection_requested';
        sample.rejectionReason = finalReason;
        sample.rejectionNotes = (rejectionNotes || notes || '').trim();
        sample.rejectedAt = new Date();
        sample.rejectedBy = actor.email || 'Lab Technician';

        // In-memory recollection task
        if (!this.memoryRecollections.has(tenantId)) this.memoryRecollections.set(tenantId, new Map());
        const existingTask = Array.from(this.memoryRecollections.get(tenantId).values()).find((t) => t.rejectedSampleId === sample.sampleId);
        if (!existingTask) {
          const taskId = this.generateId('rec');
          const mockTask = {
            taskId,
            tenantId,
            orderId: sample.orderId,
            orderNumber: sample.orderNumber,
            rejectedSampleId: sample.sampleId,
            rejectedBarcode: sample.barcode,
            patientId: sample.patientId || '',
            patientName: sample.patientName,
            patientMrn: sample.patientMrn || '',
            sampleType: sample.sampleType,
            container: sample.container,
            testCodes: sample.testCodes || [],
            testNames: sample.testNames || [],
            reason: finalReason,
            notes: sample.rejectionNotes,
            status: 'pending',
            requestedBy: actor.email || 'Lab Technician',
            createdAt: new Date(),
            toSafeJSON() { return { ...this }; },
          };
          this.memoryRecollections.get(tenantId).set(taskId, mockTask);
          sample.recollectionTaskId = taskId;
        } else {
          sample.recollectionTaskId = existingTask.taskId;
        }
      } else if (collectionStatus === 'received') {
        if (sample.collectionStatus === 'received') {
          // Idempotent duplicate receipt - safe return
        } else if (sample.collectionStatus === 'rejected') {
          throw new ClinicalServiceError(
            'Cannot receive a rejected specimen without recollection',
            'INVALID_SAMPLE_STATE',
            400
          );
        } else if (sample.collectionStatus !== 'collected') {
          throw new ClinicalServiceError(
            'Specimen must be collected by phlebotomy before central laboratory receipt',
            'SOD_VIOLATION_UNCOLLECTED_SPECIMEN',
            400
          );
        } else {
          sample.collectionStatus = 'received';
          sample.receivedAt = new Date();
          sample.receivedBy = actor.email || 'Accessioning Technician';
        }
      } else if (collectionStatus === 'collected') {
        if (sample.collectionStatus === 'received') {
          throw new ClinicalServiceError(
            'Specimen already received in laboratory cannot revert to collected',
            'INVALID_SAMPLE_STATE',
            400
          );
        }
        sample.collectionStatus = 'collected';
        sample.collectedAt = new Date();
        sample.collectedBy = actor.email || 'Phlebotomist';
      } else {
        sample.collectionStatus = collectionStatus;
      }
    }

    return sample;
  }

  async recordSampleResults(tenantId, sampleId, resultData = {}, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const SampleModel = tenantConnectionService.getTenantSampleModel(tenantId);
    const OrderModel = tenantConnectionService.getTenantOrderModel(tenantId);
    const ReportModel = tenantConnectionService.getTenantReportModel(tenantId);

    let sample = null;
    if (SampleModel) {
      sample = await SampleModel.findOne({ tenantId, $or: [{ sampleId }, { barcode: sampleId }] });
    } else {
      const tenantMap = this.memorySamples.get(tenantId);
      sample = tenantMap?.get(sampleId);
      if (!sample && tenantMap) {
        sample = Array.from(tenantMap.values()).find((s) => s.barcode === sampleId);
      }
    }

    if (!sample) {
      throw new ClinicalServiceError('Sample not found', 'SAMPLE_NOT_FOUND', 404);
    }

    // Strict Sequential State Validation: Specimen MUST be received before analysis
    if (sample.collectionStatus !== 'received') {
      throw new ClinicalServiceError(
        'Sample must be received in lab before analysis',
        'SOD_VIOLATION_UNRECEIVED_ANALYSIS',
        403
      );
    }

    // Check associated report immutability before accepting result mutations
    let existingReportDoc = null;
    if (sample.orderId) {
      if (ReportModel) {
        existingReportDoc = await ReportModel.findOne({ tenantId, orderId: sample.orderId });
      } else {
        const repMap = this.memoryReports.get(tenantId);
        existingReportDoc = repMap ? Array.from(repMap.values()).find((r) => r.orderId === sample.orderId) : null;
      }
    }

    if (existingReportDoc) {
      if (existingReportDoc.status === 'released') {
        throw new ClinicalServiceError(
          'Cannot modify results: diagnostic report is already finalized and released to patient portal',
          'REPORT_ALREADY_RELEASED',
          403
        );
      }
      if (existingReportDoc.status === 'approved') {
        throw new ClinicalServiceError(
          'Cannot modify results: diagnostic report has already been reviewed and approved by Pathologist',
          'REPORT_ALREADY_APPROVED',
          403
        );
      }
    }

    const { parameterResults = [], findings, notes, instrument, reagentLot } = resultData;

    // Fetch associated order first to access configured test and parameter metadata
    let order = null;
    if (sample.orderId) {
      if (OrderModel) {
        order = await OrderModel.findOne({ tenantId, orderId: sample.orderId });
      } else {
        const oMap = this.memoryOrders.get(tenantId);
        order = oMap?.get(sample.orderId);
      }
    }

    const targetCodes = Array.isArray(sample.testCodes) ? sample.testCodes : [];
    const targetItemIds = Array.isArray(sample.itemIds) ? sample.itemIds : [];
    const matchedItems = order?.items
      ? order.items.filter((it) => targetCodes.includes(it.testCode) || targetItemIds.includes(it.itemId) || order.items.length === 1)
      : [];

    // Index all parameters configured on matched order items (including custom Hospital Admin tests)
    const configuredParamsMap = new Map();
    for (const item of matchedItems) {
      if (Array.isArray(item.parameters)) {
        for (const p of item.parameters) {
          const code = (p.parameterCode || p.code || '').trim().toUpperCase();
          if (code && !configuredParamsMap.has(code)) {
            configuredParamsMap.set(code, p);
          }
        }
      }
    }

    // Patient demographics for age/gender specific reference intervals
    const demographics = {
      gender: order?.patientGender || '',
    };

    // Validate parameterResults strictly with authoritative classification
    const validatedParameterResults = [];
    if (Array.isArray(parameterResults)) {
      for (const pr of parameterResults) {
        const pCode = (pr.parameterCode || pr.code || '').trim().toUpperCase();
        const paramDef = configuredParamsMap.get(pCode) || pr;
        const pName = paramDef.name || pr.name || pCode || 'Parameter';
        const pType = (paramDef.resultType || pr.resultType || 'NUMERIC').toUpperCase();
        let val = pr.value;

        if (pType === 'NUMERIC') {
          if (val === '' || val === undefined || (val === null && (pr.required || paramDef.required))) {
            throw new ClinicalServiceError(
              `Invalid numeric value for parameter '${pName}'. Empty input cannot be evaluated as zero.`,
              'INVALID_NUMERIC_VALUE',
              400
            );
          }
          if (val !== null && val !== undefined) {
            const numVal = Number(val);
            if (isNaN(numVal)) {
              throw new ClinicalServiceError(
                `Invalid numeric value '${val}' for parameter '${pName}'`,
                'INVALID_NUMERIC_VALUE',
                400
              );
            }
            val = numVal;
          }
        } else if (pType === 'OPTIONS') {
          if (val === undefined || val === null || String(val).trim() === '') {
            if (pr.required || paramDef.required) {
              throw new ClinicalServiceError(
                `Value required for parameter '${pName}'`,
                'REQUIRED_PARAMETER_MISSING',
                400
              );
            }
            val = '';
          } else {
            val = String(val).trim();
          }
        } else {
          // TEXT
          if (val === undefined || val === null || String(val).trim() === '') {
            if (pr.required || paramDef.required) {
              throw new ClinicalServiceError(
                `Value required for parameter '${pName}'`,
                'REQUIRED_PARAMETER_MISSING',
                400
              );
            }
            val = '';
          } else {
            val = String(val).trim();
          }
        }

        // Authoritative independent clinical classification (Problem B fix)
        const classification = classifyResult(val, paramDef || pr, demographics);
        const refDisplay = (!isGenericReferenceRange(classification.referenceRangeDisplay) ? classification.referenceRangeDisplay : null)
          || (!isGenericReferenceRange(pr.referenceRange) ? pr.referenceRange : null)
          || (!isGenericReferenceRange(paramDef?.referenceRange) ? paramDef.referenceRange : null)
          || '—';
        const unit = pr.unit || paramDef?.unit || '';

        validatedParameterResults.push({
          parameterCode: pCode || 'PARAM',
          name: pName,
          resultType: pType,
          value: val,
          unit,
          referenceRange: refDisplay,
          isAbnormal: classification.isAbnormal,
          flag: classification.flag,
          enteredAt: new Date(),
          enteredBy: actor.email || 'Lab Technician',
        });
      }
    }

    // Transition sample processing status to results_entered
    sample.processingStatus = 'results_entered';
    if (sample.save) await sample.save();

    let report = null;
    if (order) {
      let anyItemUpdated = false;
      let hasAbnormal = false;

      for (const it of order.items) {
        const matchesCode = targetCodes.includes(it.testCode);
        const matchesId = targetItemIds.includes(it.itemId);
        if (matchesCode || matchesId || order.items.length === 1) {
          it.status = 'results_entered';
          if (validatedParameterResults.length > 0) {
            it.parameterResults = validatedParameterResults;
            it.isAbnormal = it.parameterResults.some((p) => p.isAbnormal);
            if (it.isAbnormal) {
              hasAbnormal = true;
            }
            it.resultValue = it.parameterResults
              .map((p) => `${p.name || p.parameterCode}: ${p.value}${p.unit ? ' ' + p.unit : ''}`)
              .join(', ');
          }
          anyItemUpdated = true;
        }
      }

      if (anyItemUpdated) {
        order.orderStatus = 'in_analysis';
        if (order.save) await order.save();
      }

      // Check completeness across all order items before advancing report to pending_review
      const isItemComplete = (it) => {
        if (Array.isArray(it.parameterResults) && it.parameterResults.length > 0) {
          return it.parameterResults.every(
            (p) => p.value !== undefined && p.value !== null && String(p.value).trim() !== ''
          );
        }
        return it.resultValue !== undefined && it.resultValue !== null && String(it.resultValue).trim() !== '';
      };

      const completedItems = order.items.filter(isItemComplete);
      const missingItems = order.items.filter((it) => !isItemComplete(it));
      const allItemsComplete = order.items.length > 0 && missingItems.length === 0;

      const targetReportStatus = allItemsComplete ? 'pending_review' : 'draft';
      const defaultFindings = allItemsComplete
        ? (hasAbnormal ? 'Parameters flagged outside normal clinical thresholds.' : 'Parameters verified within normal clinical reference ranges.')
        : `Partial results entered (${completedItems.length}/${order.items.length} tests complete). Awaiting remaining specimen runs: ${missingItems.map((m) => m.testCode || m.testName).join(', ')}.`;
      const combinedFindings = !allItemsComplete
        ? `${findings ? findings + ' — ' : ''}Partial results recorded (${completedItems.length}/${order.items.length} tests complete). Awaiting remaining specimen runs: ${missingItems.map((m) => m.testCode || m.testName).join(', ')}.`
        : (findings || defaultFindings);

      if (ReportModel) {
        report = await ReportModel.findOne({ tenantId, orderId: order.orderId });
        if (report && (report.status === 'draft' || report.status === 'pending_review' || report.status === 'rejected')) {
          report.items = order.items;
          report.findings = combinedFindings;
          report.status = targetReportStatus;
          report.draftedBy = actor.email || 'Lab Technician';
          await report.save();
        } else if (!report) {
          const reportId = this.generateId('rep');
          const reportNumber = `REP-${Date.now().toString().slice(-6)}`;
          report = new ReportModel({
            reportId,
            tenantId,
            reportNumber,
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            patientName: order.patientName,
            patientMrn: order.patientMrn,
            testName: sample.testNames?.join(', ') || order.items[0]?.testName || 'Diagnostic Panel',
            items: order.items,
            findings: combinedFindings,
            status: targetReportStatus,
            draftedBy: actor.email || 'Lab Technician',
          });
          await report.save();
        }
      } else {
        if (!this.memoryReports.has(tenantId)) this.memoryReports.set(tenantId, new Map());
        const existingRep = Array.from(this.memoryReports.get(tenantId).values()).find((r) => r.orderId === order.orderId);
        if (existingRep && (existingRep.status === 'draft' || existingRep.status === 'pending_review' || existingRep.status === 'rejected')) {
          existingRep.items = order.items;
          existingRep.findings = combinedFindings;
          existingRep.status = targetReportStatus;
          report = existingRep;
        } else if (!existingRep) {
          const reportId = this.generateId('rep');
          const reportNumber = `REP-${Date.now().toString().slice(-6)}`;
          report = {
            reportId,
            tenantId,
            reportNumber,
            orderId: order.orderId,
            orderNumber: order.orderNumber,
            patientName: order.patientName,
            patientMrn: order.patientMrn,
            testName: sample.testNames?.join(', ') || order.items[0]?.testName || 'Diagnostic Panel',
            items: order.items,
            findings: combinedFindings,
            status: targetReportStatus,
            draftedBy: actor.email || 'Lab Technician',
            createdAt: new Date(),
            toSafeJSON() { return { ...this }; },
          };
          this.memoryReports.get(tenantId).set(reportId, report);
        }
      }
    }

    await auditLogService.recordEvent({
      action: 'SAMPLE_RESULTS_ENTERED',
      targetTenantId: tenantId,
      actorType: actor.accountType || 'TENANT_USER',
      actorEmail: actor.email,
      details: {
        sampleId: sample.sampleId,
        barcode: sample.barcode,
        orderId: sample.orderId,
        parameterCount: parameterResults.length,
        status: 'results_entered',
      },
    });

    return {
      sample: sample.toSafeJSON ? sample.toSafeJSON() : sample,
      report: report?.toSafeJSON ? report.toSafeJSON() : report,
    };
  }

  // -------------------------------------------------------------------------
  // RECOLLECTION QUEUE & TRIAGE MANAGEMENT
  // -------------------------------------------------------------------------
  async listRecollectionTasks(tenantId, query = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const { status, limit = 50 } = query;
    const RecollectionModel = tenantConnectionService.getTenantRecollectionTaskModel(tenantId);

    if (RecollectionModel) {
      const filter = { tenantId };
      if (status) filter.status = status;
      const list = await RecollectionModel.find(filter).sort({ createdAt: -1 }).limit(parseInt(limit, 10));
      return list.map((t) => t.toSafeJSON());
    }

    const tenantMap = this.memoryRecollections.get(tenantId) || new Map();
    let list = Array.from(tenantMap.values());
    if (status) list = list.filter((t) => t.status === status);
    return list;
  }

  async resolveRecollectionTask(tenantId, taskId, data = {}, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const RecollectionModel = tenantConnectionService.getTenantRecollectionTaskModel(tenantId);
    const SampleModel = tenantConnectionService.getTenantSampleModel(tenantId);

    let task = null;
    if (RecollectionModel) {
      task = await RecollectionModel.findOne({ tenantId, taskId });
    } else {
      task = this.memoryRecollections.get(tenantId)?.get(taskId);
    }

    if (!task) {
      throw new ClinicalServiceError(`Recollection task '${taskId}' not found`, 'TASK_NOT_FOUND', 404);
    }

    if (task.status === 'recollected') {
      return {
        task: task.toSafeJSON ? task.toSafeJSON() : task,
        alreadyResolved: true,
      };
    }

    // Generate new replacement tube with suffix -R1
    const newSampleId = this.generateId('smp');
    const newBarcode = `${task.rejectedBarcode}-R1`;

    const newSampleData = {
      sampleId: newSampleId,
      tenantId,
      barcode: newBarcode,
      orderId: task.orderId,
      orderNumber: task.orderNumber,
      patientId: task.patientId,
      patientMrn: task.patientMrn,
      patientName: task.patientName,
      sampleType: task.sampleType,
      container: task.container,
      testCodes: task.testCodes || [],
      testNames: task.testNames || [],
      tubeIndex: 1,
      totalTubes: 1,
      collectionStatus: 'collected',
      processingStatus: 'pending',
      collectedAt: new Date(),
      collectedBy: actor.email || 'Phlebotomist',
    };

    let newSample = null;
    if (SampleModel) {
      const doc = new SampleModel(newSampleData);
      await doc.save();
      newSample = doc.toSafeJSON();
    } else {
      if (!this.memorySamples.has(tenantId)) this.memorySamples.set(tenantId, new Map());
      newSample = { ...newSampleData, createdAt: new Date(), toSafeJSON() { return { ...this }; } };
      this.memorySamples.get(tenantId).set(newSampleId, newSample);
    }

    task.status = 'resolved';
    task.recollectedSampleId = newSampleId;
    task.recollectedBarcode = newBarcode;
    task.recollectedAt = new Date();
    task.resolvedBy = actor.email || 'Phlebotomist';
    if (task.save) await task.save();

    // Re-link replacement specimen to order items
    if (task.orderId) {
      const OrderModel = tenantConnectionService.getTenantOrderModel(tenantId);
      if (OrderModel) {
        const ord = await OrderModel.findOne({ tenantId, orderId: task.orderId });
        if (ord && Array.isArray(ord.items)) {
          let ordUpdated = false;
          for (const it of ord.items) {
            if (it.sampleId === task.rejectedSampleId || it.barcode === task.rejectedBarcode || task.testCodes?.includes(it.testCode)) {
              it.sampleId = newSampleId;
              it.barcode = newBarcode;
              it.status = 'sample_collected';
              ordUpdated = true;
            }
          }
          if (ordUpdated) await ord.save();
        }
      } else {
        const oMap = this.memoryOrders.get(tenantId);
        const ord = oMap?.get(task.orderId);
        if (ord && Array.isArray(ord.items)) {
          for (const it of ord.items) {
            if (it.sampleId === task.rejectedSampleId || it.barcode === task.rejectedBarcode || task.testCodes?.includes(it.testCode)) {
              it.sampleId = newSampleId;
              it.barcode = newBarcode;
              it.status = 'sample_collected';
            }
          }
        }
      }
    }

    return {
      task: task.toSafeJSON ? task.toSafeJSON() : task,
      newSample,
      replacementBarcode: newBarcode,
      replacementSample: newSample,
    };
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
    const { code, name, category, department, specimenType, container, price, turnaroundHours, referenceRange, parameters } = data;

    if (!code || !name) {
      throw new ClinicalServiceError('Test code and descriptive name are required', 'VALIDATION_ERROR', 400);
    }

    const testId = this.generateId('tst');
    const cleanCode = code.trim().toUpperCase();
    const sanitizedParams = validateAndSanitizeParameters(parameters);
    const resolvedCont = container?.trim() || resolveSpecimenContainer(specimenType, container);
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
        container: resolvedCont,
        price: Number(price) || 0,
        turnaroundHours: Number(turnaroundHours) || 24,
        referenceRange: referenceRange?.trim() || 'Standard clinical normal reference range',
        parameters: sanitizedParams,
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
      container: resolvedCont,
      price: Number(price) || 0,
      turnaroundHours: Number(turnaroundHours) || 24,
      referenceRange: referenceRange || 'Standard reference range',
      parameters: sanitizedParams,
      isActive: true,
      toSafeJSON() { return { ...this }; },
    };
    this.memoryTests.get(tenantId).set(testId, mock);
    return mock;
  }

  async getTest(tenantId, testId) {
    await tenantUserService.assertTenantReady(tenantId);
    const TestModel = tenantConnectionService.getTenantTestCatalogModel(tenantId);

    if (TestModel) {
      const doc = await TestModel.findOne({
        tenantId,
        $or: [{ testId }, { code: String(testId).trim().toUpperCase() }],
      });
      if (!doc) {
        throw new ClinicalServiceError(`Test '${testId}' not found in catalog`, 'TEST_NOT_FOUND', 404);
      }
      return doc.toSafeJSON();
    }

    const tenantMap = this.memoryTests.get(tenantId);
    if (!tenantMap) throw new ClinicalServiceError(`Test '${testId}' not found in catalog`, 'TEST_NOT_FOUND', 404);
    const direct = tenantMap.get(testId);
    if (direct) return direct.toSafeJSON ? direct.toSafeJSON() : direct;
    for (const t of tenantMap.values()) {
      if (t.code === String(testId).trim().toUpperCase() || t.testId === testId) {
        return t.toSafeJSON ? t.toSafeJSON() : t;
      }
    }
    throw new ClinicalServiceError(`Test '${testId}' not found in catalog`, 'TEST_NOT_FOUND', 404);
  }

  async updateTest(tenantId, testId, data, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const TestModel = tenantConnectionService.getTenantTestCatalogModel(tenantId);

    const updates = {};
    if (data.code !== undefined) {
      const cleanCode = String(data.code).trim().toUpperCase();
      if (!cleanCode) throw new ClinicalServiceError('Test code cannot be empty', 'VALIDATION_ERROR', 400);
      updates.code = cleanCode;
    }
    if (data.name !== undefined) {
      const cleanName = String(data.name).trim();
      if (!cleanName) throw new ClinicalServiceError('Test name cannot be empty', 'VALIDATION_ERROR', 400);
      updates.name = cleanName;
    }
    if (data.category !== undefined) updates.category = String(data.category).trim();
    if (data.department !== undefined) updates.department = String(data.department).trim();
    if (data.specimenType !== undefined) updates.specimenType = String(data.specimenType).trim();
    if (data.container !== undefined) updates.container = String(data.container).trim();
    if (data.price !== undefined) {
      const p = Number(data.price);
      if (isNaN(p) || p < 0) throw new ClinicalServiceError('Price must be a non-negative number', 'VALIDATION_ERROR', 400);
      updates.price = p;
    }
    if (data.turnaroundHours !== undefined) {
      const t = Number(data.turnaroundHours);
      if (isNaN(t) || t < 0) throw new ClinicalServiceError('Turnaround hours must be non-negative', 'VALIDATION_ERROR', 400);
      updates.turnaroundHours = t;
    }
    if (data.referenceRange !== undefined) {
      updates.referenceRange = String(data.referenceRange).trim();
    }
    if (data.isActive !== undefined) {
      updates.isActive = Boolean(data.isActive);
    }
    if (data.parameters !== undefined) {
      updates.parameters = validateAndSanitizeParameters(data.parameters);
    }

    if (TestModel) {
      const existing = await TestModel.findOne({
        tenantId,
        $or: [{ testId }, { code: String(testId).trim().toUpperCase() }],
      });
      if (!existing) {
        throw new ClinicalServiceError(`Test '${testId}' not found in catalog`, 'TEST_NOT_FOUND', 404);
      }

      if (updates.code && updates.code !== existing.code) {
        const dup = await TestModel.findOne({ tenantId, code: updates.code, testId: { $ne: existing.testId } });
        if (dup) {
          throw new ClinicalServiceError(`A test with code '${updates.code}' already exists`, 'DUPLICATE_TEST', 409);
        }
      }

      Object.assign(existing, updates);
      await existing.save();
      return existing.toSafeJSON();
    }

    const tenantMap = this.memoryTests.get(tenantId);
    if (!tenantMap) throw new ClinicalServiceError(`Test '${testId}' not found in catalog`, 'TEST_NOT_FOUND', 404);
    let target = tenantMap.get(testId);
    if (!target) {
      for (const t of tenantMap.values()) {
        if (t.code === String(testId).trim().toUpperCase() || t.testId === testId) {
          target = t; break;
        }
      }
    }
    if (!target) throw new ClinicalServiceError(`Test '${testId}' not found in catalog`, 'TEST_NOT_FOUND', 404);

    if (updates.code && updates.code !== target.code) {
      for (const t of tenantMap.values()) {
        if (t.code === updates.code && t.testId !== target.testId) {
          throw new ClinicalServiceError(`A test with code '${updates.code}' already exists`, 'DUPLICATE_TEST', 409);
        }
      }
    }

    Object.assign(target, updates);
    return target.toSafeJSON ? target.toSafeJSON() : target;
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
    const { referenceRange, parameterResults } = data;
    let { resultValue, isAbnormal = false } = data;

    const hasParamResults = parameterResults && (
      (Array.isArray(parameterResults) && parameterResults.length > 0) ||
      (typeof parameterResults === 'object' && Object.keys(parameterResults).length > 0)
    );

    const hasSingleResult = resultValue !== undefined && resultValue !== null && String(resultValue).trim() !== '';

    if (!hasParamResults && !hasSingleResult) {
      throw new ClinicalServiceError('Test result value or structured parameter results must be provided', 'VALIDATION_ERROR', 400);
    }

    const OrderModel = tenantConnectionService.getTenantOrderModel(tenantId);
    let order = null;
    if (OrderModel) {
      order = await OrderModel.findOne({ tenantId, $or: [{ orderId }, { orderNumber: orderId }] });
    } else {
      const tenantMap = this.memoryOrders.get(tenantId);
      order = tenantMap?.get(orderId);
      if (!order && tenantMap) {
        for (const o of tenantMap.values()) {
          if (o.orderNumber === orderId) { order = o; break; }
        }
      }
    }

    if (!order) throw new ClinicalServiceError('Order not found', 'ORDER_NOT_FOUND', 404);

    const targetItem = order.items.find((it) => it.itemId === itemId || it.testCode === itemId);
    if (!targetItem) throw new ClinicalServiceError(`Test item '${itemId}' not found in order`, 'ITEM_NOT_FOUND', 404);

    // Validate specimen existence and central receipt state (Fix D)
    const SampleModel = tenantConnectionService.getTenantSampleModel(tenantId);
    let sample = null;
    if (SampleModel) {
      if (targetItem.sampleId) {
        sample = await SampleModel.findOne({ tenantId, sampleId: targetItem.sampleId });
      }
      if (!sample && targetItem.barcode) {
        sample = await SampleModel.findOne({ tenantId, barcode: targetItem.barcode });
      }
      if (!sample) {
        sample = await SampleModel.findOne({ tenantId, orderId: order.orderId, testCodes: targetItem.testCode });
      }
      if (!sample) {
        sample = await SampleModel.findOne({ tenantId, orderId: order.orderId });
      }
    } else {
      const sMap = this.memorySamples.get(tenantId);
      if (sMap) {
        sample = Array.from(sMap.values()).find((s) =>
          s.sampleId === targetItem.sampleId ||
          s.barcode === targetItem.barcode ||
          (s.orderId === order.orderId && (s.testCodes?.includes(targetItem.testCode) || s.itemIds?.includes(targetItem.itemId)))
        ) || Array.from(sMap.values()).find((s) => s.orderId === order.orderId);
      }
    }

    if (!sample) {
      throw new ClinicalServiceError(
        `No specimen found for order item '${itemId}'. Cannot record results without linked specimen.`,
        'SPECIMEN_NOT_FOUND',
        400
      );
    }

    if (sample.collectionStatus !== 'received') {
      throw new ClinicalServiceError(
        `Specimen '${sample.barcode || sample.sampleId}' must be collected and received in the laboratory before result entry`,
        'SOD_VIOLATION_UNRECEIVED_ANALYSIS',
        403
      );
    }

    // Check associated report immutability before accepting result mutations (Fix C)
    const ReportModel = tenantConnectionService.getTenantReportModel(tenantId);
    let existingReport = null;
    if (ReportModel) {
      existingReport = await ReportModel.findOne({ tenantId, orderId: order.orderId });
    } else {
      const rMap = this.memoryReports.get(tenantId);
      existingReport = rMap ? Array.from(rMap.values()).find((r) => r.orderId === order.orderId) : null;
    }

    if (existingReport) {
      if (existingReport.status === 'released') {
        throw new ClinicalServiceError(
          'Cannot modify results for a released diagnostic report',
          'REPORT_ALREADY_RELEASED',
          403
        );
      }
      if (existingReport.status === 'approved') {
        throw new ClinicalServiceError(
          'Cannot modify results for an approved diagnostic report without authorized revision',
          'REPORT_ALREADY_APPROVED',
          403
        );
      }
    }

    // Validate and process parameter results if provided
    let storedParamResults = [];
    if (hasParamResults) {
      let rawList = [];
      if (Array.isArray(parameterResults)) {
        rawList = parameterResults;
      } else {
        rawList = Object.entries(parameterResults).map(([k, v]) => {
          if (v && typeof v === 'object' && v.value !== undefined) {
            return { parameterCode: k, ...v };
          }
          return { parameterCode: k, value: v };
        });
      }

      const itemParams = Array.isArray(targetItem.parameters) ? targetItem.parameters : [];

      for (const entry of rawList) {
        const code = (entry.parameterCode || entry.code || '').trim().toUpperCase();
        if (!code) continue;

        // Match strictly against the order item's parameter snapshot
        const paramDef = itemParams.find((p) => (p.parameterCode || '').toUpperCase() === code);
        const resultType = paramDef?.resultType || entry.resultType || 'TEXT';
        let val = entry.value;
        let itemAbnormal = Boolean(entry.isAbnormal);

        if (resultType === 'NUMERIC') {
          if (val === undefined || val === null || val === '' || isNaN(Number(val))) {
            throw new ClinicalServiceError(
              `Numeric value required for parameter '${paramDef?.name || code}'`,
              'INVALID_NUMERIC_VALUE',
              400
            );
          }
          val = Number(val);

        } else if (resultType === 'OPTIONS') {
          const validOpts = Array.isArray(paramDef?.options) ? paramDef.options : [];
          if (validOpts.length > 0) {
            const matchedOpt = validOpts.find((o) => o.trim().toUpperCase() === String(val).trim().toUpperCase());
            if (!matchedOpt) {
              throw new ClinicalServiceError(
                `Invalid option '${val}' for parameter '${paramDef?.name || code}'. Allowed: ${validOpts.join(', ')}`,
                'INVALID_PARAMETER_OPTION',
                400
              );
            }
            val = matchedOpt;
          } else {
            val = String(val).trim();
          }
        } else {
          // TEXT
          if (val === undefined || val === null || String(val).trim() === '') {
            throw new ClinicalServiceError(
              `Text value required for parameter '${paramDef?.name || code}'`,
              'INVALID_TEXT_VALUE',
              400
            );
          }
          val = String(val).trim();
        }

        // Authoritative independent clinical classification (Problem B fix)
        const classification = classifyResult(val, paramDef || entry);
        const unit = entry.unit || paramDef?.unit || '';
        const refDisplay = (!isGenericReferenceRange(classification.referenceRangeDisplay) ? classification.referenceRangeDisplay : null)
          || (!isGenericReferenceRange(entry.referenceRange) ? entry.referenceRange : null)
          || (!isGenericReferenceRange(paramDef?.referenceRange) ? paramDef?.referenceRange : null)
          || '—';

        storedParamResults.push({
          parameterCode: code,
          name: paramDef?.name || entry.name || code,
          resultType,
          value: val,
          unit,
          referenceRange: refDisplay,
          isAbnormal: classification.isAbnormal,
          flag: classification.flag,
          enteredAt: new Date(),
          enteredBy: actor.email || 'Lab Technician',
        });
      }

      targetItem.parameterResults = storedParamResults;
      isAbnormal = storedParamResults.some((p) => p.isAbnormal);

      // Generate composite resultValue string if omitted
      if (!hasSingleResult && storedParamResults.length > 0) {
        resultValue = storedParamResults
          .map((p) => `${p.name || p.parameterCode}: ${p.value}${p.unit ? ' ' + p.unit : ''}`)
          .join(', ');
      }
    } else if (hasSingleResult) {
      // Authoritative validation of single result against target item's reference range
      const singleClassification = classifyResult(resultValue, {
        referenceRange: targetItem.referenceRange || referenceRange,
      });
      isAbnormal = singleClassification.isAbnormal;
    }

    if (resultValue) {
      targetItem.resultValue = String(resultValue).trim();
    }
    targetItem.status = 'results_entered';
    targetItem.isAbnormal = Boolean(isAbnormal);
    if (referenceRange) targetItem.referenceRange = String(referenceRange).trim();

    sample.processingStatus = 'results_entered';
    if (sample.save) await sample.save();

    order.orderStatus = 'in_analysis';
    if (OrderModel && order.save) {
      await order.save();
    }

    // Connect into DiagnosticReport workflow
    const isItemComplete = (it) => {
      if (Array.isArray(it.parameterResults) && it.parameterResults.length > 0) {
        return it.parameterResults.every(
          (p) => p.value !== undefined && p.value !== null && String(p.value).trim() !== ''
        );
      }
      return it.resultValue !== undefined && it.resultValue !== null && String(it.resultValue).trim() !== '';
    };

    const completedItems = order.items.filter(isItemComplete);
    const missingItems = order.items.filter((it) => !isItemComplete(it));
    const allItemsComplete = order.items.length > 0 && missingItems.length === 0;

    const targetReportStatus = allItemsComplete ? 'pending_review' : 'draft';
    let hasAbnormal = order.items.some((it) => it.isAbnormal);
    const defaultFindings = allItemsComplete
      ? (hasAbnormal ? 'Parameters flagged outside normal clinical thresholds.' : 'Parameters verified within normal clinical reference ranges.')
      : `Partial results entered (${completedItems.length}/${order.items.length} tests complete). Awaiting remaining specimen runs: ${missingItems.map((m) => m.testCode || m.testName).join(', ')}.`;
    const combinedFindings = defaultFindings;

    let report = null;
    if (ReportModel) {
      if (existingReport && (existingReport.status === 'draft' || existingReport.status === 'pending_review' || existingReport.status === 'rejected')) {
        existingReport.items = order.items;
        existingReport.findings = combinedFindings;
        existingReport.status = targetReportStatus;
        existingReport.draftedBy = actor.email || 'Lab Technician';
        await existingReport.save();
        report = existingReport;
      } else if (!existingReport) {
        const reportId = this.generateId('rep');
        const reportNumber = `REP-${Date.now().toString().slice(-6)}`;
        report = new ReportModel({
          reportId,
          tenantId,
          reportNumber,
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          patientName: order.patientName,
          patientMrn: order.patientMrn,
          testName: sample.testNames?.join(', ') || targetItem.testName || 'Diagnostic Panel',
          items: order.items,
          findings: combinedFindings,
          status: targetReportStatus,
          draftedBy: actor.email || 'Lab Technician',
        });
        await report.save();
      }
    } else {
      if (!this.memoryReports.has(tenantId)) this.memoryReports.set(tenantId, new Map());
      if (existingReport && (existingReport.status === 'draft' || existingReport.status === 'pending_review' || existingReport.status === 'rejected')) {
        existingReport.items = order.items;
        existingReport.findings = combinedFindings;
        existingReport.status = targetReportStatus;
        report = existingReport;
      } else if (!existingReport) {
        const reportId = this.generateId('rep');
        const reportNumber = `REP-${Date.now().toString().slice(-6)}`;
        report = {
          reportId,
          tenantId,
          reportNumber,
          orderId: order.orderId,
          orderNumber: order.orderNumber,
          patientName: order.patientName,
          patientMrn: order.patientMrn,
          testName: sample.testNames?.join(', ') || targetItem.testName || 'Diagnostic Panel',
          items: order.items,
          findings: combinedFindings,
          status: targetReportStatus,
          draftedBy: actor.email || 'Lab Technician',
          createdAt: new Date(),
          toSafeJSON() { return { ...this }; },
        };
        this.memoryReports.get(tenantId).set(reportId, report);
      }
    }

    return order.toSafeJSON ? order.toSafeJSON() : order;
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

    let resolvedItems = Array.isArray(data.items) ? data.items : [];

    if (orderId) {
      try {
        const order = await this.getOrderById(tenantId, orderId);
        if (order) {
          resolvedOrderNumber = resolvedOrderNumber || order.orderNumber;
          resolvedPatientName = resolvedPatientName || order.patientName;
          resolvedPatientMrn = resolvedPatientMrn || order.patientMrn;
          resolvedTestName = resolvedTestName || order.items?.[0]?.testName || 'Diagnostic Panel';
          if (resolvedItems.length === 0 && Array.isArray(order.items)) {
            resolvedItems = order.items;
          }
        }
      } catch {}
    }

    if (!orderId || !resolvedPatientName || !resolvedTestName) {
      throw new ClinicalServiceError('Order, patient, and test name required for report draft', 'VALIDATION_ERROR', 400);
    }

    const reportId = this.generateId('rep');
    const reportNumber = `REP-${Date.now().toString().slice(-6)}`;
    const findings = data.findings || data.clinicalFindings || data.interpretations || 'Diagnostic specimen intake recorded. Awaiting analytical completion and pathologist review.';
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
        items: resolvedItems,
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
      items: resolvedItems,
      findings: String(findings).trim(),
      status: 'draft',
      draftedBy: actor.email || 'Lab Technician',
      createdAt: new Date(),
      toSafeJSON() { return { ...this }; },
    };
    this.memoryReports.get(tenantId).set(reportId, mock);
    return mock;
  }

  async approveReport(tenantId, reportId, actor = {}, data = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const ReportModel = tenantConnectionService.getTenantReportModel(tenantId);

    let report = null;
    if (ReportModel) {
      report = await ReportModel.findOne({ tenantId, reportId });
    } else {
      const tenantMap = this.memoryReports.get(tenantId);
      report = tenantMap?.get(reportId);
    }

    if (!report) throw new ClinicalServiceError('Report not found', 'REPORT_NOT_FOUND', 404);

    // 1. Verify valid state transition
    if (report.status !== 'draft' && report.status !== 'pending_review') {
      throw new ClinicalServiceError(`Report cannot be verified from status '${report.status}'`, 'INVALID_STATE_TRANSITION', 400);
    }

    // 2. Prevent verification when required clinical results are missing
    let items = Array.isArray(report.items) && report.items.length > 0 ? report.items : [];
    if (report.orderId) {
      try {
        const order = await this.getOrderById(tenantId, report.orderId);
        if (order && Array.isArray(order.items) && order.items.length > 0) {
          if (items.length < order.items.length) {
            items = order.items;
            report.items = items;
          }
        }
      } catch {}
    }

    if (items.length === 0) {
      throw new ClinicalServiceError('Cannot verify report: no test items or clinical parameters found', 'MISSING_RESULTS', 400);
    }

    const incompleteTests = items
      .filter((it) => {
        const hasParams = Array.isArray(it.parameterResults) && it.parameterResults.length > 0;
        if (hasParams) {
          return it.parameterResults.some((p) => p.value === undefined || p.value === null || String(p.value).trim() === '');
        }
        return it.resultValue === undefined || it.resultValue === null || String(it.resultValue).trim() === '';
      })
      .map((it) => it.testName || it.testCode || it.itemId || 'Diagnostic Test');

    if (incompleteTests.length > 0) {
      throw new ClinicalServiceError(
        `Cannot verify report: one or more tests have missing diagnostic results (${incompleteTests.join(', ')})`,
        'MISSING_RESULTS',
        400
      );
    }

    // 3. Record verification details
    report.status = 'approved';
    report.reviewedBy = actor.email || actor.userId || 'Consultant Pathologist';
    report.verifiedAt = new Date();
    if (data?.verificationNotes) {
      report.verificationNotes = String(data.verificationNotes).trim();
    }
    if (data?.findings && String(data.findings).trim()) {
      report.findings = String(data.findings).trim();
    }

    if (ReportModel && typeof report.save === 'function') {
      await report.save();
    }

    // Also mark matching sample(s) and order as completed
    if (report.orderId) {
      const SampleModel = tenantConnectionService.getTenantSampleModel(tenantId);
      const OrderModel = tenantConnectionService.getTenantOrderModel(tenantId);
      if (SampleModel) {
        await SampleModel.updateMany(
          { tenantId, orderId: report.orderId, processingStatus: { $ne: 'rejected' } },
          { $set: { processingStatus: 'completed', verifiedAt: report.verifiedAt, verifiedBy: report.reviewedBy } }
        );
      } else {
        const tenantSamples = this.memorySamples.get(tenantId);
        if (tenantSamples) {
          for (const s of tenantSamples.values()) {
            if (s.orderId === report.orderId && s.processingStatus !== 'rejected') {
              s.processingStatus = 'completed';
              s.verifiedAt = report.verifiedAt;
              s.verifiedBy = report.reviewedBy;
            }
          }
        }
      }

      if (OrderModel) {
        await OrderModel.updateOne(
          { tenantId, orderId: report.orderId },
          { $set: { orderStatus: 'completed' } }
        );
      } else {
        const tenantOrders = this.memoryOrders.get(tenantId);
        const ord = tenantOrders?.get(report.orderId);
        if (ord) ord.orderStatus = 'completed';
      }
    }

    await auditLogService.recordEvent({
      action: 'REPORT_APPROVED',
      targetTenantId: tenantId,
      actorType: actor.accountType || 'TENANT_USER',
      actorEmail: actor.email,
      details: {
        reportId,
        reportNumber: report.reportNumber,
        verifiedBy: report.reviewedBy,
        verifiedAt: report.verifiedAt,
        hasVerificationNotes: Boolean(data?.verificationNotes),
      },
    });

    return report.toSafeJSON ? report.toSafeJSON() : report;
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

      if (report.status === 'released') {
        throw new ClinicalServiceError('Cannot reject an already released report', 'REPORT_ALREADY_RELEASED', 400);
      }
      if (report.status === 'approved') {
        throw new ClinicalServiceError('Cannot reject an already approved report', 'REPORT_ALREADY_APPROVED', 400);
      }

      const historyEntry = {
        reason: reason.trim(),
        rejectedBy: actor.email || 'Pathologist',
        rejectedAt: new Date(),
      };
      if (!Array.isArray(report.rejectionHistory)) {
        report.rejectionHistory = [];
      }
      report.rejectionHistory.push(historyEntry);

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

    if (report.status === 'released') {
      throw new ClinicalServiceError('Cannot reject an already released report', 'REPORT_ALREADY_RELEASED', 400);
    }
    if (report.status === 'approved') {
      throw new ClinicalServiceError('Cannot reject an already approved report', 'REPORT_ALREADY_APPROVED', 400);
    }

    const historyEntry = {
      reason: reason.trim(),
      rejectedBy: actor.email || 'Pathologist',
      rejectedAt: new Date(),
    };
    if (!Array.isArray(report.rejectionHistory)) {
      report.rejectionHistory = [];
    }
    report.rejectionHistory.push(historyEntry);

    report.status = 'rejected';
    report.rejectionReason = reason.trim();
    report.reviewedBy = actor.email;
    return report;
  }

  async releaseReport(tenantId, reportId, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const ReportModel = tenantConnectionService.getTenantReportModel(tenantId);

    // Resolve tenant lab name for public authenticity record
    let labName = 'Clinical Diagnostic Laboratory';
    try {
      const lab = await laboratoryManagementService.getLaboratoryById(tenantId);
      if (lab?.name) labName = lab.name;
    } catch (_) {}

    if (ReportModel) {
      const report = await ReportModel.findOne({ tenantId, reportId });
      if (!report) throw new ClinicalServiceError('Report not found', 'REPORT_NOT_FOUND', 404);

      if (report.status === 'released') {
        throw new ClinicalServiceError('Report is already released', 'ALREADY_RELEASED', 400);
      }
      if (report.status === 'rejected') {
        throw new ClinicalServiceError('Cannot release a rejected diagnostic report', 'INVALID_STATE_TRANSITION', 400);
      }
      if (report.status !== 'approved') {
        throw new ClinicalServiceError(`Cannot release report in '${report.status}' status. Report must be approved before release.`, 'REPORT_NOT_APPROVED', 400);
      }

      // Check required results are present
      if (Array.isArray(report.items) && report.items.length > 0) {
        for (const item of report.items) {
          if (Array.isArray(item.parameterResults) && item.parameterResults.length > 0) {
            for (const pr of item.parameterResults) {
              if (pr.value === undefined || pr.value === null || String(pr.value).trim() === '') {
                throw new ClinicalServiceError(`Cannot release report with missing result for parameter '${pr.parameterName || pr.parameterCode}'`, 'MISSING_RESULTS', 400);
              }
            }
          }
        }
      }

      // Generate unpredictable cryptographically secure token
      if (!report.verificationToken) {
        report.verificationToken = crypto.randomBytes(24).toString('hex');
      }

      report.status = 'released';
      report.releasedBy = actor.email || 'Pathologist / Director';
      report.releasedAt = report.releasedAt || new Date();
      await report.save();

      // Upsert public verification registry in master DB
      const verificationRecord = {
        token: report.verificationToken,
        tenantId,
        labName,
        reportNumber: report.reportNumber,
        status: 'released',
        releasedAt: report.releasedAt,
      };

      try {
        await ReportVerificationModel.findOneAndUpdate(
          { token: report.verificationToken },
          verificationRecord,
          { upsert: true, new: true }
        );
      } catch (dbErr) {
        logger.warn('Failed to persist to master verification model, fallback to memory', { error: dbErr.message });
      }
      this.memoryVerifications.set(report.verificationToken, verificationRecord);

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

    if (report.status === 'released') {
      throw new ClinicalServiceError('Report is already released', 'ALREADY_RELEASED', 400);
    }
    if (report.status === 'rejected') {
      throw new ClinicalServiceError('Cannot release a rejected diagnostic report', 'INVALID_STATE_TRANSITION', 400);
    }
    if (report.status !== 'approved') {
      throw new ClinicalServiceError(`Cannot release report in '${report.status}' status. Report must be approved before release.`, 'REPORT_NOT_APPROVED', 400);
    }

    if (Array.isArray(report.items) && report.items.length > 0) {
      for (const item of report.items) {
        if (Array.isArray(item.parameterResults) && item.parameterResults.length > 0) {
          for (const pr of item.parameterResults) {
            if (pr.value === undefined || pr.value === null || String(pr.value).trim() === '') {
              throw new ClinicalServiceError(`Cannot release report with missing result for parameter '${pr.parameterName || pr.parameterCode}'`, 'MISSING_RESULTS', 400);
            }
          }
        }
      }
    }

    if (!report.verificationToken) {
      report.verificationToken = crypto.randomBytes(24).toString('hex');
    }

    report.status = 'released';
    report.releasedBy = actor.email;
    report.releasedAt = report.releasedAt || new Date();

    const verificationRecord = {
      token: report.verificationToken,
      tenantId,
      labName,
      reportNumber: report.reportNumber,
      status: 'released',
      releasedAt: report.releasedAt,
    };
    this.memoryVerifications.set(report.verificationToken, verificationRecord);

    return report;
  }

  async batchReleaseReports(tenantId, reportIds, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    if (!Array.isArray(reportIds) || reportIds.length === 0) {
      throw new ClinicalServiceError('reportIds must be a non-empty array of report IDs', 'VALIDATION_ERROR', 400);
    }

    const results = [];
    for (const reportId of reportIds) {
      try {
        const released = await this.releaseReport(tenantId, reportId, actor);
        results.push({
          reportId,
          reportNumber: released.reportNumber,
          status: 'released',
          success: true,
          releasedAt: released.releasedAt,
          verificationToken: released.verificationToken,
        });
      } catch (err) {
        results.push({
          reportId,
          status: 'failed',
          success: false,
          error: err.message || 'Failed to release report',
          code: err.code || 'RELEASE_FAILED',
        });
      }
    }

    return {
      totalRequested: reportIds.length,
      releasedCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      results,
    };
  }

  async verifyPublicReport(token) {
    if (!token || typeof token !== 'string') {
      throw new ClinicalServiceError('Invalid verification token', 'INVALID_VERIFICATION_TOKEN', 400);
    }
    const cleanToken = token.trim();
    if (!/^[a-zA-Z0-9_-]{16,128}$/.test(cleanToken)) {
      throw new ClinicalServiceError('Malformed verification token', 'INVALID_VERIFICATION_TOKEN', 400);
    }

    let record = null;
    try {
      record = await ReportVerificationModel.findOne({ token: cleanToken });
    } catch (_) {}

    if (!record) {
      record = this.memoryVerifications.get(cleanToken);
    }

    if (!record) {
      throw new ClinicalServiceError('Invalid or unknown verification token', 'VERIFICATION_TOKEN_NOT_FOUND', 404);
    }

    // Cross-verify with tenant DB to ensure report is still released and exists
    try {
      const ReportModel = tenantConnectionService.getTenantReportModel(record.tenantId);
      if (ReportModel) {
        const liveReport = await ReportModel.findOne({ tenantId: record.tenantId, reportNumber: record.reportNumber });
        if (!liveReport || liveReport.status !== 'released') {
          throw new ClinicalServiceError('Report is not currently in released status', 'REPORT_NOT_RELEASED', 404);
        }
      }
    } catch (err) {
      if (err.code === 'REPORT_NOT_RELEASED') throw err;
    }

    // Minimal authenticity information ONLY (no patient demographics, no test results)
    return {
      valid: true,
      labName: record.labName,
      reportNumber: record.reportNumber,
      status: 'released',
      releasedAt: record.releasedAt,
    };
  }

  async enrichReportData(tenantId, report) {
    if (!report) return report;
    const safeJson = report.toSafeJSON ? report.toSafeJSON() : { ...report };

    const OrderModel = tenantConnectionService.getTenantOrderModel(tenantId);
    const PatientModel = tenantConnectionService.getTenantPatientModel(tenantId);
    const SampleModel = tenantConnectionService.getTenantSampleModel(tenantId);

    let order = null;
    if (safeJson.orderId) {
      if (OrderModel) {
        order = await OrderModel.findOne({ tenantId, orderId: safeJson.orderId });
      } else {
        const oMap = this.memoryOrders.get(tenantId);
        order = oMap?.get(safeJson.orderId);
      }
    }

    let patient = null;
    const patientLookupId = order?.patientId || safeJson.patientId;
    if (patientLookupId) {
      if (PatientModel) {
        patient = await PatientModel.findOne({ tenantId, patientId: patientLookupId });
      } else {
        const pMap = this.memoryPatients.get(tenantId);
        patient = pMap?.get(patientLookupId);
      }
    }
    if (!patient && (safeJson.patientMrn || order?.patientMrn)) {
      const mrn = safeJson.patientMrn || order?.patientMrn;
      if (PatientModel) {
        patient = await PatientModel.findOne({ tenantId, mrn });
      }
    }

    let samples = [];
    if (safeJson.orderId) {
      if (SampleModel) {
        samples = await SampleModel.find({ tenantId, orderId: safeJson.orderId }).sort({ tubeIndex: 1 });
      } else {
        const sMap = this.memorySamples.get(tenantId);
        if (sMap) {
          samples = Array.from(sMap.values()).filter((s) => s.orderId === safeJson.orderId);
        }
      }
    }

    let lab = null;
    try {
      lab = await laboratoryManagementService.getLaboratory(tenantId);
    } catch {}

    const patientAge = patient?.age || (patient?.dob ? calculateAge(patient.dob) : '');
    const patientGender = patient?.gender ? patient.gender.toUpperCase() : '';
    const patientDob = patient?.dob || '';
    const patientPhone = patient?.phone || '';
    const patientAddress = patient?.address || '';

    const orderingPhysician = order?.orderingPhysician || safeJson.orderingPhysician || 'Attending Physician';
    const orderDate = order?.createdAt || safeJson.createdAt;
    const primarySample = samples[0];
    const collectedAt = primarySample?.collectedAt || null;
    const receivedAt = primarySample?.receivedAt || null;
    const specimenType = primarySample?.sampleType || safeJson.items?.[0]?.specimenType || 'Serum';
    const container = primarySample?.container || safeJson.items?.[0]?.container || 'Standard Tube';
    const barcode = primarySample?.barcode || safeJson.items?.[0]?.barcode || null;

    // Normalizing test items & authoritative classification
    const enrichedItems = (Array.isArray(safeJson.items) ? safeJson.items : []).map((it) => {
      const paramResults = Array.isArray(it.parameterResults) ? it.parameterResults : [];
      const normalizedParams = paramResults.map((pr) => {
        const classification = classifyResult(pr.value, pr, { gender: patientGender });
        const name = pr.name || pr.parameterCode || pr.parameterName || 'Analyte';
        const isAbnormal = classification.isAbnormal || Boolean(pr.isAbnormal);
        let flag = classification.flag;
        // If legacy or unverified record had isAbnormal: true, ensure flag is never silently NORMAL
        if (pr.isAbnormal && (flag === 'NORMAL' || flag === 'UNCLASSIFIED' || !flag)) {
          flag = 'ABNORMAL';
        }
        return {
          ...pr,
          name,
          parameterName: name, // backwards compatibility
          parameterCode: pr.parameterCode || pr.code || name,
          unit: pr.unit || '',
          referenceRange: (!isGenericReferenceRange(classification.referenceRangeDisplay) ? classification.referenceRangeDisplay : null)
            || (!isGenericReferenceRange(pr.referenceRange) ? pr.referenceRange : null)
            || (pr.lowNormal !== null && pr.highNormal !== null && pr.lowNormal !== undefined && pr.highNormal !== undefined ? `${pr.lowNormal} - ${pr.highNormal}` : null)
            || '—',
          value: pr.value,
          isAbnormal,
          abnormalFlag: isAbnormal, // backwards compatibility
          flag,
          flagType: flag, // backwards compatibility
          flagLabel: flag === 'ABNORMAL' && classification.flag !== 'ABNORMAL' ? 'Abnormal' : classification.flagLabel,
          displayFlag: flag === 'ABNORMAL' && classification.flag !== 'ABNORMAL' ? 'ABNORMAL' : classification.displayFlag,
          status: isAbnormal ? 'abnormal' : classification.status,
        };
      });

      return {
        ...it,
        department: it.department || 'Clinical Pathology',
        specimenType: it.specimenType || specimenType,
        container: it.container || container,
        barcode: it.barcode || barcode,
        parameterResults: normalizedParams,
        isAbnormal: normalizedParams.some((p) => p.isAbnormal) || Boolean(it.isAbnormal),
      };
    });

    const formatLabAddress = (addr) => {
      if (!addr) return '';
      if (typeof addr === 'string') return addr.trim();
      return [addr.street, addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean).join(', ');
    };

    return {
      ...safeJson,
      patientAge,
      patientGender,
      patientDob,
      patientPhone,
      patientAddress,
      orderingPhysician,
      orderDate,
      collectedAt,
      receivedAt,
      specimenType,
      container,
      barcode,
      items: enrichedItems,
      labName: lab?.branding?.displayName || lab?.name || 'Diagnostic Laboratory',
      labLegalName: lab?.legalName || lab?.name || '',
      labPhone: lab?.phone || '',
      labEmail: lab?.email || '',
      labAddress: formatLabAddress(lab?.address),
      accreditation: lab?.branding?.accreditation || '',
      branding: lab?.branding || {},
    };
  }

  async getReportForDownload(tenantId, reportId, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    const ReportModel = tenantConnectionService.getTenantReportModel(tenantId);

    let report = null;
    if (ReportModel) {
      report = await ReportModel.findOne({ tenantId, reportId });
    } else {
      const tenantMap = this.memoryReports.get(tenantId);
      report = tenantMap?.get(reportId);
    }

    if (!report) {
      throw new ClinicalServiceError('Report not found', 'REPORT_NOT_FOUND', 404);
    }

    // STRICT CHECK: Cannot download an unapproved draft or non-released report as official
    if (report.status !== 'released') {
      throw new ClinicalServiceError(
        `Cannot download unreleased diagnostic report in status '${report.status}'. Official download is only permitted for released reports.`,
        'REPORT_NOT_RELEASED',
        400
      );
    }

    // Sanitize filename based on report number
    const rawNum = report.reportNumber || 'Report';
    const cleanNum = String(rawNum).replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFilename = `Report_${cleanNum}.pdf`;

    // Audit log
    await auditLogService.recordEvent({
      action: 'REPORT_DOWNLOADED',
      targetTenantId: tenantId,
      actorType: actor.accountType || 'TENANT_USER',
      actorEmail: actor.email,
      details: { reportId, reportNumber: report.reportNumber, safeFilename },
    });

    const enriched = await this.enrichReportData(tenantId, report);
    return {
      ...enriched,
      safeFilename,
      downloadUrl: `/api/v1/tenants/${tenantId}/reports/${reportId}/download`,
    };
  }

  async batchDownloadReports(tenantId, reportIds, actor = {}) {
    await tenantUserService.assertTenantReady(tenantId);
    if (!Array.isArray(reportIds) || reportIds.length === 0) {
      throw new ClinicalServiceError('reportIds must be a non-empty array of report identifiers', 'VALIDATION_ERROR', 400);
    }

    const ReportModel = tenantConnectionService.getTenantReportModel(tenantId);
    const results = [];

    for (const reportId of reportIds) {
      try {
        let report = null;
        if (ReportModel) {
          report = await ReportModel.findOne({ tenantId, reportId });
        } else {
          const tenantMap = this.memoryReports.get(tenantId);
          report = tenantMap?.get(reportId);
        }

        if (!report) {
          results.push({
            reportId,
            status: 'not_found',
            success: false,
            error: 'Report not found in this laboratory tenant',
            code: 'REPORT_NOT_FOUND',
          });
          continue;
        }

        if (report.status !== 'released') {
          results.push({
            reportId,
            reportNumber: report.reportNumber,
            status: report.status,
            success: false,
            error: `Cannot download unreleased diagnostic report in status '${report.status}'. Official download is only permitted for released reports.`,
            code: 'REPORT_NOT_RELEASED',
          });
          continue;
        }

        const rawNum = report.reportNumber || 'Report';
        const cleanNum = String(rawNum).replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeFilename = `Report_${cleanNum}.pdf`;

        await auditLogService.recordEvent({
          action: 'REPORT_DOWNLOADED',
          targetTenantId: tenantId,
          actorType: actor.accountType || 'TENANT_USER',
          actorEmail: actor.email,
          details: { reportId, reportNumber: report.reportNumber, safeFilename, batch: true },
        });

        // STRICT PRIVACY: Do not return patient demographics, clinical findings or verification tokens in batch summaries!
        results.push({
          reportId: report.reportId,
          reportNumber: report.reportNumber,
          safeFilename,
          status: 'released',
          success: true,
          downloadUrl: `/api/v1/tenants/${tenantId}/reports/${report.reportId}/download`,
        });
      } catch (err) {
        results.push({
          reportId,
          status: 'error',
          success: false,
          error: err.message || 'Failed to prepare report for download',
          code: err.code || 'DOWNLOAD_FAILED',
        });
      }
    }

    return {
      totalRequested: reportIds.length,
      downloadedCount: results.filter((r) => r.success).length,
      failedCount: results.filter((r) => !r.success).length,
      results,
    };
  }

  // -------------------------------------------------------------------------
  // BILLING & INVOICES (Accountant, Lab Admin)
  // -------------------------------------------------------------------------
  async createInvoiceForOrder(tenantId, order, paymentInfo = null) {
    const invoiceId = this.generateId('inv');
    const invoiceNumber = `INV-${order.orderNumber.replace('ORD-', '')}`;
    const InvoiceModel = tenantConnectionService.getTenantInvoiceModel(tenantId);

    const paidAmount = Number(order.paidAmount) || (paymentInfo ? Number(paymentInfo.paidAmount) || 0 : 0);
    const totalAmount = Number(order.totalAmount) || 0;
    const balance = Math.max(0, totalAmount - paidAmount);
    const status = (balance === 0 && totalAmount > 0)
      ? 'paid'
      : (paidAmount > 0 ? 'partially_paid' : 'unpaid');

    const payments = [];
    if (paidAmount > 0) {
      payments.push({
        paymentId: this.generateId('pay'),
        amount: paidAmount,
        method: paymentInfo?.paymentMethod || 'cash',
        reference: paymentInfo?.paymentReference || 'Intake Payment at Registration',
        receivedBy: paymentInfo?.actor?.email || order.createdBy || 'Receptionist',
        paidAt: new Date(),
      });
    }

    if (InvoiceModel) {
      const invoiceDoc = new InvoiceModel({
        invoiceId,
        tenantId,
        invoiceNumber,
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        patientName: order.patientName,
        totalAmount,
        paidAmount,
        balance,
        status,
        payments,
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
      totalAmount,
      paidAmount,
      balance,
      status,
      payments,
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
  // TODAY'S LAB ORDERS SUMMARY & LOCAL CALENDAR RANGE & TAT
  // -------------------------------------------------------------------------
  calculateLocalCalendarRange(timeZone = 'UTC') {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const dateStr = formatter.format(now);
      const [year, month, day] = dateStr.split('-').map(Number);

      const tempDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      const invDate = new Date(tempDate.toLocaleString('en-US', { timeZone: 'UTC' }));
      const localDate = new Date(tempDate.toLocaleString('en-US', { timeZone }));
      const diffMs = invDate.getTime() - localDate.getTime();

      const startOfDay = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) + diffMs);
      const endOfDay = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999) + diffMs);

      return { startOfDay, endOfDay, dateStr, timeZone };
    } catch (_) {
      const now = new Date();
      const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
      return { startOfDay, endOfDay, dateStr: startOfDay.toISOString().split('T')[0], timeZone: 'UTC' };
    }
  }

  async getTodayOrderSummary(tenantId, options = {}) {
    await tenantUserService.assertTenantReady(tenantId);

    // 1. Resolve Laboratory Local Timezone
    // "Use the lab's configured IANA timezone where available. Validate client-provided timezone values and avoid silently using UTC when a valid lab timezone is configured."
    let labConfiguredTimezone = null;
    try {
      const lab = await laboratoryManagementService.getLaboratoryById(tenantId);
      if (lab && lab.timezone && isValidIanaTimezone(lab.timezone)) {
        labConfiguredTimezone = lab.timezone.trim();
      }
    } catch (_) {}

    const rawClientTz = (options.timeZone || options.timezone || '').trim();
    const isClientValid = isValidIanaTimezone(rawClientTz);

    let timeZone = null;
    if (labConfiguredTimezone && labConfiguredTimezone !== 'UTC') {
      timeZone = labConfiguredTimezone;
    } else if (isClientValid) {
      timeZone = rawClientTz;
    } else if (labConfiguredTimezone) {
      timeZone = labConfiguredTimezone;
    } else {
      timeZone = 'UTC';
    }

    // 2. Compute exact local calendar day boundaries
    const { startOfDay, endOfDay, dateStr } = this.calculateLocalCalendarRange(timeZone);

    const OrderModel = tenantConnectionService.getTenantOrderModel(tenantId);
    const SampleModel = tenantConnectionService.getTenantSampleModel(tenantId);
    const ReportModel = tenantConnectionService.getTenantReportModel(tenantId);

    let todayOrders = 0;
    let pendingOrders = 0;
    let samplesCollected = 0;
    let reportsReleased = 0;
    let averageTatMinutes = null;
    let formattedTat = 'N/A';
    let tatReportCount = 0;

    if (OrderModel && SampleModel && ReportModel) {
      const [orderCount, pendingCount, sampleCount, reportCount, releasedReportsDocs] = await Promise.all([
        // 1. Today's total lab orders
        OrderModel.countDocuments({
          tenantId,
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        }),
        // 2. Pending orders created today (ordered / in_progress / in_analysis)
        OrderModel.countDocuments({
          tenantId,
          orderStatus: { $in: ['ordered', 'in_progress', 'in_analysis'] },
          createdAt: { $gte: startOfDay, $lte: endOfDay },
        }),
        // 3. Samples collected today
        SampleModel.countDocuments({
          tenantId,
          collectionStatus: { $in: ['collected', 'received'] },
          $or: [
            { collectedAt: { $gte: startOfDay, $lte: endOfDay } },
            { collectedAt: null, createdAt: { $gte: startOfDay, $lte: endOfDay } },
          ],
        }),
        // 4. Reports released today
        ReportModel.countDocuments({
          tenantId,
          status: 'released',
          $or: [
            { releasedAt: { $gte: startOfDay, $lte: endOfDay } },
            { releasedAt: null, createdAt: { $gte: startOfDay, $lte: endOfDay } },
          ],
        }),
        // 5. Released reports for today's turnaround time calculation
        ReportModel.find({
          tenantId,
          status: 'released',
          releasedAt: { $gte: startOfDay, $lte: endOfDay },
        }).select('reportId orderId releasedAt status').lean(),
      ]);

      todayOrders = orderCount;
      pendingOrders = pendingCount;
      samplesCollected = sampleCount;
      reportsReleased = reportCount;

      // Calculate TAT from released reports and corresponding sample timestamps
      const orderIds = releasedReportsDocs.map((r) => r.orderId).filter(Boolean);
      const samplesByOrder = new Map();
      if (orderIds.length > 0) {
        const sampleDocs = await SampleModel.find({
          tenantId,
          orderId: { $in: orderIds },
        }).select('sampleId orderId collectedAt receivedAt collectionStatus').lean();

        for (const s of sampleDocs) {
          if (!samplesByOrder.has(s.orderId)) {
            samplesByOrder.set(s.orderId, []);
          }
          samplesByOrder.get(s.orderId).push(s);
        }
      }

      const reportTatList = [];
      for (const report of releasedReportsDocs) {
        if (!report.releasedAt) continue;
        const releaseTime = new Date(report.releasedAt).getTime();
        if (isNaN(releaseTime) || releaseTime <= 0) continue;

        const orderSamples = samplesByOrder.get(report.orderId) || [];
        const startCandidates = [];
        for (const s of orderSamples) {
          const rawStart = s.collectedAt || s.receivedAt;
          if (rawStart) {
            const t = new Date(rawStart).getTime();
            if (!isNaN(t) && t > 0) {
              startCandidates.push(t);
            }
          }
        }

        // If no valid collection or receipt timestamp found, exclude report
        if (startCandidates.length === 0) continue;

        // Earliest valid collection/receipt timestamp
        const startTime = Math.min(...startCandidates);

        // Exclude invalid sequence (released before collected)
        if (releaseTime < startTime) continue;

        const diffMins = Math.round((releaseTime - startTime) / (1000 * 60));
        reportTatList.push(diffMins);
      }

      tatReportCount = reportTatList.length;
      if (tatReportCount > 0) {
        const totalMinutes = reportTatList.reduce((sum, m) => sum + m, 0);
        averageTatMinutes = Math.round(totalMinutes / tatReportCount);
        formattedTat = formatTatDuration(averageTatMinutes);
      }
    } else {
      // In-memory fallback
      const tenantOrders = this.memoryOrders.get(tenantId) || new Map();
      const tenantSamples = this.memorySamples.get(tenantId) || new Map();
      const tenantReports = this.memoryReports.get(tenantId) || new Map();

      const ordersList = Array.from(tenantOrders.values());
      const samplesList = Array.from(tenantSamples.values());
      const reportsList = Array.from(tenantReports.values());

      todayOrders = ordersList.filter(
        (o) => o.createdAt && new Date(o.createdAt) >= startOfDay && new Date(o.createdAt) <= endOfDay
      ).length;

      pendingOrders = ordersList.filter(
        (o) =>
          ['ordered', 'in_progress', 'in_analysis'].includes(o.orderStatus) &&
          o.createdAt &&
          new Date(o.createdAt) >= startOfDay &&
          new Date(o.createdAt) <= endOfDay
      ).length;

      samplesCollected = samplesList.filter(
        (s) =>
          (s.collectionStatus === 'collected' || s.collectionStatus === 'received') &&
          ((s.collectedAt && new Date(s.collectedAt) >= startOfDay && new Date(s.collectedAt) <= endOfDay) ||
            (!s.collectedAt && s.createdAt && new Date(s.createdAt) >= startOfDay && new Date(s.createdAt) <= endOfDay))
      ).length;

      reportsReleased = reportsList.filter(
        (r) =>
          r.status === 'released' &&
          ((r.releasedAt && new Date(r.releasedAt) >= startOfDay && new Date(r.releasedAt) <= endOfDay) ||
            (!r.releasedAt && r.createdAt && new Date(r.createdAt) >= startOfDay && new Date(r.createdAt) <= endOfDay))
      ).length;

      // In-memory TAT calculation
      const eligibleReports = reportsList.filter(
        (r) =>
          r.status === 'released' &&
          r.releasedAt &&
          new Date(r.releasedAt) >= startOfDay &&
          new Date(r.releasedAt) <= endOfDay
      );

      const memTatList = [];
      for (const report of eligibleReports) {
        const releaseTime = new Date(report.releasedAt).getTime();
        if (isNaN(releaseTime) || releaseTime <= 0) continue;

        const orderSamples = samplesList.filter((s) => s.orderId === report.orderId);
        const startCandidates = [];
        for (const s of orderSamples) {
          const rawStart = s.collectedAt || s.receivedAt;
          if (rawStart) {
            const t = new Date(rawStart).getTime();
            if (!isNaN(t) && t > 0) startCandidates.push(t);
          }
        }
        if (startCandidates.length === 0) continue;
        const startTime = Math.min(...startCandidates);
        if (releaseTime < startTime) continue;

        const diffMins = Math.round((releaseTime - startTime) / (1000 * 60));
        memTatList.push(diffMins);
      }

      tatReportCount = memTatList.length;
      if (tatReportCount > 0) {
        const totalMinutes = memTatList.reduce((sum, m) => sum + m, 0);
        averageTatMinutes = Math.round(totalMinutes / tatReportCount);
        formattedTat = formatTatDuration(averageTatMinutes);
      }
    }

    return {
      todayOrders,
      pendingOrders,
      samplesCollected,
      reportsReleased,
      averageTatMinutes,
      formattedTat,
      tatReportCount,
      date: dateStr,
      timeZone,
      startOfDay,
      endOfDay,
    };
  }

  // -------------------------------------------------------------------------
  // DASHBOARD AGGREGATED SUMMARY (Role-Specific)
  // -------------------------------------------------------------------------
  async getDashboardSummary(tenantId, role = 'lab_admin', options = {}) {
    await tenantUserService.assertTenantReady(tenantId);

    const PatientModel = tenantConnectionService.getTenantPatientModel(tenantId);
    const OrderModel = tenantConnectionService.getTenantOrderModel(tenantId);
    const SampleModel = tenantConnectionService.getTenantSampleModel(tenantId);
    const ReportModel = tenantConnectionService.getTenantReportModel(tenantId);

    const countsPromise = (async () => {
      if (PatientModel && OrderModel && SampleModel && ReportModel) {
        const [
          totalPatients,
          totalOrders,
          pendingCollectionSamples,
          inAnalysisSamples,
          activeQueueSamples,
          pendingReviewReports,
          approvedReports,
          rejectedReports,
          releasedReports,
        ] = await Promise.all([
          PatientModel.countDocuments({ tenantId, isActive: { $ne: false } }),
          OrderModel.countDocuments({ tenantId }),
          SampleModel.countDocuments({ tenantId, collectionStatus: 'pending' }),
          SampleModel.countDocuments({ tenantId, processingStatus: 'in_analysis' }),
          SampleModel.countDocuments({ tenantId, processingStatus: { $ne: 'completed' }, collectionStatus: { $ne: 'rejected' } }),
          ReportModel.countDocuments({ tenantId, status: { $in: ['draft', 'pending_review'] } }),
          ReportModel.countDocuments({ tenantId, status: 'approved' }),
          ReportModel.countDocuments({ tenantId, status: 'rejected' }),
          ReportModel.countDocuments({ tenantId, status: 'released' }),
        ]);
        return {
          totalPatients,
          totalOrders,
          pendingCollectionSamples,
          inAnalysisSamples,
          activeQueueSamples,
          pendingReviewReports,
          approvedReports,
          rejectedReports,
          releasedReports,
        };
      }

      // In-memory fallback for offline test suites
      const tenantPatients = this.memoryPatients.get(tenantId) || new Map();
      const tenantOrders = this.memoryOrders.get(tenantId) || new Map();
      const tenantSamples = this.memorySamples.get(tenantId) || new Map();
      const tenantReports = this.memoryReports.get(tenantId) || new Map();

      const patientList = Array.from(tenantPatients.values());
      const orderList = Array.from(tenantOrders.values());
      const sampleList = Array.from(tenantSamples.values());
      const reportList = Array.from(tenantReports.values());

      return {
        totalPatients: patientList.filter((p) => p.isActive !== false).length,
        totalOrders: orderList.length,
        pendingCollectionSamples: sampleList.filter((s) => s.collectionStatus === 'pending').length,
        inAnalysisSamples: sampleList.filter((s) => s.processingStatus === 'in_analysis').length,
        activeQueueSamples: sampleList.filter((s) => s.processingStatus !== 'completed' && s.collectionStatus !== 'rejected').length,
        pendingReviewReports: reportList.filter((r) => r.status === 'draft' || r.status === 'pending_review').length,
        approvedReports: reportList.filter((r) => r.status === 'approved').length,
        rejectedReports: reportList.filter((r) => r.status === 'rejected').length,
        releasedReports: reportList.filter((r) => r.status === 'released').length,
      };
    })();

    const [patients, orders, samples, reports, billing, todaySummary, staffList, counts] = await Promise.all([
      this.listPatients(tenantId, { limit: 10 }),
      this.listOrders(tenantId, { limit: 10 }),
      this.listSamples(tenantId, { limit: 50 }),
      this.listReports(tenantId, { limit: 50 }),
      this.getBillingSummary(tenantId),
      this.getTodayOrderSummary(tenantId, options),
      tenantUserService.listUsers(tenantId).catch(() => []),
      countsPromise,
    ]);

    const metrics = {
      todayOrders: todaySummary.todayOrders,
      pendingOrders: todaySummary.pendingOrders,
      samplesCollected: todaySummary.samplesCollected,
      reportsReleased: todaySummary.reportsReleased,
      averageTatMinutes: todaySummary.averageTatMinutes,
      formattedTat: todaySummary.formattedTat,
      tatReportCount: todaySummary.tatReportCount,
      tat: todaySummary.formattedTat,
      totalPatients: counts.totalPatients,
      totalOrders: counts.totalOrders,
      totalStaff: staffList.length,
      pendingCollectionSamples: counts.pendingCollectionSamples,
      inAnalysisSamples: counts.inAnalysisSamples,
      activeQueueSamples: counts.activeQueueSamples,
      pendingReviewReports: counts.pendingReviewReports,
      approvedReports: counts.approvedReports,
      rejectedReports: counts.rejectedReports,
      releasedReports: counts.releasedReports,
      totalRevenue: billing.totalRevenue,
      totalOutstanding: billing.totalOutstanding,
    };

    // Prioritize actionable bench specimens (pending, in_analysis, results_entered) over completed ones,
    // ensuring active work is not crowded out by completed runs
    const actionableSamples = samples.filter(
      (s) => s.processingStatus !== 'completed' && s.collectionStatus !== 'rejected'
    );
    const completedOrArchived = samples.filter(
      (s) => s.processingStatus === 'completed' || s.collectionStatus === 'rejected'
    );
    const queueSamples = [...actionableSamples, ...completedOrArchived].slice(0, 30);

    // Prioritize actionable reports in the Pathologist queue:
    // 1. Pending Review / Drafts (requiring Pathologist Review & Sign-Off)
    // 2. Approved reports awaiting release
    // 3. Rejected reports (returned for technician correction)
    // 4. Released reports (completed history)
    const pendingReviewReportsList = reports.filter(
      (r) => r.status === 'draft' || r.status === 'pending_review'
    );
    const approvedReportsList = reports.filter((r) => r.status === 'approved');
    const rejectedReportsList = reports.filter((r) => r.status === 'rejected');
    const releasedReportsList = reports.filter((r) => r.status === 'released');
    const queueReports = [
      ...pendingReviewReportsList,
      ...approvedReportsList,
      ...rejectedReportsList,
      ...releasedReportsList,
    ];

    return {
      role,
      todaySummary,
      metrics,
      staff: staffList.map((u) => ({
        userId: u.userId,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        department: u.department,
        phone: u.phone,
        isActive: u.isActive,
        createdAt: u.createdAt,
      })),
      recentPatients: patients.slice(0, 5),
      recentOrders: orders.slice(0, 5),
      recentSamples: queueSamples,
      recentReports: queueReports,
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
