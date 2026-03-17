# Production-Ready Invoices: Analysis & Implementation

## Capabilities Implemented

### 1. **Invoice lifecycle & status**
- **DRAFT** → **UNPAID** → **PARTIAL** → **PAID**, plus **OVERDUE** and **CANCELLED**.
- New invoices default to **DRAFT**; status can be set on create or updated later (except PAID/PARTIAL, which are driven by payments).
- **Overdue** is computed when `due_date < today` and status is not PAID/CANCELLED (shown in detail and list).

### 2. **Sequential invoice numbering**
- **Backend:** `invoice_number_sequences` table (tenant_id, year, last_number) with `NextInvoiceNumber` (INSERT ... ON CONFLICT DO UPDATE RETURNING last_number).
- **API:** `GET /sales/invoices/next-number` returns `{ "suggested": "INV-YYYY-NNNNN" }`.
- **Create invoice:** If `invoice_number` is omitted or blank, backend auto-generates the next number. Frontend can prefill the create form with the suggested value.

### 3. **Payments**
- **List:** `GET /sales/invoices/:id/payments` (also included in `GET /sales/invoices/:id`).
- **Create:** `POST /sales/invoices/:id/payments` with `amount`, `payment_date`, `payment_method`, `reference_number`.
- **Rules:** Payment amount must be positive; sum of payments + new amount cannot exceed invoice total; cancelled invoices cannot receive payments.
- **Status update:** After each payment, invoice status is set to **PAID** (if total paid ≥ total) or **PARTIAL**.

### 4. **Invoice detail with balance & aging**
- **GET /sales/invoices/:id** returns:
  - `invoice`, `payments`, `line_items`
  - `paid_total`, `balance_due`, `overdue` (computed).
- Frontend uses this for the detail drawer: header, line items, payments table, balance due, “Record payment” and “Update status”, and print.

### 5. **Validation & business rules**
- Create: `customer_id` and `invoice_date` required; `total_amount` must be positive; optional `so_id`, `due_date`, `invoice_number` (auto if blank).
- Payment: amount ≤ balance due; no payment on cancelled invoices.
- Status update: PAID/PARTIAL cannot be set via PATCH (only via payments); other statuses (e.g. OVERDUE, CANCELLED) allowed.

### 6. **Invoice line items (schema & API)**
- **Schema:** `invoice_line_items` (invoice_id, description, quantity, unit_price, total_line, sort_order).
- **API:** `GET /sales/invoices/:id/line-items`, `POST /sales/invoices/:id/line-items` (body: description, quantity, unit_price, total_line, sort_order).
- Detail view shows line items when present; create flow can be extended later to add lines (and optionally derive total from lines).

### 7. **Print**
- Frontend: “Print” in the invoice detail drawer opens a new window with a print-friendly version of the invoice (header, dates, line items, totals, payments) and calls `window.print()`.

### 8. **Frontend production features**
- **List:** Search by invoice number or customer; click row to open detail drawer.
- **Create:** Optional invoice number (placeholder shows “Auto-generated if blank” when next-number is loaded); default status DRAFT; customer, date, amount required.
- **Detail drawer:** Full invoice, line items, payments, paid total, balance due, overdue badge, “Record payment”, “Update status” (e.g. Mark OVERDUE / CANCELLED), Print.
- **Record payment modal:** Amount (prefilled with balance due), date, method (CASH / BANK_TRANSFER / CARD), reference; submit to `POST .../payments`.
- **Status:** Dropdown in detail to set OVERDUE, CANCELLED, UNPAID, DRAFT (PAID/PARTIAL only via payments).

## API summary

| Method | Path | Description |
|--------|------|-------------|
| GET | /sales/invoices | List invoices (tenant-scoped) |
| GET | /sales/invoices/next-number | Next suggested invoice number |
| GET | /sales/invoices/:id | Invoice + payments + line_items + paid_total, balance_due, overdue |
| POST | /sales/invoices | Create invoice (invoice_number optional) |
| PATCH | /sales/invoices/:id/status | Update status (body: { status }) |
| GET | /sales/invoices/:id/payments | List payments for invoice |
| POST | /sales/invoices/:id/payments | Record payment |
| GET | /sales/invoices/:id/line-items | List line items |
| POST | /sales/invoices/:id/line-items | Add line item |

## Migration

- **00006_invoice_enhancements.sql:** Creates `invoice_line_items` and `invoice_number_sequences`. Run migrations (e.g. `goose up`) before using next-number or line items.

## Optional next steps

- **Aging report:** Endpoint that returns outstanding balances by bucket (e.g. 0–30, 31–60, 61–90, 90+ days past due).
- **Bulk status update:** e.g. nightly job to set OVERDUE for invoices where due_date < today and status in (UNPAID, PARTIAL).
- **Create with line items:** Frontend form to add multiple lines and optionally compute total from lines.
- **PDF export:** Server-side PDF generation for invoice + payments instead of or in addition to browser print.
