# Inventory Management UI — Enterprise Spec (SAP / Oracle ERP–Style)

**Purpose:** Define the inventory management screen as an enterprise-grade **operational control center**, aligned with SAP S/4HANA / Oracle ERP Cloud patterns and the **Reva Technologies** manufacturing use case (metal fabrication, stainless steel, Bhopal).

**Related docs:** [ERP_ENTERPRISE_DESIGN.md](./ERP_ENTERPRISE_DESIGN.md) (modules, workflows), [API_DESIGN.md](./API_DESIGN.md) (REST inventory APIs).

---

## 1. Overall Page Layout (Enterprise UX Structure)

```
------------------------------------------------------
 Top Navigation (Global Search, Notifications, User)
------------------------------------------------------
 Left Sidebar (Modules / Navigation Tree)
------------------------------------------------------
 Main Workspace
   ├── Header (Filters + Actions)
   ├── KPI Summary Cards
   ├── Inventory Table / Grid
   ├── Detail Panel / Drill Down
------------------------------------------------------
 Footer (Pagination / Logs / Status)
```

---

## 2. Header Section (Control Panel)

The most critical operational control layer.

### 2.1 Filters (Advanced)

| Filter | Description |
|--------|-------------|
| **Product / SKU Search** | Auto-suggest, typeahead |
| **Category / Subcategory** | Product hierarchy |
| **Warehouse** | Single or multi-select |
| **Location** | Zone → Rack → Bin |
| **Batch Number** | Lot tracking |
| **Serial Number** | Serialised items |
| **Stock Type** | Available, Reserved, Blocked, In Transit |
| **Date Range** | Stock movement window |
| **Vendor** | Linked to product/supply |
| **Manufacturing / Expiry Date** | Batch lifecycle |
| **Stock Status** | In Stock, Low Stock, Out of Stock, Overstock |

### 2.2 Actions (Primary CTAs)

| Action | Purpose |
|--------|---------|
| **Create Inventory Entry (GRN)** | Goods receipt from PO |
| **Stock Transfer** | Inter-warehouse move |
| **Adjust Stock** | Manual correction with reason |
| **Issue Material** | Consumption / dispatch |
| **Receive Material** | Inbound receipt |
| **Stock Audit** | Cycle count / physical verification |
| **Generate Report** | Valuation, aging, movement |
| **Import** | CSV / Excel bulk load |
| **Export Data** | Current view export |

---

## 3. KPI Summary Cards (Real-Time Analytics)

Displayed at top for quick decision-making. In Oracle/SAP these are real-time aggregates (OLAP/cached).

| KPI | Description |
|-----|-------------|
| **Total Inventory Value** | ₹ (valuation method: FIFO/LIFO/Moving Avg) |
| **Total SKUs** | Distinct products in scope |
| **Low Stock Items** | Count below reorder level |
| **Out of Stock Items** | Zero available |
| **Overstock Items** | Above max / target |
| **Reserved Inventory** | Quantity committed (e.g. for SO) |
| **In-Transit Inventory** | Pending transfers / open PO receipts |
| **Dead Stock** | No movement in X days (configurable) |

---

## 4. Inventory Table (Core Data Grid)

Heart of the UI — highly detailed, performant grid.

### 4.1 Columns (Detailed)

| Column | Notes |
|--------|-------|
| SKU Code | Unique identifier |
| Product Name | |
| Category | |
| Warehouse | |
| Location | Zone / Rack / Bin |
| Batch Number | |
| Serial Number | |
| Quantity On Hand | |
| Reserved Quantity | |
| Available Quantity | On Hand − Reserved |
| Unit of Measure | |
| Inventory Value | Qty × cost |
| Cost Price | |
| Reorder Level | |
| Safety Stock | |
| Lead Time | |
| Vendor | Primary/default |
| Last Movement Date | |
| Expiry Date | Batch-level |
| **Status** | Color-coded (see below) |

### 4.2 Status Indicators (Color-Coded)

| Status | Meaning |
|--------|---------|
| Healthy Stock | Within range |
| Low Stock | Below reorder |
| Critical | Below safety / out soon |
| Blocked | Quality / hold |
| In Transit | Transfer or GRN pending |

### 4.3 Table Features

- Column customization (show/hide, order)
- Multi-column sorting
- Advanced filtering (header filters or filter panel)
- Grouping (e.g. by warehouse, category)
- Inline editing (controlled, with validation)
- Bulk selection + bulk actions (transfer, adjust, export)
- Virtualisation for large datasets (millions of rows)

