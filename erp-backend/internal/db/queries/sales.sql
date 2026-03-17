-- name: CreateCustomer :one
INSERT INTO customers (
    tenant_id, name, contact_person, email, phone, billing_address, shipping_address, tax_id, gstin, place_of_supply_state, pan
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
) RETURNING id, tenant_id, name, contact_person, email, phone, billing_address, shipping_address, tax_id, gstin, place_of_supply_state, pan, created_at, updated_at;

-- name: GetCustomer :one
SELECT id, tenant_id, name, contact_person, email, phone, billing_address, shipping_address, tax_id, gstin, place_of_supply_state, pan, created_at, updated_at
FROM customers
WHERE id = $1 AND tenant_id = $2;

-- name: ListCustomers :many
SELECT id, tenant_id, name, contact_person, email, phone, billing_address, shipping_address, tax_id, gstin, place_of_supply_state, pan, created_at, updated_at
FROM customers
WHERE tenant_id = $1
ORDER BY name ASC;

-- name: UpdateCustomer :one
UPDATE customers
SET name = $3, contact_person = $4, email = $5, phone = $6, billing_address = $7, shipping_address = $8, tax_id = $9, gstin = $10, place_of_supply_state = $11, pan = $12, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, name, contact_person, email, phone, billing_address, shipping_address, tax_id, gstin, place_of_supply_state, pan, created_at, updated_at;

-- name: DeleteCustomer :exec
DELETE FROM customers WHERE id = $1 AND tenant_id = $2;

-- name: CreateSalesOrder :one
INSERT INTO sales_orders (
    tenant_id, customer_id, so_number, status, expected_shipping_date, total_amount, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING id, tenant_id, customer_id, so_number, status, expected_shipping_date, total_amount, created_by, created_at, updated_at;

-- name: ListSalesOrders :many
SELECT id, tenant_id, customer_id, so_number, status, expected_shipping_date, total_amount, created_by, created_at, updated_at
FROM sales_orders
WHERE tenant_id = $1
ORDER BY created_at DESC;

-- name: GetSalesOrder :one
SELECT id, tenant_id, customer_id, so_number, status, expected_shipping_date, total_amount, created_by, created_at, updated_at
FROM sales_orders
WHERE id = $1 AND tenant_id = $2;

-- name: UpdateSalesOrderStatus :exec
UPDATE sales_orders
SET status = $3, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND tenant_id = $2;

-- name: UpdateSalesOrderTotal :exec
UPDATE sales_orders
SET total_amount = (SELECT COALESCE(SUM(total_price), 0) FROM sales_order_items WHERE sales_order_items.so_id = sales_orders.id), updated_at = CURRENT_TIMESTAMP
WHERE sales_orders.id = $1 AND sales_orders.tenant_id = $2;

-- name: ListSalesOrderItems :many
SELECT id, tenant_id, so_id, product_id, quantity, unit_price, total_price, created_at
FROM sales_order_items
WHERE so_id = $1 AND tenant_id = $2
ORDER BY created_at ASC;

-- name: DeleteSalesOrderItem :exec
DELETE FROM sales_order_items
WHERE id = $1 AND tenant_id = $2;

-- name: GetSalesOrderItemByID :one
SELECT id, tenant_id, so_id, product_id, quantity, unit_price, total_price, created_at
FROM sales_order_items
WHERE id = $1 AND tenant_id = $2;

-- name: AddSalesOrderItem :one
INSERT INTO sales_order_items (
    tenant_id, so_id, product_id, quantity, unit_price, total_price
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING id, tenant_id, so_id, product_id, quantity, unit_price, total_price, created_at;

-- name: CreateInvoice :one
INSERT INTO invoices (
    tenant_id, customer_id, so_id, invoice_number, invoice_date, due_date, total_amount, status,
    place_of_supply_state, invoice_type, subtotal, cgst_total, sgst_total, igst_total
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
) RETURNING id, tenant_id, customer_id, so_id, invoice_number, invoice_date, due_date, total_amount, status,
  place_of_supply_state, invoice_type, subtotal, cgst_total, sgst_total, igst_total, created_at;

-- name: ListInvoices :many
SELECT id, tenant_id, customer_id, so_id, invoice_number, invoice_date, due_date, total_amount, status,
  place_of_supply_state, invoice_type, subtotal, cgst_total, sgst_total, igst_total, created_at
FROM invoices
WHERE tenant_id = $1
ORDER BY created_at DESC;

-- name: GetInvoice :one
SELECT id, tenant_id, customer_id, so_id, invoice_number, invoice_date, due_date, total_amount, status,
  place_of_supply_state, invoice_type, subtotal, cgst_total, sgst_total, igst_total, created_at
FROM invoices
WHERE tenant_id = $1 AND id = $2;

-- name: ListPaymentsByInvoice :many
SELECT id, tenant_id, invoice_id, amount, payment_date, payment_method, reference_number, recorded_by, created_at
FROM payments
WHERE tenant_id = $1 AND invoice_id = $2
ORDER BY payment_date ASC, created_at ASC;

-- name: SumPaymentsByInvoice :one
SELECT COALESCE(SUM(amount), 0)::DECIMAL(15,2) AS total_paid
FROM payments
WHERE tenant_id = $1 AND invoice_id = $2;

-- name: UpdateInvoiceStatus :exec
UPDATE invoices SET status = $3 WHERE tenant_id = $1 AND id = $2;

-- name: NextInvoiceNumber :one
INSERT INTO invoice_number_sequences (tenant_id, year, last_number)
VALUES ($1, $2, 1)
ON CONFLICT (tenant_id, year) DO UPDATE SET last_number = invoice_number_sequences.last_number + 1
RETURNING last_number;

-- name: ListInvoiceLineItems :many
SELECT id, tenant_id, invoice_id, description, quantity, unit_price, total_line, sort_order,
  hsn_sac, taxable_value, cgst, sgst, igst, created_at
FROM invoice_line_items
WHERE tenant_id = $1 AND invoice_id = $2
ORDER BY sort_order ASC, created_at ASC;

-- name: AddInvoiceLineItem :one
INSERT INTO invoice_line_items (tenant_id, invoice_id, description, quantity, unit_price, total_line, sort_order, hsn_sac, taxable_value, cgst, sgst, igst)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING id, tenant_id, invoice_id, description, quantity, unit_price, total_line, sort_order, hsn_sac, taxable_value, cgst, sgst, igst, created_at;

-- name: CreatePayment :one
INSERT INTO payments (
    tenant_id, invoice_id, amount, payment_date, payment_method, reference_number, recorded_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
) RETURNING id, tenant_id, invoice_id, amount, payment_date, payment_method, reference_number, recorded_by, created_at;
