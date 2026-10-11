# LMS Phase 10.1: Security & Configuration Audit Report

**Project:** `D:/Laboratry_medical365/LabManagementSystem`  
**Date of Audit:** October 11, 2026  
**Auditor:** Automated Diagnostic & Defensive Security Assessment  
**Mode:** Read-Only Audit & Threat Modeling (No Application Code Modified)

---

## 1. Executive Summary

This security and configuration audit evaluates the production readiness of the standalone Lab Management System (LMS) across its backend APIs, multi-tenant database connection layer, role-based access control (RBAC), frontend client integration, and configuration defaults.

### Key Strengths
- **Strict Multi-Tenant Database Isolation:** Database names are computed server-side (`lms_lab_<tenantId>`) with sanitized tenant identifiers. Cross-tenant routing is systematically rejected at the middleware level (`CROSS_TENANT_FORBIDDEN`).
- **Data Minimization on Public Verification:** The unauthenticated report verification endpoint (`GET /api/v1/public/verify-report/:token`) strictly outputs authenticity metadata (lab name, report number, release timestamp), completely redacting patient identifiers (MRN, name), clinical findings, and test results.
- **Audit Redaction:** Compliance audit trails actively strip authentication tokens, passwords, verification tokens, and clinical details before persistence.
- **Stack Trace Protection:** Production error handling suppresses debug information and stack traces from API responses.

### Critical Concerns & Production Blockers
1. **Universal Authentication Rate Limit Bypass Header:** Any external caller can bypass rate limiting on login endpoints by supplying `x-bypass-rate-limit: test-bypass`.
2. **Permissive CORS Configuration:** The backend CORS middleware unconditionally returns `callback(null, true)` with `credentials: true`, allowing any external origin to read authenticated responses.
3. **Hardcoded Insecure Defaults with Non-Fatal Validation:** Default development secrets for `JWT_SECRET`, `SUPER_ADMIN_API_KEY`, and `COOKIE_SECRET` generate non-blocking warnings in production rather than terminating execution.
4. **Unescaped Regular Expression Query Injection (ReDoS):** Patient, order, and sample search filters pass raw user input into MongoDB `$regex` without escaping special characters.

---

## 2. Findings Matrix

| Finding ID | Vulnerability / Risk | Severity | Category | Status |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Test Rate-Limit Bypass Header Active in All Environments | **CRITICAL** | Rate Limiting / DoS | Confirmed |
| **SEC-02** | Wildcard / Permissive CORS Reflecting Arbitrary Origins with Credentials | **HIGH** | Web Security / CORS | Confirmed |
| **SEC-03** | Hardcoded Default Secrets with Non-Fatal Production Validation | **HIGH** | Secrets Management | Confirmed |
| **SEC-04** | Unescaped User Input in MongoDB `$regex` Queries (ReDoS) | **HIGH** | Injection / DoS | Confirmed |
| **SEC-05** | Fallback Super Admin API Key Uses Non-Constant-Time Equality | **MEDIUM** | Authentication | Confirmed |
| **SEC-06** | In-Memory Audit Trail Volatility During Database Glitches | **MEDIUM** | Compliance / Integrity | Confirmed |
| **SEC-07** | Missing Rate Limiting on Public Verification & Branding Endpoints | **MEDIUM** | Rate Limiting / Abuse | Confirmed |
| **SEC-08** | Client IP Spoofing Risk via `X-Forwarded-For` without Trust Proxy | **MEDIUM** | Security Headers | Confirmed |
| **SEC-09** | MongoDB Atlas Shared Tier Collection Limit Ceiling (Operational Risk) | **MEDIUM** | Database / Availability| Confirmed |
| **SEC-10** | Password Policy Discrepancy (Special Character Not Enforced) | **LOW** | Password Policy | Confirmed |
| **SEC-11** | Unhandled Error Messages Returned Verbose in Production 500 Responses | **LOW** | Information Disclosure | Confirmed |
| **SEC-12** | Client & Server Dev-Dependency Vulnerabilities | **LOW / MEDIUM**| Dependencies | Confirmed |

---

## 3. Detailed Findings with Evidence

