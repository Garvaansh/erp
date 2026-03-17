# Tenant Onboarding

## Option 1: API (self-service signup)

Any new workspace can be created via the public API:

```bash
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_name": "Acme Corp",
    "first_name": "Admin",
    "last_name": "User",
    "email": "admin@acme.com",
    "password": "your-secure-password"
  }'
```

Response includes `tenant_id` and `user_id`. The first user is automatically assigned the **Admin** role. Tenant configuration (settings, document number series for PO/SO/INV/GRN/WO/VINV, default roles) is seeded automatically.

Users of that tenant then log in with:

```bash
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "<tenant_id from signup>",
    "email": "admin@acme.com",
    "password": "your-secure-password"
  }'
```

Use the returned `token` in the `Authorization: Bearer <token>` header for all protected endpoints.

## Option 2: CLI (provisioning / first tenant)

For provisioning a tenant outside the API (e.g. “Reva” or a customer created by an operator), run the seed command from the backend directory:

```bash
cd erp-backend
export TENANT_NAME="Reva Technologies"
export ADMIN_EMAIL="admin@reva.com"
export ADMIN_PASSWORD="your-secure-password"
# Optional:
# export ADMIN_FIRST_NAME="Admin"
# export ADMIN_LAST_NAME="User"

go run cmd/seed-tenant/main.go
```

Ensure `.env` is loaded (DB connection). The script creates the tenant, the first user, seeds tenant_settings and document_number_series, creates default roles (Admin, Manager, Operator), and assigns the first user to Admin. Log in via the API or the UI using the returned tenant ID and credentials.

## Database migrations

For a **new database** (no schema yet), run all migrations so that tenant_config and other tables exist:

```bash
cd erp-backend
# Install goose: go install github.com/pressly/goose/v3/cmd/goose@latest
bash scripts/migrate-all.sh
```

This applies migrations 00001 through 00012 (auth, inventory, purchase, sales, manufacturing, reporting, tenant config, indexes). If the DB already has schema but is missing newer migrations (e.g. 00011, 00012), run the same command; goose will apply only pending migrations.

## After onboarding

- **Tenant settings**: Authenticated users can `GET /api/v1/tenant/settings` and `PUT /api/v1/tenant/settings` to change display name, currency, locale, timezone.
- **Company profile**: For legal/address and GST (e.g. on invoices), use `GET/PUT /api/v1/reva/company-profile` (one row per tenant).
- **Document numbers**: PO, SO, INV, GRN numbers are generated automatically from `document_number_series` when creating POs, GRNs, invoices, etc.
