-- name: CreateVendor :one
INSERT INTO vendors (
    tenant_id, name, contact_person, email, phone, address, status_notes, gstin, pan
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9
) RETURNING id, tenant_id, name, contact_person, email, phone, address, status_notes, gstin, pan, created_at, updated_at;

-- name: ListVendors :many
SELECT id, tenant_id, name, contact_person, email, phone, address, status_notes, gstin, pan, created_at, updated_at
FROM vendors
WHERE tenant_id = $1
ORDER BY name ASC;

-- name: GetVendor :one
SELECT id, tenant_id, name, contact_person, email, phone, address, status_notes, gstin, pan, created_at, updated_at
FROM vendors
WHERE id = $1 AND tenant_id = $2;

-- name: UpdateVendor :one
UPDATE vendors
SET name = $3, contact_person = $4, email = $5, phone = $6, address = $7, status_notes = $8, gstin = $9, pan = $10, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, name, contact_person, email, phone, address, status_notes, gstin, pan, created_at, updated_at;

-- name: DeleteVendor :exec
DELETE FROM vendors WHERE id = $1 AND tenant_id = $2;

-- name: CreatePurchaseOrder :one
INSERT INTO purchase_orders (
    tenant_id, vendor_id, po_number, status, expected_delivery_date, total_amount, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING id, tenant_id, vendor_id, po_number, status, expected_delivery_date, total_amount, created_by, created_at, updated_at;

-- name: GetPurchaseOrder :one
SELECT id, tenant_id, vendor_id, po_number, status, expected_delivery_date, total_amount, created_by, created_at, updated_at
FROM purchase_orders
WHERE id = $1 AND tenant_id = $2;

-- name: ListPurchaseOrders :many
SELECT id, tenant_id, vendor_id, po_number, status, expected_delivery_date, total_amount, created_by, created_at, updated_at
FROM purchase_orders
WHERE tenant_id = $1
ORDER BY created_at DESC;

-- name: ListPurchaseOrderItems :many
SELECT id, tenant_id, po_id, product_id, quantity, unit_price, total_price, created_at
FROM purchase_order_items
WHERE po_id = $1 AND tenant_id = $2
ORDER BY created_at ASC;

-- name: AddPurchaseOrderItem :one
INSERT INTO purchase_order_items (
    tenant_id, po_id, product_id, quantity, unit_price, total_price
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING id, tenant_id, po_id, product_id, quantity, unit_price, total_price, created_at;

-- name: CreateGoodsReceipt :one
INSERT INTO goods_receipts (
    tenant_id, po_id, warehouse_id, receipt_number, receipt_date, received_by, notes
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING id, tenant_id, po_id, warehouse_id, receipt_number, receipt_date, received_by, notes, created_at;

-- name: UpdatePurchaseOrderStatus :exec
UPDATE purchase_orders
SET status = $1, updated_at = CURRENT_TIMESTAMP
WHERE id = $2 AND tenant_id = $3;

-- name: ListGoodsReceipts :many
SELECT id, tenant_id, po_id, warehouse_id, receipt_number, receipt_date, received_by, notes, created_at
FROM goods_receipts
WHERE tenant_id = $1
ORDER BY created_at DESC;

-- name: GetGoodsReceipt :one
SELECT id, tenant_id, po_id, warehouse_id, receipt_number, receipt_date, received_by, notes, created_at
FROM goods_receipts
WHERE id = $1 AND tenant_id = $2;

-- name: CreateVendorInvoice :one
INSERT INTO vendor_invoices (tenant_id, vendor_id, po_id, invoice_number, invoice_date, due_date, total_amount, status, notes, tds_section, tds_rate, tds_amount, tds_paid_at, challan_number)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
RETURNING id, tenant_id, vendor_id, po_id, invoice_number, invoice_date, due_date, total_amount, status, notes, tds_section, tds_rate, tds_amount, tds_paid_at, challan_number, created_at;

-- name: ListVendorInvoices :many
SELECT id, tenant_id, vendor_id, po_id, invoice_number, invoice_date, due_date, total_amount, status, notes, tds_section, tds_rate, tds_amount, tds_paid_at, challan_number, created_at
FROM vendor_invoices
WHERE tenant_id = $1
ORDER BY created_at DESC;

-- name: GetVendorInvoice :one
SELECT id, tenant_id, vendor_id, po_id, invoice_number, invoice_date, due_date, total_amount, status, notes, tds_section, tds_rate, tds_amount, tds_paid_at, challan_number, created_at
FROM vendor_invoices
WHERE id = $1 AND tenant_id = $2;

-- name: UpdateVendorInvoiceStatus :exec
UPDATE vendor_invoices SET status = $3 WHERE id = $1 AND tenant_id = $2;

-- name: UpdateVendorInvoiceTDS :one
UPDATE vendor_invoices
SET tds_section = $3, tds_rate = $4, tds_amount = $5, tds_paid_at = $6, challan_number = $7
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, vendor_id, po_id, invoice_number, invoice_date, due_date, total_amount, status, notes, tds_section, tds_rate, tds_amount, tds_paid_at, challan_number, created_at;
