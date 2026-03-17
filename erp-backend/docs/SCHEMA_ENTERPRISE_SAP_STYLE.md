# Enterprise Database Schema — SAP ERP–Style Design

**Purpose:** Multi-tenant ERP schema covering SAP-like scope (FI, CO, MM, SD, PP, QM, PM, org structure) with hundreds of tables.  
**Conventions:** `tenant_id` on every business table; UUID primary keys; snake_case; PostgreSQL.  
**Reference:** SAP modules FI, CO, MM, SD, PP, QM, PM; our existing schema in `migrations/` and `DATABASE_DESIGN.md`.

---

## 1. Research Summary: SAP ERP Table Scope

| SAP Module | Approx. Tables (SAP) | Our Coverage |
|------------|----------------------|--------------|
| **FI** (Financial Accounting) | ~4,500+ | Chart of accounts, G/L documents, cost centers, profit centers, bank, fiscal periods |
| **CO** (Controlling) | Hundreds | Cost centers, profit centers, internal orders, cost elements, activity types |
| **MM** (Materials Management) | ~500+ (MM-PUR alone ~487) | Material master extensions, purchasing info, source list, material documents, physical inventory |
| **SD** (Sales & Distribution) | Hundreds | Sales areas, condition records, schedule lines, delivery/billing document layers, partners |
| **PP** (Production Planning) | Hundreds | Work centers, routings, capacity, production versions |
| **QM** (Quality Management) | Hundreds | Inspection lots, characteristics, results, certificates |
| **PM** (Plant Maintenance) | Hundreds | Functional locations, equipment, maintenance orders, task lists |
| **Org / Cross** | Thousands | Company codes, plants, storage locations, purchasing/sales orgs |

We do **not** copy SAP table names (e.g. MARA, EKKO); we use domain-driven snake_case names and keep tenant isolation and UUIDs.

---

## 2. Schema Overview by Domain

Total table count below includes **existing** tables (from current migrations) plus **new** enterprise tables. Counts are approximate.

| Domain | Existing | New | Description |
|--------|----------|-----|-------------|
| **1. Auth & tenant** | 9 | 12 | Tenants, users, roles, settings, company codes, fiscal config |
| **2. Organizational structure** | 0 | 18 | Company codes, plants, storage locations, purchasing/sales orgs, channels |
| **3. Finance (FI)** | 0 | 28 | Chart of accounts, G/L docs, cost/profit centers, bank, periods |
| **4. Controlling (CO)** | 0 | 14 | Internal orders, cost elements, activity types, rates, profitability |
| **5. Material master** | 4 | 22 | Products (existing) + descriptions, plant/sloc data, valuations, UOM, types, groups |
| **6. Purchasing (MM-PUR)** | 6 | 20 | POs, GRN, requisitions (existing) + info records, source list, quota, scheduling agreements |
| **7. Inventory (MM-IM)** | 8 | 16 | Transactions, batches (existing) + material docs, reservations detail, physical inventory |
| **8. Sales (SD)** | 7 | 24 | SO, invoices, shipments (existing) + areas, conditions, schedule lines, delivery/billing docs |
| **9. Manufacturing (PP)** | 12 | 18 | BOM, work orders, production (existing) + work centers, routings, capacity |
| **10. Quality (QM)** | 1 | 12 | Inspections (existing) + inspection lots, characteristics, certificates, defect codes |
| **11. Plant maintenance (PM)** | 0 | 14 | Functional locations, equipment, maintenance orders, task lists |
| **12. Addresses & contacts** | 0 | 8 | Generic addresses, contact persons, bank details |
| **13. Documents & attachments** | 0 | 6 | Document headers, attachments, links |
| **14. Audit & reporting** | 2 | 6 | Audit logs, report logs (existing) + report variants, export queue |
| **15. Integration** | 0 | 8 | Outbound/inbound message log, mapping rules |
| **16. Notifications & workflow** | 0 | 6 | Events, deliveries, approval steps (extended) |

**Total (new only):** ~226 new tables. **Total (existing + new):** ~250+ tables.

**Implementation:** Migrations `00019` through `00031` implement the above. Run `bash scripts/migrate-all.sh` from `erp-backend` to apply.

---

## 3. Table List by Domain

### 3.1 Auth & Tenant (existing + new)

