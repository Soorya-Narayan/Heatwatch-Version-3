#!/bin/bash
# HeatWatch 3 — Full Autostart Setup Script for Raspberry Pi

echo "[HeatWatch 3] Setting up Automatic Background Services & Kiosk Boot..."

# 1. Install & Enable Systemd Backend Services
if [ -f "systemd/heatwatch-dashboard.service" ]; then
  sudo cp systemd/heatwatch-dashboard.service /etc/systemd/system/
  sudo cp systemd/heatwatch-poller.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now heatwatch-dashboard heatwatch-poller
  echo "[HeatWatch 3] Background server & poller services enabled!"
fi

# 2. Configure Desktop Kiosk Autostart
AUTOSTART_DIR="$HOME/.config/autostart"
DESKTOP_FILE="$AUTOSTART_DIR/heatwatch-kiosk.desktop"

mkdir -p "$AUTOSTART_DIR"

cat > "$DESKTOP_FILE" << 'EOF'
[Desktop Entry]
Type=Application
Name=HeatWatch 3 Kiosk
Comment=Auto-launch HeatWatch kiosk screen on desktop startup
Exec=/bin/bash -c "sleep 4 && chromium --noerrdialogs --disable-infobars --kiosk --app=http://localhost:3001"
X-GNOME-Autostart-enabled=true
EOF

chmod +x "$DESKTOP_FILE"

echo "[HeatWatch 3] Desktop Kiosk Autostart configured at: $DESKTOP_FILE"
echo "[HeatWatch 3] COMPLETE! Next time your Raspberry Pi boots up, the screen will open HeatWatch automatically."
