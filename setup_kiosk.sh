#!/bin/bash
# HeatWatch 3 — Dynamic Autostart Setup Script for Raspberry Pi

CURR_DIR="$PWD"
CURR_USER="$USER"
NODE_PATH=$(which node || echo "/usr/bin/node")

echo "[HeatWatch 3] Configuring Systemd Service for directory: $CURR_DIR (User: $CURR_USER)"

# 1. Dynamically Create & Start Dashboard Service using tee
cat << EOF | sudo tee /etc/systemd/system/heatwatch-dashboard.service > /dev/null
[Unit]
Description=HeatWatch 3 Dashboard Server
After=network.target

[Service]
User=$CURR_USER
WorkingDirectory=$CURR_DIR
ExecStart=$NODE_PATH server.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 2. Reload Systemd and Start Server Immediately
sudo systemctl daemon-reload
sudo systemctl enable --now heatwatch-dashboard

# 3. Configure Desktop Kiosk Autostart
AUTOSTART_DIR="$HOME/.config/autostart"
DESKTOP_FILE="$AUTOSTART_DIR/heatwatch-kiosk.desktop"

mkdir -p "$AUTOSTART_DIR"

cat > "$DESKTOP_FILE" << 'EOF'
[Desktop Entry]
Type=Application
Name=HeatWatch 3 Kiosk
Exec=/bin/bash -c "sleep 6 && chromium --noerrdialogs --disable-infobars --kiosk --app=http://localhost:3001"
X-GNOME-Autostart-enabled=true
EOF

chmod +x "$DESKTOP_FILE"

echo "[HeatWatch 3] Server service started & Kiosk autostart configured successfully!"
