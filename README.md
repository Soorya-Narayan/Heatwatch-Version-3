# HeatWatch 3 — Industrial Telemetry Platform

![HeatWatch](https://img.shields.io/badge/Platform-HeatWatch%203-blue)
![Version](https://img.shields.io/badge/Version-3.0.0-green)
![Hardware](https://img.shields.io/badge/Hardware-Raspberry%20Pi%205-red)
![License](https://img.shields.io/badge/License-MIT-yellow)

A real-time industrial temperature monitoring & telemetry platform by **Goose Industrial Solutions**. Monitors 8 RTD PT100 sensors via PPI AIME 8U, stores time-series records in InfluxDB v2, and renders a live telemetry dashboard on Waveshare 7" HDMI display in kiosk mode.

---

## Features

- **Live 8-Channel Telemetry Grid** — Instant WebSocket updates (2s frequency) with status badges (**Normal**, **Warning Hi/Lo**, **Critical HiHi/LoLo**).
- **Interactive Multi-Channel Trends** — Chart.js graph with smooth splines, timeframe presets (1h, 6h, 24h, 7d), and click-to-hide legends.
- **History Query & Export Suite** — Tabular data log viewer with date-range filters and instant export to **CSV**, **Excel (`.xlsx`)**, or **PDF**.
- **Configuration & Threshold Manager** — Edit channel labels and HiHi/Hi/Lo/LoLo threshold limits directly from the dashboard.
- **Hardware Diagnostics** — Live CPU load, CPU temperature, RAM usage, SD disk storage, DB size, and system uptime.
- **Automatic Kiosk Boot** — Single-command setup script to auto-launch fullscreen Chromium kiosk on Pi system startup.

---

## Quick Setup & Autostart Guide

### 1. Install Dependencies
```bash
# Clone & install Node dependencies
git clone https://github.com/Soorya-Narayan/Milma_Kattappana.git HeatWatch3
cd HeatWatch3
npm install

# Setup Python virtual environment
python3 -m venv venv
source venv/bin/activate
pip install requests influxdb-client
```

---

### 2. Enable Automatic Kiosk Boot (On Raspberry Pi Startup)

To automatically launch the **HeatWatch 3** dashboard in fullscreen kiosk mode whenever your Raspberry Pi powers on:

```bash
chmod +x setup_kiosk.sh
./setup_kiosk.sh
```

*(This creates `~/.config/autostart/heatwatch-kiosk.desktop` to open Chromium at `http://localhost:3001` on desktop load).*

---

### 3. Setup Background Systemd Services

To run the backend server and data poller automatically in the background:

```bash
sudo cp systemd/heatwatch-dashboard.service /etc/systemd/system/
sudo cp systemd/heatwatch-poller.service /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable --now heatwatch-dashboard heatwatch-poller
```

---

## Architecture Overview

```
RTD Sensors (x8) — PT100
        ↓
PPI AIME 8U (HTTP/XML over Ethernet @ 192.168.1.2)
        ↓
Raspberry Pi 5 (4GB)
├── Python Poller     → reads AIME 8U / Simulation fallback, writes to InfluxDB
├── InfluxDB v2       → time-series data storage
├── Node.js Server    → WebSocket + REST API on port 3001
└── Chromium Kiosk    → auto-launches fullscreen dashboard on boot
```

---

## License
MIT License
