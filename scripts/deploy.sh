#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/frigate-openclaw-notifier}"
ENV_FILE="${ENV_FILE:-/etc/frigate-openclaw-notifier.env}"
SERVICE_NAME="${SERVICE_NAME:-frigate-openclaw-notifier}"
SERVICE_USER="${SERVICE_USER:-$(id -un)}"
SERVICE_GROUP="${SERVICE_GROUP:-$(id -gn)}"
PNPM_BIN="${PNPM_BIN:-$(command -v pnpm)}"
NODE_BIN="${NODE_BIN:-$(node -p 'process.execPath')}"
DEPLOY_PATH="$(dirname "$NODE_BIN"):$PATH"

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOCAL_ENV_FILE="$SRC_DIR/.env"

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  echo "Missing service user: $SERVICE_USER"
  exit 1
fi

if [[ -f "$LOCAL_ENV_FILE" ]]; then
  echo "Updating $ENV_FILE from local .env"
  sudo cp "$LOCAL_ENV_FILE" "$ENV_FILE"
  sudo chown "root:$SERVICE_GROUP" "$ENV_FILE"
  sudo chmod 640 "$ENV_FILE"
else
  echo "Missing local .env: $LOCAL_ENV_FILE"
  echo "Create it from .env.example before deploying."
  exit 1
fi

echo "Syncing source to $APP_DIR"
sudo mkdir -p "$APP_DIR"
sudo find "$APP_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
tar \
  --exclude=node_modules \
  --exclude=dist \
  --exclude=.git \
  --exclude=.env \
  -C "$SRC_DIR" \
  -cf - . | sudo tar -C "$APP_DIR" -xf -

sudo chown -R "$SERVICE_USER:$SERVICE_GROUP" "$APP_DIR"

echo "Installing dependencies"
sudo -u "$SERVICE_USER" env PATH="$DEPLOY_PATH" "$PNPM_BIN" --dir "$APP_DIR" install --frozen-lockfile

echo "Running checks"
sudo -u "$SERVICE_USER" env PATH="$DEPLOY_PATH" "$PNPM_BIN" --dir "$APP_DIR" run check

echo "Installing systemd unit"
UNIT_TMP="$(mktemp)"
sed \
  -e "s|^WorkingDirectory=.*|WorkingDirectory=$APP_DIR|" \
  -e "s|^EnvironmentFile=.*|EnvironmentFile=$ENV_FILE|" \
  -e "s|^Environment=PATH=.*|Environment=PATH=$DEPLOY_PATH|" \
  -e "s|^ExecStart=.*|ExecStart=$NODE_BIN $APP_DIR/dist/src/index.js|" \
  -e "s|^User=.*|User=$SERVICE_USER|" \
  -e "s|^Group=.*|Group=$SERVICE_GROUP|" \
  "$APP_DIR/systemd/$SERVICE_NAME.service" > "$UNIT_TMP"
sudo cp "$UNIT_TMP" "/etc/systemd/system/$SERVICE_NAME.service"
rm -f "$UNIT_TMP"
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"

echo "Restarting $SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl --no-pager --lines=20 status "$SERVICE_NAME"
