# ERP Database Design — Normalized Schema

**Target:** Multi-tenant, normalized relational model.  
**DBMS:** PostgreSQL.  
**Naming:** snake_case; `tenant_id` on every tenant-scoped table; UUID primary keys.

---

## 1. Design Principles

- **Tenant isolation:** Every business table has `tenant_id`; all queries filter by tenant.
- **Normalization:** 3NF where practical; denormalize only for read-heavy reporting (e.g. materialized views).
- **Audit:** Critical entities support audit (audit_log table or versioned rows).
- **Referential integrity:** FKs with appropriate ON DELETE (CASCADE for child data, RESTRICT for master references).
- **Indexes:** Composite on `(tenant_id, created_at DESC)` for list APIs; indexes on FKs and status columns.

---

## 2. Core Tables (Existing + Summary)

### 2.1 Auth & Tenant
| Table | Purpose |
|-------|---------|
| **tenants** | Tenant (organization) master |
| **users** | User accounts; tenant_id, email unique per tenant |
| **roles** | Role definitions per tenant |
| **user_roles** | User–role assignment |
| **tenant_settings** | Display name, fiscal year, currency, locale, feature flags |
| **document_number_series** | Per-tenant, per-document-type, per-year sequences (PO, SO, INV, GRN, WO, VINV) |
| **tax_rules** | Tax rates and types per tenant |
| **custom_fields** | Custom field definitions per entity type |
| **company_profiles** | One row per tenant: name, address, GST, TAN, state code |

### 2.2 Product & Inventory
| Table | Purpose |
|-------|---------|
| **product_categories** | Category hierarchy (name, description) |
| **products** | Product master: name, sku, category_id, price, cost_price, uom, reorder_point, safety_stock, lead_time_days, brand, product_type, stock_status, hsn_sac, gst_rate, etc. |
| **warehouses** | Warehouse master: name, location |
| **product_batches** | Batch/lot: product_id, batch_number, manufacture_date, expiry_date |
| **inventory_transactions** | Stock ledger: product_id, warehouse_id, batch_id, transaction_type, quantity, transaction_reason, reference_id, created_by |
| **inventory_reservations** | Reserved qty: product_id, warehouse_id, quantity, reference_type, reference_id, status |
| **warehouse_transfers** | Inter-warehouse transfer: from/to warehouse, product, quantity, status |

### 2.3 Purchase
| Table | Purpose |
|-------|---------|
| **vendors** | Vendor master: name, contact, email, phone, address, gstin, pan, payment_terms, credit_limit, status_notes |
| **purchase_orders** | PO header: vendor_id, po_number, status, expected_delivery_date, total_amount |
| **purchase_order_items** | PO lines: po_id, product_id, quantity, unit_price, total_price |
| **goods_receipts** | GRN header: po_id, warehouse_id, receipt_number, receipt_date |
| **vendor_invoices** | Vendor invoice: vendor_id, po_id, invoice_number, dates, total_amount, status, tds_* |

### 2.4 Sales
| Table | Purpose |
|-------|---------|
| **customers** | Customer master: name, contact, addresses, gstin, place_of_supply_state, pan |
| **sales_orders** | SO header: customer_id, so_number, status, expected_shipping_date, total_amount |
| **sales_order_items** | SO lines: so_id, product_id, quantity, unit_price, total_price |
| **invoices** | Sales invoice: customer_id, so_id, invoice_number, dates, totals, place_of_supply_state, invoice_type, cgst/sgst/igst |
| **invoice_line_items** | Invoice lines: invoice_id, description, quantity, unit_price, hsn_sac, tax breakdown |
| **invoice_number_sequences** | Per-tenant, per-year invoice number |
| **payments** | Payment against invoice: invoice_id, amount, payment_date, payment_method, reference_number |

