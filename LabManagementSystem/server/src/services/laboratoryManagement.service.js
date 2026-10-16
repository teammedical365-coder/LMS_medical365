/**
 * Lab Management System (LMS) - Laboratory Management Service
 * 
 * Handles Super Admin laboratory registration, lifecycle transitions,
 * profile updates, and database provisioning coordination.
 */

import dns from 'dns';
import mongoose from 'mongoose';
import config from '../config/env.js';
import TenantModel, { generateTenantId, normalizeDomain, generateDomainVerificationToken } from '../models/tenant.model.js';
import { LAB_STATUS, PROVISIONING_STATUS, AUDIT_ACTIONS, isValidStatusTransition } from '../config/constants.js';
import tenantProvisioningService, { deriveDatabaseName } from './tenantProvisioning.service.js';
import auditLogService from './auditLog.service.js';
import passwordService from './password.service.js';
import tenantUserService from './tenantUser.service.js';
import roleService from './role.service.js';
import { USER_ROLES } from '../config/constants.js';
import dbConnection from '../config/db.js';
import logger from '../utils/logger.js';

export class LaboratoryManagementError extends Error {
  constructor(message, statusCode = 400, code = 'BAD_REQUEST') {
    super(message);
    this.name = 'LaboratoryManagementError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

class LaboratoryManagementService {
  constructor() {
    // In-memory tenant store fallback when MongoDB is not connected
    this.memoryTenants = new Map();
    this.dnsResolver = null; // Defaults to dns.promises.resolveTxt unless custom injected
    this.initDefaultMemoryTenants();
  }

  setDnsResolver(resolver) {
    this.dnsResolver = resolver;
  }

  initDefaultMemoryTenants() {
    // Only real laboratories created by users/super-admin are stored
  }

  isMongoActive() {
    return dbConnection.getStatus().connected;
  }

  /**
   * Platform overview with total laboratories, status breakdowns, and health
   */
  async getPlatformOverview() {
    if (this.isMongoActive()) {
      const [
        totalLaboratories,
        activeLaboratories,
        pendingLaboratories,
        suspendedLaboratories,
        inactiveLaboratories,
        readyProvisioned,
      ] = await Promise.all([
        TenantModel.countDocuments({}),
        TenantModel.countDocuments({ status: LAB_STATUS.ACTIVE }),
        TenantModel.countDocuments({ status: LAB_STATUS.PENDING }),
        TenantModel.countDocuments({ status: LAB_STATUS.SUSPENDED }),
        TenantModel.countDocuments({ status: LAB_STATUS.INACTIVE }),
        TenantModel.countDocuments({ 'database.provisioningStatus': PROVISIONING_STATUS.READY }),
      ]);

      return {
        totalLaboratories,
        activeLaboratories,
        pendingLaboratories,
        suspendedLaboratories,
        inactiveLaboratories,
        readyProvisioned,
        systemHealth: 'OPERATIONAL',
      };
    }

    // In-memory fallback
    const list = Array.from(this.memoryTenants.values());
    return {
      totalLaboratories: list.length,
      activeLaboratories: list.filter((l) => l.status === LAB_STATUS.ACTIVE).length,
      pendingLaboratories: list.filter((l) => l.status === LAB_STATUS.PENDING).length,
      suspendedLaboratories: list.filter((l) => l.status === LAB_STATUS.SUSPENDED).length,
      inactiveLaboratories: list.filter((l) => l.status === LAB_STATUS.INACTIVE).length,
      readyProvisioned: list.filter((l) => l.database?.provisioningStatus === PROVISIONING_STATUS.READY).length,
      systemHealth: 'OPERATIONAL',
    };
  }

  /**
   * List laboratories with pagination, search, and status filters
   */
  async listLaboratories({ page = 1, limit = 10, status = null, provisioningStatus = null, q = null } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    if (this.isMongoActive()) {
      const filter = {};
      if (status && Object.values(LAB_STATUS).includes(status)) {
        filter.status = status;
      }
      if (provisioningStatus && Object.values(PROVISIONING_STATUS).includes(provisioningStatus)) {
        filter['database.provisioningStatus'] = provisioningStatus;
      }
      if (q && typeof q === 'string') {
        const cleanQ = q.trim();
        filter.$or = [
          { name: { $regex: cleanQ, $options: 'i' } },
          { code: { $regex: cleanQ, $options: 'i' } },
          { email: { $regex: cleanQ, $options: 'i' } },
        ];
      }

      const [docs, total] = await Promise.all([
        TenantModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
        TenantModel.countDocuments(filter),
      ]);

      const rawLabs = docs.map((d) => d.toSafeJSON());
      const laboratoriesWithStaff = await Promise.all(
        rawLabs.map(async (lab) => {
          try {
            const users = await tenantUserService.listUsers(lab.tenantId);
            const admin = users.find((u) => u.role === 'lab_admin') || null;
            return {
              ...lab,
              adminUser: admin ? {
                fullName: admin.fullName,
                email: admin.email,
                phone: admin.phone || null,
                role: admin.role,
              } : null,
              staffCount: users.length,
              staff: users.map((u) => ({
                userId: u.userId,
                fullName: u.fullName,
                email: u.email,
                role: u.role,
                department: u.department,
                phone: u.phone,
                isActive: u.isActive,
              })),
            };
          } catch {
            return {
              ...lab,
              adminUser: null,
              staffCount: 0,
              staff: [],
            };
          }
        })
      );

      return {
        laboratories: laboratoriesWithStaff,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum) || 1,
        },
      };
    }

    // In-memory fallback
    let list = Array.from(this.memoryTenants.values());

    if (status) {
      list = list.filter((l) => l.status === status);
    }
    if (provisioningStatus) {
      list = list.filter((l) => l.database?.provisioningStatus === provisioningStatus);
    }
    if (q) {
      const search = q.toLowerCase();
      list = list.filter((l) =>
        l.name.toLowerCase().includes(search) ||
        l.code.toLowerCase().includes(search) ||
        l.email.toLowerCase().includes(search)
      );
    }

    const total = list.length;
    const paginated = list.slice(skip, skip + limitNum);

    const laboratoriesWithStaff = await Promise.all(
      paginated.map(async (lab) => {
        try {
          const users = await tenantUserService.listUsers(lab.tenantId);
          const admin = users.find((u) => u.role === 'lab_admin') || null;
          return {
            ...lab,
            adminUser: admin ? {
              fullName: admin.fullName,
              email: admin.email,
              phone: admin.phone || null,
              role: admin.role,
            } : null,
            staffCount: users.length,
            staff: users,
          };
        } catch {
          return {
            ...lab,
            adminUser: null,
            staffCount: 0,
            staff: [],
          };
        }
      })
    );

    return {
      laboratories: laboratoriesWithStaff,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  }

  /**
   * Retrieve single laboratory by tenantId or internal _id
   */
  async getLaboratoryById(idOrTenantId, { includeStaff = false } = {}) {
    if (!idOrTenantId) {
      throw new LaboratoryManagementError('Laboratory ID is required', 400);
    }

    let lab = null;

    if (this.isMongoActive()) {
      const isObjectId = mongoose.Types.ObjectId.isValid(idOrTenantId);
      const query = isObjectId
        ? { $or: [{ _id: idOrTenantId }, { tenantId: idOrTenantId }] }
        : { tenantId: idOrTenantId };

      const doc = await TenantModel.findOne(query);
      if (!doc) {
        throw new LaboratoryManagementError(`Laboratory not found with identifier: ${idOrTenantId}`, 404);
      }
      lab = doc.toSafeJSON();
    } else {
      // In-memory fallback
      const tenant = this.memoryTenants.get(idOrTenantId) ||
        Array.from(this.memoryTenants.values()).find((l) => l.tenantId === idOrTenantId || l.code === idOrTenantId);

      if (!tenant) {
        throw new LaboratoryManagementError(`Laboratory not found with identifier: ${idOrTenantId}`, 404);
      }
      lab = { ...tenant };
    }

    if (lab && includeStaff) {
      try {
        const users = await tenantUserService.listUsers(lab.tenantId);
        const adminUser = users.find((u) => u.role === 'lab_admin') || null;
        lab.adminUser = adminUser ? {
          fullName: adminUser.fullName,
          email: adminUser.email,
          phone: adminUser.phone || null,
          role: adminUser.role,
          createdAt: adminUser.createdAt,
        } : null;
        lab.staff = users.map((u) => ({
          userId: u.userId,
          fullName: u.fullName,
          email: u.email,
          role: u.role,
          department: u.department,
          phone: u.phone,
          isActive: u.isActive,
          createdAt: u.createdAt,
        }));
        lab.staffCount = users.length;
      } catch {
        lab.adminUser = null;
        lab.staff = [];
        lab.staffCount = 0;
      }
    } else if (lab) {
      lab.adminUser = null;
      lab.staff = [];
      lab.staffCount = 0;
    }

    return lab;
  }

  /**
   * Register a new laboratory
   */
  async registerLaboratory(input, actor = {}) {
    // 1. Validate required fields
    if (!input.name || !input.name.trim()) {
      throw new LaboratoryManagementError('Laboratory name is required', 400);
    }
    if (!input.code || !input.code.trim()) {
      throw new LaboratoryManagementError('Laboratory unique code is required', 400);
    }
    const labEmail = (input.email || input.contactEmail || '').trim();
    if (!labEmail) {
      throw new LaboratoryManagementError('Contact email address is required', 400);
    }

    // Normalize code
    const cleanCode = input.code.trim().toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanCode) || cleanCode.length < 2 || cleanCode.length > 30) {
      throw new LaboratoryManagementError(
        'Laboratory code must be 2-30 characters of lowercase letters, numbers, and hyphens',
        400
      );
    }

