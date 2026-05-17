-- name: InsertCustomer :one
INSERT INTO customers (
    display_name,
    normalized_name,
    phone_number,
    normalized_phone,
    whatsapp_number,
    normalized_whatsapp,
    email,
    gst_number,
    normalized_gst,
    company_name,
    notes,
    is_active
) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE
)
RETURNING *;

-- name: GetCustomerByID :one
SELECT *
FROM customers
WHERE id = $1;

-- name: GetCustomerByNormalizedPhone :one
SELECT *
FROM customers
WHERE normalized_phone = $1
LIMIT 1;

-- name: GetCustomerByNormalizedWhatsApp :one
SELECT *
FROM customers
WHERE normalized_whatsapp = $1
LIMIT 1;

-- name: GetCustomerByNormalizedGST :one
SELECT *
FROM customers
WHERE normalized_gst = $1
LIMIT 1;

-- name: ListCustomersByNormalizedAlias :many
SELECT c.*
FROM customer_aliases a
JOIN customers c ON c.id = a.customer_id
WHERE a.normalized_alias = $1
ORDER BY c.created_at ASC, c.id ASC;

-- name: InsertCustomerAlias :exec
INSERT INTO customer_aliases (
    customer_id,
    alias,
    normalized_alias
) VALUES (
    $1, $2, $3
)
ON CONFLICT (customer_id, normalized_alias) DO NOTHING;

-- name: ListCustomerSearchCandidates :many
SELECT
    sqlc.embed(c),
    COALESCE(alias_match.alias, '') AS matched_alias,
    COALESCE(alias_match.normalized_alias, '') AS matched_normalized_alias,
    CASE
        WHEN c.normalized_name = sqlc.arg('normalized_query')::text THEN 1
        WHEN alias_match.normalized_alias = sqlc.arg('normalized_query')::text THEN 2
        WHEN LOWER(COALESCE(c.company_name, '')) = sqlc.arg('lower_query')::text THEN 3
        WHEN c.normalized_name LIKE sqlc.arg('normalized_query')::text || '%' THEN 4
        WHEN alias_match.customer_id IS NOT NULL THEN 5
        WHEN LOWER(COALESCE(c.company_name, '')) LIKE sqlc.arg('lower_query')::text || '%' THEN 6
        ELSE 7
    END AS match_rank
FROM customers c
LEFT JOIN LATERAL (
    SELECT
        a.customer_id,
        a.alias,
        a.normalized_alias
    FROM customer_aliases a
    WHERE a.customer_id = c.id
      AND sqlc.arg('normalized_query')::text <> ''
      AND (
          a.normalized_alias = sqlc.arg('normalized_query')::text
          OR a.normalized_alias LIKE sqlc.arg('normalized_query')::text || '%'
      )
    ORDER BY
        CASE
            WHEN a.normalized_alias = sqlc.arg('normalized_query')::text THEN 0
            ELSE 1
        END,
        a.created_at ASC,
        a.id ASC
    LIMIT 1
) alias_match ON TRUE
WHERE c.is_active = TRUE
  AND sqlc.arg('normalized_query')::text <> ''
  AND (
      c.normalized_name = sqlc.arg('normalized_query')::text
      OR c.normalized_name LIKE sqlc.arg('normalized_query')::text || '%'
      OR (c.company_name IS NOT NULL AND LOWER(c.company_name) = sqlc.arg('lower_query')::text)
      OR (c.company_name IS NOT NULL AND LOWER(c.company_name) LIKE sqlc.arg('lower_query')::text || '%')
      OR alias_match.customer_id IS NOT NULL
  )
ORDER BY match_rank ASC, c.normalized_name ASC, c.id ASC
LIMIT sqlc.arg('page_limit');

-- name: ListCustomerFuzzyCandidates :many
SELECT
    sqlc.embed(c),
    COALESCE(alias_match.alias, '') AS matched_alias,
    COALESCE(alias_match.normalized_alias, '') AS matched_normalized_alias
FROM customers c
LEFT JOIN LATERAL (
    SELECT
        a.customer_id,
        a.alias,
        a.normalized_alias
    FROM customer_aliases a
    WHERE a.customer_id = c.id
      AND sqlc.arg('normalized_query')::text <> ''
      AND a.normalized_alias LIKE '%' || sqlc.arg('normalized_query')::text || '%'
    ORDER BY a.created_at ASC, a.id ASC
    LIMIT 1
) alias_match ON TRUE
WHERE c.is_active = TRUE
  AND sqlc.arg('normalized_query')::text <> ''
  AND (
      c.normalized_name LIKE '%' || sqlc.arg('normalized_query')::text || '%'
      OR (c.company_name IS NOT NULL AND LOWER(c.company_name) LIKE '%' || sqlc.arg('lower_query')::text || '%')
      OR alias_match.customer_id IS NOT NULL
  )
ORDER BY c.created_at ASC, c.id ASC
LIMIT sqlc.arg('page_limit');
