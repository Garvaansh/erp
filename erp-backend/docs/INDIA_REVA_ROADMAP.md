# India-First ERP Roadmap — Reva Technologies as Design Partner

**Target region:** India  
**Design partner / first tenant:** Reva Technologies (manufacturing — coil/industrial)  
**Product:** Multi-tenant ERP SaaS (Go, PostgreSQL, Next.js)

---

## 1. Why India + Reva

- **India:** GST, TDS, PF/ESI, labour compliance, and invoicing rules drive a large part of “ERP” requirements. Building India-first gives a clear compliance backbone for later regions.
- **Reva Technologies:** Your first tenant; manufacturing domain (coil consumption, products, vendors, work orders). Building for Reva = real workflows, real data, and a reference customer for the same vertical (metal/coil/industrial) in India.

---

## 2. India-Specific Capabilities (Priority Order)

### 2.1 Invoicing & Tax (GST)

- **GST-compliant invoices**
  - Mandatory fields: GSTIN (buyer/seller), HSN/SAC, place of supply, taxable value, CGST/SGST/IGST, invoice number series.
  - Optional: e-invoice (IRN/QR) integration later; for MVP, generate PDF that meets format requirements.
- **GSTIN** on organisations, customers, vendors (with validation/format check).
- **HSN/SAC** on products/services (e.g. coil vs services); support 4- and 6-digit codes.
- **Tax calculation**
  - CGST+SGST for intra-state, IGST for inter-state; place-of-supply rules.
  - Configurable tax rates per HSN (e.g. 5%, 12%, 18%, 28%).
- **GSTR reports (later)**
  - GSTR-1 (outward supplies), GSTR-2/2B (inward), GSTR-3B. Start with data model and export that can feed into these; full filing integration can be Phase 2.

### 2.2 Deductions at Source (TDS/TCS)

- **TDS** on vendor payments (e.g. 194C, 194J) and on expenses (rent, professional fees).
  - Store TDS section, rate, deducted amount; track TDS payable and paid (challan).
- **TCS** on sales if applicable (e.g. certain goods).
- **TAN** on tenant org; TDS certificates (26AS-style data export for reconciliation).

### 2.3 Payroll & Statutory (when you add HR)

- **Payroll**
  - Salary structure (earnings, deductions), pay runs, payslips.
  - Statutory: **PF** (employee + employer), **ESI** (if applicable), **PT** (professional tax by state), **LWF** where applicable.
- **Compliance**
  - Monthly/quarterly returns (PF, ESI, PT); annual returns.
  - Leave: CL, EL, ML, etc., with policy rules; optional integration with attendance.
- **Labour laws**
  - Shops & Establishments (leave, working hours, registers); contract labour if Reva uses contractors.

### 2.4 Compliance & Reporting

- **Audit trail**
  - Who changed what, when (already important for India audits).
- **Financial year**
  - April–March; all reports and period filters respect FY.
- **Registers**
  - E.g. stock, purchase, sales, TDS — export to PDF/Excel for auditors.

---

## 3. Reva Domain (Manufacturing / Coil)

You already have:

- **Inventory:** products, warehouses, batches, transfers, valuation.
- **Purchase:** vendors, POs, GRN, vendor invoices.
- **Sales:** customers, orders, invoices, payments.
- **Manufacturing:** BOMs, work orders, production logs, **coil_consumption_log** (starting/used/remaining/scrap/shortlength, coil_ended).

To make it “world-class” for Reva and similar manufacturers in India:

- **Coil lifecycle**
  - Coil as a tracked “batch” or sub-inventory: opening weight, consumption by work order, scrap/shortlength, coil close. Link consumption to cost (raw material cost per job).
- **Costing**
  - Material cost (coil consumption), labour/overhead allocation to work orders; WIP and finished-goods valuation.
- **GST on manufacturing**
  - Input tax credit (ITC) on purchases; output GST on sales; track by HSN. Reva’s HSN for coils vs services should be configurable.
- **Vendor/supplier**
  - Reva-specific fields (e.g. `status_notes`) already in place; add TDS section, GSTIN, payment terms, and link to POs and GRNs.
