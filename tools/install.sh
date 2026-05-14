#!/bin/bash

set -e

SERVICE_NAME="iredmail-api"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="/opt/iredmail-api"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

API_PORT="8081"

NODE_PATH="$(command -v node || true)"

if [ -z "$NODE_PATH" ]; then
    echo ""
    echo "ERROR: Node.js is not installed or not in PATH."
    echo ""
    echo "Install with:"
    echo "  apt update"
    echo "  apt install -y nodejs npm"
    echo ""
    exit 1
fi

echo "Using node at: $NODE_PATH"
echo ""

echo "Creating app directory..."
mkdir -p "$APP_DIR"

echo "Copying application files..."
rsync -a \
  --exclude "node_modules" \
  --exclude ".git" \
  "$SOURCE_DIR/" "$APP_DIR/"

echo ""
echo "Installing production dependencies..."
cd "$APP_DIR"
npm install --omit=dev

echo ""
echo "Creating systemd service..."

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=iRedMail REST API
After=network.target mariadb.service

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=$NODE_PATH $APP_DIR/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=$API_PORT
User=root

[Install]
WantedBy=multi-user.target
EOF

echo ""
echo "Reloading systemd..."
systemctl daemon-reload

echo "Enabling service..."
systemctl enable "$SERVICE_NAME"

echo "Starting service..."
systemctl restart "$SERVICE_NAME"

echo ""
echo "Configuring nftables..."
if command -v nft >/dev/null 2>&1; then

    if nft list ruleset | grep -q "tcp dport $API_PORT accept"; then
        echo "nftables rule already exists."
    else
        nft add rule inet filter input tcp dport $API_PORT accept
        echo "Opened TCP port $API_PORT in nftables."
    fi

    if [ -f /etc/nftables.conf ]; then
        echo "Saving nftables configuration..."
        nft list ruleset > /etc/nftables.conf
    fi

else
    echo "WARNING: nft command not found. Firewall rule not added."
fi

echo ""
echo "======================================"
echo "Service installed successfully."
echo "======================================"
echo ""

systemctl status "$SERVICE_NAME" --no-pager || true

echo ""
echo "Useful commands:"
echo "  systemctl restart $SERVICE_NAME"
echo "  systemctl stop $SERVICE_NAME"
echo "  systemctl status $SERVICE_NAME"
echo "  journalctl -u $SERVICE_NAME -f"
echo ""
