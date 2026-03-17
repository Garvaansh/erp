# Reva Technologies – Company Profile & SaaS Implementation Plan

This document combines **public company information** (IndiaMART profile) with the **existing operations analysis** (spreadsheets) to form a single plan for the Reva Technologies SaaS ERP.

---

## Part 1: Reva Technologies – What We Learned (IndiaMART)

### 1.1 Company Overview

| Field | Value |
|-------|--------|
| **Name** | Reva Technologies |
| **Location** | Govindpura, Bhopal, Madhya Pradesh, India |
| **Established** | 2003 |
| **Business type** | Manufacturer, Wholesaler, Trader |
| **CEO / Mentor** | Mr. Arpit Agarwal |
| **Employees** | 26–50 |
| **Annual turnover** | ₹1.5–5 Cr |
| **Legal status** | Proprietorship |
| **GST** | 23AHRPA8602J1ZD |
| **Experience** | 14+ years (IndiaMART), 68% response rate |
| **Export** | United Arab Emirates |

### 1.2 Product Categories (IndiaMART)

| Category | Sub-products / Variants |
|----------|--------------------------|
| **Rubber Profile** | RUBBER PROFILES, Extruded Rubber Profiles, EPDM Rubber Profile |
| **Rubber Seal** | Stop Dam Gate Seal, Dam Gate Rubber Seal, Window Rubber Seal |
| **Rubber Beadings** | RIR Rubber Beading, Industrial Rubber Beading |
| **Rubber Extrusion** | Rubber Extrusion, Industrial Rubber Extrusion, High Quality Rubber Extrusion |
| **Elastomeric Bridge Bearings** | Bridge Bearings, Elastomeric Bridge Bearing (multiple types) |
| **Stainless Steel Pipe** | Jindal Stainless Steel Round Pipes, 202 Stainless Steel Round Pipe |
| **Curtain Rods** | Curtain Rod, Stainless Steel Curtain Rod |
| **PVC Products** | Clear PVC Rubber |

### 1.3 Brands

- **Manufacturing brand:** RIR  
- **Trading brand:** Jindal  

### 1.4 Operations & Strengths

- **Why they stand out:** Customization, vast industrial experience, wide distribution network, quality-proven range, timely delivery  
- **Infrastructure:** Modern machines, segmented departments, coordinated workflow  
- **Quality:** Stringent checks at every stage, research aligned with market demands  
- **Team:** Sales & marketing, skilled/semi-skilled workforce, technicians, quality analysts, engineers  
- **Payment:** Online, Bank Transfer, DD, Cheque, Credit Card, Cash  
- **Shipment:** By Road  

---

## Part 2: How This Maps to the SaaS ERP

The **IndiaMART product list** aligns with the **spreadsheet-based operations** already modeled in the ERP:

| IndiaMART category | ERP / Operations concept |
|--------------------|---------------------------|
| Rubber Profile, Rubber Seal, Rubber Beadings, Rubber Extrusion, PVC | **Product catalog** – categories, types (e.g. 30 MM, 48 MM), UOMs (KG, PC, B) |
| Elastomeric Bridge Bearings, Stainless Steel Pipe, Curtain Rods | **STOCK COIL**, **Pipe coil**, **CURTAIN TRACK** – material types and stock views |
| RIR / Jindal | **Vendors** (trading) and **product brands** (optional attribute on products) |
| Customization, specs, timely delivery | **Work orders**, **coil consumption**, **purchase history** – traceability and reporting |

So the SaaS should:

1. Support **all product categories** above (via product categories and types).  
2. Keep **coil/pipe/curtain** workflows (REVA-26, STOCK COIL, CURTAIN TRACK) as already planned.  
3. Optionally add **brand** (RIR / Jindal) on products and **export country** (e.g. UAE) for orders/reports.

---

## Part 3: SaaS Implementation Plan (Consolidated)

### Phase 1 – Data model & backend ✅ (Done)

- [x] Migration 00009 – Reva domain (coil_consumption_log, product_type/stock_status/tr_notes, vendor status_notes)  
- [x] Coil consumption API (create, list, list by product, last remaining)  
- [x] Purchase history API  
- [x] Stock levels with Reva fields API  
- [x] Vendor status_notes (PATCH / list)  

### Phase 2 – Frontend (Reva-specific views) ✅ (Done)

- [x] Coil consumption page (`/coil-consumption`)  
- [x] Stock Coil view (`/stock-coil`)  
- [x] Purchase history view (`/purchase-history`)  
- [x] Vendors with status notes  
- [x] Dashboard nav for Reva modules  

