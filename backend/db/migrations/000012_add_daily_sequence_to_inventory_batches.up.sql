ALTER TABLE inventory_batches
ADD COLUMN daily_sequence INT;

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY item_id, (created_at AT TIME ZONE 'UTC')::date
            ORDER BY created_at, id
        ) AS seq
    FROM inventory_batches
)
UPDATE inventory_batches b
SET daily_sequence = COALESCE(r.seq, 1)
FROM ranked r
WHERE b.id = r.id;

UPDATE inventory_batches
SET daily_sequence = 1
WHERE daily_sequence IS NULL;

ALTER TABLE inventory_batches
ALTER COLUMN daily_sequence SET NOT NULL;

CREATE INDEX idx_inventory_batches_item_created_at_sequence
ON inventory_batches(item_id, created_at);