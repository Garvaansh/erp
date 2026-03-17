# ERP SaaS Product Vision

## Goal

A **generic, multi-tenant ERP SaaS** that any business can use. Reva Technologies is one customer; the same product can be sold and configured for other tenants (companies/workspaces) without code changes.

## What “Generic” Means

- **Tenant isolation**: Every tenant’s data (products, vendors, orders, invoices, users) is strictly isolated by `tenant_id`. No cross-tenant access.
- **Configurable per tenant**: Display name, base currency, locale, timezone, document number series (PO, SO, INV, GRN, etc.), tax rules, and optional custom fields are stored in tenant configuration tables and can differ per tenant.
- **Single codebase**: One backend (Go) and one frontend (Next.js) serve all tenants. Tenant context comes from the JWT (tenant_id + user_id) on every request.

## Supported Modules

| Module | Description |
|--------|-------------|
| **Auth & org** | Tenant and user registration, login, JWT, roles (Admin, Manager, Operator), tenant settings |
| **Inventory** | Products, categories, warehouses, stock ledger, batches, reservations, transfers, valuation reports |
| **Purchase** | Vendors, purchase orders, goods receipts (GRN), vendor invoices |
| **Sales** | Customers, sales orders, invoices, payments; inventory deduction on shipment |
| **Manufacturing** | BOMs, work orders, production logs, material consumption |
| **Reports** | Dashboard metrics, inventory valuation, scheduled reports, exports |
| **Reva** | Tenant-specific (Reva): coil consumption log, stock levels with Reva fields, company profile |

## Tenant Lifecycle

1. **Signup**: `POST /api/v1/auth/register` with tenant name + first user (email, password). Creates tenant, user, default roles, tenant_settings, and document number series. First user is assigned Admin.
2. **Login**: `POST /api/v1/auth/login` with tenant_id, email, password. Returns JWT with `sub` (user id) and `tenant_id`.
3. **Config**: Authenticated users can `GET/PUT /api/v1/tenant/settings` to read/update display name, currency, locale, timezone.
4. **Seeding (optional)**: For provisioning without the API (e.g. first “Reva” tenant), run `go run cmd/seed-tenant/main.go` with env `TENANT_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.

## Operator Flows

- **Purchase**: Create vendor → Create PO (with items) → Create goods receipt (GRN) for a PO → Stock IN is recorded automatically; optionally create vendor invoice.
- **Sales**: Create customer → Create sales order (with items) → Update SO status to SHIPPED (with warehouse_id) → Inventory OUT is recorded; create invoice and record payments.
- **Inventory**: Products and warehouses; view stock levels, stock by warehouse, low-stock alerts, valuation report (`GET /api/v1/inventory/reports/valuation`).

## Where Configuration Lives

- **tenant_settings**: display_name, fiscal_year_start_month, base_currency, locale, timezone, feature_flags (JSON).
- **document_number_series**: per tenant, per document type (PO, SO, INV, GRN, WO, VINV), per year; used to generate next numbers.
- **tax_rules**: per tenant (name, rate, type, applicable_to).
- **custom_fields**: per tenant, per entity type (product, vendor, customer, etc.) for future extensibility.
- **company_profiles**: legal name, address, GST, contact (one row per tenant); used for invoices and Reva-specific UI.

## Tech Stack

- **Backend**: Go, Fiber, sqlc, pgx, PostgreSQL. Migrations: goose.
- **Frontend**: Next.js 16, React 19, Tailwind. Auth: JWT in localStorage; tenant_id in login form.
- **Database**: Single PostgreSQL database; tenant isolation enforced in application layer (all queries filter by tenant_id from JWT).
