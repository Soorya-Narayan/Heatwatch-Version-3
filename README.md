# HeatWatch 3 — Industrial Telemetry Platform

![HeatWatch](https://img.shields.io/badge/Platform-HeatWatch%203-blue)
![Version](https://img.shields.io/badge/Version-3.0.0-green)
![Hardware](https://img.shields.io/badge/Hardware-Raspberry%20Pi%205-red)
![License](https://img.shields.io/badge/License-MIT-yellow)

Next-generation industrial temperature monitoring & telemetry platform by **Goose Industrial Solutions**.

---

## Features & Workflow

1. **Apple-Inspired First Boot Wizard**:
   - Breathing logo ambient greeting.
   - User profile & login credential configuration.
   - 8 RTD sensor names & threshold limits setup (HiHi, Hi, Lo, LoLo).
   - Review & Welcome confirmation screen.
2. **Main Dashboard Screen**:
   - Navbar with **Goose Logo** (Left), **HeatWatch** title (Center), and **Settings & Navigation** menu (Right).
   - Real-time 8-channel telemetry grid with live WebSocket readings from PPI AIME 8U.
3. **Settings & Navigation Drawer**:
   - **Live Telemetry** (Homescreen).
   - **Trends** (Multi-channel interactive historical line chart).
   - **History Logs** (Data table with CSV, Excel, PDF export).
   - **Usage** (Pi CPU %, Temp, Memory, Disk storage, DB size, Uptime).
   - 🔐 **Protected Settings**: Requires administrator password to modify thresholds or delete historical data.

---

## Quick Start Guide

```bash
# 1. Install Node.js dependencies
npm install

# 2. Setup Python environment
python3 -m venv venv
source venv/bin/activate
pip install requests influxdb-client

# 3. Start Dashboard Server
npm start

# 4. Enable Kiosk Autostart on Pi Boot
./setup_kiosk.sh
```

---

## License
MIT License
