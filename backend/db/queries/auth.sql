-- name: GetUserWithRoleByEmail :one
SELECT 
    u.id, 
    u.email, 
    u.password_hash, 
    u.name, 
    u.is_active, 
    u.is_admin,
    r.code as role_code 
FROM users u 
JOIN roles r ON u.role_id = r.id 
WHERE u.email = $1 LIMIT 1;

-- name: GetRoleByCode :one
SELECT id, code, name FROM roles WHERE code = $1 LIMIT 1;

-- name: CreateUser :one
INSERT INTO users (email, password_hash, name, role_id)
VALUES ($1, $2, $3, $4)
RETURNING *;