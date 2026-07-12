#!/usr/bin/env bash
# Install the Stalker skill on the VM's Hermes and register the hourly cron job
# that enqueues a competitor sweep. This is the Hermes "cron capability doing
# real work" for eligibility. Run locally from repo root.
set -euo pipefail

VM_IP="${VM_IP:-98.70.29.145}"
VM_USER="${VM_USER:-azureuser}"
KEY="${KEY:-$HOME/Downloads/hermes_key.pem}"
SSH="ssh -i $KEY -o StrictHostKeyChecking=no $VM_USER@$VM_IP"
CONVEX_URL="${CONVEX_URL:?Set CONVEX_URL before running}"

echo "==> Copying stalker skill to ~/.hermes/skills/stalker"
rsync -az -e "ssh -i $KEY -o StrictHostKeyChecking=no" \
  ./hermes/skills/stalker \
  "$VM_USER@$VM_IP:/home/$VM_USER/.hermes/skills/"

echo "==> Installing convex dep for the skill + exporting CONVEX_URL"
$SSH bash -s <<REMOTE
set -euo pipefail
cd ~/.hermes/skills/stalker/scripts
npm init -y >/dev/null 2>&1 || true
npm install convex@^1.42.1 --no-audit --no-fund
# Persist CONVEX_URL for skill + cron scripts.
grep -q '^CONVEX_URL=' ~/.hermes/.env 2>/dev/null || echo "CONVEX_URL=$CONVEX_URL" >> ~/.hermes/.env
REMOTE

echo "==> Registering hourly Hermes cron (enqueues a sweep)"
# Hermes cron runs a pre-run script whose job is to enqueue the sweep. Using a
# script keeps the cron deterministic and cheap (no agent turn needed).
$SSH bash -s <<REMOTE
set -euo pipefail
export CONVEX_URL="$CONVEX_URL"
cd ~/.hermes/hermes-agent
# 'hermes cron add' — hourly, runs the enqueue script. no-agent so it's just the script.
~/.hermes/bin/hermes cron add \
  --schedule "0 * * * *" \
  --name "stalker-hourly-sweep" \
  --script "node ~/.hermes/skills/stalker/scripts/stalker.mjs sweep" \
  --no-agent 2>&1 || \
  echo "If 'hermes cron add' flags differ, run: hermes cron --help and adjust."
~/.hermes/bin/hermes cron list 2>&1 | head -20 || true
REMOTE

echo "==> Done. Hourly sweep enqueues to Convex; the orchestrator picks it up."
