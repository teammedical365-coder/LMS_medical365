# Lab Management System (LMS) — Enterprise Multi-Tenant Laboratory Platform

A standalone, multi-tenant healthcare laboratory management platform architected for clinical diagnostics, specimen accessioning, laboratory workflow automation, and pathologist verification.

> [!NOTE]
> **Phase 2 Implementation Notice:**
> Phase 2 delivers working **Platform Super Admin functionality**, **laboratory onboarding**, **tenant lifecycle management**, and a **dedicated tenant logical database provisioning foundation** (`lms_lab_<internalTenantId>`).
> All Super Admin endpoints and lifecycle state transitions are fully operational and verified with automated test suites.
> Ordinary patient registration, billing transactions, specimen accessioning, and diagnostic report sign-offs remain planned for Phase 3.

---

## 1. Project Isolation & Guarantees

- **Project Directory:** `LabManagementSystem/`
- **Isolation Guarantee:** Completely decoupled and standalone. Does not import, modify, delete, rename, or share files, databases, or credentials with Medical365/HMS.
- **Data Sovereignty:** Platform Master Database (`lms_master`) stores registry metadata, platform admins, verified domains, and audit logs. Protected Health Information (PHI) is strictly confined to dedicated logical tenant databases (`lms_lab_<internalTenantId>`).

---

## 2. Technology Stack

### Frontend (`client/`)
- **Library / Core:** React 18.3 (`JavaScript`)
- **Bundler & Dev Server:** Vite 5.4
- **Routing:** React Router v6.28
- **HTTP Client:** Axios 1.7
- **Icons:** Lucide React
- **Design System:** Custom Vanilla CSS Design System with Medical365 visual styling (Royal Blue `#2563EB`, Accent Cyan `#22C1DC`, Mint `#ECFDF5`, Main Bg `#EAF7FC`, White sidebar, rounded cards with light-blue borders `#D7E5F0`).

### Backend (`server/`)
- **Runtime:** Node.js (ES Modules `type: "module"`)
- **Framework:** Express.js 4.21
- **Database Architecture:** MongoDB with Mongoose 8.9 (Master DB + Server-Controlled Logical Tenant Databases)
- **Security & Utilities:** Helmet, CORS, Morgan, Dotenv, Crypto

---

## 3. Multi-Tenant Logical Architecture

### Platform Master Database (`lms_master`)
- Laboratory Registry (`tenants`): Internal tenant ID (`ten_...`), unique code, legal name, contacts, lifecycle status, verified domains, and database provisioning metadata.
- Platform Administrators (`platform_admins`): Global operators authorized to manage laboratories.
- Platform Audit Events (`platform_audit_logs`): Immutable record of Super Admin actions, onboarding timestamps, and provisioning outcomes (zero secret leaks).

### Laboratory Tenant Database (`lms_lab_<internalTenantId>`)
- Server-controlled naming convention: `lms_lab_` + internal server-generated tenant ID (e.g. `lms_lab_ten_5d81b811cfd6`).
- Browser or API consumers are **never** permitted to supply database names.
- Logical collections: `users`, `patients`, `orders`, `samples`, `tests`, `results`, `reports`, `invoices`, `settings`.

---

## 4. Super Admin REST API Endpoints (`/api/v1/super-admin`)

All management endpoints are protected by `superAdminAuth.middleware.js` using `x-admin-api-key` or `Authorization: Bearer <key>`:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/super-admin/overview` | Platform KPI metrics and recent audit log events |
| `GET` | `/api/v1/super-admin/laboratories` | List laboratories with search (`q`), status, and pagination |
| `POST` | `/api/v1/super-admin/laboratories` | Onboard new laboratory & initiate dedicated DB provisioning |
| `GET` | `/api/v1/super-admin/laboratories/:id` | Retrieve single laboratory profile and database status |
| `PATCH` | `/api/v1/super-admin/laboratories/:id` | Update laboratory profile (name, legalName, email, phone, etc.) |
| `POST` | `/api/v1/super-admin/laboratories/:id/status` | Transition lifecycle state (`PENDING`, `ACTIVE`, `SUSPENDED`, `INACTIVE`) |
| `GET` | `/api/v1/super-admin/laboratories/:id/provisioning` | Safe database provisioning status (zero secrets) |
| `POST` | `/api/v1/super-admin/laboratories/:id/provisioning/retry` | Idempotent database provisioning retry |
| `POST` | `/api/v1/super-admin/laboratories/:id/domains/:domain/verify` | Verify custom domain for hostname tenant resolution |
| `GET` | `/api/v1/super-admin/audit-logs` | Retrieve platform administration audit events |

---

## 5. Super Admin UI Routes

| Route | Page | Description |
| :--- | :--- | :--- |
| `/super-admin` | **Platform Overview** | Platform KPIs, multi-tenant DB status, and real-time audit log stream |
| `/super-admin/laboratories` | **Laboratories Directory** | Filterable, searchable, and paginated directory of onboarded labs |
| `/super-admin/laboratories/new` | **Register Laboratory** | Laboratory onboarding form with server-controlled tenant ID generation |
| `/super-admin/laboratories/:id` | **Laboratory Details** | Lifecycle controls (Activate, Suspend, Reactivate), DB provisioning status, and Retry |

---

## 6. How to Run & Verify

### 1. Run the Backend API Server
```bash
cd LabManagementSystem/server
npm start
# Server listens on http://localhost:5000
```

### 2. Run the Frontend Development Client
```bash
cd LabManagementSystem/client
npm run dev
# Vite dev server runs at http://localhost:5173
```

### 3. Run Automated Tests
```bash
cd LabManagementSystem/server
npm test
# Runs test-health.js and test-phase2.js (All 36 Phase 2 test assertions pass)
```

### 4. Build Frontend for Production
```bash
cd LabManagementSystem/client
npm run build
# Builds production bundle cleanly into dist/
```

---

## 7. Security Boundaries & Invariants

1. **Anti-Fallback Rule:** The server **never** falls back to querying another tenant's database or the platform master database when tenant resolution fails.
2. **Untrusted Header Rejection:** Client-supplied headers such as `X-Tenant-ID` or `X-Hospital-ID` are explicitly rejected as proof of authorization.
3. **Activation Guard:** A laboratory cannot be transitioned to `ACTIVE` unless its dedicated logical database has status `READY`.
4. **Secret Sanitization:** All audit logs, API responses, and error traces are scrubbed of connection strings, passwords, and tokens.
