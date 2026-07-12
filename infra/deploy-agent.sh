#!/usr/bin/env bash
# Deploy the Python agent to the Hermes VM and run it as a systemd service
# (the runQueue subscriber). Run locally from repo root.
#   KEY=~/Downloads/hermes_key.pem ./infra/deploy-agent.sh
set -euo pipefail

VM_IP="${VM_IP:-98.70.29.145}"
VM_USER="${VM_USER:-azureuser}"
KEY="${KEY:-$HOME/Downloads/hermes_key.pem}"
REMOTE_DIR="/home/$VM_USER/stalker-hermes"
SSH="ssh -i $KEY -o StrictHostKeyChecking=no $VM_USER@$VM_IP"

echo "==> Syncing agent + .env to $VM_USER@$VM_IP:$REMOTE_DIR"
rsync -az --delete \
  -e "ssh -i $KEY -o StrictHostKeyChecking=no" \
  --exclude '.venv' --exclude '__pycache__' --exclude '*.egg-info' \
  ./agent "$VM_USER@$VM_IP:$REMOTE_DIR/"
# .env carries all secrets; copy it explicitly (rsync of repo root would be heavy).
scp -i "$KEY" -o StrictHostKeyChecking=no ./.env "$VM_USER@$VM_IP:$REMOTE_DIR/.env"

echo "==> Installing uv + Python deps on the VM"
$SSH bash -s <<'REMOTE'
set -euo pipefail
cd ~/stalker-hermes/agent
if ! command -v uv >/dev/null; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
  export PATH="$HOME/.local/bin:$PATH"
fi
export PATH="$HOME/.local/bin:$PATH"
uv venv --python 3.12 .venv 2>/dev/null || true
uv pip install -e . >/dev/null
# .env lives one level up (repo root on the VM); symlink so config.py finds it.
ln -sf ~/stalker-hermes/.env ~/stalker-hermes/agent/../.env 2>/dev/null || true
echo "deps installed"
REMOTE

echo "==> Running Alembic migration (creates tables)"
$SSH bash -s <<'REMOTE'
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
cd ~/stalker-hermes/agent
# Autogenerate initial migration if none exists, then upgrade.
if [ -z "$(ls migrations/versions/*.py 2>/dev/null)" ]; then
  .venv/bin/alembic revision --autogenerate -m "initial" || true
fi
.venv/bin/alembic upgrade head || .venv/bin/python -m stalker.cli initdb
echo "db ready"
REMOTE

echo "==> Installing systemd unit stalker-agent"
$SSH "sudo tee /etc/systemd/system/stalker-agent.service >/dev/null" <<UNIT
[Unit]
Description=Stalker Hermes agent (runQueue subscriber)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$VM_USER
WorkingDirectory=$REMOTE_DIR/agent
ExecStart=$REMOTE_DIR/agent/.venv/bin/python -m stalker.cli serve
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

$SSH "sudo systemctl daemon-reload && sudo systemctl enable --now stalker-agent && sleep 2 && sudo systemctl status stalker-agent --no-pager | head -18"
echo "==> Done. Tail logs: $SSH 'journalctl -u stalker-agent -f'"
