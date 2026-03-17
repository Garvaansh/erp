-- name: CreateTenant :one
INSERT INTO tenants (name)
VALUES ($1)
RETURNING id, name, created_at, updated_at;

-- name: GetTenant :one
SELECT id, name, created_at, updated_at
FROM tenants
WHERE id = $1 LIMIT 1;

-- name: CreateUser :one
INSERT INTO users (tenant_id, email, password_hash, first_name, last_name)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, tenant_id, email, password_hash, first_name, last_name, created_at, updated_at;

-- name: GetUserByEmail :one
SELECT id, tenant_id, email, password_hash, first_name, last_name, created_at, updated_at
FROM users
WHERE email = $1 AND tenant_id = $2 LIMIT 1;

-- name: GetUserByID :one
SELECT id, tenant_id, email, password_hash, first_name, last_name, created_at, updated_at
FROM users
WHERE id = $1 LIMIT 1;

-- name: CreateRole :one
INSERT INTO roles (tenant_id, name, description)
VALUES ($1, $2, $3)
RETURNING id, tenant_id, name, description, created_at;

-- name: AssignUserRole :exec
INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES ($1, $2, $3);

-- name: GetRoleByTenantAndName :one
SELECT id, tenant_id, name, description, created_at FROM roles WHERE tenant_id = $1 AND name = $2 LIMIT 1;

-- name: UpdateUserPassword :exec
UPDATE users SET password_hash = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND tenant_id = $2;
