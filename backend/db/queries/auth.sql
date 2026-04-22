-- name: GetUserWithRoleByEmail :one
SELECT 
    u.id, 
    u.email, 
    u.password_hash, 
    u.name, 
    u.is_active,
    r.code as role_code
FROM users u 
JOIN roles r ON u.role_id = r.id 
WHERE u.email = $1 LIMIT 1;

-- name: GetRoleByCode :one
SELECT id, code, name FROM roles WHERE code = $1 LIMIT 1;

-- name: GetUserWithRoleByID :one
SELECT
    u.id,
    u.email,
    u.password_hash,
    u.name,
    u.is_active,
    r.code as role_code
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE u.id = $1
LIMIT 1;