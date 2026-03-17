-- name: CreateAuditLog :one
INSERT INTO audit_logs (tenant_id, user_id, entity_type, entity_id, operation, old_value, new_value, ip_address, user_agent)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, tenant_id, user_id, entity_type, entity_id, operation, old_value, new_value, ip_address, user_agent, created_at;

-- name: ListAuditLogs :many
SELECT id, tenant_id, user_id, entity_type, entity_id, operation, old_value, new_value, ip_address, user_agent, created_at
FROM audit_logs
WHERE tenant_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: ListAuditLogsByEntity :many
SELECT id, tenant_id, user_id, entity_type, entity_id, operation, old_value, new_value, ip_address, user_agent, created_at
FROM audit_logs
WHERE tenant_id = $1 AND entity_type = $2 AND entity_id = $3
ORDER BY created_at DESC
LIMIT $4 OFFSET $5;
