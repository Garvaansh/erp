-- +goose Up
ALTER TABLE vendors
ADD COLUMN notes TEXT;

CREATE INDEX idx_po_vendor_id
ON purchase_orders(vendor_id);

CREATE INDEX idx_payments_po_id
ON purchase_order_payments(po_id);

CREATE INDEX idx_batches_po_id
ON inventory_batches(parent_po_id);


-- +goose Down
DROP INDEX IF EXISTS idx_batches_po_id;
DROP INDEX IF EXISTS idx_payments_po_id;
DROP INDEX IF EXISTS idx_po_vendor_id;

ALTER TABLE vendors
DROP COLUMN IF EXISTS notes;