### [SEC-01] Universal Authentication Rate-Limit Bypass Header (CRITICAL)
- **File:** [`server/src/middleware/rateLimit.middleware.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/middleware/rateLimit.middleware.js#L52-L56)
- **Evidence:**
  ```javascript
  export const authRateLimiter = (req, res, next) => {
    // Allow test suites to bypass rate limiting
    if (req.headers['x-bypass-rate-limit'] === 'test-bypass' || process.env.NODE_ENV === 'test') {
      return next();
    }
  ```
- **Description:** The authentication rate limiter allows any HTTP request with `x-bypass-rate-limit: test-bypass` to bypass rate limits entirely. This check is not gated by `NODE_ENV === 'test'`. In a live production environment, an attacker performing credential stuffing or password brute-force can simply supply this header to bypass throttling.
- **Impact:** Eliminates brute-force protections for both Super Admin and Laboratory logins.
- **Remediation:** Remove the header bypass check or restrict it strictly to `process.env.NODE_ENV === 'test'`.

---

### [SEC-02] Permissive CORS Reflecting Arbitrary Origins with Credentials (HIGH)
- **File:** [`server/src/app.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/app.js#L26-L38)
- **Evidence:**
  ```javascript
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || origin === config.corsOrigin || origin.startsWith('http://localhost:')) {
          return callback(null, true);
        }
        return callback(null, true); // Permissive in dev; configurable in prod
      },
      credentials: true,
    })
  );
  ```
- **Description:** The CORS middleware returns `callback(null, true)` for every origin, even when it does not match `config.corsOrigin` or `localhost`. Combined with `credentials: true`, any malicious third-party website visited by a logged-in user can make cross-origin requests to the LMS API with cookies and inspect response data.
- **Impact:** Cross-Origin Request Forgery and unauthorized cross-origin data exposure.
- **Remediation:** In production (`config.isProduction`), return `callback(new Error('CORS Not Allowed'), false)` when `origin !== config.corsOrigin`.

---

### [SEC-03] Hardcoded Default Secrets with Non-Fatal Production Validation (HIGH)
- **Files:**
  - [`server/src/config/env.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/config/env.js#L28-L42)
  - [`server/src/config/env.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/config/env.js#L47-L66)
  - [`server/src/server.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/server.js#L78-L82)
- **Evidence:**
  ```javascript
  // config/env.js
  superAdmin: {
    apiKey: process.env.SUPER_ADMIN_API_KEY || 'dev-super-admin-key-change-in-production',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-lms-jwt-secret-do-not-use-in-production-change-me-32chars',
  },
  ```
  ```javascript
  // server.js
  const validation = validateConfig();
  if (!validation.isValid) {
    validation.warnings.forEach((warning) => logger.warn(`Configuration Notice: ${warning}`));
  }
  ```
- **Description:** If environment variables are omitted or misconfigured when deploying in production mode (`NODE_ENV=production`), the application falls back to publicly known strings in source control. The validation function only logs warnings and does not abort startup.
- **Impact:** Attackers can forge valid JWT access tokens using the known secret or obtain full Super Admin privileges using the default API key.
- **Remediation:** In `validateConfig()`, throw a fatal exception and exit process if `config.isProduction` is true and default secrets are present or under 32 characters.

---

### [SEC-04] Unescaped User Input in MongoDB `$regex` Queries (ReDoS) (HIGH)
- **Files:**
  - [`server/src/services/tenantClinical.service.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/services/tenantClinical.service.js#L221-L228) (Patients)
  - [`server/src/services/tenantClinical.service.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/services/tenantClinical.service.js#L342-L348) (Orders)
- **Evidence:**
  ```javascript
  if (search) {
    filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName: { $regex: search, $options: 'i' } },
      { mrn: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }
  ```
- **Description:** Search inputs provided via query parameters (`?search=...`) are passed directly into MongoDB `$regex` clauses without escaping special regular expression metacharacters (`.*+?^${}()|[]\`).
- **Impact:**
  1. Regular Expression Denial of Service (ReDoS) from catastrophic backtracking patterns.
  2. Malformed regexes resulting in unhandled 500 errors.
  3. Unexpected query scoping and information disclosure.
- **Remediation:** Escape special regex characters (e.g. `search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')`) or use exact prefix matches and text indexing.

---

### [SEC-05] Super Admin API Key Header Uses Non-Constant-Time Equality (MEDIUM)
- **File:** [`server/src/middleware/superAdminAuth.middleware.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/middleware/superAdminAuth.middleware.js#L64-L75)
- **Evidence:**
  ```javascript
  const apiKeyHeader = req.headers['x-admin-api-key'];
  if (apiKeyHeader) {
    const configuredKey = config.superAdmin.apiKey;
    if (configuredKey && apiKeyHeader === configuredKey) {
  ```
- **Description:** The API key comparison is performed using standard JavaScript string comparison (`===`), which terminates on the first non-matching byte.
- **Impact:** Susceptible to timing analysis side-channel attacks across network boundaries.
- **Remediation:** Use `crypto.timingSafeEqual` with matching byte buffer lengths.

---

### [SEC-06] In-Memory Audit Trail Volatility During Database Glitches (MEDIUM)
- **File:** [`server/src/services/auditLog.service.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/services/auditLog.service.js#L66-L79)
- **Evidence:**
  ```javascript
  // Store in memory ring buffer
  this.memoryBuffer.unshift(eventData);
  if (this.memoryBuffer.length > this.maxBufferSize) {
    this.memoryBuffer.pop();
  }
  if (dbConnection.getStatus().connected) {
    try {
      await AuditLogModel.create(eventData);
    } catch (err) {
      logger.warn('Failed to persist audit log to MongoDB, preserved in memory buffer', { error: err.message });
    }
  }
  ```
- **Description:** When MongoDB experiences a temporary network disruption, audit logs are buffered exclusively in a 100-entry in-memory array. If the application server restarts or exceeds 100 entries before the database recovers, events are dropped permanently and are not backfilled.
- **Impact:** Non-compliance with healthcare non-repudiation mandates (HIPAA / ISO 15189) during infrastructure failovers.
- **Remediation:** Implement local disk write-ahead logging or a resilient message queue (e.g., Redis / BullMQ) with automatic re-sync on reconnection.

---

### [SEC-07] Missing Rate Limiting on Public Verification & Branding Endpoints (MEDIUM)
- **File:** [`server/src/routes/index.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/routes/index.js#L26-L32)
- **Evidence:**
  ```javascript
  apiV1Router.get('/tenant/branding', tenantClinicalController.resolvePublicBranding);
  apiV1Router.get('/public/verify-report/:token', tenantClinicalController.verifyPublicReport);
  apiV1Router.get('/reports/verify/:token', tenantClinicalController.verifyPublicReport);
  ```
- **Description:** Unlike login endpoints, public unauthenticated verification and branding resolution routes have no rate limiting applied.
- **Impact:** Enumeration scanning of report tokens or denial of service against the public verification surface.
- **Remediation:** Mount an IP-based rate limiter (e.g., 60 requests / minute) on all `/public/` routes.

---

### [SEC-08] Client IP Spoofing Risk via `X-Forwarded-For` without Trust Proxy (MEDIUM)
- **Files:**
  - [`server/src/middleware/rateLimit.middleware.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/middleware/rateLimit.middleware.js#L58)
  - [`server/src/app.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/app.js)
- **Evidence:**
  ```javascript
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  ```
- **Description:** In `app.js`, Express does not have `app.set('trust proxy', ...)` configured. Reading `req.headers['x-forwarded-for']` directly allows clients to forge arbitrary IP addresses and evade IP-based rate limiting.
- **Impact:** Evasion of rate limiting counters and inaccurate audit logging.
- **Remediation:** Configure `app.set('trust proxy', 1)` (or appropriate subnet) and rely on Express's validated `req.ip`.

---

### [SEC-09] MongoDB Atlas Shared Tier Collection Limit Ceiling (MEDIUM - Operational)
- **Files:**
  - [`server/src/services/tenantProvisioning.service.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/services/tenantProvisioning.service.js#L80-L120)
  - [`server/src/services/tenantConnection.service.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/services/tenantConnection.service.js#L105-L125)
- **Evidence:** Multi-tenant architecture creates a distinct database per tenant (`lms_lab_<tenantId>`) with 6–8 initialized collections per database.
- **Description:** MongoDB Atlas M0 (Free) and M2/M5 (Shared) tiers enforce a hard limit of 500 collections across the entire cluster. With 50–60 tenants, this ceiling is exceeded, causing provisioning and indexing failures.
- **Impact:** Laboratory onboarding failures and unexpected 500 errors once tenant count scales.
- **Remediation:** Upgrade to an Atlas M10+ dedicated cluster for production deployments, or implement collection-partitioned tenancy (`tenantId` discriminator with compound indexes) if remaining on shared tiers.

---

### [SEC-10] Password Policy Discrepancy (Special Character Not Enforced) (LOW)
- **File:** [`server/src/services/password.service.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/services/password.service.js#L59-L69)
- **Evidence:**
  ```javascript
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  if (!hasUpper || !hasLower || !hasNumber) {
    return {
      isValid: false,
      message: 'Password must include at least one uppercase letter, one lowercase letter, and one number',
    };
  }
  ```
- **Description:** The policy docstring specifies that passwords require at least one special character, and `hasSpecial` is evaluated, but the condition fails to test `!hasSpecial`.
- **Impact:** Passwords without special characters are accepted contrary to the stated specification.
- **Remediation:** Include `!hasSpecial` in the validation condition.

---

### [SEC-11] Unhandled Error Messages Returned Verbose in Production 500 Responses (LOW)
- **File:** [`server/src/middleware/error.middleware.js`](file:///d:/Laboratry_medical365/LabManagementSystem/server/src/middleware/error.middleware.js#L10-L20)
- **Evidence:**
  ```javascript
  const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_ERROR;
  const message = err.message || 'An unexpected internal server error occurred';
  ...
  const responsePayload = {
    success: false,
    message,
  ...
  ```
- **Description:** If an unexpected 500-level error occurs, `err.message` is returned to the client. While stack traces are suppressed in production, database driver errors (e.g. `MongoServerError: ...`) or filesystem paths could be leaked.
- **Impact:** Low-level architectural information disclosure.
- **Remediation:** In production, replace `err.message` with a generic string (`Internal Server Error`) whenever `statusCode >= 500`.

---

### [SEC-12] Dependency Vulnerabilities (LOW / MEDIUM)
- **Evidence (`npm audit` output):**
  - **Server:** 3 High severity vulnerabilities in dev-dependency tree (`nodemon` -> `chokidar` -> `braces` CWE-674 Stack-exhaustion DoS). Production dependencies have 0 known vulnerabilities.
  - **Client:** 4 vulnerabilities in dev and runtime dependencies (`vite` <=6.4.2 Path Traversal CWE-22/CWE-200, `esbuild` CWE-346, `react-router-dom` CVE-2025-68470 open redirect / CWE-470).
- **Impact:** Vite and nodemon vulnerabilities affect development environments; React Router open redirect could affect navigation if user-controlled URLs are passed into `<Link>`.
- **Remediation:** Upgrade `react-router-dom` to `>=7.18.4` and `vite` to `>=6.4.3` or `8.x`.

---

## 4. Production Blockers (Must Fix Prior to Launch)

The following four items **must** be resolved before exposing the LMS to live network traffic or real patient data:

1. **[BLOCKER 1] Remove Rate Limit Bypass Header (`SEC-01`):** Eliminate `x-bypass-rate-limit: test-bypass` from `server/src/middleware/rateLimit.middleware.js`.
2. **[BLOCKER 2] Restrict Production CORS (`SEC-02`):** Configure `server/src/app.js` to strictly reject unauthorized origins when `config.isProduction` is true.
3. **[BLOCKER 3] Enforce Mandatory Production Secrets (`SEC-03`):** Update `server/src/config/env.js` and `server/src/server.js` to abort startup if default secrets are detected in production.
4. **[BLOCKER 4] Sanitize MongoDB `$regex` Inputs (`SEC-04`):** Escape regex metacharacters in all search query handlers to prevent ReDoS.

---

## 5. Recommended Remediation Order

### Phase 1: Immediate Security Patches (Estimated: 30 minutes)
1. **Fix Rate Limiter:** Restrict `x-bypass-rate-limit` to `process.env.NODE_ENV === 'test'`.
2. **Harden CORS:** Disallow wildcard fallback when `credentials: true`.
3. **Fail-Fast Configuration Validation:** Terminate process on startup if `JWT_SECRET` contains default text in production.
4. **Escape Regex Queries:** Wrap `search` strings with `lodash.escapeRegExp` or regex escape utility before `$regex`.

### Phase 2: Defense-in-Depth Hardening (Estimated: 1–2 hours)
1. **Constant-Time API Key Check:** Replace `===` with `crypto.timingSafeEqual` in `superAdminAuthMiddleware`.
2. **Public Endpoint Throttling:** Apply rate limiting to `/public/verify-report/:token` and `/tenant/branding`.
3. **Trust Proxy Configuration:** Add `app.set('trust proxy', 1)` in `app.js` and rely on `req.ip`.
4. **Sanitize 500 Responses:** Mask internal error messages in production.
5. **Enforce Special Characters:** Update `passwordService.validatePassword` to check `!hasSpecial`.

### Phase 3: Infrastructure & Scalability (Estimated: Next Sprint)
1. **Cluster Capacity Planning:** Migrate from shared Atlas tiers to dedicated M10+ instances before onboarding >25 laboratories.
2. **Audit Trail Persistence:** Implement persistent spooling (or write-ahead queue) for audit logs during database failovers.
3. **Dependency Updates:** Upgrade `react-router-dom` and `vite` to clear reported security advisories.

---

## 6. Checks That Could Not Be Verified

Due to local environment limitations, the following items could not be verified and must be checked on the hosting platform:

1. **Production Reverse Proxy / TLS Termination:** Verified locally with HTTP; HTTPS certificate enforcement (HSTS, TLS 1.3) must be verified at the cloud ingress / load balancer level.
2. **MongoDB Atlas IP Access Whitelist:** Cloud firewall rules (e.g. restricting access to specific VPC/NAT gateway IPs rather than `0.0.0.0/0`) must be confirmed in the Atlas Web Console.
3. **Production Secrets Manager:** Verification that secrets in production are injected via AWS Secrets Manager, Doppler, or HashiCorp Vault rather than static files on server disks.
4. **Backup & Point-in-Time Recovery:** MongoDB Atlas continuous cloud backups and disaster recovery policies must be validated in Atlas project settings.

---

*Report generated for LMS Phase 10.1 Security & Configuration Audit.*