| Table | Purpose |
|-------|---------|
| tenants | Tenant master (existing) |
| users | User accounts (existing) |
| roles | Role definitions (existing) |
| user_roles | User–role assignment (existing) |
| tenant_settings | Display name, currency, locale, feature flags (existing) |
| document_number_series | Document sequences per type/year (existing) |
| tax_rules | Tax rates per tenant (existing) |
| custom_fields | Custom field definitions (existing) |
| company_profiles | Company name, address, GST, TAN (existing) |
| company_codes | FI company code (e.g. 1000, 2000); one per legal entity |
| company_code_texts | Language-dependent description |
| fiscal_year_variants | Fiscal year definition (calendar vs non-calendar) |
| fiscal_periods | Posting periods per company code / year |
| posting_period_locks | Lock/unlock posting by period |

### 3.2 Organizational Structure

| Table | Purpose |
|-------|---------|
| plants | Plant (manufacturing site); links to company code |
| plant_texts | Plant descriptions |
| storage_locations | Storage location within plant (aligns with warehouses or sub-locations) |
| storage_location_texts | Descriptions |
| purchasing_organizations | Purchasing org (can serve multiple plants) |
| purchasing_org_texts | Descriptions |
| sales_organizations | Sales org (sales structure) |
| sales_org_texts | Descriptions |
| distribution_channels | Distribution channel (e.g. wholesale, retail) |
| divisions | Product division |
| plant_purchasing_org | Assignment plant ↔ purchasing org |
| plant_sales_org | Assignment plant ↔ sales org |
| company_code_plants | Assignment company code ↔ plant |
| organizational_units | Generic hierarchy node (optional) |
| org_unit_assignments | Entity (e.g. user, cost center) ↔ org unit |

### 3.3 Finance (FI)

| Table | Purpose |
|-------|---------|
| chart_of_accounts | Chart of accounts (e.g. COA_IN, COA_GAAP) |
| chart_of_accounts_texts | Descriptions |
| gl_accounts | G/L account master (account number, type, control) |
| gl_account_texts | Account name by language |
| gl_account_company_code | Company-code-specific account config (blocked, tax, etc.) |
| accounting_document_headers | Document header (company code, fiscal year, document number, posting date) |
| accounting_document_items | Document line (account, amount, debit/credit, cost center, profit center) |
| document_line_account_assignments | Additional account assignment (e.g. order, project) |
| cost_centers | Cost center master |
| cost_center_texts | Descriptions |
| cost_center_hierarchy | Parent-child for reporting |
| profit_centers | Profit center master |
| profit_center_texts | Descriptions |
| profit_center_hierarchy | Hierarchy |
| cost_center_profit_center | Assignment cost center → profit center |
| bank_masters | Bank master (bank key, name, SWIFT) |
| bank_accounts | Company bank accounts (company code, account id, bank key) |
| bank_statement_headers | Bank statement upload header |
| bank_statement_items | Statement line (amount, value date, ref) |
| payment_terms | Payment terms (e.g. Net 30, 2% 10) |
| payment_terms_texts | Descriptions |
| currency_rates | Exchange rates (from_currency, to_currency, date, rate) |
| dunning_config | Dunning configuration per company code |
| dunning_run_headers | Dunning run header |
| dunning_run_items | Dunning run line (customer/vendor, level, amount) |

### 3.4 Controlling (CO)

| Table | Purpose |
|-------|---------|
| cost_elements | Cost element (primary/secondary) |
| cost_element_texts | Descriptions |
| activity_types | Activity type (e.g. labor, machine) |
| activity_type_texts | Descriptions |
| cost_center_activity_rates | Price per activity type per cost center per period |
| internal_orders | Internal order (project, cost collector) |
| internal_order_texts | Descriptions |
| internal_order_settlement_rules | Settlement rule (receiver, percentage) |
| profitability_segments | Profitability segment (dimensions) |
| profitability_segment_texts | Descriptions |
| profit_center_accounting_assignments | Assignment of CO object to profit center |
| assessment_cycle_headers | Assessment cycle definition |
| assessment_cycle_sources | Source cost center / cost element |
| assessment_cycle_receivers | Receiver cost center / order |
| distribution_cycle_headers | Distribution cycle |
| distribution_cycle_sources_receivers | Source and receiver |

### 3.5 Material Master (extensions to products)

