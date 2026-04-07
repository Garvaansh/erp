-- name: CreateLocation :one
INSERT INTO inventory_locations (
    code, name, type, parent_id
) VALUES (
    $1, $2, $3, $4
)
RETURNING *;

-- name: ListLocationsByType :many
SELECT * FROM inventory_locations
WHERE type = $1 AND is_active = true
ORDER BY name;