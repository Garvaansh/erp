-- name: CreateShipment :one
INSERT INTO shipments (tenant_id, shipment_number, sales_order_id, warehouse_id, carrier_name, tracking_number, status, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id, tenant_id, shipment_number, sales_order_id, warehouse_id, carrier_name, tracking_number, status, shipped_at, delivered_at, created_by, created_at;

-- name: ListShipments :many
SELECT id, tenant_id, shipment_number, sales_order_id, warehouse_id, carrier_name, tracking_number, status, shipped_at, delivered_at, created_by, created_at
FROM shipments
WHERE tenant_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetShipment :one
SELECT id, tenant_id, shipment_number, sales_order_id, warehouse_id, carrier_name, tracking_number, status, shipped_at, delivered_at, created_by, created_at
FROM shipments
WHERE id = $1 AND tenant_id = $2;

-- name: UpdateShipmentStatus :one
UPDATE shipments
SET status = $3
WHERE id = $1 AND tenant_id = $2
RETURNING id, tenant_id, shipment_number, sales_order_id, warehouse_id, carrier_name, tracking_number, status, shipped_at, delivered_at, created_by, created_at;

-- name: CreateShipmentLine :one
INSERT INTO shipment_lines (shipment_id, product_id, quantity)
VALUES ($1, $2, $3)
RETURNING id, shipment_id, product_id, quantity, created_at;

-- name: ListShipmentLines :many
SELECT id, shipment_id, product_id, quantity, created_at
FROM shipment_lines
WHERE shipment_id = $1
ORDER BY id ASC;
