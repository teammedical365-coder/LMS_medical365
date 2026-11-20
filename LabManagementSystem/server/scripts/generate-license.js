/**
 * LMS Medical365 - License Generator Utility (Vendor CLI)
 * Signs license payloads with RSA-2048 private key.
 * Private key should only be used by authorized licensing administrators.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { canonicalizePayload } from '../src/services/license.service.js';

// Embedded test/development private key corresponding to server/src/config/licensePublicKey.pem
const DEFAULT_DEV_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDkwwaapOPQf788
jWVTLbnv61dYzvdpm3KBhKKopVbRQp72k0gAq6zy3y+n9YKgHFi2cP/McWPDP3lc
85B276L39aMyfi9Ll0l7/tY3pQe7FPyt1byzhD6sSsc0r3l/mlLJwZHcVpzjdZbr
8vrBuFjj7qb5YYFivVOhyAxQau5m1BI464fLd25RSVbv+C4eF36wYMgtO5Sh8WPt
zWZ+MGxFdYMVsBvSmM9IT2mHwGUQQkFSuKqEDG87UYzeLj5aZTKAa9CzD/QHvvQG
8b6tl/BwCssj/OTWCCSw1WrnqZkxZhY57yrZd5I7fkhEnluH/bWlRM832oWmhwVB
9V4byyF7AgMBAAECggEAPCyM1SrgfhzMWgo7h/i0O0blkAfJDu+D3EveWYw8XQkw
NV4ih4KhGLXanEy5UpKCR2NL9iQxgM92hhvPeWmprZ3gksycdj7SZppvEO4JLY3k
tXlOjM4RilKVOeeahxU6B7YyPwpNdIue6mvcyA5M25AQPfMHDMkOcbTkgFbQZR2O
aHnFywQgOApjWMwpkhppmAB3iHp4JCPSXV6OPoIIGdjiN/39py4v5N9/VM1x0egU
ONr5P2UPdWwXgdX3qGqeIk96tPbh7+xP7ACseVCiJRE+Wsg8se7nnBLO+rM4m6WF
O+/kuzBZHkjLvOP/RewDLzc7n43EZFQUXmcx5VYYgQKBgQDzvxRW8nU9Px9Br/jg
7sqfg1xhOuyT6FADFzz7l0VU0KjYOYKBaIqk9ZpDkXKnvzzxE24B/GiXq+jMO/qQ
94TJ2tmpEPm7Pog0uqSeZtfCSwKDwQKWPWQZd9nd31WuaZHYj08tlC6UJ52Rn2TT
PEo9j+4yj4JjJaKlgH305TbYwQKBgQDwQxnCdJ+ZRXKLpYyYIQeWAOWUkRIIv/yc
BxDJgsAqeyA2e2l/qrMxXHGEpD7hVmXhpSFfp7n0t/EP53wyleHmhFADLz4cSqh0
1dGYpqpjblsqYlSWljYZ0gz77NZexrpu6tWtXH6ciHtNWS57Rf6Qbx2TRok6118s
cQ9WYB1tOwKBgQCCCes8B9ZseoSecteAiWUofNiINvuIXWRyga9TOn0OptOtp+Ds
UW3GXBGVAr/8ppZIt2j1Pkg+wsRMUaN4O9VoK438GMZjExVvrDOvHob1bTdGO265
4L7Kp5pgOIpppoDc3HgNhQTknc3+pt8PoxaoiWU3LEEPzEBds5N/V9pPAQKBgQCI
U2qQXaAZVcBy4FJwF324bXXW4KG8+UKaPaAW1uu2rvpOL6Ri3jai8XMv8goDzgQt
DodrQT5QTvanMY/VHBp7s+O6itnRL8N518D/vsG7fWiZGgYpE75K1Fats2rHiDdM
rE7l+S+WHhLohovLQqH4zjOX11QSYRYNn3E2b38C9QKBgQDTuHyV5Q/GkKX/Dpbo
b4CUnzDtTnvUBKORUr/OOcmpuB8EbuFotRowynzy8UZFd1L8GUeVD9wmzKc1bG3F
zqwlraTH58bTkJLE7ov/Tn1O3nC9rIkGb6n4/TsbWe4pgnI0MtP9glqdahN5C767
VID+ciB6Mvi7uD6fyL6vJFvfmQ==
-----END PRIVATE KEY-----`;

export function signPayload(payload, privateKeyPem = DEFAULT_DEV_PRIVATE_KEY) {
  const canonical = canonicalizePayload(payload);
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(canonical);
  return sign.sign(privateKeyPem, 'base64');
}

export function generateLicense({
  licenseId = 'LIC-2026-MED365-ONPREM',
  customerName = 'Central Diagnostic Clinical Laboratory',
  labCode = 'main-lab',
  contactEmail = 'contact@locallab.com',
  hardwareId = '*',
  edition = 'local_enterprise',
  features = ['clinical', 'billing', 'reports', 'lan_access', 'backup_restore', 'audit_compliance'],
  maxUsers = 50,
  maxWorkstations = 25,
  validDays = 730, // 2 years
  gracePeriodDays = 14,
  privateKeyPem = DEFAULT_DEV_PRIVATE_KEY,
} = {}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);

  const payload = {
    licenseId,
    customer: {
      name: customerName,
      labCode,
      contactEmail,
    },
    hardwareId,
    edition,
    features,
    maxUsers,
    maxWorkstations,
    issuedAt: now.toISOString(),
    validFrom: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    gracePeriodDays,
  };

  const signature = signPayload(payload, privateKeyPem);

  return {
    payload,
    signature,
  };
}

async function main() {
  const license = generateLicense();
  const formatted = JSON.stringify(license, null, 2);
  console.log(formatted);

  const outputPath = process.argv[2] || path.resolve('docker/license.key');
  fs.writeFileSync(outputPath, formatted, 'utf8');
  console.log(`\nLicense generated and written to: ${outputPath}`);
}

const isCli = process.argv[1] && process.argv[1].endsWith('generate-license.js');
if (isCli) {
  main().catch(console.error);
}
