# HeatWatch 3 — Industrial Telemetry Platform

![HeatWatch](https://img.shields.io/badge/Platform-HeatWatch%203-blue)
![Version](https://img.shields.io/badge/Version-3.0.0-green)
![Hardware](https://img.shields.io/badge/Hardware-Raspberry%20Pi%205-red)
![License](https://img.shields.io/badge/License-MIT-yellow)

Real-time industrial temperature monitoring & telemetry platform by **Goose Industrial Solutions**.

---

## Quick Setup & Deployment Guide

### 1. Install Node Dependencies
```bash
npm install
```

### 2. Setup Python Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate
pip install requests influxdb-client
```

### 3. Start Server Manually
```bash
npm start
```
> Access live dashboard in browser at: `http://localhost:3001`

### 4. Enable Automatic Kiosk Boot (on Raspberry Pi Boot)
```bash
./setup_kiosk.sh
```

---

## License
MIT License
