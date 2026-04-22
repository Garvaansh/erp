DROP INDEX IF EXISTS idx_batches_po_id;
DROP INDEX IF EXISTS idx_payments_po_id;
DROP INDEX IF EXISTS idx_po_vendor_id;

ALTER TABLE vendors
DROP COLUMN IF EXISTS notes;
