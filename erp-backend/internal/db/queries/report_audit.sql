-- name: InsertReportAccessLog :one
INSERT INTO report_access_log (tenant_id, user_id, report_type, parameters, export_format)
VALUES ($1, $2, $3, $4, $5)
RETURNING id;
