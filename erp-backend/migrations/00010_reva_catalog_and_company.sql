-- +goose Up
-- Reva catalog: product brand (RIR, Jindal), company profile, and default product categories

-- Product brand (IndiaMART: RIR manufacturing, Jindal trading)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brand VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_products_tenant_category ON products(tenant_id, category_id);

-- Company profile: one row per tenant (Reva name, address, GST, contact)
CREATE TABLE IF NOT EXISTS company_profiles (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  company_name VARCHAR(255) NOT NULL DEFAULT '',
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(20),
  country VARCHAR(100) DEFAULT 'India',
  gst_number VARCHAR(50),
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_company_profiles_tenant ON company_profiles(tenant_id);

-- Seed default Reva product categories (IndiaMART) for all existing tenants
INSERT INTO product_categories (tenant_id, name, description)
SELECT t.id, cat.name, cat.description
FROM tenants t
CROSS JOIN (
  VALUES
    ('Rubber Profile', 'Extruded rubber profiles, EPDM rubber profile'),
    ('Rubber Seal', 'Stop dam gate seal, dam gate rubber seal, window rubber seal'),
    ('Rubber Beadings', 'RIR rubber beading, industrial rubber beading'),
    ('Rubber Extrusion', 'Rubber extrusion, industrial and high quality'),
    ('Elastomeric Bridge Bearings', 'Bridge bearings, elastomeric types'),
    ('Stainless Steel Pipe', 'Jindal stainless steel round pipes, 202 stainless steel'),
    ('Curtain Rods', 'Curtain rod, stainless steel curtain rod'),
    ('PVC Products', 'Clear PVC rubber and related')
) AS cat(name, description)
WHERE NOT EXISTS (
  SELECT 1 FROM product_categories pc
  WHERE pc.tenant_id = t.id AND pc.name = cat.name
);

-- +goose Down
DROP INDEX IF EXISTS idx_products_tenant_category;
DROP TABLE IF EXISTS company_profiles;
ALTER TABLE products DROP COLUMN IF EXISTS brand;
