-- +goose Up
CREATE TABLE warehouse_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, warehouse_id, code)
);

CREATE TABLE warehouse_racks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID NOT NULL REFERENCES warehouse_zones(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(zone_id, code)
);

CREATE TABLE warehouse_shelves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rack_id UUID NOT NULL REFERENCES warehouse_racks(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rack_id, code)
);

CREATE TABLE warehouse_bins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shelf_id UUID NOT NULL REFERENCES warehouse_shelves(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(shelf_id, code)
);

CREATE INDEX idx_warehouse_zones_tenant_warehouse ON warehouse_zones(tenant_id, warehouse_id);
CREATE INDEX idx_warehouse_racks_zone ON warehouse_racks(zone_id);
CREATE INDEX idx_warehouse_shelves_rack ON warehouse_shelves(rack_id);
CREATE INDEX idx_warehouse_bins_shelf ON warehouse_bins(shelf_id);

-- +goose Down
DROP INDEX IF EXISTS idx_warehouse_bins_shelf;
DROP INDEX IF EXISTS idx_warehouse_shelves_rack;
DROP INDEX IF EXISTS idx_warehouse_racks_zone;
DROP INDEX IF EXISTS idx_warehouse_zones_tenant_warehouse;
DROP TABLE IF EXISTS warehouse_bins;
DROP TABLE IF EXISTS warehouse_shelves;
DROP TABLE IF EXISTS warehouse_racks;
DROP TABLE IF EXISTS warehouse_zones;
