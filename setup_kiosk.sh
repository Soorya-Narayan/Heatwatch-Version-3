#!/bin/bash
# HeatWatch 3 — Kiosk Autostart Setup Script for Raspberry Pi

AUTOSTART_DIR="$HOME/.config/autostart"
DESKTOP_FILE="$AUTOSTART_DIR/heatwatch-kiosk.desktop"

echo "[HeatWatch 3] Configuring Kiosk Autostart..."

mkdir -p "$AUTOSTART_DIR"

cat > "$DESKTOP_FILE" << 'EOF'
[Desktop Entry]
Type=Application
Name=HeatWatch 3 Kiosk
Exec=/bin/bash -c "sleep 5 && chromium --noerrdialogs --disable-infobars --kiosk --app=http://localhost:3001"
X-GNOME-Autostart-enabled=true
EOF

chmod +x "$DESKTOP_FILE"

echo "[HeatWatch 3] Kiosk autostart successfully created at: $DESKTOP_FILE"