| Table | Purpose |
|-------|---------|
| product_categories | Category (existing) |
| products | Product master (existing) |
| product_descriptions | Short/long text by language (MAKT-style) |
| material_groups | Material group (procurement, valuation grouping) |
| material_types | Material type (raw, semi-finished, finished, trading, etc.) |
| valuation_areas | Valuation area (company code or plant level) |
| product_plant_data | Product data per plant (MRP type, lot size, lead time) — MARC-style |
| product_storage_location_data | Product per plant + storage location (reorder point, etc.) — MARD-style |
| product_valuations | Valuation (standard price, moving average) per valuation area — MBEW-style |
| product_uom_conversions | Alternate UOM and conversion factor — MARM-style |
| product_sales_data | Sales org / channel data (min order qty, delivery group) — MVKE-style |
| product_purchasing_data | Purchasing data (planning delivery time, GR processing time) |
| product_mrp_data | MRP views (MRP type, lot size, safety stock) |
| product_quality_data | Quality management relevant (inspection type) |
| product_forecasting_data | Forecasting parameters |
| product_classification | Classification (class type, class) for variants |
| product_partners | Partner roles (vendor, customer) per product |
| product_documents | Link to document (drawing, cert) |
| product_serial_number_profiles | Serial number profile per product |
| product_batches | Batch master (existing) |
| product_batch_valuations | Batch valuation (split valuation) |
| product_supply_source | Default supply source (make/buy, default vendor) |

### 3.6 Purchasing (MM-PUR) extensions

| Table | Purpose |
|-------|---------|
| vendors | Vendor master (existing) |
| purchase_orders | PO header (existing) |
| purchase_order_items | PO items (existing) |
| purchase_requisitions | Requisition header (existing) |
| purchase_requisition_items | Requisition items (existing) |
| goods_receipts | GRN header (existing) |
| vendor_invoices | Vendor invoice (existing) |
| purchasing_groups | Purchasing group (buyer group) — T024-style |
| purchasing_info_records | Vendor–material info record — EINA/EINE-style |
| purchasing_info_record_conditions | Conditions (price, delivery) per info record |
| source_list | Source of supply (vendor, material, plant, preferred) — EORD-style |
| source_list_conditions | Conditions on source list |
| quota_arrangements | Quota arrangement (multiple sources, %) |
| quota_arrangement_items | Quota item (vendor, percentage) |
| scheduling_agreement_headers | Scheduling agreement with vendor |
| scheduling_agreement_items | SA item (material, schedule line dates/qty) |
| purchase_order_history | History per PO item (goods movement, invoice) — EKBE-style |
| rfqs | RFQ header (existing in reference DDL) |
| rfq_items | RFQ items |
| vendor_quotes | Vendor quotes per RFQ |
| contract_headers | Outline agreement (contract) |
| contract_items | Contract item (material, quantity, value) |
| subcontracting_orders | Subcontracting PO reference (send material, receive finished) |

### 3.7 Inventory (MM-IM) extensions

| Table | Purpose |
|-------|---------|
| warehouses | Warehouse (existing) |
| warehouse_zones, warehouse_racks, warehouse_shelves, warehouse_bins | Hierarchy (existing) |
| inventory_transactions | Stock movement (existing) |
| inventory_reservations | Reservation header (existing) |
| reservation_items | Reservation item (material, requirement date, quantity) — RESB-style |
| material_document_headers | Material document header (annual, number) — MKPF-style |
| material_document_items | Material document item (movement type, quantity, batch) — MSEG-style |
| physical_inventory_headers | Physical inventory document header — IKPF-style |
| physical_inventory_items | Counted quantity per material/batch/sloc — ISEG-style |
| inventory_cycle_count_schedules | Cycle count schedule (material, storage location, frequency) |
| stock_initialization_log | Log of initial stock upload (for go-live) |
| serial_numbers | Serial number master (product, serial, status) |
| serial_number_history | Movement history per serial |
| inventory_revaluation_headers | Revaluation run header |
| inventory_revaluation_items | Revaluation line (material, old/new price) |
| stock_transfer_requests | Request for stock transfer (before warehouse_transfers) |

### 3.8 Sales (SD) extensions

| Table | Purpose |
|-------|---------|
| customers | Customer master (existing) |
| sales_orders | SO header (existing) |
| sales_order_items | SO items (existing) |
| sales_order_schedule_lines | Schedule line (delivery date, quantity) |
| sales_order_partners | Sold-to, ship-to, bill-to, payer |
| invoices | Sales invoice (existing) |
| invoice_line_items | Invoice lines (existing) |
| payments | Payment (existing) |
| shipments | Shipment header (existing) |
| shipment_lines | Shipment lines (existing) |
| sales_areas | Sales org + distribution channel + division |
| sales_office | Sales office |
| sales_group | Sales group |
| pricing_condition_types | Condition type (price, discount, freight) |
| condition_records | Condition record (material, customer, valid-from/to, amount/%) |
| customer_material_info | Customer-specific material number / description |
| delivery_blocks | Block reason (e.g. credit hold) |
| billing_blocks | Billing block reason |
| delivery_headers | Delivery document header (can align with shipment) |
| delivery_items | Delivery item (material, quantity, reference SO) |
| billing_document_headers | Billing document (can align with invoice) |
| billing_document_items | Billing item |
| incompletion_log | Incomplete document log (missing fields) |
| credit_control_areas | Credit control area |
| credit_control_account_assignments | Customer ↔ credit control area |

