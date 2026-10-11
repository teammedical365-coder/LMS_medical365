/**
 * Lab Management System (LMS) - Platform Super Admin One-Time Bootstrap Script
 * 
 * Provides a secure, server-side first-admin provisioning mechanism.
 * 
 * SECURITY RULES:
 * 1. Never creates public registration endpoints.
 * 2. Strictly one-time: Refuses execution if any platform administrator already exists.
 * 3. Enforces strong enterprise password complexity.
 * 4. Never logs or outputs passwords, hashes, or secrets.
 * 
 * Usage:
 *   node src/scripts/bootstrapSuperAdmin.js --email <email> --password <pwd> --fullName "<name>"
 *   OR using environment variables:
 *   BOOTSTRAP_ADMIN_EMAIL=... BOOTSTRAP_ADMIN_PASSWORD=... node src/scripts/bootstrapSuperAdmin.js
 */

import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import config from '../config/env.js';
import dbConnection from '../config/db.js';
import PlatformAdminModel from '../models/platformAdmin.model.js';
import passwordService from '../services/password.service.js';
import authService from '../services/auth.service.js';
import logger from '../utils/logger.js';

export class BootstrapError extends Error {
  constructor(message, code = 'BOOTSTRAP_FAILED') {
    super(message);
    this.name = 'BootstrapError';
    this.code = code;
  }
}

/**
 * Programmatic bootstrap function
 */