---

## 5. Row-Level Actions (Per Inventory Item)

| Action | Description |
|--------|-------------|
| View Details | Open detail/drill-down panel |
| Edit Inventory | Adjust qty, location, block |
| Transfer Stock | Initiate transfer from this row |
| Adjust Quantity | With reason and approval if configured |
| View Ledger | Stock ledger for this product/warehouse |
| View Movement History | Last N transactions |
| Create Reorder | Trigger PR/PO suggestion |
| Block / Unblock Stock | Hold release |

---

## 6. Inventory Detail View (Drill-Down Panel)

Opening a row shows a side or modal panel with:

### 6.1 Basic Info

- Product details, SKU, Barcode, Category

### 6.2 Location Details

- Warehouse → Zone → Rack → Bin

### 6.3 Quantity Breakdown

| Field | Description |
|-------|-------------|
| Total Quantity | On hand |
| Reserved | Committed |
| Available | Total − Reserved |
| Damaged | If tracked |
| In Transit | Pending moves |

### 6.4 Batch / Serial Details

- Batch number, Manufacturing date, Expiry date

### 6.5 Financial Info

- Cost, Valuation method (FIFO / LIFO / Moving Avg)

### 6.6 Movement History (Mini Ledger)

- Last 10 transactions (type, qty, date, reference, user)

---

## 7. Stock Ledger (Transaction History Tab)

Critical for audit and debugging.

| Field | Description |
|-------|-------------|
| Transaction ID | Unique |
| Date & Time | |
| Transaction Type | GRN, Issue, Transfer, Adjustment, Return, etc. |
| Quantity Change | + / − |
| Before Quantity | Balance before |
| After Quantity | Balance after |
| Reference Document | PO / SO / Production Order / Transfer ID |
| User | Who performed |

---

## 8. Reva Technologies Use Case (Concrete Example)

**Context:** Metal manufacturing (stainless steel pipes, Bhopal plant).

| Field | Example Value |
|-------|----------------|
| Product | Stainless Steel Pipe |
| Warehouse | Bhopal Plant |
| Location | Zone A → Rack 5 → Bin 2 |
| Total Qty | 10,000 units |
| Reserved | 3,000 |
| Available | 7,000 |
| Batch | SS-PIPE-2026-01 |
| Vendor | Tata Steel |
| Cost | ₹120/unit |

**Typical actions:**

- Reserve stock for production order
- Transfer raw material to manufacturing unit
- Track WIP consumption
- Monitor finished goods stock

---

## 9. Advanced Features (SAP/Oracle Level)

| Feature | Description |
|---------|-------------|
| **Real-time sync** | IoT / barcode scanners; auto stock update on scan |
| **Reorder automation** | Auto PR when Available &lt; Reorder Level |
| **AI insights** | Predict stock-out, suggest reorder qty, detect dead stock |
| **Multi-unit handling** | Kg ↔ Pieces ↔ Meter conversions |
| **Multi-company / multi-tenant** | Separate inventory per legal entity (tenant) |
| **Security & governance** | Role-based access (Inventory Manager, Warehouse Operator, Auditor); approval workflows for adjustments; audit logs for every change |

---

## 10. Security & Governance

- **Roles:** Inventory Manager, Warehouse Operator, Auditor
- **Approval workflows:** e.g. stock adjustment above threshold
- **Audit logs:** Every change (user, timestamp, old/new value, operation)

---

## 11. Reports Section (Accessible from UI)

| Report | Purpose |
|--------|---------|
| Inventory Valuation Report | Value by warehouse/category |
| Stock Aging Report | Age of stock |
| Movement Report | In/out over period |
| Batch Traceability Report | Full batch history |
| Warehouse Utilization | Capacity vs used |

---

## 12. Performance & UX (Enterprise Grade)

- Virtualised tables (millions of rows)
- Lazy loading / pagination
- Real-time updates (e.g. WebSockets)
- Cached queries (e.g. Redis) for KPIs and aggregates

---

## 13. Summary — What Makes the Inventory UI Powerful

The Inventory UI is:

1. **Operational control center** — Filters, actions, and grid in one place  
2. **Financial impact engine** — Valuation, cost, and reporting  
3. **Supply chain visibility layer** — Stock types, in-transit, reservations  
4. **Audit & compliance tool** — Ledger, movement history, approvals  
5. **Decision intelligence dashboard** — KPIs, low/over/dead stock, reorder cues  

