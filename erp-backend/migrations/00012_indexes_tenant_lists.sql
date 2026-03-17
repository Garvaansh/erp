-- +goose Up
-- Composite indexes for tenant-scoped list queries (ORDER BY created_at DESC)

CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_created ON purchase_orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goods_receipts_tenant_created ON goods_receipts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_invoices_tenant_created ON vendor_invoices(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_orders_tenant_created ON sales_orders(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_created ON invoices(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_tenant_created ON inventory_transactions(tenant_id, created_at DESC);

-- +goose Down
DROP INDEX IF EXISTS idx_purchase_orders_tenant_created;
DROP INDEX IF EXISTS idx_goods_receipts_tenant_created;
DROP INDEX IF EXISTS idx_vendor_invoices_tenant_created;
DROP INDEX IF EXISTS idx_sales_orders_tenant_created;
DROP INDEX IF EXISTS idx_invoices_tenant_created;
DROP INDEX IF EXISTS idx_inventory_transactions_tenant_created;
