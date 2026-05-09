ALTER TABLE inventory_batches
    DROP CONSTRAINT IF EXISTS inventory_batches_procurement_status_chk;

ALTER TABLE inventory_batches
    ADD CONSTRAINT inventory_batches_procurement_status_chk
    CHECK (
        parent_po_id IS NULL
        OR status::text IN ('ACTIVE', 'REVERSED')
    );
