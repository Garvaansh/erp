# ERP REST API Design

**Base path:** `/api/v1`  
**Auth:** Bearer JWT (header: `Authorization: Bearer <token>`)  
**Tenant:** Inferred from JWT or `X-Tenant-ID` (for server-to-server).  
**Conventions:** JSON request/response; UUIDs for IDs; ISO 8601 for dates; pagination via `limit`/`offset` or `cursor`.

---

## 1. Example APIs (Request/Response)

### 1.1 Create Product

**POST** `/inventory/products`

**Request:**
```json
{
  "name": "Stainless Steel Pipe 2\" Sch 40",
  "sku": "SSP-2-S40",
  "category_id": "uuid-of-category",
  "uom": "MTR",
  "price": 450.00,
  "cost_price": 320.00,
  "reorder_point": 100,
  "safety_stock": 50,
  "product_type": "FINISHED_GOODS",
  "hsn_code": "7306",
  "gst_rate": 18,
  "weight_kg": 2.5,
  "barcode": "8901234567890",
  "description": "SS 304 pipe, 2 inch nominal, schedule 40"
}
```

**Response:** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "...",
  "name": "Stainless Steel Pipe 2\" Sch 40",
  "sku": "SSP-2-S40",
  "category_id": "uuid-of-category",
  "uom": "MTR",
  "price": 450.00,
  "cost_price": 320.00,
  "reorder_point": 100,
  "safety_stock": 50,
  "product_type": "FINISHED_GOODS",
  "hsn_code": "7306",
  "gst_rate": 18,
  "created_at": "2025-03-17T10:00:00Z",
  "updated_at": "2025-03-17T10:00:00Z"
}
```

**Errors:** `400` validation, `409` duplicate SKU.

---

### 1.2 Update Vendor

**PUT** `/purchase/vendors/:id`

**Request:**
```json
{
  "name": "Jindal Steel & Power Ltd",
  "contact_person": "Rajesh Kumar",
  "email": "procurement@jindal.com",
  "phone": "+91-755-1234567",
  "address": "Plot 12, Sector 5, Bhopal",
  "gst_number": "23AAACJ1234D1ZV",
  "pan_number": "AAACJ1234D",
  "payment_terms_days": 30,
  "credit_limit": 5000000.00
}
```

**Response:** `200 OK` (full vendor object)

**Errors:** `400` validation, `404` vendor not found, `409` duplicate email.

---

### 1.3 Create Purchase Order

**POST** `/purchase/purchase-orders`

**Request:**
```json
{
  "vendor_id": "uuid-of-vendor",
  "expected_delivery_date": "2025-04-01",
  "delivery_warehouse_id": "uuid-of-warehouse",
  "payment_terms": "NET_30",
  "notes": "Urgent for production",
  "items": [
    {
      "product_id": "uuid-of-product",
      "quantity": 500,
      "unit_price": 420.00
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "po_number": "PO-2025-00142",
  "tenant_id": "...",
  "vendor_id": "...",
  "status": "DRAFT",
  "expected_delivery_date": "2025-04-01",
  "total_amount": 210000.00,
  "created_at": "2025-03-17T10:00:00Z"
}
```

**Errors:** `400` validation, `403` vendor not activated or over credit limit, `404` vendor/product/warehouse.

---

### 1.4 Receive Inventory (Goods Receipt)

**POST** `/purchase/goods-receipts`

**Request:**
```json
{
  "po_id": "uuid-of-po",
  "warehouse_id": "uuid-of-warehouse",
  "receipt_date": "2025-03-17",
  "notes": "Partial receipt - balance next week",
  "lines": [
    {
      "purchase_order_item_id": "uuid-of-po-line",
      "quantity_received": 250,
      "batch_number": "BATCH-2025-0317-01"
    }
  ]
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "receipt_number": "GRN-2025-0089",
  "po_id": "...",
  "warehouse_id": "...",
  "receipt_date": "2025-03-17",
  "status": "COMPLETED",
  "created_at": "2025-03-17T10:00:00Z"
}
```

**Side effect:** Inventory transactions (IN) and stock ledger updated; PO status may move to PARTIAL_RECEIPT or COMPLETED.

**Errors:** `400` quantity exceeds PO, `404` PO/warehouse, `409` duplicate receipt for same PO line if not allowed.

---

### 1.5 Transfer Stock

**POST** `/inventory/transfers`

**Request:**
```json
{
  "from_warehouse_id": "uuid-wh-a",
  "to_warehouse_id": "uuid-wh-b",
  "product_id": "uuid-of-product",
  "quantity": 100,
  "notes": "Replenishment for Zone B"
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "from_warehouse_id": "...",
  "to_warehouse_id": "...",
  "product_id": "...",
  "quantity": 100,
  "status": "PENDING",
  "created_at": "2025-03-17T10:00:00Z"
}
```

**Complete transfer:** `POST` `/inventory/transfers/:id/complete` → status COMPLETED; creates OUT at source and IN at destination.

**Errors:** `400` same warehouse, insufficient stock, `404` warehouse/product.

---

## 2. API Catalog (Grouped by Module)

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/register | Register tenant + user |
| POST | /auth/login | Login, returns JWT |

### Tenant
| Method | Path | Description |
|--------|------|-------------|
| GET | /tenant/settings | Get tenant settings |
| PUT | /tenant/settings | Update tenant settings |

### Inventory — Products
| Method | Path | Description |
|--------|------|-------------|
| GET | /inventory/products | List products (filter: category, sku, type) |
| POST | /inventory/products | Create product |
| POST | /inventory/products/bulk | Bulk create products |
| GET | /inventory/products/:id | Get product |
| PUT | /inventory/products/:id | Update product |
| DELETE | /inventory/products/:id | Soft delete / deactivate product |
| GET | /inventory/products/by-scan | Get by barcode/SKU |
| GET | /inventory/products/:id/qrcode | Get QR code image |

### Inventory — Categories
| Method | Path | Description |
|--------|------|-------------|
| GET | /inventory/categories | List categories |
| POST | /inventory/categories | Create category |

### Inventory — Warehouses
| Method | Path | Description |
|--------|------|-------------|
| GET | /inventory/warehouses | List warehouses |
| POST | /inventory/warehouses | Create warehouse |

### Inventory — Stock & Ledger
| Method | Path | Description |
|--------|------|-------------|
| GET | /inventory/stock-levels | List stock levels (all products/warehouses) |
| GET | /inventory/stock-by-warehouse | Stock grouped by warehouse |
| GET | /inventory/product/:productID/stock | Stock for one product |
| GET | /inventory/low-stock-alerts | Products below reorder/safety |
| GET | /inventory/transactions | List stock transactions (filters) |
| POST | /inventory/transaction | Record single transaction (IN/OUT/adjustment) |

### Inventory — Batches
| Method | Path | Description |
|--------|------|-------------|
| POST | /inventory/batches | Create batch |
| GET | /inventory/product/:productID/batches | List batches for product |

### Inventory — Reservations
| Method | Path | Description |
|--------|------|-------------|
| POST | /inventory/reservations | Create reservation |
| GET | /inventory/reservations | List reservations |
| DELETE | /inventory/reservations/:id | Release reservation |

### Inventory — Transfers
| Method | Path | Description |
|--------|------|-------------|
| POST | /inventory/transfers | Create transfer |
| GET | /inventory/transfers | List transfers |
| POST | /inventory/transfers/:id/complete | Complete transfer |

### Inventory — Reports
| Method | Path | Description |
|--------|------|-------------|
| GET | /inventory/reports/valuation | Inventory valuation report |

### Purchase — Vendors
| Method | Path | Description |
|--------|------|-------------|
| GET | /purchase/vendors | List vendors |
| POST | /purchase/vendors | Create vendor |
| POST | /purchase/vendors/bulk | Bulk create vendors |
| GET | /purchase/vendors/:id | Get vendor |
| PUT | /purchase/vendors/:id | Update vendor |
| DELETE | /purchase/vendors/:id | Delete vendor |

### Purchase — Purchase Orders
| Method | Path | Description |
|--------|------|-------------|
| GET | /purchase/purchase-orders | List POs |
| POST | /purchase/purchase-orders | Create PO |
| GET | /purchase/purchase-orders/:id | Get PO |
| GET | /purchase/purchase-orders/:id/items | List PO items |
| POST | /purchase/purchase-orders/item | Add PO item |
| PATCH | /purchase/purchase-orders/:id/status | Update PO status |

### Purchase — Goods Receipts
| Method | Path | Description |
|--------|------|-------------|
| GET | /purchase/goods-receipts | List GRNs |
| POST | /purchase/goods-receipts | Create GRN (receive inventory) |
| GET | /purchase/goods-receipts/:id | Get GRN |

### Purchase — Vendor Invoices
| Method | Path | Description |
|--------|------|-------------|
| GET | /purchase/vendor-invoices | List vendor invoices |
| POST | /purchase/vendor-invoices | Create vendor invoice |
| GET | /purchase/vendor-invoices/:id | Get vendor invoice |
| PATCH | /purchase/vendor-invoices/:id/tds | Update TDS on invoice |

### Sales — Customers
| Method | Path | Description |
|--------|------|-------------|
| GET | /sales/customers | List customers |
| POST | /sales/customers | Create customer |
| POST | /sales/customers/bulk | Bulk create |
| GET | /sales/customers/:id | Get customer |
| PUT | /sales/customers/:id | Update customer |
| DELETE | /sales/customers/:id | Delete customer |

### Sales — Sales Orders
| Method | Path | Description |
|--------|------|-------------|
| GET | /sales/sales-orders | List sales orders |
| POST | /sales/sales-orders | Create sales order |
| GET | /sales/sales-orders/:id | Get sales order |
| GET | /sales/sales-orders/:id/items | List SO items |
| POST | /sales/sales-orders/item | Add SO item |
| DELETE | /sales/sales-orders/items/:id | Delete SO item |
| PATCH | /sales/sales-orders/:id/status | Update SO status |

### Sales — Invoices & Payments
| Method | Path | Description |
|--------|------|-------------|
| GET | /sales/invoices | List invoices |
| GET | /sales/invoices/next-number | Next invoice number |
| POST | /sales/invoices | Create invoice |
| GET | /sales/invoices/:id | Get invoice |
| PATCH | /sales/invoices/:id/status | Update invoice status |
| GET | /sales/invoices/:id/line-items | List line items |
| POST | /sales/invoices/:id/line-items | Add line item |
| GET | /sales/invoices/:id/payments | List payments |
| POST | /sales/invoices/:id/payments | Record payment |

### Manufacturing — BOM
| Method | Path | Description |
|--------|------|-------------|
| GET | /manufacturing/bom | List BOMs |
| POST | /manufacturing/bom | Create BOM |

### Manufacturing — Work Orders
| Method | Path | Description |
|--------|------|-------------|
| GET | /manufacturing/work-orders | List work orders |
| POST | /manufacturing/work-orders | Create work order |
| GET | /manufacturing/work-orders/:id | Get work order |
| PATCH | /manufacturing/work-orders/:id | Update work order status |
| GET | /manufacturing/work-orders/:id/production-logs | List production logs |
| GET | /manufacturing/work-orders/:id/material-consumption | List material consumption |
| POST | /manufacturing/production-log | Record production log |
| POST | /manufacturing/material-consumption | Record material consumption |

### Reva (Domain-specific)
| Method | Path | Description |
|--------|------|-------------|
| POST | /reva/coil-consumption | Create coil consumption log |
| POST | /reva/coil-consumption/bulk | Bulk coil consumption |
| GET | /reva/coil-consumption | List coil consumption |
| GET | /reva/coil-consumption/product/:productId | By product |
| GET | /reva/coil-consumption/product/:productId/last-remaining | Last remaining kg |
| GET | /reva/purchase-history | Purchase history |
| GET | /reva/stock-levels | Stock levels (Reva view) |
| GET | /reva/company-profile | Company profile |
| PUT | /reva/company-profile | Upsert company profile |

### Reports
| Method | Path | Description |
|--------|------|-------------|
| GET | /reports/ | Report summary |
| GET | /reports/dashboard | Dashboard metrics |
| GET | /reports/export | Export (rate-limited) |
| GET | /reports/schedules | List scheduled reports |
| POST | /reports/schedules | Create schedule |
| DELETE | /reports/schedules/:id | Delete schedule |
| GET | /reports/gstr/outward | GSTR outward |
| GET | /reports/gstr/inward | GSTR inward |
| GET | /reports/gstr/sales-summary-by-hsn | Sales summary by HSN |
| POST | /reports/gst/calculate | Calculate GST |

### Notifications
| Method | Path | Description |
|--------|------|-------------|
| GET | /notifications/whatsapp/status | WhatsApp status |
| POST | /notifications/whatsapp/send | Send WhatsApp |

---

## 3. Common Patterns

- **Pagination:** `?limit=20&offset=0` or `?cursor=xxx&limit=20`.  
- **Filtering:** Query params per resource (e.g. `status`, `from_date`, `to_date`, `warehouse_id`).  
- **Sorting:** `?sort=created_at&order=desc`.  
- **Idempotency:** `Idempotency-Key: <uuid>` on POST for payment/receipt APIs.  
- **Versioning:** URL path `/api/v1`; new breaking changes as v2.  
- **Errors:** `{ "error": { "code": "VALIDATION", "message": "...", "details": [] } }`.

---

## 4. Future API Groups (Blueprint)

To reach 1000+ APIs, extend with:

- Purchase requisitions, RFQ, vendor quotes, quote comparison  
- Vendor approval workflow (submit, approve, activate)  
- Warehouse zones, racks, shelves, bins, putaway rules  
- Production orders (above work orders), scheduling  
- Shipments, carriers, tracking  
- Quality inspections, certificates  
- GL accounts, journal entries, cost centers  
- User/role CRUD, permission checks  
- Audit log query API  
- Notification preferences, event subscription  
- Master data: tax codes, currencies, locations, UOM  
- Document storage (invoices, certificates) upload/retrieve  

Each of these adds tens to hundreds of endpoints; the above catalog aligns with the current codebase and the enterprise design.