### Phase 3 – Align with IndiaMART profile (Next)

| # | Task | Description |
|---|------|-------------|
| 1 | **Product categories** | Ensure product categories in the app match IndiaMART: Rubber Profile, Rubber Seal, Rubber Beadings, Rubber Extrusion, Elastomeric Bridge Bearings, Stainless Steel Pipe, Curtain Rods, PVC Products. Seed or migrate if needed. |
| 2 | **Product types / specs** | Support types like 30 MM, 48 MM, 3/4"(60), EPDM, etc. (product_type already in schema). Use in filters and Stock Coil view. |
| 3 | **Brand (optional)** | Add optional `brand` on products (RIR, Jindal) for reporting and catalog. |
| 4 | **Company profile in app** | Optional: “About Reva” or company info (name, location, GST, contact) in dashboard or settings, sourced from this document. |

### Phase 4 – Later (Out of current scope)

- Data migration from Google Sheets (ETL into products, vendors, POs, coil log).  
- ESTIMATE, SCRAP, TRANSPORT NUMBER tabs → estimating, scrap, transport modules.  
- Expenses and attendance.  
- Alerts (e.g. low coil remaining, coil ended).  
- Export-specific reports (e.g. UAE).  

---

## Part 4: What to Implement Next (Concrete Steps)

When you say “we will implement,” the next logical steps are:

1. **Product categories & types**  
   - In backend: ensure categories exist (migration or seed) for all IndiaMART categories.  
   - In frontend: category filter on Products and Stock Coil; show product_type and tr_notes consistently.  

2. **Optional: Brand on products**  
   - Migration: `products.brand` (nullable text).  
   - Backend: include in product CRUD and list APIs.  
   - Frontend: show and edit brand (e.g. RIR / Jindal) on product form and list.  

3. **Optional: Company profile**  
   - Settings or “About” page with Reva name, address, GST, contact (read-only or editable).  

4. **Polish & testing**  
   - Run through: coil consumption flow, stock coil filters, purchase history, vendor notes.  
   - Fix any bugs and improve UX (loading states, validation, empty states).  

---

## Part 5: File Reference

| Area | Location |
|------|----------|
| Operations plan (spreadsheets) | `docs/REVA_OPERATIONS_PLAN.md` |
| This plan (company + SaaS) | `docs/REVA_COMPANY_AND_SAAS_PLAN.md` |
| Migration (brand, company_profiles, seed categories) | `erp-backend/migrations/00010_reva_catalog_and_company.sql` |
| Reva API routes | `erp-backend/internal/routes/router.go` → `setupRevaRoutes` |
| Reva handlers | `erp-backend/internal/reva/handler.go` |
| Reva SQL | `erp-backend/internal/db/queries/reva.sql` |
| Inventory categories & products (brand, filter) | `erp-backend/internal/inventory/handler.go`, `internal/db/queries/inventory.sql` |
| Coil consumption UI | `erp-frontend/src/app/(dashboard)/coil-consumption/page.tsx` |
| Stock Coil UI | `erp-frontend/src/app/(dashboard)/stock-coil/page.tsx` |
| Company profile UI | `erp-frontend/src/app/(dashboard)/settings/page.tsx` |
| Purchase history UI | `erp-frontend/src/app/(dashboard)/purchase-history/page.tsx` |
| Vendors (status notes) | `erp-frontend/src/app/(dashboard)/vendors/page.tsx` |
| Products (categories, brand, type, filters) | `erp-frontend/src/app/(dashboard)/products/page.tsx` |

## Part 6: Apply migration

From `erp-backend` run your migration tool (e.g. goose) so that the new schema and seed are applied:

```bash
cd erp-backend
goose -dir migrations postgres "YOUR_DSN" up
```

Then regenerate Go from SQL if you change queries: `sqlc generate`.

---

## Summary

- **Reva Technologies** (Bhopal): manufacturer/wholesaler/trader since 2003; rubber profiles, seals, beadings, extrusion, bridge bearings, stainless steel pipes, curtain rods, PVC; brands RIR and Jindal.  
- The **SaaS ERP** already implements their spreadsheet workflows (coil consumption, stock coil, purchase history, vendor notes).  
- **Next:** align product categories with IndiaMART, reinforce product types/specs and filters, optionally add brand and company profile, then polish and test.  

Once you confirm which of the “next” items you want (e.g. categories + types only, or also brand + company profile), we can implement them step by step.
