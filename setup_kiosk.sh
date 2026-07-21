#!/bin/bash
# HeatWatch 3 — Dynamic Autostart Setup Script for Raspberry Pi

CURR_DIR="$PWD"
CURR_USER="$USER"
NODE_PATH=$(which node || echo "/usr/bin/node")
PYTHON_PATH=$(which python3 || echo "/usr/bin/python3")

echo "[HeatWatch 3] Configuring Systemd Services for directory: $CURR_DIR (User: $CURR_USER)"

# 1. Create Dashboard Server Service
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

# 2. Create Python Data Poller Service
cat << EOF | sudo tee /etc/systemd/system/heatwatch-poller.service > /dev/null
[Unit]
Description=HeatWatch 3 Temperature Data Poller
After=network.target

[Service]
User=$CURR_USER
WorkingDirectory=$CURR_DIR
ExecStart=$PYTHON_PATH poller.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 3. Reload Systemd and Start Both Services Immediately
sudo systemctl daemon-reload
sudo systemctl enable --now heatwatch-dashboard heatwatch-poller

# 4. Configure Desktop Kiosk Autostart (Bypassing Keyring Password Prompts)
AUTOSTART_DIR="$HOME/.config/autostart"
DESKTOP_FILE="$AUTOSTART_DIR/heatwatch-kiosk.desktop"

mkdir -p "$AUTOSTART_DIR"

cat > "$DESKTOP_FILE" << 'EOF'
[Desktop Entry]
Type=Application
Name=HeatWatch 3 Kiosk
Exec=/bin/bash -c "sleep 4 && chromium --noerrdialogs --disable-infobars --password-store=basic --no-first-run --disable-session-crashed-bubble --fast --fast-start --kiosk --app=http://localhost:3001"
X-GNOME-Autostart-enabled=true
EOF

chmod +x "$DESKTOP_FILE"

# 5. Clear Chromium Keyring Lock if Present
rm -rf ~/.config/chromium/Default/Login\ Data* 2>/dev/null

echo "[HeatWatch 3] Services started & Kiosk autostart (Keyring Bypass) configured successfully!"
