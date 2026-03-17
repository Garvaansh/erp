# Reva Technologies – Operations Analysis & SaaS ERP Implementation Plan

This document analyses the **real operational spreadsheets** used by Reva Technologies and defines how to implement a **domain-specific ERP** that matches their factory workflow.

---

## 1. What These Spreadsheets Are

### 1.1 "Reva item purchase history" (multi-tab workbook)

| Tab | Purpose | Key Data |
|-----|---------|----------|
| **Purchase material** | Purchase order log / material receiving record | Date, Supplier, Item description, Quantity, Unit, Price/Cost, Specs (columns D–H often mix qty, price, dimensions) |
| **STOCK COIL** | Live inventory summary for coils & pipes | Tr Item ID, Item name (SS COIL, SS PIPE), Type (30 MM, 48 MM, 3/4"(60), etc.), Price, # Stock (KG), Status (In stock), Tr Notes (OLD, NEW, 6 BUNDLE, PIPES) |
| **Pipe coil** | Goods inward / consumption by pipe/coil type | Blocks per material (e.g. LIGHT 30mm, Heavy .48mm, 3/4" PIPE): Date, Quantity (KG/B/PC), REM/REI reference codes, running totals |
| **railing COIL** | Same structure for railing coils | Same pattern as Pipe coil |
| **CURTAIN TRACK** | Curtain-track items + vendor list | Item (e.g. JUMBO SILENT TRACK), Qty (PC), Unit price; Vendor names with status notes (e.g. "don't sell", "RATES given", "CALL NOT PICK") |

### 1.2 "REVA - 26"

- **Purpose:** Daily production / material consumption log for metal coils.
- **Columns:** Date, Coil type (e.g. 30 mm coil (New), 48 mm coil (New)), Total material (kg), Scrap (kg), Shortlength (kg), Coil used (kg), Coil remaining (kg).
- **Special event:** "COIL END" when a coil is fully consumed; next row often starts a new coil of same type.
- **Tabs:** ESTIMATE, SCRAP, TRANSPORT NUMBER – linked to estimating, waste, and logistics.

### 1.3 Other referenced sheets

- **EXPENSES**, **NOV - ATTENDENCE**, **REVA-26**, **work sheet**, **WhatsApp**, **gmail** – indicate expenses, attendance, and communication are part of the same operational context (future modules).

---

## 2. Domain Concepts to Support in the SaaS ERP

| Concept | Source | ERP implementation |
|--------|--------|---------------------|
| **Material categories** | Tabs: STOCK COIL, Pipe coil, railing COIL, CURTAIN TRACK | Product categories (e.g. "STOCK COIL", "Pipe coil", "CURTAIN TRACK") and product types/specs (30 MM, 48 MM, 3/4"(60)) |
| **Purchase history** | Purchase material tab | Purchase orders + goods receipts; optional "purchase history" report (date, vendor, item, qty, price) |
| **Goods inward by material type** | Pipe coil / railing COIL tabs | Goods receipts + inventory transactions; material type = product/category |
| **Stock summary by type** | STOCK COIL tab | Products with Type/Spec, current stock (from inventory_transactions), Status, Tr Notes |
| **Coil consumption (REVA-26)** | REVA - 26 sheet | Dedicated **coil consumption log**: date, coil type (product), total kg, scrap kg, shortlength kg, used kg, remaining kg, coil_ended |
| **Vendor status/notes** | CURTAIN TRACK vendor list | Vendor master + **status_notes** (e.g. "RATES given", "don't sell", "CALL NOT PICK") |
| **UOMs** | All sheets | KG, PC, B (bundle), GM PL, etc. – already supported via product UOM |
| **REM/REI codes** | Pipe coil tab | Optional reference code on goods receipt or inventory transaction (notes or dedicated field) |

---

## 3. Implementation Plan (Phased)

### Phase 1 – Data model & backend (current scope)

1. **Migration 00009 – Reva domain**
   - **coil_consumption_log** – operation_date, product_id (coil type), starting_kg, scrap_kg, shortlength_kg, used_kg, remaining_kg, coil_ended (boolean), notes, created_at, created_by.
   - **products** – add optional `product_type` (e.g. "30 MM", "48 MM"), `stock_status` (e.g. "In stock"), `tr_notes` (e.g. "OLD", "NEW", "6 BUNDLE") for STOCK COIL–style views.
   - **vendors** – add `status_notes` (e.g. "RATES given", "don't sell") for CURTAIN TRACK–style vendor list.

2. **Backend**
   - Coil consumption: create/list coil consumption log; optionally derive “current remaining” per product from latest row.
   - Purchase history: list purchase order items with date, vendor, product, qty, unit price (from existing PO + PO items).
   - Stock by category/type: list products with stock levels, filter by category; use product_type / tr_notes for display.
   - Vendor notes: update vendor (PATCH) to set status_notes; list vendors with status_notes.

3. **SQL / sqlc**
   - New queries for coil_consumption_log (insert, list by tenant, list by product).
   - Optional: purchase history view/query (join PO, PO items, vendors, products).
   - Product list already supports category; extend with product_type/stock_status/tr_notes in SELECT if columns exist.

### Phase 2 – Frontend (current scope)

1. **Coil consumption page (REVA-26)**
   - Form: date, coil type (product dropdown), starting kg (optional / pre-filled from last remaining), scrap kg, shortlength kg, coil used kg; checkbox “Coil ended”.
   - Compute and show remaining kg; on submit: insert coil_consumption_log and optionally create OUT transaction for “used” quantity.

2. **Stock Coil view**
   - Table: Item name, Type, # Stock (KG), Status, Tr Notes (from products + stock levels); filter by category “STOCK COIL” or similar.
   - Reuse existing inventory/stock-level APIs; add category filter and product_type/tr_notes in response if available.

3. **Purchase history view**
   - Table: Date, Supplier, Item, Quantity, Unit, Unit price (from PO items + PO + vendors). Filter by date range, vendor, product.

4. **Vendors**
   - In vendor list/detail: show and edit **Status notes** (single text field or dropdown of common values).

5. **Navigation**
   - Add “Coil consumption” and “Purchase history” (and optionally “Stock by type”) to dashboard nav; link to new pages.

### Phase 3 – Later (out of current scope)

- Data migration from Google Sheets (ETL, cleaning, mapping to products/vendors/POs/coil log).
- ESTIMATE, SCRAP, TRANSPORT NUMBER tabs → estimating, scrap/waste, and transport modules.
- Expenses and attendance integration.
- Alerts when coil remaining is low or coil ended.

---

## 4. Summary: What to Build in the SaaS Application

| # | Feature | Backend | Frontend |
|---|--------|---------|----------|
| 1 | Coil consumption log (REVA-26) | Migration + API (create, list) | Coil consumption page with form and table |
| 2 | Stock summary by type (STOCK COIL) | Product type/notes + existing stock API | Stock Coil view (filter by category/type) |
| 3 | Purchase history | Purchase history query + endpoint | Purchase history page (date, vendor, item, qty, price) |
| 4 | Vendor status notes | Vendor status_notes column + PATCH | Vendor list/detail: show and edit status notes |
| 5 | Material categories | Use product_categories (STOCK COIL, Pipe coil, etc.) | Category filter on products and stock views |

---

## 5. File and Component Checklist

- [x] **docs/REVA_OPERATIONS_PLAN.md** (this file)
- [x] **erp-backend/migrations/00009_reva_domain.sql** – coil_consumption_log, products + vendor columns
- [x] **erp-backend/internal/db/queries/reva.sql** – coil log, purchase history, stock levels with Reva fields
- [x] **erp-backend/internal/reva/handler.go** – handlers for coil log, purchase history, stock-levels
- [x] **erp-backend/internal/routes/router.go** – setupRevaRoutes (JWT protected)
- [x] **erp-frontend** – Coil consumption page (`/coil-consumption`), Purchase history (`/purchase-history`), Stock Coil (`/stock-coil`), Vendor status notes (vendors page + nav)

**Apply migration:** From `erp-backend` run your migration tool (e.g. `goose -dir migrations postgres "YOUR_DSN" up`). Then run sqlc if you change queries: `sqlc generate`.

This plan aligns the SaaS ERP with Reva’s actual factory workflow and spreadsheet usage, and implements it step by step in the existing codebase.
