-- name: CreateItem :one
INSERT INTO items (
    parent_id,
    sku,
    name,
    category,
    base_unit,
    specs,
    category_code,
    low_stock_threshold,
    linked_raw_material_id,
    diameter
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
)
RETURNING *;

-- name: GetItem :one
SELECT * FROM items
WHERE id = $1 LIMIT 1;

-- name: ListVariantsByParent :many
SELECT * FROM items
WHERE parent_id = $1 AND is_active = true
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListActiveItemsByCategory :many
SELECT * FROM items
WHERE category = $1 AND is_active = true
ORDER BY name
LIMIT $2 OFFSET $3;

-- name: GetSelectableItems :many
SELECT id, name, category, specs
FROM items
WHERE is_active = true
ORDER BY category, name;

-- name: UpdateItemThreshold :one
UPDATE items
SET low_stock_threshold = $2, updated_at = NOW()
WHERE id = $1
RETURNING *;

-- name: GetFinishedGoodByRecipe :one
SELECT * FROM items
WHERE category = 'FINISHED'::item_category
  AND linked_raw_material_id = sqlc.arg(linked_raw_material_id)
  AND diameter = sqlc.arg(diameter)
  AND is_active = true
LIMIT 1;
