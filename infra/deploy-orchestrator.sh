#!/usr/bin/env bash
# Deploy the orchestrator (and convex-backend generated types) to the Hermes VM
# and run it as a systemd service. Run locally from repo root.
#   KEY=~/Downloads/hermes_key.pem ./infra/deploy-orchestrator.sh
set -euo pipefail

VM_IP="${VM_IP:-98.70.29.145}"
VM_USER="${VM_USER:-azureuser}"
KEY="${KEY:-$HOME/Downloads/hermes_key.pem}"
REMOTE_DIR="/home/$VM_USER/stalker-hermes"
SSH="ssh -i $KEY -o StrictHostKeyChecking=no $VM_USER@$VM_IP"

echo "==> Syncing repo to $VM_USER@$VM_IP:$REMOTE_DIR"
# Requires generated Convex types present locally (run `npx convex dev` once first).
rsync -az --delete \
  -e "ssh -i $KEY -o StrictHostKeyChecking=no" \
  --exclude node_modules --exclude .git --exclude dashboard/dist \
  ./orchestrator ./convex-backend ./package.json \
  "$VM_USER@$VM_IP:$REMOTE_DIR/"

echo "==> Installing deps + Node 20 on the VM (if missing)"
$SSH bash -s <<'REMOTE'
set -euo pipefail
cd ~/stalker-hermes
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
cd orchestrator && npm install --no-audit --no-fund
REMOTE

echo "==> Installing systemd unit"
# .env must already exist at $REMOTE_DIR/orchestrator/.env (see infra/env note).
$SSH "sudo tee /etc/systemd/system/stalker-orch.service >/dev/null" <<UNIT
[Unit]
Description=Stalker Hermes orchestrator
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$VM_USER
WorkingDirectory=$REMOTE_DIR/orchestrator
EnvironmentFile=$REMOTE_DIR/orchestrator/.env
ExecStart=/usr/bin/node --import tsx/esm src/index.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

$SSH "sudo systemctl daemon-reload && sudo systemctl enable --now stalker-orch && sleep 2 && sudo systemctl status stalker-orch --no-pager | head -20"
echo "==> Done. Tail logs with: $SSH 'journalctl -u stalker-orch -f'"