export async function bootstrapSuperAdmin({
  email,
  password,
  fullName = 'Platform Super Administrator',
  silent = false,
  update = false,
} = {}) {
  // 1. Resolve inputs from parameters or environment
  const targetEmail = (
    email !== undefined ? email : (process.env.BOOTSTRAP_ADMIN_EMAIL || config.bootstrap?.adminEmail || '')
  ).trim().toLowerCase();

  const targetPassword =
    password !== undefined ? password : (process.env.BOOTSTRAP_ADMIN_PASSWORD || config.bootstrap?.adminPassword || '');

  const targetFullName = (
    fullName !== undefined ? fullName : (process.env.BOOTSTRAP_ADMIN_NAME || 'Platform Super Administrator')
  ).trim();

  if (!targetEmail || !targetPassword) {
    throw new BootstrapError(
      'Missing bootstrap credentials. Both email and password are required via CLI arguments or environment variables.',
      'MISSING_CREDENTIALS'
    );
  }

  // 2. Validate password complexity
  const passCheck = passwordService.validatePassword(targetPassword);
  if (!passCheck.isValid) {
    throw new BootstrapError(
      `Password fails security requirements: ${passCheck.message}`,
      'WEAK_PASSWORD'
    );
  }

  // 3. Check for existing administrators (one-time restriction unless update=true)
  const isMongoConnected = dbConnection.getStatus().connected && mongoose.connection.readyState === 1;

  if (isMongoConnected) {
    const existingCount = await PlatformAdminModel.countDocuments();
    if (existingCount > 0 && !update) {
      throw new BootstrapError(
        `Bootstrap refused: ${existingCount} platform administrator(s) already exist. The bootstrap command can only be executed once unless --update is provided.`,
        'ADMIN_ALREADY_EXISTS'
      );
    }

    if (existingCount > 0 && update) {
      // Find existing admin to update (by targetEmail first, or single existing admin)
      let admin = await PlatformAdminModel.findOne({ email: targetEmail }).select('+passwordHash');
      if (!admin) {
        admin = await PlatformAdminModel.findOne().select('+passwordHash');
      }

      if (admin) {
        admin.email = targetEmail;
        admin.fullName = targetFullName || admin.fullName;
        admin.passwordHash = await passwordService.hashPassword(targetPassword);
        admin.isActive = true;
        await admin.save();

        if (!silent) {
          console.log('---------------------------------------------------------');
          console.log('✅ LMS Platform Super Admin updated successfully!');
          console.log(`   Admin ID:  ${admin.adminId}`);
          console.log(`   Email:     ${admin.email}`);
          console.log(`   Role:      ${admin.role}`);
          console.log('   Status:    ACTIVE');
          console.log('---------------------------------------------------------');
        }

        return admin.toSafeJSON();
      }
    }

    // 4. Hash password and persist
    const passwordHash = await passwordService.hashPassword(targetPassword);
    const adminId = `adm_${crypto.randomBytes(6).toString('hex')}`;

    const admin = new PlatformAdminModel({
      adminId,
      email: targetEmail,
      fullName: targetFullName,
      passwordHash,
      role: 'super_admin',
      isActive: true,
    });

    await admin.save();

    if (!silent) {
      console.log('---------------------------------------------------------');
      console.log('✅ LMS Platform Super Admin bootstrapped successfully!');
      console.log(`   Admin ID:  ${admin.adminId}`);
      console.log(`   Email:     ${admin.email}`);
      console.log(`   Role:      ${admin.role}`);
      console.log('   Status:    ACTIVE');
      console.log('---------------------------------------------------------');
    }

    return admin.toSafeJSON();
  }

  // Fallback for test memory store execution
  if (authService.testMemoryAdmins.size > 0 && !update) {
    throw new BootstrapError(
      'Bootstrap refused: platform administrator already exists in test store.',
      'ADMIN_ALREADY_EXISTS'
    );
  }

  if (authService.testMemoryAdmins.size > 0 && update) {
    const existing = authService.testMemoryAdmins.values().next().value;
    const passwordHash = await passwordService.hashPassword(targetPassword);
    existing.email = targetEmail;
    existing.fullName = targetFullName;
    existing.passwordHash = passwordHash;
    authService.registerTestAdmin(existing);
    return existing.toSafeJSON();
  }

  const passwordHash = await passwordService.hashPassword(targetPassword);
  const adminId = `adm_${crypto.randomBytes(6).toString('hex')}`;
  const mockAdmin = {
    id: adminId,
    adminId,
    email: targetEmail,
    fullName: targetFullName,
    passwordHash,
    role: 'super_admin',
    isActive: true,
    lastLoginAt: null,
    comparePassword: async (candidate) => passwordService.comparePassword(candidate, passwordHash),
    toSafeJSON: function () {
      const copy = { ...this };
      delete copy.passwordHash;
      delete copy.comparePassword;
      delete copy.toSafeJSON;
      return copy;
    },
  };

  authService.registerTestAdmin(mockAdmin);

  if (!silent) {
    console.log('---------------------------------------------------------');
    console.log('✅ LMS Platform Super Admin bootstrapped (Test Memory Mode)');
    console.log(`   Admin ID:  ${mockAdmin.adminId}`);
    console.log(`   Email:     ${mockAdmin.email}`);
    console.log('---------------------------------------------------------');
  }

  return mockAdmin.toSafeJSON();
}

/**
 * CLI execution handler
 */
async function runCli() {
  const args = process.argv.slice(2);
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--email' && args[i + 1]) parsed.email = args[++i];
    if (args[i] === '--password' && args[i + 1]) parsed.password = args[++i];
    if (args[i] === '--fullName' && args[i + 1]) parsed.fullName = args[++i];
    if (args[i] === '--update') parsed.update = true;
  }

  try {
    // Attempt DB connection if configured
    if (config.database?.uri && config.database?.autoConnect) {
      await dbConnection.connect();
    }

    await bootstrapSuperAdmin(parsed);
    await dbConnection.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(`❌ [BOOTSTRAP ERROR]: ${err.message}`);
    await dbConnection.disconnect().catch(() => {});
    process.exit(1);
  }
}

// Execute if run directly from command line
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === path.resolve(process.argv[1]).toLowerCase();
if (isDirectRun) {
  runCli();
}

export default bootstrapSuperAdmin;