### 3.9 Manufacturing (PP) extensions

| Table | Purpose |
|-------|---------|
| bom | BOM header (existing) |
| bom_items | BOM items (existing) |
| work_orders | Work order (existing) |
| production_orders | Production order (existing) |
| production_lines | Production line / work center (existing) |
| machines | Machine (existing) |
| production_logs | Production log (existing) |
| material_consumption | Material consumption (existing) |
| quality_inspections | Quality inspection (existing) |
| work_centers | Work center master (capacity, cost center link) |
| work_center_capacities | Capacity per work center (formula, available capacity) |
| work_center_cost_center | Work center → cost center |
| routings | Routing header (product, plant, version) |
| routing_operations | Operation (work center, sequence, standard time) |
| routing_operation_materials | Material component per operation |
| production_versions | Production version (BOM + routing combination) |
| capacity_planning_headers | Capacity planning run |
| capacity_planning_items | Planned load per work center / period |
| scrap_analysis_headers | Scrap analysis run |
| scrap_analysis_items | Scrap by material / order |
| operation_confirmations | Confirmation of operation (labor, quantity, time) |
| rework_orders | Rework order (reference production order) |

### 3.10 Quality (QM)

| Table | Purpose |
|-------|---------|
| quality_info_records | Quality info record (vendor, material, inspection type) |
| inspection_lot_headers | Inspection lot (triggered by GR, production, etc.) |
| inspection_lot_characteristics | Characteristic (e.g. dimension, hardness) |
| inspection_lot_results | Result (measured value, pass/fail) |
| quality_certificates | Certificate (link to batch, document) |
| defect_codes | Defect code (short text, catalog) |
| defect_code_groups | Grouping of defect codes |
| sampling_schemes | Sampling scheme (AQL, sample size) |
| inspection_methods | Inspection method (procedure) |
| quality_audit_log | Audit trail for QM decisions |
| quality_notification_headers | Quality notification (complaint, defect) |
| quality_notification_items | Notification item (material, defect code) |
| quality_inspections | (Existing) Work order inspection |

### 3.11 Plant Maintenance (PM)

| Table | Purpose |
|-------|---------|
| functional_locations | Functional location (hierarchy: building → area → equipment) |
| functional_location_hierarchy | Parent-child |
| equipments | Equipment (installed at functional location) |
| equipment_serial_data | Serial number, warranty |
| maintenance_plan_headers | Maintenance plan (strategy, cycle) |
| maintenance_plan_items | Plan item (activity type, interval) |
| maintenance_task_list_headers | Task list (general task list) |
| maintenance_task_list_operations | Operation (work center, duration) |
| maintenance_order_headers | Maintenance order (reference equipment, plan) |
| maintenance_order_operations | Order operation (task list operation, actual time) |
| maintenance_order_reservations | Material reservation for maintenance order |
| maintenance_order_confirmations | Confirmation (labor, time) |
| maintenance_history | History of completed orders per equipment |
| meter_readings | Meter reading (equipment, counter, value, date) |

### 3.12 Addresses & Contacts

| Table | Purpose |
|-------|---------|
| address_types | Type (billing, shipping, remit-to) |
| addresses | Generic address (street, city, state, country, pincode) |
| party_addresses | Link address to party (vendor_id, customer_id, company) and type |
| contact_persons | Contact (name, phone, email) |
| party_contacts | Link contact to vendor/customer |
| bank_details | Bank account (IBAN, bank key, account holder) |
| party_bank_details | Link bank to vendor/customer (for payment) |
| communication_log | Log of outbound/inbound communication (email, call) |

### 3.13 Documents & Attachments

| Table | Purpose |
|-------|---------|
| document_types | Document type (invoice, PO, drawing, cert) |
| document_headers | Document header (type, description, created_by) |
| document_attachments | File (storage path or blob ref, mime type) |
| document_links | Link document to entity (entity_type, entity_id) |
| document_versions | Version history of document |
| document_approvals | Approval status per document |

