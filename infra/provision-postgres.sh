#!/usr/bin/env bash
# Provision Azure Postgres Flexible Server in the hermes-agent RG and print the
# connection env for orchestrator/.env. Run locally (needs az CLI logged in).
set -euo pipefail

RG="${RG:-hermes-agent}"
LOCATION="${LOCATION:-centralindia}"
SERVER="${SERVER:-stalker-pg-$RANDOM}"
ADMIN_USER="${ADMIN_USER:-stalkeradmin}"
ADMIN_PASS="${ADMIN_PASS:-$(openssl rand -base64 18 | tr -d '/+=' )Aa1!}"
DB="${DB:-stalker}"
SKU="${SKU:-Standard_B1ms}"      # burstable, cheap
TIER="${TIER:-Burstable}"
VERSION="${PG_VERSION:-16}"

echo "Creating Postgres flexible server '$SERVER' in '$RG' ($LOCATION)…"
az postgres flexible-server create \
  --resource-group "$RG" \
  --name "$SERVER" \
  --location "$LOCATION" \
  --admin-user "$ADMIN_USER" \
  --admin-password "$ADMIN_PASS" \
  --sku-name "$SKU" \
  --tier "$TIER" \
  --version "$VERSION" \
  --storage-size 32 \
  --database-name "$DB" \
  --public-access 0.0.0.0-255.255.255.255 \
  --yes

HOST="$(az postgres flexible-server show -g "$RG" -n "$SERVER" --query fullyQualifiedDomainName -o tsv)"

# Also allow Azure services (the VM) explicitly.
az postgres flexible-server firewall-rule create \
  --resource-group "$RG" --name "$SERVER" \
  --rule-name allow-azure --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 || true

cat <<EOF

=========================================================
Postgres ready. Add these to orchestrator/.env:

PGHOST=$HOST
PGPORT=5432
PGDATABASE=$DB
PGUSER=$ADMIN_USER
PGPASSWORD=$ADMIN_PASS
PGSSLMODE=require
=========================================================
Store the password now — it is not shown again.
EOF
