# ERP Performance Requirements & Architecture

**Target scale:**
- **1 million users** (concurrent and total)
- **100,000 transactions per hour** (~28 TPS sustained, higher peaks)
- **Real-time analytics** (dashboards, stock levels, alerts)
- **Low latency** (p95 < 200 ms for read APIs; p95 < 500 ms for write APIs where feasible)

---

## 1. Capacity Targets

| Metric | Target | Notes |
|--------|--------|------|
| Concurrent users | 10,000–50,000 | Per tenant and global; session/cache strategy |
| Transactions per hour | 100,000 | Mixed read/write; write-heavy during GRN, SO, PO |
| Transactions per second (peak) | 500–1000 TPS | Burst handling with queue + auto-scaling |
| API latency (p95) | < 200 ms read, < 500 ms write | Excluding export/report generation |
| Real-time analytics | Sub-minute freshness | Dashboards, stock levels, alerts |
| Database size | Billions of rows | Partitioning, archival, read replicas |

---

## 2. Architecture Principles

### 2.1 Current Stack (Baseline)
- **App:** Go (Fiber), SQLC, pgx pool
- **DB:** PostgreSQL (single primary)
- **State/queues:** PostgreSQL (no Redis/Kafka in current design)
- **Frontend:** Next.js

### 2.2 Scaling Path

1. **Vertical:** Larger DB and app instances; connection pooling (pgxpool), statement caching.
2. **Read scaling:** PostgreSQL read replicas; route reporting and list APIs to replicas; primary for writes and strong-consistency reads.
3. **Horizontal app:** Stateless API servers behind load balancer; scale out with traffic.
4. **Async processing:** Long-running or heavy work (exports, notifications, MRP runs) via background jobs (DB-backed queue or worker pool) to keep API latency low.
5. **Caching:**  
   - Tenant settings, product/vendor master cache (short TTL or invalidation on write).  
   - Stock-level and dashboard aggregates (short TTL, e.g. 30–60 s) for real-time feel.  
   - Optional: Redis for session and cache when introducing it later.
6. **Database:**  
   - Partitioning for `audit_logs`, `inventory_transactions`, `report_access_log` by time (e.g. month).  
   - Indexes as in DATABASE_DESIGN.md; avoid over-indexing writes.  
   - Vacuum/analyze and monitoring.

---

## 3. API Layer

- **Connection pooling:** Per-app-instance pgx pool; limit connections per instance so total < DB `max_connections`.
- **Timeouts:** Request timeout (e.g. 30 s); DB query timeout (e.g. 10 s); cancel long-running queries.
- **Rate limiting:** Per-tenant and per-IP (e.g. 15/min for export); return 429 with Retry-After.
- **Idempotency:** For payment and receipt APIs to avoid duplicate processing under retries.
- **Pagination:** Cursor or keyset for large lists to avoid deep offset; limit max page size (e.g. 100).

---

## 4. Database

- **Connection pooling:** PgBouncer or app-side pgxpool; avoid one connection per request.
- **Read replicas:** Replica for: list products, list POs, reports, dashboard queries. Primary for: create/update/delete, stock updates, any read requiring immediate consistency.
- **Queries:** Use SQLC/parameterized queries; avoid N+1; batch where possible (e.g. bulk insert for transactions).
- **Transactions:** Keep write transactions short; do not hold open transactions during external calls.
- **Archival:** Move old `inventory_transactions` and `audit_logs` to archive tables or cold storage; keep recent data hot.

---

## 5. Real-Time Analytics

- **Stock levels / dashboards:**  
  - Option A: Queries against current DB with good indexes and (if needed) materialized views refreshed every 1–5 minutes.  
  - Option B: Pre-aggregate into summary tables updated by application or triggers.  
  - Option C: Stream changes to a separate analytics store (e.g. time-series or OLAP) when scale justifies it.
- **Alerts:** Low stock, approval pending: either polling (cron) or event-driven (after write, enqueue check); push to notification system.
- **Reporting exports:** Async job; notify user when ready (link or email); do not block API for large exports.

---

## 6. Low Latency

- **Critical path:** Auth (JWT validation), tenant resolution, product/vendor by ID, single-document fetch (PO, SO, invoice) — optimize with indexes and minimal JOINs.
- **Heavy operations:** Bulk create, bulk receive, MRP run, large report — run in background; return 202 with job ID.
- **Caching:** Cache tenant settings and static master data (categories, UOM) with invalidation on update.
- **Monitoring:** Track p50/p95/p99 latency per endpoint; alert on SLO breach.

---

## 7. Security & Reliability

- **TLS:** All client–server traffic over TLS.
- **Secrets:** DB credentials and JWT secret in env/secrets manager; never in code.
- **Backups:** Automated daily backups; point-in-time recovery (PITR) where required.
- **Health checks:** Liveness (process up); readiness (DB reachable, pool healthy).
- **Circuit breaker:** For external calls (payment gateway, bank, etc.) to avoid cascading failure.

---

## 8. Monitoring & Observability

- **Metrics:** Request rate, error rate, latency (per route and per tenant optional), DB pool usage, replica lag.
- **Logging:** Structured logs; request ID for tracing; no sensitive data in logs.
- **Alerting:** High error rate, high latency, DB connections exhausted, disk usage, replica lag.
- **Tracing:** Optional distributed tracing for multi-service flows (e.g. API → worker → DB).

---

## 9. Checklist (Summary)

| Requirement | Approach |
|-------------|----------|
| 1M users | Stateless API, horizontal scaling, session/cache strategy, DB read replicas |
| 100k TPS (hourly) | Connection pooling, async for heavy work, read/write split, indexing |
| Real-time analytics | Refreshed aggregates / materialized views / event-driven updates; sub-minute freshness |
| Low latency | Indexes, caching, background jobs for heavy ops, timeouts and limits |
| Compliance | Audit logs, encryption, access control, retention policy |

This document should be used together with the existing architecture (modular monolith, PostgreSQL, no Redis/Kafka initially) and expanded when introducing Redis, message queues, or additional services.
