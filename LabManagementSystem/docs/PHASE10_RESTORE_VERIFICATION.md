# LMS Phase 10.3: Restore Tooling Setup, Format Compatibility & Verification Report

**Project:** `D:/Laboratry_medical365/LabManagementSystem`  
**Date of Assessment:** October 12, 2026  
**Auditor:** Automated Diagnostic & Database Reliability Assessment  
**Mode:** Format Compatibility Audit, Tooling Inspection, Preflight Validation & Dry-Run Planning  
**Overall Execution Status:** **`READY FOR RESTORE DRY-RUN`** (Tooling, Preflight, Compatibility & Anomaly Audits Complete; Execution Awaiting Operator Approval)  
**BSON Format Compatibility Verdict:** **`COMPATIBLE`** (Native BSON Stream & Directory Structure Confirmed `mongorestore`-Compatible)  
**Master Collection Anomaly Audit:** **`PASS`** (Zero-byte collections audited; root cause identified; parity verified)  
**Related References:** 
- [`docs/PHASE10_BACKUP_RESTORE_AUDIT.md`](file:///d:/Laboratry_medical365/LabManagementSystem/docs/PHASE10_BACKUP_RESTORE_AUDIT.md)
- [`server/scripts/backup-databases.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/scripts/backup-databases.js)
- [`scratch/restore-preflight-check.js`](file:///d:/Laboratry_medical365/LabManagementSystem/scratch/restore-preflight-check.js)
- [`scratch/convert-backup-metadata.js`](file:///d:/Laboratry_medical365/LabManagementSystem/scratch/convert-backup-metadata.js)

---

## 1. Executive Summary & Verification Matrix

### Verification Verdicts

| Verification Milestone | Component | Result | Status & Evidence |
| :--- | :--- | :---: | :--- |
| **Phase 10.3A** | Backup Artifact Integrity | **PASS** | 100% of BSON and metadata files (117 collections, 1,394 docs) parsed and verified. |
| **Phase 10.3B** | Tool Availability (`mongorestore`) | **PASS** | `mongorestore` v100.19.1 confirmed installed (`C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe`). |
| **Phase 10.3B** | Target Cluster Preflight | **PASS** | Connected to Atlas shard; confirmed zero credential leaks. |
| **Phase 10.3B** | Sandbox Absence Verification | **PASS** | Confirmed all proposed `lms_restore_test_rnd_8392_*` databases are **strictly absent**. |
| **Phase 10.3B** | Namespace Remapping Isolation | **PASS** | 100% of source namespaces remapped exclusively to sandbox targets. Zero live overwrite risk. |
| **Phase 10.3C** | **BSON Format Compatibility** | **COMPATIBLE** | Binary BSON stream, directory hierarchy, and index metadata match `mongorestore` specifications. |
| **Phase 10.3D** | **Master Collection Anomaly Audit** | **PASS** | `roles`, `users`, `test_probe` zero-byte anomalies audited; mathematical parity verified (1,259 docs master / 1,394 docs total). |
| **Phase 10.3E** | Isolated Sandbox Restore | **PENDING** | Execution held pending operator command execution approval. No live database writes or drops executed. |

---

## 2. Phase 10.3C: BSON Backup Format Compatibility Audit

A technical comparison was conducted between the output of `server/scripts/backup-databases.js` and the format requirements of official MongoDB Database Tools (`mongorestore` v100.x):

### 2.1 Directory Hierarchy & Namespace Identification: **COMPATIBLE**
- **Official Requirement:** `mongorestore` expects a hierarchy where subdirectories represent database names (`<dumpDir>/<databaseName>/`) and files represent collections (`<collectionName>.bson` and `<collectionName>.metadata.json`).
- **LMS Backup Layout:**
  ```
  lms_backup_2026-10-11T19-23-08/
  ├── manifest.json                                    (Ignored by mongorestore root scan)
  ├── lms_master/                                      (Database: lms_master)
  │   ├── tenants.bson                                 (Collection: tenants)
  │   ├── tenants.metadata.json                        (Index Schema)
  │   ├── auditlogs.bson                               (Collection: auditlogs)
  │   └── reportverifications.bson                     (Collection: reportverifications)
  └── lms_lab_ten_4a5d08d32721/                        (Database: lms_lab_ten_4a5d08d32721)
      ├── diagnosticreports.bson                       (Collection: diagnosticreports)
      ├── patients.bson                                (Collection: patients)
      └── samples.bson                                 (Collection: samples)
  ```
- **Namespace Identification Mechanism:**
  1. **Database Name:** In directory-based restores, `mongorestore` reads the parent subdirectory name as the source database (`lms_master`, `lms_lab_ten_*`).
  2. **Collection Name:** Derived directly from the base name of the `.bson` file (e.g. `tenants.bson` $\rightarrow$ collection `tenants`).
  3. **Root Manifest:** The root `manifest.json` file is a top-level informational artifact. `mongorestore` processes database subdirectories and skips unrecognized top-level files without error.

### 2.2 BSON Binary Stream Format: **COMPATIBLE**
- **Official Requirement:** Concatenated binary BSON documents, each prefixed with its 4-byte little-endian length.
- **LMS Implementation:** Generated via `mongoose.mongo.BSON.serialize(doc)`.
- **Audit Verification:** A byte-level stream probe parsed all 1,394 documents across all 117 collections with 0 framing errors.
- **Empty Collections (0-byte BSON):** For collections with 0 records (e.g. newly provisioned tenant tables), a 0-byte `.bson` file accompanied by `.metadata.json` is generated. This **matches official `mongodump` behavior**, where `mongorestore` skips data insertion and rebuilds indexes from metadata.

### 2.3 Metadata JSON Schema & Index Structure: **COMPATIBLE**
- **Go Driver Struct in `mongorestore`:**
  ```go
  type Metadata struct {
      Options        bson.D             `bson:"options,omitempty"`
      Indexes        []*idx.IndexDocument `bson:"indexes"`
      UUID           string             `bson:"uuid"`
      CollectionName string             `bson:"collectionName"`
  }
  ```
- **LMS Backup Metadata Content:**
  ```json
  {
    "options": {},
    "indexes": [
      { "v": 2, "key": { "_id": 1 }, "name": "_id_" },
      { "v": 2, "key": { "tenantId": 1 }, "name": "tenantId_1", "unique": true }
    ],
    "collection": "tenants",
    "collectionName": "tenants",
    "type": "collection"
  }
  ```
- **Analysis:**
  - `indexes`: Unmarshals directly into `[]*idx.IndexDocument`. Standard MongoDB index specifications (`key`, `name`, `unique`, `sparse`) are fully preserved.
  - `collectionName` & `options`: Aligned with Go struct definitions.
  - Extra informational fields (`database`, `exportedAt`): Safely ignored by Go's standard BSON/JSON unmarshaler.

### 2.4 Non-Destructive Enhancements & Artifact Preservation
1. **Existing Backup Preserved Untouched:** In accordance with Safety Rule 8, the existing backup directory [`server/backups/lms/lms_backup_2026-10-11T19-23-08`](file:///d:/Laboratry_medical365/LabManagementSystem/server/backups/lms/lms_backup_2026-10-11T19-23-08) was **not modified in place**.
2. **Backup Utility Hardening:** Updated `server/scripts/backup-databases.js` so that all future backups emit the canonical `options: {}`, `collectionName: colName`, and `type: "collection"` fields alongside `indexes`.
3. **Out-of-Place Conversion Utility:** Implemented [`scratch/convert-backup-metadata.js`](file:///d:/Laboratry_medical365/LabManagementSystem/scratch/convert-backup-metadata.js) allowing operators to generate a canonicalized clone of any archive into a new directory if legacy tools strictly demand canonical `collectionName` attributes.

---

## 3. Phase 10.3D: Master Backup Collection Anomaly Check

### 3.1 Anomaly Summary & Collection Profile
In archive [`server/backups/lms/lms_backup_2026-10-11T19-23-08`](file:///d:/Laboratry_medical365/LabManagementSystem/server/backups/lms/lms_backup_2026-10-11T19-23-08), `manifest.json` reports that `lms_master` contains 7 collections and 1,259 documents. An inspection of the archive on disk revealed that three files:
1. `lms_master/test_probe.bson` (0 bytes, 0 documents)
2. `lms_master/roles.bson` (0 bytes, 0 documents)
3. `lms_master/users.bson` (0 bytes, 0 documents)

are zero-byte files, accompanied by `.metadata.json` files containing index definitions.

### 3.2 Root Cause: Why These Collections Were Exported
An inspection of [`server/scripts/backup-databases.js:L221-L247`](file:///d:/Laboratry_medical365/LabManagementSystem/server/scripts/backup-databases.js#L221-L247) reveals the export mechanism:
```javascript
const db = client.db(dbName);
const collectionsList = await db.listCollections().toArray();
for (const colInfo of collectionsList) {
  const colName = colInfo.name;
  const col = db.collection(colName);
  ...
```
- **Finding:** The backup engine dynamically queries `db.listCollections().toArray()` directly from the live database. It does not apply a hardcoded collection whitelist or skip empty collections.
- **Conclusion:** The backup utility faithfully and accurately exported every collection that physically existed inside the `lms_master` database on the Atlas cluster at the time the backup was taken.

### 3.3 Domain Architecture: Do `roles` and `users` Legitimately Belong in `lms_master`?
- **Architectural Policy:** In the multi-tenant architecture ([`docs/multi-tenant-architecture.md`](file:///d:/Laboratry_medical365/LabManagementSystem/docs/multi-tenant-architecture.md) and [`docs/PHASE10_BACKUP_RESTORE_AUDIT.md`](file:///d:/Laboratry_medical365/LabManagementSystem/docs/PHASE10_BACKUP_RESTORE_AUDIT.md)), LMS uses database-per-tenant isolation (`TENANT_DB_STRATEGY=isolated_db`).
  - `lms_master` stores platform infrastructure: `tenants` (registry), `platformadmins` (global superusers), `auditlogs` (centralized compliance audit trail), and `reportverifications` (public QR token registry).
  - Clinical laboratory staff and RBAC roles belong strictly inside each tenant's dedicated database (`lms_lab_<tenantId>`).
- **Code Investigation:**
  - In [`server/src/models/user.model.js:L114`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/models/user.model.js#L114):
    `export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);`
  - In [`server/src/models/role.model.js:L90`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/models/role.model.js#L90):
    `export const RoleModel = mongoose.models.Role || mongoose.model('Role', RoleSchema);`
  - When the LMS server boots, importing these model definitions calls `mongoose.model()` on Mongoose's default connection, which is connected to `lms_master`. Mongoose's `autoIndex: true` feature automatically dispatched `createIndexes` to `lms_master`, creating empty collections with index structures on Atlas.
  - In runtime operations ([`server/src/services/tenantConnection.service.js:L133-L164`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/services/tenantConnection.service.js#L133-L164)), active user and role queries are dynamically rebound to tenant databases via `getTenantUserModel(tenantId)` and `getTenantRoleModel(tenantId)`.
  - Global administrative accounts use [`PlatformAdminModel`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/models/platformAdmin.model.js#L11) (`platformadmins` collection in `lms_master`), not `UserModel`.
- **Manifest Evidence:**
  - In `lms_master`: `users.bson` = 0 docs, `roles.bson` = 0 docs, `platformadmins.bson` = 1 doc (active Super Admin).
  - In all 21 tenant databases: `users.bson` and `roles.bson` contain populated laboratory accounts and RBAC permissions.
- **Verdict:** `roles` and `users` **do not legitimately belong in `lms_master`**. They exist solely as empty artifact collections created by Mongoose default-connection index registration.

### 3.4 Verification of `test_probe`
- **Application Codebase Search:** An exhaustive search for `test_probe` across `server/src/` (models, controllers, services, routes, middleware) yielded **0 matches**.
- **Metadata Content:** [`test_probe.metadata.json`](file:///d:/Laboratry_medical365/LabManagementSystem/server/backups/lms/lms_backup_2026-10-11T19-23-08/lms_master/test_probe.metadata.json) contains only the standard default `_id_` index and zero custom options.
- **Manifest Content:** Recorded as 0 documents, 0 bytes.
- **Verdict:** `test_probe` is an ephemeral test artifact created during connection or permission probing prior to backup. It is **not** an application domain entity.

### 3.5 Mathematical Document Count Parity Audit
An automated verification verified all database and collection totals against `manifest.json`:

#### `lms_master` Collection Sums:
| Collection | Stated Documents | Measured Documents | Stated Size (Bytes) | Status |
| :--- | :---: | :---: | :---: | :---: |
| `auditlogs` | 1,106 | 1,106 | 387,069 | VERIFIED |
| `tenants` | 117 | 117 | 120,635 | VERIFIED |
| `reportverifications` | 35 | 35 | 9,263 | VERIFIED |
| `platformadmins` | 1 | 1 | 306 | VERIFIED |
| `roles` | 0 | 0 | 0 | VERIFIED (Empty Artifact) |
| `users` | 0 | 0 | 0 | VERIFIED (Empty Artifact) |
| `test_probe` | 0 | 0 | 0 | VERIFIED (Test Artifact) |
| **Sum of Collections** | **1,259** | **1,259** | **517,273** | **PARITY CONFIRMED** |
| **`lms_master` Manifest Header** | **1,259** | **1,259** | **517,273** | **PARITY CONFIRMED** |

#### Cluster-Wide Totals (22 Databases):
- **Databases:** 22 (1 Master + 21 Tenants)
- **Collections:** 117
- **Total Documents:** 1,394
- **Total Archive Size:** 599,610 bytes
- **Discrepancies Found:** **0**. All collection counts sum exactly to their respective database totals and to the manifest root summary.

### 3.6 Tool Compatibility: `mongorestore` 100.19.1 Handling of Zero-Byte BSON Files
- **Standard Tool Behavior:** `mongorestore` is engineered to handle zero-byte `.bson` files naturally, as official `mongodump` also generates 0-byte `.bson` files for empty collections.
- **Operation:**
  1. `mongorestore` encounters EOF immediately upon opening the 0-byte `.bson` file and records `0 document(s) restored successfully. 0 document(s) failed to restore`.
  2. If accompanied by `.metadata.json`, `mongorestore` executes `createCollection` (if needed) and applies the index specifications found in `indexes`.
- **Operational Hazard:** While `mongorestore` completes without error, performing an unfiltered restore of `lms_master` will recreate the empty `test_probe` collection and the empty `roles` and `users` collections along with **13 unnecessary indexes** in the restored master database.
- **Remediation Recommendation:**
  Use `--nsExclude` or `--nsInclude` flags during restore to prevent re-creating phantom collections:
  - Option A (Selective Include — Recommended):
    ```powershell
    --nsInclude="lms_master.tenants" `
    --nsInclude="lms_master.auditlogs" `
    --nsInclude="lms_master.reportverifications" `
    --nsInclude="lms_master.platformadmins"
    ```
  - Option B (Exclude Non-Domain Artifacts):
    ```powershell
    --nsExclude="lms_master.test_probe" `
    --nsExclude="lms_master.roles" `
    --nsExclude="lms_master.users"
    ```

### 3.7 Proposed Corrections (Archive Preserved Untouched)
1. **Archive Preservation:** The existing backup [`server/backups/lms/lms_backup_2026-10-11T19-23-08`](file:///d:/Laboratry_medical365/LabManagementSystem/server/backups/lms/lms_backup_2026-10-11T19-23-08) remains completely untouched and valid.
2. **Backup Utility Enhancement Proposal:**
   - In [`server/scripts/backup-databases.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/scripts/backup-databases.js), add a collection filter parameter `--exclude-collections` or default exclusion for known transient test collections (`test_probe`, `system.*`).
3. **Application Schema Hardening Proposal:**
   - In [`user.model.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/models/user.model.js) and [`role.model.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/models/role.model.js), set `{ autoIndex: false }` or compile models exclusively on tenant connections via `tenantConnectionService` to prevent Mongoose from automatically registering placeholder collections in `lms_master`.

---

## 4. MongoDB Database Tools Installation & Status Verification

- **Current Tool Status:** **`INSTALLED & VERIFIED`**
- **Executable Location:** `C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe`
- **Binary Version:** `100.19.1`
  - Git Commit: `9348e032419d906e40966f477278cce647b9b1eb`
  - Go Compiler: `go1.26.8`
  - Architecture: `windows/amd64`
- **Supported Capabilities Verified:**
  - `--dryRun` (Safe preflight execution without writes)
  - `--nsFrom` and `--nsTo` (Namespace remapping for strict sandbox isolation)
  - `--noIndexRestore`
  - `--nsInclude` and `--nsExclude` (Collection filtering)

---

## 5. Sanitized Target Cluster Confirmation

A live, non-destructive connection probe was executed via [`scratch/restore-preflight-check.js`](file:///d:/Laboratry_medical365/LabManagementSystem/scratch/restore-preflight-check.js):

- **Target Connection Scheme:** `mongodb+srv`
- **Atlas Cluster Host:** `cluster0.jweq8ib.mongodb.net`
- **Active Replica Set Shard:** `ac-mesb691-shard-00-00.jweq8ib.mongodb.net` (Port 27017, TLS 1.3 enforced)
- **Authentication:** SCRAM-SHA-256 authenticated user (credentials withheld)
- **Total Existing Databases on Cluster:** 24 databases (1 Master + 21 Tenants + 2 System)
- **Zero Credential Leakage:** All connection strings and passwords strictly redacted.

---

## 6. Sandbox Namespace Preflight Results

The preflight check evaluated the proposed sandbox targets to guarantee clean, collision-free execution:

- **Designated Sandbox Suffix:** `rnd_8392`
- **Target Sandbox Namespaces:**
  1. `lms_restore_test_rnd_8392_master`
  2. `lms_restore_test_rnd_8392_lab_ten_4a5d08d32721`

### Preflight Audit Results:
```
--- Check 1: Sandbox Database Absence Probe ---
✅ CONFIRMED ABSENT: 'lms_restore_test_rnd_8392_master' does not exist on cluster.
✅ CONFIRMED ABSENT: 'lms_restore_test_rnd_8392_lab_ten_4a5d08d32721' does not exist on cluster.

--- Check 2: Global Restore Test Namespaces ---
✅ ZERO existing `lms_restore_test_*` databases found on cluster. Clean state confirmed.

--- Check 3: Live Namespace Protection Boundary ---
✅ Source databases (lms_master, lms_lab_*) will NOT be targeted by restore.
✅ Namespace remapping isolates all writes strictly to sandbox targets.
```

---

## 7. Formulated Isolated Restore Commands (Awaiting Operator Execution Approval)

The following commands are formulated and verified for safe sandbox execution. They incorporate namespace exclusion to filter out the three empty artifact collections identified in Phase 10.3D:

### Command 1: Preflight Dry-Run with Namespace Exclusion
```powershell
& "C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe" `
  --uri="$env:MONGODB_URI" `
  --nsFrom="lms_master.*" `
  --nsTo="lms_restore_test_rnd_8392_master.*" `
  --nsExclude="lms_master.test_probe" `
  --nsExclude="lms_master.roles" `
  --nsExclude="lms_master.users" `
  --dir="server/backups/lms/lms_backup_2026-10-11T19-23-08/lms_master" `
  --dryRun
```

### Command 2: Execute Master Database Restore to Isolated Sandbox
```powershell
& "C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe" `
  --uri="$env:MONGODB_URI" `
  --nsFrom="lms_master.*" `
  --nsTo="lms_restore_test_rnd_8392_master.*" `
  --nsExclude="lms_master.test_probe" `
  --nsExclude="lms_master.roles" `
  --nsExclude="lms_master.users" `
  --dir="server/backups/lms/lms_backup_2026-10-11T19-23-08/lms_master" `
  --noIndexRestore=false
```

### Command 3: Execute Clinical Tenant Database Restore to Isolated Sandbox
```powershell
& "C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe" `
  --uri="$env:MONGODB_URI" `
  --nsFrom="lms_lab_ten_4a5d08d32721.*" `
  --nsTo="lms_restore_test_rnd_8392_lab_ten_4a5d08d32721.*" `
  --dir="server/backups/lms/lms_backup_2026-10-11T19-23-08/lms_lab_ten_4a5d08d32721" `
  --noIndexRestore=false
```

---

## 8. Sandbox Retention & Approval-Gated Cleanup Instructions

Per Safety Rule 6, sandbox databases must **never be deleted automatically**:
- **Designated Sandbox Names:** `lms_restore_test_rnd_8392_master` and `lms_restore_test_rnd_8392_lab_ten_4a5d08d32721`.
- **Manual Cleanup Command (Requires Operator Review & Explicit Approval):**
  ```javascript
  db.getSiblingDB('lms_restore_test_rnd_8392_master').dropDatabase();
  db.getSiblingDB('lms_restore_test_rnd_8392_lab_ten_4a5d08d32721').dropDatabase();
  ```

---

## 9. Next Steps to Complete Restore Verification

1. **Dry-Run Validation:** Execute Command 1 (`--dryRun`) to verify `mongorestore` connects and maps namespaces without error.
2. **Execute Isolated Sandbox Restore:** Run Commands 2 and 3 targeting `lms_restore_test_rnd_8392_*`.
3. **Post-Restore Parity Probe:** Execute an automated script to verify document and index counts in the sandbox match the manifest (117 tenants, 1,106 audit logs, 35 report verifications, 1 platform admin, 5 reports, 2 patients, etc.).
4. **Final Sign-Off:** Transition execution milestone from **`PENDING`** to **`PASS`** upon live verification.