---

## Appendix A: Reva / Current System Alignment

Mapping this spec to the existing **Reva ERP** backend and frontend.

### A.1 Backend APIs (Already Present)

| Spec concept | Backend support | API / model |
|--------------|-----------------|-------------|
| Products, SKU, category | ✅ | `GET/POST /inventory/products`, categories |
| Warehouses | ✅ | `GET/POST /inventory/warehouses` |
| Zone → Rack → Shelf → Bin | ✅ | `GET/POST /warehouses/:id/zones`, `zones/:id/racks`, etc. |
| Stock levels (total) | ✅ | `GET /inventory/stock-levels` |
| Stock by warehouse | ✅ | `GET /inventory/stock-by-warehouse` |
| Low stock alerts | ✅ | `GET /inventory/low-stock-alerts` |
| Transactions / ledger | ✅ | `GET /inventory/transactions`, `POST /inventory/transaction` |
| Batches (lot) | ✅ | `POST /inventory/batches`, product batches |
| Transfers | ✅ | `POST /inventory/transfers`, complete transfer |
| Reservations | ✅ | `GET /inventory/reservations` (and create via sales/manufacturing) |
| Product stock (single) | ✅ | `GET /inventory/product/:id/stock` |
| Reorder point, safety stock, UOM, lead time | ✅ | `products` table and APIs |

### A.2 Frontend (Current Inventory Page)

| Spec concept | Current state |
|--------------|---------------|
| Header + filters | ✅ Search by product/SKU; filters for tx type, warehouse, transfer status |
| KPI cards | ⚠️ Low-stock alerts strip only; no Total Value, SKU count, Reserved, In-Transit, Dead stock |
| Inventory table | ✅ Stock levels (total or by warehouse); not full column set (e.g. reserved, location, batch, expiry, status) |
| Row actions | ⚠️ Limited; no per-row Transfer / Adjust / Ledger / Block |
| Detail panel | ❌ No drill-down panel (basic info, location, qty breakdown, batch, mini ledger) |
| Stock ledger tab | ✅ Transactions list; not product/warehouse-scoped ledger view |
| Actions: GRN, Transfer, Adjust, Receive | ✅ Record Movement (IN/OUT/ADJUST), Transfer, Warehouse; no dedicated “GRN” or “Issue” entry points |
| Import / Export | ❌ Not on inventory page |
| Reports | ❌ No in-UI links to valuation, aging, movement, batch traceability |

### A.3 Gap Summary (To Reach Enterprise Spec)

| Area | Gap | Suggested direction |
|------|-----|---------------------|
| **KPIs** | Total value, SKU count, reserved, in-transit, dead stock | New aggregate API(s) or reuse valuation + counts; add KPI cards to UI |
| **Grid columns** | Reserved, location (zone/rack/bin), batch, expiry, status, vendor, last movement | Extend `ListStockLevels` / `ListStockByWarehouse` or new “inventory list” API with joins; add columns and status logic |
| **Filters** | Category, location, batch, serial, stock type, date range, vendor, stock status | Backend filter params + frontend filter bar |
| **Detail panel** | Drill-down with basic info, location, qty breakdown, batch, mini ledger | New “inventory detail” API or compose from product + stock + transactions; add side panel |
| **Row actions** | Transfer, Adjust, View Ledger, Block/Unblock, Reorder | Add action menu; wire to existing transfer/transaction APIs; add block state if needed |
| **Ledger view** | Product/warehouse-scoped ledger tab | Use existing transactions API with product_id/warehouse_id filters; dedicated “Ledger” tab or panel |
| **GRN / Issue** | Explicit entry points | Keep “Record Movement” and add quick actions “GRN” (IN+RECEIPT) and “Issue” (OUT+SHIPMENT/CONSUMPTION) |
| **Import / Export** | Bulk import; export current view | Backend: CSV/Excel import endpoint; frontend: Export button (CSV/Excel) |
| **Reports** | Valuation, aging, movement, batch traceability, utilization | Backend report endpoints (some exist, e.g. valuation); UI: report links or embedded widgets |
| **Performance** | Virtualisation, real-time, caching | Frontend: virtualised grid; backend: pagination, optional WebSocket or polling; Redis for KPI cache if needed |

Use this appendix to prioritise implementation (e.g. KPIs + grid columns + detail panel first, then filters and row actions, then reports and import/export).
