-- +goose Up
-- India GST/TDS and invoicing (Phase 1)

-- Company profile: state code (2-digit for GST), TAN for TDS
ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS state_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS tan VARCHAR(50);

-- Customers: GSTIN, place of supply state, PAN
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS gstin VARCHAR(50),
  ADD COLUMN IF NOT EXISTS place_of_supply_state VARCHAR(10),
  ADD COLUMN IF NOT EXISTS pan VARCHAR(20);

-- Vendors: GSTIN, PAN (for TDS and compliance)
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS gstin VARCHAR(50),
  ADD COLUMN IF NOT EXISTS pan VARCHAR(20);

-- Products: HSN/SAC code and default GST rate
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS hsn_sac VARCHAR(20),
  ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5, 2);

-- Sales invoices: place of supply, invoice type, GST totals
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS place_of_supply_state VARCHAR(10),
  ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(30) NOT NULL DEFAULT 'TAX_INVOICE',
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS cgst_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_total DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_total DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- Invoice line items: HSN/SAC and tax breakdown per line
ALTER TABLE invoice_line_items
  ADD COLUMN IF NOT EXISTS hsn_sac VARCHAR(20),
  ADD COLUMN IF NOT EXISTS taxable_value DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS cgst DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst DECIMAL(15, 2) NOT NULL DEFAULT 0;

-- Vendor invoices: TDS (India)
ALTER TABLE vendor_invoices
  ADD COLUMN IF NOT EXISTS tds_section VARCHAR(20),
  ADD COLUMN IF NOT EXISTS tds_rate DECIMAL(5, 2),
  ADD COLUMN IF NOT EXISTS tds_amount DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS tds_paid_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS challan_number VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_date ON invoices(tenant_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_tenant_date ON vendor_invoices(tenant_id, invoice_date DESC);

-- +goose Down
ALTER TABLE company_profiles DROP COLUMN IF EXISTS state_code, DROP COLUMN IF EXISTS tan;
ALTER TABLE customers DROP COLUMN IF EXISTS gstin, DROP COLUMN IF EXISTS place_of_supply_state, DROP COLUMN IF EXISTS pan;
ALTER TABLE vendors DROP COLUMN IF EXISTS gstin, DROP COLUMN IF EXISTS pan;
ALTER TABLE products DROP COLUMN IF EXISTS hsn_sac, DROP COLUMN IF EXISTS gst_rate;
ALTER TABLE invoices DROP COLUMN IF EXISTS place_of_supply_state, DROP COLUMN IF EXISTS invoice_type,
  DROP COLUMN IF EXISTS subtotal, DROP COLUMN IF EXISTS cgst_total, DROP COLUMN IF EXISTS sgst_total, DROP COLUMN IF EXISTS igst_total;
ALTER TABLE invoice_line_items DROP COLUMN IF EXISTS hsn_sac, DROP COLUMN IF EXISTS taxable_value,
  DROP COLUMN IF EXISTS cgst, DROP COLUMN IF EXISTS sgst, DROP COLUMN IF EXISTS igst;
ALTER TABLE vendor_invoices DROP COLUMN IF EXISTS tds_section, DROP COLUMN IF EXISTS tds_rate,
  DROP COLUMN IF EXISTS tds_amount, DROP COLUMN IF EXISTS tds_paid_at, DROP COLUMN IF EXISTS challan_number;
DROP INDEX IF EXISTS idx_invoices_tenant_date;
DROP INDEX IF EXISTS idx_vendor_invoices_tenant_date;
