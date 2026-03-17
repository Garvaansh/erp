#!/usr/bin/env bash
# Run all pending migrations on the database using goose.
# Uses .env in erp-backend for DB connection. Applies 00001 through latest
# (e.g. 00031 enterprise schema; see migrations/ and docs/SCHEMA_ENTERPRISE_SAP_STYLE.md).
#
# Prerequisite: install goose
#   go install github.com/pressly/goose/v3/cmd/goose@latest
#
# Usage: from repo root or erp-backend:
#   cd erp-backend && bash scripts/migrate-all.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/.."

if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

DB_USER="${DB_USER:-erp_user}"
DB_PASSWORD="${DB_PASSWORD:-Admin2590!}"
DB_HOST="${DB_HOST:-161.118.161.118}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-reva_erp}"

DSN="postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable"

# Find goose: PATH, then $GOPATH/bin, then $HOME/go/bin
GOOSE=""
if command -v goose >/dev/null 2>&1; then
  GOOSE=goose
else
  for dir in "${GOPATH:-$HOME/go}/bin" "$HOME/go/bin"; do
    if [ -x "$dir/goose" ]; then
      GOOSE="$dir/goose"
      break
    fi
  done
fi
if [ -z "$GOOSE" ]; then
  echo "goose not found. Install with:"
  echo "  go install github.com/pressly/goose/v3/cmd/goose@latest"
  echo "Then ensure goose is in PATH or in \$GOPATH/bin / \$HOME/go/bin."
  exit 1
fi

echo "Running all pending migrations on ${DB_HOST}:${DB_PORT}/${DB_NAME}..."
"$GOOSE" -dir migrations postgres "$DSN" up
echo "Done."
