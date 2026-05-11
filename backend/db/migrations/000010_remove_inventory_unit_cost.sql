-- +goose Up
ALTER TABLE inventory_batches
DROP COLUMN unit_cost;


-- +goose Down
ALTER TABLE inventory_batches
ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(18,2);
