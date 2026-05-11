-- +goose Up
ALTER TABLE items
ADD COLUMN linked_raw_material_id UUID REFERENCES items(id) ON DELETE RESTRICT,
ADD COLUMN diameter NUMERIC(10,2);

CREATE INDEX idx_items_linked_raw_material_id
    ON items(linked_raw_material_id)
    WHERE linked_raw_material_id IS NOT NULL;

CREATE UNIQUE INDEX idx_items_finished_recipe_unique
    ON items(linked_raw_material_id, diameter)
    WHERE category = 'FINISHED'::item_category
      AND linked_raw_material_id IS NOT NULL
      AND diameter IS NOT NULL
      AND is_active = true;


-- +goose Down
DROP INDEX IF EXISTS idx_items_finished_recipe_unique;
DROP INDEX IF EXISTS idx_items_linked_raw_material_id;

ALTER TABLE items
DROP COLUMN IF EXISTS diameter,
DROP COLUMN IF EXISTS linked_raw_material_id;
