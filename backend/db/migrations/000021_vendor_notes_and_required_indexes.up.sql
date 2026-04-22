ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_po_vendor_id
ON purchase_orders(vendor_id);

CREATE INDEX IF NOT EXISTS idx_payments_po_id
ON purchase_order_payments(po_id);

CREATE INDEX IF NOT EXISTS idx_batches_po_id
ON inventory_batches(parent_po_id);
