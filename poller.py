#!/usr/bin/env python3
"""
HeatWatch 3 — Live Industrial Temperature Poller
Polls PPI AIME 8U RTD hardware via HTTP (index.xml or main HTML interface at http://192.168.1.2/)
and writes live time-series readings to InfluxDB v2.
"""

import time
import sys
import re
import xml.etree.ElementTree as ET
import requests
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

INFLUX_URL    = "http://localhost:8086"
INFLUX_TOKEN  = "9upI6oc3KDqHU64Gfq_2JJ9zjC4hZId-4w6qbenxgIEpvJU0TdIDp3dzgjEV5g8idgwC3dO2X58j8Vo5b33BnQ=="
INFLUX_ORG    = "heatwatch"
INFLUX_BUCKET = "temperature_data"
AIME_URL      = "http://192.168.1.2"
POLL_INTERVAL = 2  # seconds

client = None
write_api = None

try:
    client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
    write_api = client.write_api(write_options=SYNCHRONOUS)
    print(f"[HeatWatch 3 Poller] Connected to InfluxDB at {INFLUX_URL}")
except Exception as e:
    print(f"[HeatWatch 3 Poller] InfluxDB init notice: {e}")

def poll_aime_hardware():
    """Poll PPI AIME 8U via HTTP (index.xml, index.html, or root)"""
    urls = [f"{AIME_URL}/index.xml", f"{AIME_URL}/", f"{AIME_URL}/index.html"]

    for url in urls:
        try:
            resp = requests.get(url, timeout=2.0)
            if resp.status_code == 200:
                text = resp.text
                channels = {}

                for i in range(1, 9):
                    ch_key = f"CH{i}"
                    
                    # Pattern A: XML tags <CH1>27.7</CH1>
                    match = re.search(rf'<{ch_key}>\s*([^<]+?)\s*</{ch_key}>', text, re.IGNORECASE)
                    
                    # Pattern B: HTML Table cells <td>CH1</td><td>27.7</td>
                    if not match:
                        match = re.search(rf'{ch_key}\s*</t[dh]>\s*<td[^>]*>\s*([^<]+?)\s*</td>', text, re.IGNORECASE)

                    # Pattern C: KV / JSON / Plain text "CH1": 27.7 or CH1 27.7
                    if not match:
                        match = re.search(rf'{ch_key}["\'\s:=]*?(-?\d+(?:\.\d+)?)', text, re.IGNORECASE)

                    if match:
                        try:
                            val = float(match.group(1).strip())
                            channels[ch_key] = val
                        except ValueError:
                            pass

                if channels:
                    return channels
        except Exception:
            pass

    return {}

def write_to_influx(data):
    """Write live 8 channel points to InfluxDB"""
    if not write_api or not data:
        return
    points = []
    for ch_id, val in data.items():
        point = (
            Point("temperature")
            .tag("channel", ch_id)
            .tag("system", "heatwatch3")
            .field("value", float(val))
            .field(ch_id, float(val))
        )
        points.append(point)
    try:
        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)
    except Exception as e:
        print(f"[Poller Write Error] {e}")

def main():
    print(f"[HeatWatch 3 Poller] Polling live PPI AIME 8U hardware ({AIME_URL})...")

    while True:
        try:
            data = poll_aime_hardware()
            if data:
                print(f"[PPI AIME 8U Live Readings] {data}")
                write_to_influx(data)
            else:
                print(f"[Poller Status] Connected to {AIME_URL}, waiting for channel data...")
        except requests.exceptions.RequestException:
            print(f"[Poller Status] Waiting for PPI AIME 8U hardware at {AIME_URL}...")
        except KeyboardInterrupt:
            print("\n[HeatWatch 3 Poller] Stopped.")
            sys.exit(0)
        except Exception as err:
            print(f"[Poller Error] {err}")

        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
