DROP INDEX IF EXISTS idx_purchase_orders_item_id;
DROP INDEX IF EXISTS idx_purchase_orders_status_created_at;
DROP TABLE IF EXISTS purchase_orders;
DROP TYPE IF EXISTS purchase_order_status;

-- PostgreSQL does not support removing an enum value in-place.
-- 'PURCHASE_ORDER' remains in tx_reference_type on rollback.
