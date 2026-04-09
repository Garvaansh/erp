ALTER TABLE inventory_batches
ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(18,2);