- **Reports**
  - Coil utilisation, scrap %, production by product/work order, inventory valuation (FIFO/weighted avg as per your logic), and GST summary for returns.

---

## 4. Phased Roadmap (India + Reva)

### Phase 1 — Foundation (current + 3–6 months)

- **Multi-tenant + Auth:** Already in place; ensure tenant has **GSTIN**, **state**, **address**, **FY start month**.
- **India invoicing (sales)**
  - GSTIN, HSN/SAC, place of supply, CGST/SGST/IGST on sales invoices; PDF format suitable for India.
- **Purchase side**
  - GSTIN on vendors; basic TDS fields (section, rate, amount) on vendor invoices/payments; store for future 26AS reconciliation.
- **Reva manufacturing**
  - Solid coil consumption and work-order flows; simple cost capture (material from coil usage); reports for Reva’s daily use.

**Outcome:** Reva can run India-compliant sales and purchase and use manufacturing/coil features with real data.

### Phase 2 — Deeper India compliance (6–12 months)

- **GSTR-ready data**
  - Tables/views that map to GSTR-1/2/3B; export (CSV/Excel) or API for filing tools.
- **TDS full flow**
  - TDS payable ledger, challan tracking, 26AS-style export; TDS certificate generation.
- **E-invoice (optional)**
  - Integrate with NIC e-invoice API (IRN, QR) when you need it for B2B.
- **HR + Payroll (India)**
  - Employee master, salary structure, PF/ESI/PT, pay run, payslips; statutory return support.

**Outcome:** One tenant (e.g. Reva) can do GST returns, TDS compliance, and India payroll on the same platform.

### Phase 3 — Productisation (12–24 months)

- **More tenants**
  - Same codebase for other manufacturers or adjacent verticals in India; tenant-level config (GSTIN, tax rates, workflows).
- **Advanced analytics**
  - Dashboards for finance, production, procurement; India-specific (GST summary, TDS, payroll cost).
- **Integrations**
  - Banks (payment files), e-way bill if needed, accounting exports (Tally-compatible formats are common in India).

---

## 5. Data Model Additions (India)

- **Organisation / Tenant**
  - `gstin`, `state_code`, `address_line1`, `city`, `pincode`, `tan`, `financial_year_start_month` (e.g. 4 for April).
- **Customers / Vendors**
  - `gstin`, `place_of_supply_state`, `pan` (optional).
- **Products / Services**
  - `hsn_sac` (string), `gst_rate` (decimal); distinguish goods vs services for IGST/CGST/SGST.
- **Invoices (sales)**
  - `place_of_supply_state`, line-level `hsn_sac`, `taxable_value`, `cgst`, `sgst`, `igst`, `invoice_type` (e.g. tax invoice, bill of supply).
- **Vendor invoices / Payments**
  - `tds_section`, `tds_rate`, `tds_amount`, `tds_paid_at`, `challan_number` (for TDS paid to govt).

---

## 6. Summary

| Focus            | India                                              | Reva (design partner)                          |
|------------------|----------------------------------------------------|-------------------------------------------------|
| **Tax**          | GST (CGST/SGST/IGST), HSN, GSTIN, place of supply  | Same; HSN for coils and services                |
| **Deductions**   | TDS/TCS, TAN, 26AS-style data                      | TDS on vendor payments                          |
| **Payroll**      | PF, ESI, PT, FY, leave                             | When HR module is added                         |
| **Manufacturing**| Costing, WIP, inventory valuation                  | Coil consumption, work orders, scrap, costing   |
| **Compliance**   | Audit trail, registers, GSTR-ready data           | Same                                            |

Building **India-first with Reva Technologies** as the design partner keeps scope clear: nail manufacturing (coil + work orders + costing) and India compliance (GST + TDS + invoicing) first, then layer payroll and broader SaaS productisation.

---

*Next step: implement Phase 1 tenant/org fields (GSTIN, state, FY) and one GST-aware sales invoice flow; then extend to purchase and TDS fields.*
