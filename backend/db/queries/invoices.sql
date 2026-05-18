-- name: AllocateNextDocumentNumber :one
UPDATE document_sequences
SET next_number = next_number + 1,
    updated_at = NOW()
WHERE document_type = $1
RETURNING prefix, next_number;

-- name: CreateInvoice :one
INSERT INTO invoices (
    order_id, invoice_number, snapshot, generated_by, generated_at
) VALUES (
    $1, $2, $3, $4, NOW()
) RETURNING *;

-- name: GetInvoice :one
SELECT * FROM invoices
WHERE id = $1 LIMIT 1;

-- name: GetInvoiceByOrder :one
SELECT * FROM invoices
WHERE order_id = $1 LIMIT 1;

-- name: GetInvoiceByNumber :one
SELECT * FROM invoices
WHERE invoice_number = $1 LIMIT 1;
