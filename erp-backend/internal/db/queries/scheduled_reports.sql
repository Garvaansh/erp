-- name: CreateScheduledReport :one
INSERT INTO scheduled_reports (tenant_id, created_by, name, report_type, frequency, export_format, recipient_email, parameters, next_run_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: ListScheduledReports :many
SELECT * FROM scheduled_reports
WHERE tenant_id = $1
ORDER BY created_at DESC;

-- name: GetScheduledReport :one
SELECT * FROM scheduled_reports
WHERE id = $1 AND tenant_id = $2;

-- name: UpdateScheduledReportNextRun :exec
UPDATE scheduled_reports
SET last_run_at = $3, next_run_at = $4, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND tenant_id = $2;

-- name: DeleteScheduledReport :exec
DELETE FROM scheduled_reports WHERE id = $1 AND tenant_id = $2;
