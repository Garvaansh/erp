ALTER TABLE items
ADD COLUMN IF NOT EXISTS linked_raw_material_id UUID REFERENCES items(id) ON DELETE RESTRICT,
ADD COLUMN IF NOT EXISTS diameter NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS idx_items_linked_raw_material_id
    ON items(linked_raw_material_id)
    WHERE linked_raw_material_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_items_finished_recipe_unique
    ON items(linked_raw_material_id, diameter)
    WHERE category = 'FINISHED'::item_category
      AND linked_raw_material_id IS NOT NULL
      AND diameter IS NOT NULL
      AND is_active = true;
