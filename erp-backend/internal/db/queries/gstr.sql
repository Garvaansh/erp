-- GSTR-ready: outward supplies (sales) by invoice date with line-level HSN and tax (GSTR-1 style)
-- name: ListOutwardSuppliesByDateRange :many
SELECT
  i.id AS invoice_id,
  i.invoice_number,
  i.invoice_date,
  i.place_of_supply_state,
  i.invoice_type,
  i.total_amount AS invoice_total,
  i.cgst_total,
  i.sgst_total,
  i.igst_total,
  c.id AS customer_id,
  c.name AS customer_name,
  c.gstin AS customer_gstin,
  li.id AS line_id,
  li.description,
  li.quantity,
  li.unit_price,
  li.total_line,
  li.hsn_sac,
  li.taxable_value,
  li.cgst,
  li.sgst,
  li.igst
FROM invoices i
JOIN customers c ON c.id = i.customer_id AND c.tenant_id = i.tenant_id
JOIN invoice_line_items li ON li.invoice_id = i.id AND li.tenant_id = i.tenant_id
WHERE i.tenant_id = $1
  AND i.invoice_date >= $2::date
  AND i.invoice_date < ($3::date + INTERVAL '1 day')
  AND i.status != 'CANCELLED'
ORDER BY i.invoice_date ASC, i.invoice_number ASC, li.sort_order ASC, li.id ASC;

-- GSTR-ready: inward supplies (purchase) by vendor invoice date (no line-level HSN on vendor_invoices yet)
-- name: ListInwardSuppliesByDateRange :many
SELECT
  vi.id AS vendor_invoice_id,
  vi.invoice_number,
  vi.invoice_date,
  vi.total_amount,
  vi.tds_section,
  vi.tds_rate,
  vi.tds_amount,
  vi.status,
  v.id AS vendor_id,
  v.name AS vendor_name,
  v.gstin AS vendor_gstin
FROM vendor_invoices vi
JOIN vendors v ON v.id = vi.vendor_id AND v.tenant_id = vi.tenant_id
WHERE vi.tenant_id = $1
  AND vi.invoice_date >= $2::date
  AND vi.invoice_date < ($3::date + INTERVAL '1 day')
  AND vi.status != 'CANCELLED'
ORDER BY vi.invoice_date ASC, vi.invoice_number ASC;

-- Sales summary by HSN for a date range (GSTR-1 table 12 style)
-- name: ListSalesSummaryByHSN :many
SELECT
  COALESCE(li.hsn_sac, '') AS hsn_sac,
  COUNT(DISTINCT i.id)::int AS invoice_count,
  SUM(li.quantity)::DECIMAL AS total_quantity,
  SUM(COALESCE(li.taxable_value, li.total_line))::DECIMAL AS total_taxable_value,
  SUM(COALESCE(li.cgst, 0))::DECIMAL AS total_cgst,
  SUM(COALESCE(li.sgst, 0))::DECIMAL AS total_sgst,
  SUM(COALESCE(li.igst, 0))::DECIMAL AS total_igst
FROM invoices i
JOIN invoice_line_items li ON li.invoice_id = i.id AND li.tenant_id = i.tenant_id
WHERE i.tenant_id = $1
  AND i.invoice_date >= $2::date
  AND i.invoice_date < ($3::date + INTERVAL '1 day')
  AND i.status != 'CANCELLED'
GROUP BY COALESCE(li.hsn_sac, '')
ORDER BY hsn_sac;
