# How to run the Reva migration (00009)

## Permission denied for schema public

If you see **`permission denied for schema public`** when running `migrate-all.sh`, the database user needs permission to create objects in the `public` schema (common on PostgreSQL 15+). On the **PostgreSQL server**, as the `postgres` superuser run:

```bash
sudo -i -u postgres
psql -d reva_erp
```

Then in `psql`:

```sql
GRANT ALL ON SCHEMA public TO erp_user;
GRANT CREATE ON SCHEMA public TO erp_user;
\q
```

After that, run `migrate-all.sh` again from your machine.

---

## Fresh database? Run all migrations first

If you see **`relation "vendors" does not exist`** (or any "relation does not exist" error), the database is empty. Migration 00009 only adds columns and one table; it expects the base schema (auth, inventory, purchase, sales, etc.) to already exist.

**Fix:** run all migrations in order with goose:

```bash
cd erp-backend
bash scripts/migrate-all.sh
```

You need [goose](https://github.com/pressly/goose) installed: `go install github.com/pressly/goose/v3/cmd/goose@latest` (and `$HOME/go/bin` in your PATH). The script will apply 00001 through 00010, including the Reva migration.

---

## What this means

- **Migration** = a SQL file that changes your database (adds tables or columns).  
  The Reva migration adds: `coil_consumption_log` table, and new columns on `products` and `vendors`.

- **“From erp-backend”** = run the command in the **erp-backend** folder (where the `migrations` folder lives).

- **DB DSN** = **D**ata**s**ource **N**ame: the connection string to your PostgreSQL database.  
  Your app already builds it from `.env`:  
  `postgres://DB_USER:DB_PASSWORD@DB_HOST:DB_PORT/DB_NAME?sslmode=disable`  
  With your current `.env`, that is:  
  `postgres://erp_user:Admin2590!@161.118.161.118:5432/reva_erp?sslmode=disable`

---

## Reva-only script (migration 00009 already applied)

If the full schema already exists and you only need to (re-)apply the Reva part (coil_consumption_log, product_type, vendor status_notes), use this script. It reads your `.env` and runs only the “Up” part of migration 00009:

```bash
cd /Users/bhupendra/Documents/rewa/erp-backend
bash scripts/migrate-reva.sh
```

You need `psql` (PostgreSQL client) installed and a running Postgres with the database from `.env` (e.g. `reva_erp`).

---

## Option 1: Run with `psql` (no extra tools)

If you have **PostgreSQL client** (`psql`) installed:

1. Open a terminal.
2. Go to the backend folder:
   ```bash
   cd /Users/bhupendra/Documents/rewa/erp-backend
   ```
3. Run the migration SQL (only the “Up” part). Use the same user/password/host/port/db as in your `.env`:

   ```bash
   psql "postgres://erp_user:Admin2590!@161.118.161.118:5432/reva_erp?sslmode=disable" -f migrations/00009_reva_domain.sql
   ```

   **Note:** `psql` may run the whole file including the “Down” section. To run **only the Up part** (recommended), use:

   ```bash
   psql "postgres://erp_user:Admin2590!@161.118.161.118:5432/reva_erp?sslmode=disable" -f - <<'SQL'
   ALTER TABLE vendors ADD COLUMN IF NOT EXISTS status_notes TEXT;
   ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type VARCHAR(100), ADD COLUMN IF NOT EXISTS stock_status VARCHAR(50), ADD COLUMN IF NOT EXISTS tr_notes TEXT;
   CREATE TABLE IF NOT EXISTS coil_consumption_log (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
     product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
     operation_date DATE NOT NULL,
     starting_kg DECIMAL(12, 4) NOT NULL,
     scrap_kg DECIMAL(12, 4) NOT NULL DEFAULT 0,
     shortlength_kg DECIMAL(12, 4) NOT NULL DEFAULT 0,
     used_kg DECIMAL(12, 4) NOT NULL,
     remaining_kg DECIMAL(12, 4) NOT NULL,
     coil_ended BOOLEAN NOT NULL DEFAULT FALSE,
     notes TEXT,
     created_by UUID REFERENCES users(id) ON DELETE SET NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
   );
   CREATE INDEX IF NOT EXISTS idx_coil_log_tenant_date ON coil_consumption_log(tenant_id, operation_date DESC);
   CREATE INDEX IF NOT EXISTS idx_coil_log_product ON coil_consumption_log(tenant_id, product_id, operation_date DESC);
   SQL
   ```

   Or run the **Up** section only from the file (e.g. lines 5–31) in your SQL client (pgAdmin, DBeaver, etc.) if you prefer a GUI.

4. If your `.env` has different values, replace in the URL:
   - `erp_user` (before `:`) → your `DB_USER`
   - `Admin2590!` (after `:`) → your `DB_PASSWORD`
   - `161.118.161.118` → your `DB_HOST`
   - `5432` → your `DB_PORT`
   - `reva_erp` → your `DB_NAME`

---

## Option 2: Run with Goose (migration tool)

If you use [goose](https://github.com/pressly/goose) and want to run all migrations from the `migrations` folder:

1. Install goose (e.g. `go install github.com/pressly/goose/v3/cmd/goose@latest`).
2. From **erp-backend**:
   ```bash
   cd /Users/bhupendra/Documents/rewa/erp-backend
   export DB_DSN="postgres://erp_user:Admin2590!@161.118.161.118:5432/reva_erp?sslmode=disable"
   goose -dir migrations postgres "$DB_DSN" up
   ```
   Use your real DB user, password, host, port and database name in `DB_DSN` if they differ from `.env`.

---

## Check that it worked

After running the migration:

- Table exists: `SELECT 1 FROM coil_consumption_log LIMIT 1;`
- New columns on products: `SELECT product_type, stock_status, tr_notes FROM products LIMIT 1;`
- New column on vendors: `SELECT status_notes FROM vendors LIMIT 1;`

If those run without “column/relation does not exist” errors, the migration was applied.