    // 2. Server generates internal tenantId and derives database name
    const tenantId = generateTenantId();
    const databaseName = deriveDatabaseName(tenantId);

    // 3. Normalize and validate domains - All newly registered domains start UNVERIFIED
    const normalizedDomains = [];
    if (Array.isArray(input.domains)) {
      for (const d of input.domains) {
        const rawDomain = typeof d === 'string' ? d : d.domain;
        const cleanDomain = normalizeDomain(rawDomain);
        if (cleanDomain) {
          normalizedDomains.push({
            domain: cleanDomain,
            isVerified: false, // Security rule: Client input can NEVER pre-verify a domain
            verifiedAt: null,
            verificationToken: generateDomainVerificationToken(cleanDomain, tenantId),
            verificationMethod: 'DNS_TXT',
            verificationError: null,
            lastCheckedAt: null,
          });
        }
      }
    }

    // 4. Uniqueness validation: Duplicate code check
    await this.assertCodeIsUnique(cleanCode);

    // 5. Uniqueness validation: Duplicate domain check
    for (const d of normalizedDomains) {
      await this.assertDomainIsUnique(d.domain);
    }

    // 6. Whitelist allowed fields to prevent mass assignment
    const rawAdmin = input.initialAdmin || input.adminUser || (input.adminEmail && input.adminPassword ? {
      fullName: input.adminFullName || `${input.name.trim()} Administrator`,
      email: input.adminEmail,
      password: input.adminPassword,
      phone: input.adminPhone || input.phone,
    } : null);

