# LMS Server Models (Phase 1: Architecture & Schema Design)

This directory contains Mongoose schema architectural specifications prepared for Phase 2 integration.

## Multi-Tenant Schema Strategy

In Phase 1:
- No database connections are active.
- No live collections or migrations are executed.
- No real data is seeded.

In Phase 2:
- Tenant isolation will map either per-tenant databases (`lms_tenant_<id>`) or shared collections using an indexed `tenantId` discriminator and compound unique indexes.
- Schemas here serve as typed contracts for future data modeling.
