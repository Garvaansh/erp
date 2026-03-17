-- name: CreateWarehouseZone :one
INSERT INTO warehouse_zones (tenant_id, warehouse_id, code, name)
VALUES ($1, $2, $3, $4)
RETURNING id, tenant_id, warehouse_id, code, name, created_at;

-- name: ListWarehouseZones :many
SELECT id, tenant_id, warehouse_id, code, name, created_at
FROM warehouse_zones
WHERE tenant_id = $1 AND warehouse_id = $2
ORDER BY code ASC;

-- name: GetWarehouseZone :one
SELECT id, tenant_id, warehouse_id, code, name, created_at
FROM warehouse_zones
WHERE id = $1 AND tenant_id = $2;

-- name: CreateWarehouseRack :one
INSERT INTO warehouse_racks (zone_id, code)
VALUES ($1, $2)
RETURNING id, zone_id, code, created_at;

-- name: ListWarehouseRacks :many
SELECT id, zone_id, code, created_at
FROM warehouse_racks
WHERE zone_id = $1
ORDER BY code ASC;

-- name: CreateWarehouseShelf :one
INSERT INTO warehouse_shelves (rack_id, code)
VALUES ($1, $2)
RETURNING id, rack_id, code, created_at;

-- name: ListWarehouseShelves :many
SELECT id, rack_id, code, created_at
FROM warehouse_shelves
WHERE rack_id = $1
ORDER BY code ASC;

-- name: CreateWarehouseBin :one
INSERT INTO warehouse_bins (shelf_id, code)
VALUES ($1, $2)
RETURNING id, shelf_id, code, created_at;

-- name: ListWarehouseBins :many
SELECT id, shelf_id, code, created_at
FROM warehouse_bins
WHERE shelf_id = $1
ORDER BY code ASC;
