-- name: CreateItem :one
INSERT INTO items (
    parent_id, sku, name, category, base_unit, specs, category_code
) VALUES (
    $1, $2, $3, $4, $5, $6, $7
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