### 3.14 Audit & Reporting

| Table | Purpose |
|-------|---------|
| audit_logs | Audit trail (existing) |
| report_access_log | Report run log (existing) |
| scheduled_reports | Scheduled report (existing) |
| report_variants | Saved report variant (name, parameters) |
| report_output_log | Output (file, email sent) per run |
| export_queue | Queue for async export (status, file path) |
| export_queue_items | Line item (e.g. record count) |

### 3.15 Integration

| Table | Purpose |
|-------|---------|
| outbound_message_log | Outbound interface (IDoc, API call) log |
| inbound_message_log | Inbound message log |
| interface_mapping_rules | Mapping rule (source field → target field) |
| interface_endpoints | Endpoint (URL, auth type) |
| idoc_headers | Outbound IDoc header (optional) |
| idoc_segments | IDoc segment (data) |
| integration_errors | Error log (message_id, error text, retry count) |
| api_audit_log | API request/response log (optional, for integration APIs) |

### 3.16 Notifications & Workflow

| Table | Purpose |
|-------|---------|
| notification_events | Event (existing in reference DDL) |
| notification_deliveries | Delivery (existing) |
| approval_workflows | Approval workflow (existing) |
| approval_workflow_steps | Steps (existing) |
| workflow_definitions | Workflow template (entity type, steps) |
| workflow_instances | Running instance (entity_id, current step) |
| user_inbox | User inbox (task, assigned to, status) |

---

## 4. Implementation Order (Migrations)

Migrations are applied in order. Existing migrations 00001–00018 remain unchanged. New migrations (00019+) create only **new** tables; they do not alter existing core tables (except where explicitly adding a column to an existing table if needed).

| Migration | Domain | Tables |
|-----------|--------|--------|
| 00019 | Org structure | company_codes, plants, storage_locations, purchasing_organizations, sales_organizations, distribution_channels, divisions + texts and assignments |
| 00020 | FI foundation | chart_of_accounts, gl_accounts, fiscal_year_variants, fiscal_periods, accounting_document_headers, accounting_document_items, cost_centers, profit_centers + hierarchies |
| 00021 | FI bank & terms | bank_masters, bank_accounts, payment_terms, currency_rates |
| 00022 | CO | cost_elements, activity_types, internal_orders, cost_center_activity_rates, profitability_segments |
| 00023 | Material master ext | material_groups, material_types, product_descriptions, product_plant_data, product_valuations, product_uom_conversions |
| 00024 | Purchasing ext | purchasing_groups, purchasing_info_records, source_list, quota_arrangements, contract_headers, contract_items |
| 00025 | Inventory ext | material_document_headers, material_document_items, physical_inventory_headers, physical_inventory_items, reservation_items, serial_numbers |
| 00026 | Sales ext | sales_areas, sales_order_schedule_lines, sales_order_partners, pricing_condition_types, condition_records, delivery_headers, delivery_items |
| 00027 | PP ext | work_centers, work_center_capacities, routings, routing_operations, production_versions |
| 00028 | QM | inspection_lot_headers, inspection_lot_characteristics, inspection_lot_results, defect_codes, quality_info_records |
| 00029 | PM | functional_locations, equipments, maintenance_plan_headers, maintenance_order_headers, maintenance_order_operations |
| 00030 | Addresses & docs | addresses, party_addresses, contact_persons, party_contacts, bank_details, party_bank_details, document_headers, document_attachments, document_links |
| 00031 | Integration & workflow | outbound_message_log, inbound_message_log, workflow_definitions, workflow_instances, report_variants, export_queue |

---

## 5. Naming and Conventions

- **Primary key:** `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` for all new tables (or composite where appropriate, e.g. document_number_series).
- **Tenant:** `tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE` on every business table.
- **Timestamps:** `created_at`, `updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP`.
- **Soft delete:** Optional `deleted_at TIMESTAMP WITH TIME ZONE` where required.
- **Indexes:** `(tenant_id, created_at DESC)` for list APIs; unique on `(tenant_id, <business_key>)` where applicable; FK indexes.
- **Texts:** Separate `*_texts` tables with `language_code` for i18n (e.g. gl_account_texts, cost_center_texts).

---

## 6. References

- Existing schema: `erp-backend/migrations/`, `DATABASE_DESIGN.md`
- Enterprise design: `ERP_ENTERPRISE_DESIGN.md`
- SAP table references: SAP Community, SAP Help (FI, CO, MM, SD, PP, QM, PM); this doc does not reproduce proprietary SAP structures.
