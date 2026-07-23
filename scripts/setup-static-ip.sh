#!/bin/bash
# HeatWatch 3 - Static IP Configuration Script for Raspberry Pi 5 (NetworkManager)
# Usage: sudo bash scripts/setup-static-ip.sh [IP_ADDRESS] [GATEWAY]

STATIC_IP="${1:-192.168.1.140/24}"
GATEWAY="${2:-192.168.1.1}"
DNS="8.8.8.8,1.1.1.1"

echo "=========================================================="
echo " HeatWatch 3 — Static IP Configuration Setup"
echo "=========================================================="
echo "Configuring static IP: $STATIC_IP"
echo "Gateway: $GATEWAY"
echo "DNS: $DNS"
echo "=========================================================="

if [ "$EUID" -ne 0 ]; then
  echo "[ERROR] Please run as root: sudo bash scripts/setup-static-ip.sh"
  exit 1
fi

# Find active ethernet or wifi connection name
CONN_NAME=$(nmcli -t -f NAME,DEVICE connection show --active | grep -v '^lo' | head -n 1 | cut -d: -f1)

if [ -z "$CONN_NAME" ]; then
    CONN_NAME=$(nmcli -t -f NAME connection show | head -n 1)
fi

if [ -z "$CONN_NAME" ]; then
    echo "[ERROR] No NetworkManager connection found."
    exit 1
fi

echo "Target Network Connection: $CONN_NAME"

# Apply static IP configuration
nmcli connection modify "$CONN_NAME" \
    ipv4.method manual \
    ipv4.addresses "$STATIC_IP" \
    ipv4.gateway "$GATEWAY" \
    ipv4.dns "$DNS"

echo "Applying network configuration..."
nmcli connection up "$CONN_NAME"

echo "=========================================================="
echo "[SUCCESS] Static IP set to $STATIC_IP"
echo "HeatWatch 3 Dashboard URL: http://${STATIC_IP%/*}:3001"
echo "=========================================================="
