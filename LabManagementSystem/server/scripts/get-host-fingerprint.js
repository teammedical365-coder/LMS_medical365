/**
 * LMS Medical365 - Node.js Host Machine Fingerprint Generator
 * Windows 10, Windows 11 & Linux WSL2 Deterministic Hardware Identifier
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

export function computeHostFingerprint() {
  const platform = os.platform();
  const seedParts = ['LMS-MED365'];

  if (platform === 'win32') {
    // 1. Windows MachineGuid
    let machineGuid = '';
    try {
      const regOut = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', {
        stdio: ['pipe', 'pipe', 'ignore'],
        encoding: 'utf8',
      });
      const match = regOut.match(/MachineGuid\s+REG_SZ\s+(\S+)/);
      if (match && match[1]) {
        machineGuid = match[1].trim();
      }
    } catch (_) {}

    // 2. Windows Motherboard / System UUID
    let systemUuid = '';
    try {
      const wmicOut = execSync('wmic csproduct get uuid', {
        stdio: ['pipe', 'pipe', 'ignore'],
        encoding: 'utf8',
      });
      const lines = wmicOut.split('\n').map((l) => l.trim()).filter((l) => l && l !== 'UUID');
      if (lines.length > 0) {
        systemUuid = lines[0];
      }
    } catch (_) {}

    if (machineGuid) seedParts.push(`GUID:${machineGuid}`);
    if (systemUuid) seedParts.push(`UUID:${systemUuid}`);
  } else if (platform === 'linux') {
    // Linux host or container
    const machineIdPaths = ['/etc/machine-id', '/var/lib/dbus/machine-id'];
    for (const p of machineIdPaths) {
      if (fs.existsSync(p)) {
        try {
          const id = fs.readFileSync(p, 'utf8').trim();
          if (id) {
            seedParts.push(`LINUX_ID:${id}`);
            break;
          }
        } catch (_) {}
      }
    }
  }

  // Fallback MAC addresses if specific host GUID is not accessible
  if (seedParts.length <= 1) {
    const interfaces = os.networkInterfaces();
    const macs = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
          macs.push(iface.mac.toLowerCase());
        }
      }
    }
    if (macs.length > 0) {
      seedParts.push(`MACS:${macs.sort().join(',')}`);
    } else {
      seedParts.push(`HOST:${os.hostname()}|${os.arch()}`);
    }
  }

  const identityString = seedParts.join('|').toLowerCase();
  return crypto.createHash('sha256').update(identityString).digest('hex').substring(0, 32);
}

export function persistHostFingerprint(fingerprint = null, targetDir = rootDir) {
  const fp = fingerprint || computeHostFingerprint();
  const paths = [
    path.join(targetDir, 'docker/machine.id'),
    path.join(targetDir, 'storage/machine.id'),
  ];

  for (const p of paths) {
    try {
      const dir = path.dirname(p);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(p, fp, 'utf8');
    } catch (_) {}
  }

  // Update docker/local.env if exists
  try {
    const envPath = path.join(targetDir, 'docker/local.env');
    if (fs.existsSync(envPath)) {
      let content = fs.readFileSync(envPath, 'utf8');
      if (content.includes('LMS_MACHINE_FINGERPRINT=')) {
        content = content.replace(/LMS_MACHINE_FINGERPRINT=.*/, `LMS_MACHINE_FINGERPRINT=${fp}`);
      } else {
        content += `\n# Deterministic Host Machine Fingerprint (Windows 10 / Windows 11)\nLMS_MACHINE_FINGERPRINT=${fp}\n`;
      }
      fs.writeFileSync(envPath, content, 'utf8');
    }
  } catch (_) {}

  return fp;
}

const isCli = process.argv[1] && process.argv[1].endsWith('get-host-fingerprint.js');
if (isCli) {
  const fp = persistHostFingerprint();
  console.log(fp);
}
