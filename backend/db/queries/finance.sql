-- name: GetFinancePayablesRows :many
WITH payment_totals AS (
    SELECT
        p.po_id,
        COALESCE(SUM(p.amount), 0)::numeric AS total_paid,
        MAX(p.payment_date) AS last_payment_date
    FROM purchase_order_payments p
    GROUP BY p.po_id
),

batch_totals AS (
    SELECT
        b.parent_po_id AS po_id,

        -- FIX 1: count ONLY non-reversed batches
        COUNT(*) FILTER (WHERE b.status <> 'REVERSED')::int AS batch_count,

        COALESCE(
            SUM(
                CASE
                    WHEN b.status <> 'REVERSED'
                    THEN b.initial_qty * COALESCE(b.unit_cost, po.unit_price)
                    ELSE 0
                END
            ),
            0
        )::numeric AS received_value
    FROM inventory_batches b
    JOIN purchase_orders po ON po.id = b.parent_po_id
    WHERE b.parent_po_id IS NOT NULL
    GROUP BY b.parent_po_id
),

po_financials AS (
    SELECT
        po.id AS po_id,
        po.po_number,
        po.vendor_id,

        -- FIX 2: safer join (vendor might be missing edge case)
        COALESCE(v.name, '') AS vendor_name,
        COALESCE(v.vendor_code, '') AS vendor_code,

        CASE
            WHEN COALESCE(bt.batch_count, 0) > 0
            THEN COALESCE(bt.received_value, 0)
            ELSE (COALESCE(po.received_qty, 0) * COALESCE(po.unit_price, 0))
        END::numeric AS total_value,

        COALESCE(pt.total_paid, 0)::numeric AS total_paid,
        pt.last_payment_date

    FROM purchase_orders po
    LEFT JOIN vendors v ON v.id = po.vendor_id
    LEFT JOIN batch_totals bt ON bt.po_id = po.id
    LEFT JOIN payment_totals pt ON pt.po_id = po.id
),

unpaid_pos AS (
    SELECT
        pf.po_id,
        pf.po_number,
        pf.vendor_id,
        pf.vendor_name,
        pf.vendor_code,

        pf.total_value,
        pf.total_paid,

        GREATEST(pf.total_value - pf.total_paid, 0)::numeric AS total_due,

        CASE
            WHEN pf.total_paid <= 0 THEN 'UNPAID'
            WHEN pf.total_paid < pf.total_value THEN 'PARTIAL'
            ELSE 'PAID'
        END AS payment_status,

        pf.last_payment_date

    FROM po_financials pf
    WHERE GREATEST(pf.total_value - pf.total_paid, 0) > 0
),

vendor_totals AS (
    SELECT
        up.vendor_id,
        up.vendor_name,
        up.vendor_code,

        SUM(up.total_value)::numeric AS total_purchased,
        SUM(up.total_paid)::numeric AS total_paid,
        SUM(up.total_due)::numeric AS total_due

    FROM unpaid_pos up

    -- FIX 3: proper grouping instead of MAX()
    GROUP BY up.vendor_id, up.vendor_name, up.vendor_code

    HAVING SUM(up.total_due) > 0
)

SELECT
    vt.vendor_id,
    vt.vendor_name,
    vt.vendor_code,

    vt.total_purchased,
    vt.total_paid,
    vt.total_due,

    up.po_id,
    up.po_number,
    up.payment_status,

    up.total_value,
    up.total_paid AS po_total_paid,
    up.total_due AS po_total_due,

    up.last_payment_date::timestamptz AS last_payment_date

FROM vendor_totals vt
JOIN unpaid_pos up ON up.vendor_id = vt.vendor_id

ORDER BY
    vt.total_due DESC,
    up.total_due DESC,
    up.po_number ASC;