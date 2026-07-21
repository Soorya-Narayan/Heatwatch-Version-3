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
    """Poll PPI AIME 8U via XML endpoint or HTML scraping fallback"""
    channels = {}

    # Method 1: Try XML endpoint (index.xml)
    try:
        resp = requests.get(f"{AIME_URL}/index.xml", timeout=2.0)
        if resp.status_code == 200:
            tree = ET.fromstring(resp.content)
            for i in range(1, 9):
                ch_key = f"CH{i}"
                elem = tree.find(ch_key)
                if elem is not None and elem.text:
                    try:
                        channels[ch_key] = float(elem.text.strip())
                    except ValueError:
                        pass
            if len(channels) == 8:
                return channels
    except Exception:
        pass

    # Method 2: HTML Page Parsing (Scrape http://192.168.1.2/)
    try:
        resp = requests.get(f"{AIME_URL}/", timeout=2.5)
        if resp.status_code == 200:
            html = resp.text
            # Regex to match CH1..CH8 and Process Value from HTML table
            for i in range(1, 9):
                ch_key = f"CH{i}"
                # Pattern: CH1 followed by td tag with numeric process value
                pattern = rf'{ch_key}\s*</t[dh]>\s*<td[^>]*>\s*(-?\d+(?:\.\d+)?)'
                match = re.search(pattern, html, re.IGNORECASE | re.DOTALL)
                if match:
                    try:
                        channels[ch_key] = float(match.group(1))
                    except ValueError:
                        pass
                else:
                    # Fallback pattern for inline or plain text layout
                    pattern_alt = rf'{ch_key}.*?(-?\d+\.\d+)'
                    match_alt = re.search(pattern_alt, html, re.IGNORECASE | re.DOTALL)
                    if match_alt:
                        try:
                            channels[ch_key] = float(match_alt.group(1))
                        except ValueError:
                            pass
            if channels:
                return channels
    except Exception:
        pass

    return channels

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
