-- Company codes
-- name: ListCompanyCodes :many
SELECT id, tenant_id, code, name, country_code, currency, created_at, updated_at
FROM company_codes
WHERE tenant_id = $1
ORDER BY code ASC
LIMIT $2 OFFSET $3;

-- name: CountCompanyCodes :one
SELECT COUNT(*) FROM company_codes WHERE tenant_id = $1;

-- name: GetCompanyCode :one
SELECT id, tenant_id, code, name, country_code, currency, created_at, updated_at
FROM company_codes
WHERE id = $1 AND tenant_id = $2;

-- name: GetCompanyCodeByCode :one
SELECT id, tenant_id, code, name, country_code, currency, created_at, updated_at
FROM company_codes
WHERE tenant_id = $1 AND code = $2;

-- name: CreateCompanyCode :one
INSERT INTO company_codes (tenant_id, code, name, country_code, currency)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, tenant_id, code, name, country_code, currency, created_at, updated_at;

-- name: UpdateCompanyCode :one
UPDATE company_codes
SET name = $3, country_code = $4, currency = $5, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, code, name, country_code, currency, created_at, updated_at;

-- name: DeleteCompanyCode :exec
DELETE FROM company_codes WHERE id = $1 AND tenant_id = $2;

-- Plants
-- name: ListPlants :many
SELECT id, tenant_id, code, name, company_code_id, time_zone, created_at, updated_at
FROM plants
WHERE tenant_id = $1
ORDER BY code ASC
LIMIT $2 OFFSET $3;

-- name: CountPlants :one
SELECT COUNT(*) FROM plants WHERE tenant_id = $1;

-- name: GetPlant :one
SELECT id, tenant_id, code, name, company_code_id, time_zone, created_at, updated_at
FROM plants
WHERE id = $1 AND tenant_id = $2;

-- name: GetPlantByCode :one
SELECT id, tenant_id, code, name, company_code_id, time_zone, created_at, updated_at
FROM plants
WHERE tenant_id = $1 AND code = $2;

-- name: CreatePlant :one
INSERT INTO plants (tenant_id, code, name, company_code_id, time_zone)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, tenant_id, code, name, company_code_id, time_zone, created_at, updated_at;

-- name: UpdatePlant :one
UPDATE plants
SET name = $3, company_code_id = $4, time_zone = $5, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, code, name, company_code_id, time_zone, created_at, updated_at;

-- name: DeletePlant :exec
DELETE FROM plants WHERE id = $1 AND tenant_id = $2;

-- Chart of accounts
-- name: ListChartOfAccounts :many
SELECT id, tenant_id, code, name, created_at
FROM chart_of_accounts
WHERE tenant_id = $1
ORDER BY code ASC
LIMIT $2 OFFSET $3;

-- name: CountChartOfAccounts :one
SELECT COUNT(*) FROM chart_of_accounts WHERE tenant_id = $1;

-- name: GetChartOfAccounts :one
SELECT id, tenant_id, code, name, created_at
FROM chart_of_accounts
WHERE id = $1 AND tenant_id = $2;

-- name: GetChartOfAccountsByCode :one
SELECT id, tenant_id, code, name, created_at
FROM chart_of_accounts
WHERE tenant_id = $1 AND code = $2;

-- name: CreateChartOfAccounts :one
INSERT INTO chart_of_accounts (tenant_id, code, name)
VALUES ($1, $2, $3)
RETURNING id, tenant_id, code, name, created_at;

-- name: UpdateChartOfAccounts :one
UPDATE chart_of_accounts
SET name = $3
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, code, name, created_at;

-- name: DeleteChartOfAccounts :exec
DELETE FROM chart_of_accounts WHERE id = $1 AND tenant_id = $2;

-- G/L accounts (require chart_of_accounts_id; company_code comes from chart/usage)
-- name: ListGLAccounts :many
SELECT id, tenant_id, chart_of_accounts_id, account_number, account_type, group_code, created_at, updated_at
FROM gl_accounts
WHERE tenant_id = $1
ORDER BY chart_of_accounts_id, account_number ASC
LIMIT $2 OFFSET $3;

-- name: ListGLAccountsByChart :many
SELECT id, tenant_id, chart_of_accounts_id, account_number, account_type, group_code, created_at, updated_at
FROM gl_accounts
WHERE tenant_id = $1 AND chart_of_accounts_id = $2
ORDER BY account_number ASC
LIMIT $3 OFFSET $4;

-- name: CountGLAccounts :one
SELECT COUNT(*) FROM gl_accounts WHERE tenant_id = $1;

-- name: CountGLAccountsByChart :one
SELECT COUNT(*) FROM gl_accounts WHERE tenant_id = $1 AND chart_of_accounts_id = $2;

-- name: GetGLAccount :one
SELECT id, tenant_id, chart_of_accounts_id, account_number, account_type, group_code, created_at, updated_at
FROM gl_accounts
WHERE id = $1 AND tenant_id = $2;

-- name: GetGLAccountByNumber :one
SELECT id, tenant_id, chart_of_accounts_id, account_number, account_type, group_code, created_at, updated_at
FROM gl_accounts
WHERE tenant_id = $1 AND chart_of_accounts_id = $2 AND account_number = $3;

-- name: CreateGLAccount :one
INSERT INTO gl_accounts (tenant_id, chart_of_accounts_id, account_number, account_type, group_code)
VALUES ($1, $2, $3, $4, $5)
RETURNING id, tenant_id, chart_of_accounts_id, account_number, account_type, group_code, created_at, updated_at;

-- name: UpdateGLAccount :one
UPDATE gl_accounts
SET account_type = $3, group_code = $4, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, chart_of_accounts_id, account_number, account_type, group_code, created_at, updated_at;

-- name: DeleteGLAccount :exec
DELETE FROM gl_accounts WHERE id = $1 AND tenant_id = $2;

-- Cost centers
-- name: ListCostCenters :many
SELECT id, tenant_id, company_code_id, code, name, parent_cost_center_id, is_blocked, created_at
FROM cost_centers
WHERE tenant_id = $1
ORDER BY code ASC
LIMIT $2 OFFSET $3;

-- name: ListCostCentersByCompanyCode :many
SELECT id, tenant_id, company_code_id, code, name, parent_cost_center_id, is_blocked, created_at
FROM cost_centers
WHERE tenant_id = $1 AND company_code_id = $2
ORDER BY code ASC
LIMIT $3 OFFSET $4;

-- name: CountCostCenters :one
SELECT COUNT(*) FROM cost_centers WHERE tenant_id = $1;

-- name: GetCostCenter :one
SELECT id, tenant_id, company_code_id, code, name, parent_cost_center_id, is_blocked, created_at
FROM cost_centers
WHERE id = $1 AND tenant_id = $2;

-- name: GetCostCenterByCode :one
SELECT id, tenant_id, company_code_id, code, name, parent_cost_center_id, is_blocked, created_at
FROM cost_centers
WHERE tenant_id = $1 AND company_code_id = $2 AND code = $3;

-- name: CreateCostCenter :one
INSERT INTO cost_centers (tenant_id, company_code_id, code, name, parent_cost_center_id, is_blocked)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, tenant_id, company_code_id, code, name, parent_cost_center_id, is_blocked, created_at;

-- name: UpdateCostCenter :one
UPDATE cost_centers
SET name = $3, parent_cost_center_id = $4, is_blocked = $5
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, company_code_id, code, name, parent_cost_center_id, is_blocked, created_at;

-- name: DeleteCostCenter :exec
DELETE FROM cost_centers WHERE id = $1 AND tenant_id = $2;