### 2.5 Manufacturing
| Table | Purpose |
|-------|---------|
| **bom** | Bill of materials header: product_id, name, version, is_active |
| **bom_items** | BOM lines: bom_id, component_product_id, quantity, instructions |
| **work_orders** | Work order: wo_number, bom_id, product_id, sales_order_id, status, planned/produced quantity, dates |
| **material_consumption** | Consumption: work_order_id, product_id, warehouse_id, quantity |
| **production_logs** | Output: work_order_id, warehouse_id, quantity |
| **coil_consumption_log** | Reva-specific: product_id, starting_kg, scrap_kg, used_kg, remaining_kg, coil_ended |

### 2.6 Reporting
| Table | Purpose |
|-------|---------|
| **report_access_log** | Who ran which report, when, parameters |
| **scheduled_reports** | Name, report_type, frequency, recipient_email, next_run_at |

---

## 3. Normalized Core Schema (Logical)

```
tenants 1──* users
tenants 1──* roles
users *──* roles (user_roles)
tenants 1──1 tenant_settings
tenants 1──1 company_profiles

tenants 1──* product_categories
tenants 1──* products (category_id → product_categories)
tenants 1──* warehouses
tenants 1──* product_batches (product_id → products)
tenants 1──* inventory_transactions (product, warehouse, batch, created_by → users)
tenants 1──* inventory_reservations
tenants 1──* warehouse_transfers

tenants 1──* vendors
tenants 1──* purchase_orders (vendor_id, created_by)
tenants 1──* purchase_order_items (po_id, product_id)
tenants 1──* goods_receipts (po_id, warehouse_id, received_by)
tenants 1──* vendor_invoices (vendor_id, po_id)

tenants 1──* customers
tenants 1──* sales_orders (customer_id, created_by)
tenants 1──* sales_order_items (so_id, product_id)
tenants 1──* invoices (customer_id, so_id)
tenants 1──* invoice_line_items (invoice_id)
tenants 1──* payments (invoice_id, recorded_by)

tenants 1──* bom (product_id)
tenants 1──* bom_items (bom_id, component_product_id)
tenants 1──* work_orders (bom_id, product_id, sales_order_id, created_by)
tenants 1──* material_consumption (work_order_id, product_id, warehouse_id)
tenants 1──* production_logs (work_order_id, warehouse_id, recorded_by)
```

---

## 4. Enterprise Extension Tables (Reference DDL)

These tables support the full enterprise design (approvals, audit, requisitions, RFQ, shipments, locations). They are **reference only**; apply via migrations when implementing those features.

### 4.1 Audit Log
```sql
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    operation VARCHAR(20) NOT NULL,  -- CREATE, UPDATE, DELETE
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_logs_tenant_entity ON audit_logs(tenant_id, entity_type, entity_id);
CREATE INDEX idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at DESC);
```

### 4.2 Warehouse Hierarchy (Zone, Rack, Shelf, Bin)
```sql
CREATE TABLE warehouse_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    UNIQUE(tenant_id, warehouse_id, code)
);
CREATE TABLE warehouse_racks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES warehouse_zones(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    UNIQUE(zone_id, code)
);
CREATE TABLE warehouse_shelves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rack_id UUID NOT NULL REFERENCES warehouse_racks(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    UNIQUE(rack_id, code)
);
CREATE TABLE warehouse_bins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shelf_id UUID NOT NULL REFERENCES warehouse_shelves(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    UNIQUE(shelf_id, code)
);
-- Optional: add bin_id to inventory_transactions for putaway
```

