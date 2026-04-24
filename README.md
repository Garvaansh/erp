# ERP SaaS Platform

A **generic multi-tenant ERP SaaS** (Go backend, PostgreSQL, Next.js frontend). Reva Technologies is one customer; the same product can be provisioned for other tenants. No Redis/Kafka—state and queues use PostgreSQL and application logic.

## Architecture

* **Backend:** Go (Fiber, SQLC, pgxpool)
* **Frontend:** Next.js, React, Tailwind (erp-frontend)
* **Database:** PostgreSQL
* **Architecture Style:** Modular Monolith with Multi-Tenant SaaS design

## Modules
1. **Auth & org** – Registration (tenant + user), JWT login, roles, tenant settings
2. **Inventory** – Products, warehouses, stock ledger, batches, transfers, valuation reports
3. **Purchase** – Vendors, POs, goods receipts (GRN), vendor invoices
4. **Sales** – Customers, sales orders, invoices, payments; inventory deduction on shipment
5. **Manufacturing** – BOMs, work orders, production logs, material consumption
6. **Reporting** – Dashboard, inventory valuation, scheduled reports, exports

## Docs
- **[High-Level Design (HLD)](docs/HLD.md)** — System context, architecture, components, data flow, security, deployment
- [Product vision & modules](erp-backend/docs/PRODUCT_VISION.md)
- [Tenant onboarding (API & CLI)](erp-backend/docs/TENANT_ONBOARDING.md)
- [Architecture & domain model](docs/ARCHITECTURE.md)
- **Enterprise ERP design:** [Full design blueprint](erp-backend/docs/ERP_ENTERPRISE_DESIGN.md) (modules, workflows, business rules, Reva example)
- **Inventory UI (SAP/Oracle-style):** [Inventory Management UI spec](erp-backend/docs/INVENTORY_UI_ENTERPRISE_SPEC.md) (layout, filters, KPIs, grid, detail panel, ledger, Reva alignment & gaps)
- [REST API design](erp-backend/docs/API_DESIGN.md) (examples: Create Product, Update Vendor, Create PO, Receive Inventory, Transfer Stock)
- [Database design](erp-backend/docs/DATABASE_DESIGN.md) (normalized schema, core + enterprise extension tables)
- [Enterprise schema (SAP-style)](erp-backend/docs/SCHEMA_ENTERPRISE_SAP_STYLE.md) (200+ tables: FI, CO, MM, SD, PP, QM, PM, org, addresses, docs, integration)
- [Performance requirements](erp-backend/docs/PERFORMANCE_REQUIREMENTS.md) (1M users, 100k TPS/hour, real-time analytics, low latency)

## Running the Application Locally

1. Install Dependencies:
```bash
cd erp-backend
go mod tidy
```

2. Setup Environment Variables:
Ensure `erp-backend/.env` exists and contains correct PostgreSQL connection strings.
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=erp_user
DB_PASSWORD=change_me
DB_NAME=reva_erp
JWT_SECRET=change_me
PORT=3000
```

3. Run migrations (first time or after pull):
```bash
cd erp-backend
bash scripts/migrate-all.sh   # requires goose
```

4. Run the Go Fiber server:
```bash
cd erp-backend
go run cmd/server/main.go
```

5. (Optional) Run the Next.js frontend:
```bash
cd erp-frontend
npm install && npm run dev
```

## SQLC Generation

After writing SQL queries in `internal/db/queries` and schema in `migrations`, generate the Go bindings:

```bash
cd erp-backend
sqlc generate
```

## Code Improvements Applied

- Add regression tests around the highest-risk files: `frontend/src/features/vendors/vendor-code.ts`, `frontend/src/features/vendors/types.ts`, `frontend/src/features/vendors/components/vendor-create-dialog.tsx`.
- Consider extracting shared utility code into a dedicated module to lower coupling.
- Re-index and regenerate walkthroughs/diagrams after structural changes to keep documentation current.
