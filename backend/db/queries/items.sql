-- name: CreateItem :one
INSERT INTO items (
    parent_id, sku, name, category, base_unit, specs
) VALUES (
    $1, $2, $3, $4, $5, $6
)
RETURNING *;

-- name: GetItem :one
SELECT * FROM items
WHERE id = $1 LIMIT 1;

-- name: ListVariantsByParent :many
SELECT * FROM items
WHERE parent_id = $1 AND is_active = true
ORDER BY created_at DESC;

-- name: ListActiveItemsByCategory :many
SELECT * FROM items
WHERE category = $1 AND is_active = true
ORDER BY name;