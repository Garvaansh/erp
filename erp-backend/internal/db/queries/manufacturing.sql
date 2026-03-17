-- name: CreateBOM :one
INSERT INTO bom (
    tenant_id, product_id, name, version, is_active
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING id, tenant_id, product_id, name, version, is_active, created_at, updated_at;

-- name: ListBOMs :many
SELECT id, tenant_id, product_id, name, version, is_active, created_at, updated_at
FROM bom
WHERE tenant_id = $1
ORDER BY created_at DESC;

-- name: AddBOMItem :one
INSERT INTO bom_items (
    tenant_id, bom_id, component_product_id, quantity, instructions
) VALUES (
    $1, $2, $3, $4, $5
) RETURNING id, tenant_id, bom_id, component_product_id, quantity, instructions, created_at;

-- name: CreateWorkOrder :one
INSERT INTO work_orders (
    tenant_id, wo_number, bom_id, product_id, sales_order_id, status, planned_quantity, start_date, end_date, created_by
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
) RETURNING id, tenant_id, wo_number, bom_id, product_id, sales_order_id, status, planned_quantity, produced_quantity, start_date, end_date, created_by, created_at, updated_at, production_order_id, operation_type, sequence, machine_id, scheduled_start, scheduled_end;

-- name: CreateWorkOrderForProductionOrder :one
INSERT INTO work_orders (
    tenant_id, wo_number, bom_id, product_id, sales_order_id, status, planned_quantity, start_date, end_date, created_by,
    production_order_id, operation_type, sequence, machine_id, scheduled_start, scheduled_end
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
) RETURNING id, tenant_id, wo_number, bom_id, product_id, sales_order_id, status, planned_quantity, produced_quantity, start_date, end_date, created_by, created_at, updated_at, production_order_id, operation_type, sequence, machine_id, scheduled_start, scheduled_end;

-- name: RecordMaterialConsumption :one
INSERT INTO material_consumption (
    tenant_id, work_order_id, product_id, warehouse_id, quantity, recorded_by
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING id, tenant_id, work_order_id, product_id, warehouse_id, quantity, consumed_at, recorded_by;

-- name: ListProductionLogsByWorkOrder :many
SELECT id, tenant_id, work_order_id, warehouse_id, quantity, produced_at, recorded_by, notes
FROM production_logs
WHERE work_order_id = $1 AND tenant_id = $2
ORDER BY produced_at DESC;

-- name: ListMaterialConsumptionByWorkOrder :many
SELECT id, tenant_id, work_order_id, product_id, warehouse_id, quantity, consumed_at, recorded_by
FROM material_consumption
WHERE work_order_id = $1 AND tenant_id = $2
ORDER BY consumed_at DESC;

-- name: RecordProductionLog :one
INSERT INTO production_logs (
    tenant_id, work_order_id, warehouse_id, quantity, notes, recorded_by
) VALUES (
    $1, $2, $3, $4, $5, $6
) RETURNING id, tenant_id, work_order_id, warehouse_id, quantity, produced_at, recorded_by, notes;

-- name: ListWorkOrders :many
SELECT id, tenant_id, wo_number, bom_id, product_id, sales_order_id, status, planned_quantity, produced_quantity, start_date, end_date, created_by, created_at, updated_at, production_order_id, operation_type, sequence, machine_id, scheduled_start, scheduled_end
FROM work_orders
WHERE tenant_id = $1
ORDER BY created_at DESC;

-- name: ListWorkOrdersByProductionOrder :many
SELECT id, tenant_id, wo_number, bom_id, product_id, sales_order_id, status, planned_quantity, produced_quantity, start_date, end_date, created_by, created_at, updated_at, production_order_id, operation_type, sequence, machine_id, scheduled_start, scheduled_end
FROM work_orders
WHERE production_order_id = $1 AND tenant_id = $2
ORDER BY sequence ASC, created_at ASC;

-- name: GetWorkOrder :one
SELECT id, tenant_id, wo_number, bom_id, product_id, sales_order_id, status, planned_quantity, produced_quantity, start_date, end_date, created_by, created_at, updated_at, production_order_id, operation_type, sequence, machine_id, scheduled_start, scheduled_end
FROM work_orders
WHERE id = $1 AND tenant_id = $2;

-- name: UpdateWorkOrderStatus :exec
UPDATE work_orders
SET status = $1, updated_at = CURRENT_TIMESTAMP
WHERE id = $2 AND tenant_id = $3;

-- name: UpdateWorkOrderProducedQty :exec
UPDATE work_orders
SET produced_quantity = produced_quantity + $1, updated_at = CURRENT_TIMESTAMP
WHERE id = $2 AND tenant_id = $3;

-- Production lines
-- name: CreateProductionLine :one
INSERT INTO production_lines (tenant_id, name, description)
VALUES ($1, $2, $3)
RETURNING id, tenant_id, name, description, created_at;

-- name: ListProductionLines :many
SELECT id, tenant_id, name, description, created_at
FROM production_lines
WHERE tenant_id = $1
ORDER BY name ASC;

-- name: GetProductionLine :one
SELECT id, tenant_id, name, description, created_at
FROM production_lines
WHERE id = $1 AND tenant_id = $2;

-- Production orders
-- name: CreateProductionOrder :one
INSERT INTO production_orders (tenant_id, po_number, product_id, quantity, start_date, end_date, production_line_id, status, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING id, tenant_id, po_number, product_id, quantity, start_date, end_date, production_line_id, status, created_by, created_at, updated_at;

-- name: ListProductionOrders :many
SELECT id, tenant_id, po_number, product_id, quantity, start_date, end_date, production_line_id, status, created_by, created_at, updated_at
FROM production_orders
WHERE tenant_id = $1
ORDER BY created_at DESC;

-- name: GetProductionOrder :one
SELECT id, tenant_id, po_number, product_id, quantity, start_date, end_date, production_line_id, status, created_by, created_at, updated_at
FROM production_orders
WHERE id = $1 AND tenant_id = $2;

-- name: UpdateProductionOrderStatus :exec
UPDATE production_orders
SET status = $1, updated_at = CURRENT_TIMESTAMP
WHERE id = $2 AND tenant_id = $3;

-- Machines
-- name: CreateMachine :one
INSERT INTO machines (tenant_id, production_line_id, name)
VALUES ($1, $2, $3)
RETURNING id, tenant_id, production_line_id, name, created_at;

-- name: ListMachines :many
SELECT id, tenant_id, production_line_id, name, created_at
FROM machines
WHERE tenant_id = $1
ORDER BY name ASC;

-- name: ListMachinesByProductionLine :many
SELECT id, tenant_id, production_line_id, name, created_at
FROM machines
WHERE tenant_id = $1 AND production_line_id = $2
ORDER BY name ASC;

-- Quality inspections
-- name: CreateQualityInspection :one
INSERT INTO quality_inspections (tenant_id, work_order_id, result, inspector_id, notes, inspected_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, tenant_id, work_order_id, result, inspector_id, notes, inspected_at, created_at;

-- name: ListQualityInspectionsByWorkOrder :many
SELECT id, tenant_id, work_order_id, result, inspector_id, notes, inspected_at, created_at
FROM quality_inspections
WHERE work_order_id = $1 AND tenant_id = $2
ORDER BY inspected_at DESC;

-- BOM items (for MRP and UI)
-- name: ListBOMItemsByBOM :many
SELECT id, tenant_id, bom_id, component_product_id, quantity, instructions, created_at
FROM bom_items
WHERE bom_id = $1 AND tenant_id = $2
ORDER BY created_at ASC;

-- name: GetBOMByProduct :one
SELECT id, tenant_id, product_id, name, version, is_active, created_at, updated_at
FROM bom
WHERE tenant_id = $1 AND product_id = $2 AND is_active = TRUE
ORDER BY updated_at DESC
LIMIT 1;
