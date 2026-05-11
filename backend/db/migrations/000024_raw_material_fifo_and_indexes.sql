-- +goose Up
CREATE INDEX idx_inventory_fifo
ON inventory_batches (item_id, status, created_at);


-- +goose Down
DROP INDEX IF EXISTS idx_inventory_fifo;
