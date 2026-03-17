-- name: CreatePurchaseRequisition :one
INSERT INTO purchase_requisitions (tenant_id, req_number, department, requester_id, status, expected_delivery_date, budget)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING id, tenant_id, req_number, department, requester_id, status, expected_delivery_date, budget, created_at, updated_at;

-- name: ListPurchaseRequisitions :many
SELECT id, tenant_id, req_number, department, requester_id, status, expected_delivery_date, budget, created_at, updated_at
FROM purchase_requisitions
WHERE tenant_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetPurchaseRequisition :one
SELECT id, tenant_id, req_number, department, requester_id, status, expected_delivery_date, budget, created_at, updated_at
FROM purchase_requisitions
WHERE id = $1 AND tenant_id = $2;

-- name: UpdatePurchaseRequisitionStatus :one
UPDATE purchase_requisitions
SET status = $3, updated_at = CURRENT_TIMESTAMP
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, req_number, department, requester_id, status, expected_delivery_date, budget, created_at, updated_at;

-- name: CreatePurchaseRequisitionItem :one
INSERT INTO purchase_requisition_items (requisition_id, product_id, quantity, notes)
VALUES ($1, $2, $3, $4)
RETURNING id, requisition_id, product_id, quantity, notes, created_at;

-- name: ListPurchaseRequisitionItems :many
SELECT id, requisition_id, product_id, quantity, notes, created_at
FROM purchase_requisition_items
WHERE requisition_id = $1
ORDER BY created_at ASC;
