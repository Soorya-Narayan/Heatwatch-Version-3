#!/bin/bash
# =============================================================================
# HeatWatch 3 — Tailscale Remote Support Setup Script
# Installs Tailscale on the Raspberry Pi and configures it for remote access.
# Run this once on the Pi: sudo bash scripts/setup-tailscale.sh
# =============================================================================

set -e

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║       HeatWatch 3 — Tailscale Remote Support Setup          ║"
echo "║                  Goose Industrial Systems                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}[ERROR] Please run as root: sudo bash scripts/setup-tailscale.sh${NC}"
  exit 1
fi

# ── 1. Install Tailscale ──────────────────────────────────────────────────────
echo -e "${YELLOW}[1/5] Installing Tailscale...${NC}"
if command -v tailscale &>/dev/null; then
  echo -e "${GREEN}  ✓ Tailscale already installed ($(tailscale version | head -1))${NC}"
else
  curl -fsSL https://tailscale.com/install.sh | sh
  echo -e "${GREEN}  ✓ Tailscale installed successfully${NC}"
fi

# ── 2. Enable and Start tailscaled service ─────────────────────────────────────
echo -e "${YELLOW}[2/5] Enabling tailscaled systemd service...${NC}"
systemctl enable --now tailscaled
echo -e "${GREEN}  ✓ tailscaled service enabled and started${NC}"

# ── 3. Bring Tailscale up ─────────────────────────────────────────────────────
echo -e "${YELLOW}[3/5] Connecting to your Tailscale network...${NC}"
echo ""
echo -e "${CYAN}  Authenticate this Pi using the URL shown below:${NC}"
echo ""
tailscale up --ssh --accept-routes --hostname=goosepi-heatwatch 2>&1 || true

echo ""
echo -e "${GREEN}  ✓ Tailscale auth initiated${NC}"

# ── 4. Tailscale IP reporter timer ────────────────────────────────────────────
echo -e "${YELLOW}[4/5] Configuring Tailscale IP reporter for dashboard...${NC}"

cat > /etc/systemd/system/tailscale-ip-reporter.service << 'EOF'
[Unit]
Description=HeatWatch 3 Tailscale IP Reporter
After=tailscaled.service network-online.target

[Service]
Type=oneshot
ExecStart=/bin/bash -c "tailscale ip --4 > /tmp/tailscale_ip.txt 2>/dev/null || echo 'Not connected' > /tmp/tailscale_ip.txt"
RemainAfterExit=yes
EOF

cat > /etc/systemd/system/tailscale-ip-reporter.timer << 'EOF'
[Unit]
Description=Update Tailscale IP every 30 seconds

[Timer]
OnBootSec=10sec
OnUnitActiveSec=30sec
Unit=tailscale-ip-reporter.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now tailscale-ip-reporter.timer
echo -e "${GREEN}  ✓ Tailscale IP reporter timer configured${NC}"

# ── 5. Ensure SSH is enabled ──────────────────────────────────────────────────
echo -e "${YELLOW}[5/5] Ensuring SSH is enabled...${NC}"
systemctl enable --now ssh 2>/dev/null || systemctl enable --now sshd 2>/dev/null || true
echo -e "${GREEN}  ✓ SSH enabled${NC}"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Setup Complete! ✓                        ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
TAILSCALE_IP=$(tailscale ip --4 2>/dev/null || echo "Pending auth...")
echo -e "${CYAN}Remote access URLs (from anywhere in the world):${NC}"
echo -e "  HeatWatch Dashboard : ${YELLOW}http://${TAILSCALE_IP}:3001${NC}"
echo -e "  SSH Access          : ${YELLOW}ssh heatwatch@${TAILSCALE_IP}${NC}"
echo -e "  Machine name        : ${YELLOW}http://goosepi-heatwatch:3001${NC}"
echo ""
echo -e "  tailscale status       (check connection)"
echo ""
