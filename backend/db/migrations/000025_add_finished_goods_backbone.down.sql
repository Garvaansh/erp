DROP INDEX IF EXISTS idx_items_finished_recipe_unique;
DROP INDEX IF EXISTS idx_items_linked_raw_material_id;

ALTER TABLE items
DROP COLUMN IF EXISTS diameter,
DROP COLUMN IF EXISTS linked_raw_material_id;
