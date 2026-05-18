-- name: GetSetting :one
SELECT * FROM system_settings
WHERE category = $1 AND key = $2 LIMIT 1;

-- name: GetSettingsByCategory :many
SELECT * FROM system_settings
WHERE category = $1;

-- name: UpsertSetting :one
INSERT INTO system_settings (
    category, key, value, description, is_sensitive, updated_by, updated_at
) VALUES (
    $1, $2, $3, $4, $5, $6, NOW()
)
ON CONFLICT (category, key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    is_sensitive = EXCLUDED.is_sensitive,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW()
RETURNING *;
