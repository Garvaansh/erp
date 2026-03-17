# Product Vision

**Product:** World-class ERP SaaS, India-first, multi-tenant.  
**Design partner:** Reva Technologies (manufacturing — coil/industrial).  
**Stack:** Go (Fiber, SQLC, pgx), PostgreSQL, Next.js.

---

## Strategic focus

- **Region:** India first — GST, TDS, payroll (PF/ESI/PT), and local compliance drive the roadmap.
- **Vertical:** Manufacturing with Reva as the reference customer; coil consumption, work orders, BOMs, and cost tracking are first-class.
- **Evolution:** Start as Reva’s internal ERP; same codebase and data model support additional tenants (multi-tenant SaaS) and adjacent industries later.

---

## Current modules (from README)

1. **Auth & org** — Tenant + user registration, JWT, roles, tenant settings.
2. **Inventory** — Products, warehouses, stock ledger, batches, transfers, valuation.
3. **Purchase** — Vendors, POs, GRN, vendor invoices.
4. **Sales** — Customers, orders, invoices, payments; inventory deduction.
5. **Manufacturing** — BOMs, work orders, production logs, coil consumption.
6. **Reporting** — Dashboard, valuation, scheduled reports, exports.

---

## Roadmap and India compliance

Detailed India-first scope and Reva-aligned roadmap:

- **[India + Reva roadmap](INDIA_REVA_ROADMAP.md)** — GST, TDS, payroll, data model additions, and phased plan (Phase 1: India invoicing + Reva manufacturing; Phase 2: GSTR, TDS full flow, HR/Payroll; Phase 3: more tenants and analytics).

---

## Architecture

- **Style:** Modular monolith; no Redis/Kafka — PostgreSQL and app logic for state and queues.
- **Docs:** [TENANT_ONBOARDING](TENANT_ONBOARDING.md), [ARCHITECTURE](ARCHITECTURE.md) when added; [MIGRATION_REVA](MIGRATION_REVA.md) for Reva-specific migrations.