    if (rawAdmin) {
      if (!rawAdmin.email || !rawAdmin.password) {
        throw new LaboratoryManagementError('Initial Lab Admin email and password are required', 400);
      }
      const passCheck = passwordService.validatePassword(rawAdmin.password);
      if (!passCheck.isValid) {
        throw new LaboratoryManagementError(`Initial Lab Admin password fails security requirements: ${passCheck.message}`, 400);
      }
    }

    const labRecord = {
      tenantId,
      code: cleanCode,
      name: input.name.trim(),
      legalName: input.legalName?.trim() || null,
      email: labEmail.toLowerCase(),
      phone: (input.phone || input.contactPhone)?.trim() || null,
      address: {
        street: input.address?.street?.trim() || '',
        city: input.address?.city?.trim() || '',
        state: input.address?.state?.trim() || '',
        postalCode: input.address?.postalCode?.trim() || '',
        country: input.address?.country?.trim() || 'US',
      },
      timezone: input.timezone?.trim() || 'UTC',
      locale: input.locale?.trim() || 'en-US',
      status: LAB_STATUS.PENDING, // Always starts in PENDING
      plan: ['starter', 'standard', 'enterprise'].includes(input.plan) ? input.plan : 'standard',
      branding: {
        displayName: input.branding?.displayName?.trim() || input.name.trim(),
        primaryColor: input.branding?.primaryColor || '#2563EB',
        accentColor: input.branding?.accentColor || '#22C1DC',
        logoUrl: input.branding?.logoUrl || null,
        faviconUrl: input.branding?.faviconUrl || null,
        loginBannerText: input.branding?.loginBannerText || null,
        supportEmail: input.branding?.supportEmail || input.email.trim().toLowerCase(),
      },
      domains: normalizedDomains,
      database: {
        name: databaseName,
        provisioningStatus: PROVISIONING_STATUS.NOT_STARTED,
        provisionedAt: null,
        provisioningError: null,
        retryCount: 0,
        collectionsInitialized: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let savedLab = null;

    if (this.isMongoActive()) {
      try {
        const doc = new TenantModel(labRecord);
        await doc.save();
        savedLab = doc;
      } catch (err) {
        if (err.code === 11000) {
          throw new LaboratoryManagementError('A laboratory with this code or domain already exists.', 409, 'DUPLICATE_KEY');
        }
        throw new LaboratoryManagementError(err.message, 400);
      }
    } else {
      this.memoryTenants.set(tenantId, labRecord);
      savedLab = labRecord;
    }

    // Audit log
    await auditLogService.logEvent({
      action: AUDIT_ACTIONS.LAB_REGISTERED,
      targetTenantId: tenantId,
      actor,
      metadata: {
        code: cleanCode,
        name: labRecord.name,
        plan: labRecord.plan,
        domainsCount: normalizedDomains.length,
        hasInitialAdmin: !!rawAdmin,
      },
    });

    // 7. Trigger database provisioning immediately
    logger.info(`[LIFECYCLE] Triggering database provisioning for new laboratory: ${cleanCode} (${tenantId})`);
    let provResult = null;
    try {
      provResult = await tenantProvisioningService.provisionLaboratory(savedLab);
    } catch (provErr) {
      logger.error(`[LIFECYCLE] Provisioning trigger encountered error for ${tenantId}: ${provErr.message}`);
    }

    let initialAdminCreated = null;
    const isProvReady = (savedLab.database?.provisioningStatus === PROVISIONING_STATUS.READY) ||
                        (provResult && provResult.status === PROVISIONING_STATUS.READY);

    if (isProvReady) {
      try {
        await roleService.seedDefaultRoles(tenantId);
      } catch (roleErr) {
        logger.warn(`[ROLES] Default role seeding warning for ${tenantId}: ${roleErr.message}`);
      }

      if (rawAdmin) {
        try {
          // Transition tenant to ACTIVE so initial Lab Admin can authenticate
          await this.transitionStatus(tenantId, LAB_STATUS.ACTIVE, 'Initial onboarding activation with admin', actor);

          initialAdminCreated = await tenantUserService.createUser(tenantId, {
            email: rawAdmin.email,
            password: rawAdmin.password,
            fullName: rawAdmin.fullName?.trim() || `${labRecord.name} Administrator`,
            role: USER_ROLES.LAB_ADMIN,
            phone: rawAdmin.phone || null,
          }, actor);

          logger.info(`[ONBOARDING] Initial Lab Admin created for ${cleanCode} (${tenantId}): ${initialAdminCreated.email}`);
        } catch (adminErr) {
          logger.error(`[ONBOARDING] Failed to create initial Lab Admin for ${tenantId}: ${adminErr.message}`);
        }
      }
    }

    const finalLab = await this.getLaboratoryById(tenantId);
    if (initialAdminCreated) {
      finalLab.initialAdmin = initialAdminCreated;
    }
    return finalLab;
  }

  /**
   * Update allowed laboratory profile fields
   */
  async updateLaboratory(idOrTenantId, input, actor = {}) {
    const existing = await this.getLaboratoryById(idOrTenantId);
    const tenantId = existing.tenantId;

    // Explicit allowlist of updatable fields (cannot modify tenantId, code, or database.name)
    const updates = {};
    if (input.name && input.name.trim()) updates.name = input.name.trim();
    if (input.legalName !== undefined) updates.legalName = input.legalName ? input.legalName.trim() : null;
    if (input.email && input.email.trim()) updates.email = input.email.trim().toLowerCase();
    if (input.phone !== undefined) updates.phone = input.phone ? input.phone.trim() : null;
    if (input.timezone) updates.timezone = input.timezone.trim();
    if (input.locale) updates.locale = input.locale.trim();
    if (input.plan && ['starter', 'standard', 'enterprise'].includes(input.plan)) updates.plan = input.plan;
    if (input.address) {
      updates.address = {
        street: input.address.street?.trim() || existing.address?.street || '',
        city: input.address.city?.trim() || existing.address?.city || '',
        state: input.address.state?.trim() || existing.address?.state || '',
        postalCode: input.address.postalCode?.trim() || existing.address?.postalCode || '',
        country: input.address.country?.trim() || existing.address?.country || 'US',
      };
    }
    if (input.branding) {
      updates.branding = {
        displayName: input.branding.displayName !== undefined ? input.branding.displayName : (existing.branding?.displayName || existing.name),
        primaryColor: input.branding.primaryColor || existing.branding?.primaryColor || '#2563EB',
        accentColor: input.branding.accentColor || existing.branding?.accentColor || '#22C1DC',
        logoUrl: input.branding.logoUrl !== undefined ? input.branding.logoUrl : existing.branding?.logoUrl,
        faviconUrl: input.branding.faviconUrl !== undefined ? input.branding.faviconUrl : existing.branding?.faviconUrl,
        loginBannerText: input.branding.loginBannerText !== undefined ? input.branding.loginBannerText : existing.branding?.loginBannerText,
        supportEmail: input.branding.supportEmail !== undefined ? input.branding.supportEmail : existing.branding?.supportEmail,
      };
    }

    // Handle domain updates
    if (Array.isArray(input.domains)) {
      const normalizedDomains = [];
      for (const d of input.domains) {
        const rawDomain = typeof d === 'string' ? d : d.domain;
        const cleanDomain = normalizeDomain(rawDomain);
        if (cleanDomain) {
          // Check domain uniqueness against OTHER tenants
          await this.assertDomainIsUnique(cleanDomain, tenantId);
          normalizedDomains.push({
            domain: cleanDomain,
            isVerified: typeof d === 'object' && d.isVerified === true,
            verifiedAt: typeof d === 'object' && d.isVerified ? new Date() : null,
          });
        }
      }
      updates.domains = normalizedDomains;
    }

    updates.updatedAt = new Date();

    if (this.isMongoActive()) {
      const doc = await TenantModel.findOneAndUpdate({ tenantId }, { $set: updates }, { new: true });
      await auditLogService.logEvent({
        action: AUDIT_ACTIONS.LAB_UPDATED,
        targetTenantId: tenantId,
        actor,
        metadata: { updatedFields: Object.keys(updates) },
      });
      return doc.toSafeJSON();
    }

    // Memory update
    const memoryRecord = this.memoryTenants.get(tenantId);
    Object.assign(memoryRecord, updates);
    this.memoryTenants.set(tenantId, memoryRecord);

    await auditLogService.logEvent({
      action: AUDIT_ACTIONS.LAB_UPDATED,
      targetTenantId: tenantId,
      actor,
      metadata: { updatedFields: Object.keys(updates) },
    });

    return memoryRecord;
  }

  /**
   * Delete laboratory and clean up associated records
   */
  async deleteLaboratory(idOrTenantId, actor = {}) {
    const existing = await this.getLaboratoryById(idOrTenantId);
    const tenantId = existing.tenantId;

    if (this.isMongoActive()) {
      await TenantModel.deleteOne({ $or: [{ tenantId }, { _id: existing.id || existing._id }] });
      try {
        if (mongoose.connection && mongoose.connection.collection) {
          await mongoose.connection.collection('users').deleteMany({ tenantId });
        }
      } catch (err) {
        logger.warn(`[DELETE_LAB] Non-critical user cleanup warning for ${tenantId}: ${err.message}`);
      }

      await auditLogService.logEvent({
        action: AUDIT_ACTIONS.LAB_DELETED,
        targetTenantId: tenantId,
        actor,
        metadata: { name: existing.name, code: existing.code },
      });
      return { success: true, tenantId, code: existing.code };
    }

    // In-memory
    this.memoryTenants.delete(tenantId);
    await auditLogService.logEvent({
      action: 'LABORATORY_DELETED',
      targetTenantId: tenantId,
      actor,
      metadata: { name: existing.name, code: existing.code },
    });
    return { success: true, tenantId, code: existing.code };
  }

  /**
   * Transition laboratory lifecycle status
   */
  async transitionStatus(idOrTenantId, targetStatus, reason = null, actor = {}) {
    const existing = await this.getLaboratoryById(idOrTenantId);
    const tenantId = existing.tenantId;

    if (!Object.values(LAB_STATUS).includes(targetStatus)) {
      throw new LaboratoryManagementError(`Invalid target status: ${targetStatus}`, 400);
    }

    const currentStatus = existing.status;

    // Validate state machine rule
    if (!isValidStatusTransition(currentStatus, targetStatus)) {
      throw new LaboratoryManagementError(
        `Invalid lifecycle status transition from ${currentStatus} to ${targetStatus}`,
        422,
        'INVALID_STATUS_TRANSITION'
      );
    }

    // Critical Rule: Can only activate to ACTIVE if tenant database is READY!
    if (targetStatus === LAB_STATUS.ACTIVE) {
      const provStatus = existing.database?.provisioningStatus;
      if (provStatus !== PROVISIONING_STATUS.READY) {
        throw new LaboratoryManagementError(
          `Cannot activate laboratory: Tenant database provisioning is ${provStatus || 'NOT_STARTED'}. Database must be READY before activation.`,
          422,
          'PROVISIONING_NOT_READY'
        );
      }
    }

    const updates = {
      status: targetStatus,
      updatedAt: new Date(),
    };

    let action = AUDIT_ACTIONS.LAB_UPDATED;
    if (targetStatus === LAB_STATUS.ACTIVE) {
      action = currentStatus === LAB_STATUS.SUSPENDED ? AUDIT_ACTIONS.LAB_REACTIVATED : AUDIT_ACTIONS.LAB_ACTIVATED;
    } else if (targetStatus === LAB_STATUS.SUSPENDED) {
      action = AUDIT_ACTIONS.LAB_SUSPENDED;
    } else if (targetStatus === LAB_STATUS.INACTIVE) {
      action = AUDIT_ACTIONS.LAB_DEACTIVATED;
    }

    if (this.isMongoActive()) {
      const doc = await TenantModel.findOneAndUpdate({ tenantId }, { $set: updates }, { new: true });
      await auditLogService.logEvent({
        action,
        targetTenantId: tenantId,
        actor,
        metadata: { from: currentStatus, to: targetStatus, reason },
      });
      return doc.toSafeJSON();
    }

    // Memory update
    const memoryRecord = this.memoryTenants.get(tenantId);
    memoryRecord.status = targetStatus;
    memoryRecord.updatedAt = new Date();

    await auditLogService.logEvent({
      action,
      targetTenantId: tenantId,
      actor,
      metadata: { from: currentStatus, to: targetStatus, reason },
    });

    return memoryRecord;
  }

  async transitionLaboratoryStatus(idOrTenantId, targetStatus, reason = null, actor = {}) {
    return this.transitionStatus(idOrTenantId, targetStatus, reason, actor);
  }

  /**
   * Retrieve safe provisioning status
   */
  async getProvisioningStatus(idOrTenantId) {
    const lab = await this.getLaboratoryById(idOrTenantId);
    return {
      tenantId: lab.tenantId,
      code: lab.code,
      name: lab.name,
      database: {
        name: lab.database?.name,
        provisioningStatus: lab.database?.provisioningStatus || PROVISIONING_STATUS.NOT_STARTED,
        provisionedAt: lab.database?.provisionedAt || null,
        provisioningError: lab.database?.provisioningError || null,
        retryCount: lab.database?.retryCount || 0,
        collectionsInitialized: lab.database?.collectionsInitialized || [],
      },
    };
  }

  /**
   * Retry database provisioning idempotently
   */
  async retryProvisioning(idOrTenantId, actor = {}) {
    const lab = await this.getLaboratoryById(idOrTenantId);
    const tenantId = lab.tenantId;

    if (this.isMongoActive()) {
      const doc = await TenantModel.findOne({ tenantId });
      const result = await tenantProvisioningService.retryProvisioning(doc);
      return result;
    }

    // Memory retry
    const memoryRecord = this.memoryTenants.get(tenantId);
    const result = await tenantProvisioningService.retryProvisioning(memoryRecord);
    return result;
  }

  /**
   * Verify domain ownership using trusted DNS challenge record lookup
   * 
   * SECURITY RULE:
   * Prevents unverified domains from being marked as verified without
   * proving DNS ownership via matching TXT record at `_lms-challenge.<domain>`.
   */
  async verifyDomain(idOrTenantId, domainToVerify, actor = {}) {
    const lab = await this.getLaboratoryById(idOrTenantId);
    const cleanDomain = normalizeDomain(domainToVerify);
    const tenantId = lab.tenantId;

    if (!cleanDomain) {
      throw new LaboratoryManagementError('Valid domain hostname is required', 400);
    }

    const domainEntry = lab.domains?.find((d) => d.domain === cleanDomain);
    if (!domainEntry) {
      throw new LaboratoryManagementError(`Domain ${cleanDomain} is not mapped to this laboratory`, 404);
    }

    const expectedToken = domainEntry.verificationToken || generateDomainVerificationToken(cleanDomain, tenantId);
    const challengeHost = `_lms-challenge.${cleanDomain}`;

    // Perform real DNS TXT query for _lms-challenge.<cleanDomain>
    let isDnsVerified = false;
    let dnsFailureDetail = null;

    try {
      const resolver = this.dnsResolver || dns.promises.resolveTxt;
      const records = await resolver(challengeHost);
      const flat = Array.isArray(records) ? records.flat().map((r) => String(r).trim()) : [];
      if (flat.includes(expectedToken)) {
        isDnsVerified = true;
      } else {
        dnsFailureDetail = `DNS TXT record found at ${challengeHost} (${flat.join(', ') || 'empty'}), but does not match expected verification token (${expectedToken}).`;
      }
    } catch (dnsErr) {
      dnsFailureDetail = `DNS TXT query failed for ${challengeHost}: ${dnsErr.code || dnsErr.message}. No verification record found.`;
    }

    const now = new Date();

    if (!isDnsVerified) {
      // Record failure state and keep domain unverified
      if (this.isMongoActive()) {
        await TenantModel.findOneAndUpdate(
          { tenantId, 'domains.domain': cleanDomain },
          {
            $set: {
              'domains.$.isVerified': false,
              'domains.$.verificationToken': expectedToken,
              'domains.$.lastCheckedAt': now,
              'domains.$.verificationError': dnsFailureDetail,
            },
          }
        );
      } else {
        const memoryRecord = this.memoryTenants.get(tenantId);
        if (memoryRecord) {
          const entry = memoryRecord.domains?.find((d) => d.domain === cleanDomain);
          if (entry) {
            entry.isVerified = false;
            entry.verificationToken = expectedToken;
            entry.lastCheckedAt = now;
            entry.verificationError = dnsFailureDetail;
          }
        }
      }

      await auditLogService.logEvent({
        action: 'DOMAIN_VERIFICATION_FAILED',
        targetTenantId: tenantId,
        status: 'FAILURE',
        metadata: {
          domain: cleanDomain,
          challengeHost,
          expectedToken,
          error: dnsFailureDetail,
        },
      });

      throw new LaboratoryManagementError(
        `Domain ownership verification failed for '${cleanDomain}'. ${dnsFailureDetail} Required DNS configuration: Add a DNS TXT record with host '${challengeHost}' and value '${expectedToken}'. The domain remains UNVERIFIED.`,
        422,
        'DOMAIN_VERIFICATION_FAILED'
      );
    }

    // Success: Update domain as verified
    if (this.isMongoActive()) {
      const doc = await TenantModel.findOneAndUpdate(
        { tenantId, 'domains.domain': cleanDomain },
        {
          $set: {
            'domains.$.isVerified': true,
            'domains.$.verifiedAt': now,
            'domains.$.lastCheckedAt': now,
            'domains.$.verificationError': null,
          },
        },
        { new: true }
      );

      await auditLogService.logEvent({
        action: 'DOMAIN_VERIFIED',
        targetTenantId: tenantId,
        metadata: { domain: cleanDomain, verifiedAt: now },
      });

      return doc.toSafeJSON();
    }

    // Memory update
    const memoryRecord = this.memoryTenants.get(tenantId);
    const found = memoryRecord.domains.find((d) => d.domain === cleanDomain);
    if (found) {
      found.isVerified = true;
      found.verifiedAt = now;
      found.lastCheckedAt = now;
      found.verificationError = null;
    }

    await auditLogService.logEvent({
      action: 'DOMAIN_VERIFIED',
      targetTenantId: tenantId,
      metadata: { domain: cleanDomain, verifiedAt: now },
    });

    return memoryRecord;
  }

  /**
   * Get Platform Overview Metrics for Super Admin
   */
  async getPlatformOverview() {
    if (this.isMongoActive()) {
      const [total, active, pending, suspended, inactive, failedProvisioning, recentAudits] = await Promise.all([
        TenantModel.countDocuments(),
        TenantModel.countDocuments({ status: LAB_STATUS.ACTIVE }),
        TenantModel.countDocuments({ status: LAB_STATUS.PENDING }),
        TenantModel.countDocuments({ status: LAB_STATUS.SUSPENDED }),
        TenantModel.countDocuments({ status: LAB_STATUS.INACTIVE }),
        TenantModel.countDocuments({ 'database.provisioningStatus': PROVISIONING_STATUS.FAILED }),
        auditLogService.getAuditLogs({ limit: 5 }),
      ]);

      return {
        metrics: {
          totalLaboratories: total,
          activeLaboratories: active,
          pendingLaboratories: pending,
          suspendedLaboratories: suspended,
          inactiveLaboratories: inactive,
          failedProvisioningCount: failedProvisioning,
        },
        recentAudits: recentAudits.items,
      };
    }

    // Memory overview
    const list = Array.from(this.memoryTenants.values());
    const total = list.length;
    const active = list.filter((l) => l.status === LAB_STATUS.ACTIVE).length;
    const pending = list.filter((l) => l.status === LAB_STATUS.PENDING).length;
    const suspended = list.filter((l) => l.status === LAB_STATUS.SUSPENDED).length;
    const inactive = list.filter((l) => l.status === LAB_STATUS.INACTIVE).length;
    const failed = list.filter((l) => l.database?.provisioningStatus === PROVISIONING_STATUS.FAILED).length;
    const audits = await auditLogService.getAuditLogs({ limit: 5 });

    return {
      metrics: {
        totalLaboratories: total,
        activeLaboratories: active,
        pendingLaboratories: pending,
        suspendedLaboratories: suspended,
        inactiveLaboratories: inactive,
        failedProvisioningCount: failed,
      },
      recentAudits: audits.items,
    };
  }

  /**
   * Assert laboratory code is unique
   */
  async assertCodeIsUnique(code, excludeTenantId = null) {
    if (this.isMongoActive()) {
      const query = { code };
      if (excludeTenantId) query.tenantId = { $ne: excludeTenantId };
      const exists = await TenantModel.exists(query);
      if (exists) {
        throw new LaboratoryManagementError(`Laboratory code '${code}' is already in use`, 409, 'DUPLICATE_CODE');
      }
      return;
    }

    for (const [tId, t] of this.memoryTenants.entries()) {
      if (excludeTenantId && tId === excludeTenantId) continue;
      if (t.code === code) {
        throw new LaboratoryManagementError(`Laboratory code '${code}' is already in use`, 409, 'DUPLICATE_CODE');
      }
    }
  }

  /**
   * Assert domain is unique across all tenants
   */
  async assertDomainIsUnique(domain, excludeTenantId = null) {
    if (this.isMongoActive()) {
      const query = { 'domains.domain': domain };
      if (excludeTenantId) query.tenantId = { $ne: excludeTenantId };
      const exists = await TenantModel.exists(query);
      if (exists) {
        throw new LaboratoryManagementError(`Domain '${domain}' is already mapped to another laboratory`, 409, 'DUPLICATE_DOMAIN');
      }
      return;
    }

    for (const [tId, t] of this.memoryTenants.entries()) {
      if (excludeTenantId && tId === excludeTenantId) continue;
      if (t.domains?.some((d) => d.domain === domain)) {
        throw new LaboratoryManagementError(`Domain '${domain}' is already mapped to another laboratory`, 409, 'DUPLICATE_DOMAIN');
      }
    }
  }

  /**
   * Resolve public white-label branding for a domain (or laboratory code)
   * Safe for unauthenticated frontend resolution; never leaks database credentials
   */
  async resolvePublicBranding(domainOrCode) {
    if (!domainOrCode || typeof domainOrCode !== 'string') return null;
    const clean = normalizeDomain(domainOrCode) || domainOrCode.trim().toLowerCase();

    let lab = null;
    if (this.isMongoActive()) {
      lab = await TenantModel.findOne({
        $or: [
          { 'domains.domain': clean },
          { code: clean },
          { tenantId: clean },
        ],
      });
    } else {
      for (const t of this.memoryTenants.values()) {
        if (t.code === clean || t.tenantId === clean || t.domains?.some((d) => d.domain === clean)) {
          lab = t;
          break;
        }
      }
    }

    if (!lab) return null;

    return {
      tenantId: lab.tenantId,
      code: lab.code,
      name: lab.name,
      displayName: lab.branding?.displayName || lab.name,
      branding: {
        displayName: lab.branding?.displayName || lab.name,
        primaryColor: lab.branding?.primaryColor || '#2563EB',
        accentColor: lab.branding?.accentColor || '#22C1DC',
        logoUrl: lab.branding?.logoUrl || null,
        faviconUrl: lab.branding?.faviconUrl || null,
        loginBannerText: lab.branding?.loginBannerText || null,
        supportEmail: lab.branding?.supportEmail || lab.email,
      },
      status: lab.status,
    };
  }
}

export const laboratoryManagementService = new LaboratoryManagementService();
export default laboratoryManagementService;