### 4.3 Purchase Requisition & RFQ
```sql
CREATE TABLE purchase_requisitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    req_number VARCHAR(100) NOT NULL,
    department VARCHAR(100),
    requester_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    expected_delivery_date DATE,
    budget DECIMAL(15, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, req_number)
);
CREATE TABLE purchase_requisition_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requisition_id UUID NOT NULL REFERENCES purchase_requisitions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DECIMAL(12, 4) NOT NULL,
    notes TEXT
);
CREATE TABLE rfqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rfq_number VARCHAR(100) NOT NULL,
    requisition_id UUID REFERENCES purchase_requisitions(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, rfq_number)
);
CREATE TABLE rfq_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DECIMAL(12, 4) NOT NULL,
    specification TEXT
);
CREATE TABLE vendor_quotes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    rfq_id UUID NOT NULL REFERENCES rfqs(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
    unit_price DECIMAL(12, 2),
    total_price DECIMAL(15, 2),
    validity_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'RECEIVED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 4.4 Vendor Approval Workflow
```sql
CREATE TABLE vendor_approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL,  -- SUBMITTED, PROCUREMENT_REVIEW, COMPLIANCE_CHECK, FINANCE_APPROVAL, ACTIVATED
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
-- Add vendor status to vendors: pending_approval, activated, rejected
```

### 4.5 Shipments (Logistics)
```sql
CREATE TABLE shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    shipment_number VARCHAR(100) NOT NULL,
    sales_order_id UUID REFERENCES sales_orders(id) ON DELETE SET NULL,
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
    carrier_name VARCHAR(255),
    tracking_number VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',  -- PENDING, PACKED, DISPATCHED, IN_TRANSIT, DELIVERED
    shipped_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, shipment_number)
);
CREATE TABLE shipment_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity DECIMAL(12, 4) NOT NULL
);
```

### 4.6 Approval Workflows (Generic)
```sql
CREATE TABLE approval_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL,  -- PURCHASE_ORDER, REQUISITION, VENDOR, etc.
    entity_id UUID NOT NULL,
    current_step INT NOT NULL DEFAULT 1,
    status VARCHAR(50) NOT NULL,  -- PENDING, APPROVED, REJECTED
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE approval_workflow_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    role_id UUID REFERENCES roles(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    action VARCHAR(20) NOT NULL  -- APPROVE, REJECT
);
```

### 4.7 Notifications / Events
```sql
CREATE TABLE notification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    payload JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES notification_events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,  -- IN_APP, EMAIL, WHATSAPP
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    sent_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE
);
```

---

## 5. Indexing Strategy

- **List APIs:** `(tenant_id, created_at DESC)` on orders, invoices, transactions, GRNs.
- **Lookups:** `(tenant_id, sku)` on products, `(tenant_id, po_number)` on purchase_orders, etc.
- **FKs:** Index foreign keys used in JOINs and filters (e.g. vendor_id, product_id, warehouse_id).
- **Reporting:** Consider materialized views for valuation, aging, spend; refresh on schedule or event.

---

## 6. Table Count Summary

| Area | Existing | With enterprise extensions |
|------|----------|----------------------------|
| Auth & tenant | 9 | 9 |
| Product & inventory | 7 | 11 (zones, racks, shelves, bins) |
| Purchase | 5 | 10 (+ requisitions, rfq, quotes, vendor approval) |
| Sales | 7 | 9 (+ shipments, shipment_lines) |
| Manufacturing | 6 | 6 |
| Reporting | 2 | 2 |
| Audit & notifications | 0 | 4 (audit_logs, approval_workflows, notification_events, notification_deliveries) |

**Total core (current):** ~37 tables. **With enterprise extensions:** 50+ tables. Scaling to 500+ tables is achieved by adding more modules (HR, projects, assets, quality, GL, cost centers, etc.) and sub-entities (e.g. multiple address tables, document attachments, workflow steps per type).

---

## 7. Reference DDL File

Executable SQL for the enterprise extension tables (audit_logs, warehouse hierarchy, purchase requisitions, RFQ, vendor approval, shipments, approval workflows, notifications) is in **`docs/database/REFERENCE_ENTERPRISE_EXTENSIONS.sql`**. Copy sections into numbered goose migrations (e.g. `00014_audit_log.sql`, `00015_warehouse_hierarchy.sql`) when implementing.

This design aligns with the existing migrations in `erp-backend/migrations/` and extends them for the full enterprise blueprint in `ERP_ENTERPRISE_DESIGN.md`.
