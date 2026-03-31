-- name: GetUserByUsername :one
SELECT * FROM users WHERE username = $1 LIMIT 1;

-- name: CreateUser :one
INSERT INTO users (username, password_hash, full_name, role)
VALUES ($1, $2, $3, $4)
RETURNING *;