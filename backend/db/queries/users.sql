-- name: ListUsers :many
SELECT
    u.id,
    u.name,
    u.email,
    r.code AS role_code,
    r.name AS role_name,
    u.is_active,
    u.created_at,
    u.updated_at
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE (
    sqlc.arg('filter')::text = 'all'
    OR (sqlc.arg('filter')::text = 'active' AND u.is_active = TRUE)
    OR (sqlc.arg('filter')::text = 'archived' AND u.is_active = FALSE)
)
AND (
    sqlc.narg('search')::text IS NULL
    OR u.name ILIKE '%' || sqlc.narg('search')::text || '%'
    OR u.email ILIKE '%' || sqlc.narg('search')::text || '%'
    OR r.code ILIKE '%' || sqlc.narg('search')::text || '%'
)
ORDER BY u.created_at DESC;

-- name: GetUserByID :one
SELECT
    u.id,
    u.name,
    u.email,
    r.code AS role_code,
    r.name AS role_name,
    u.is_active,
    u.created_at,
    u.updated_at
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE u.id = $1
LIMIT 1;

-- name: CreateUserCommand :one
INSERT INTO users (
    name,
    email,
    password_hash,
    role_id,
    is_active
) VALUES (
    $1, $2, $3, $4, TRUE
)
RETURNING id, name, email, is_active, created_at, updated_at;

-- name: UpdateUserCommand :one
UPDATE users
SET
    role_id = COALESCE(sqlc.narg('role_id')::uuid, role_id),
    is_active = COALESCE(sqlc.narg('is_active')::boolean, is_active),
    updated_at = NOW()
WHERE id = sqlc.arg('id')::uuid
RETURNING id, name, email, is_active, created_at, updated_at;

-- name: ChangeUserPasswordCommand :exec
UPDATE users
SET
    password_hash = $2,
    updated_at = NOW()
WHERE id = $1;
