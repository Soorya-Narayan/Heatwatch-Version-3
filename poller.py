#!/usr/bin/env python3
"""
HeatWatch 3 — Live Industrial Temperature Poller
Polls PPI AIME 8U RTD hardware via HTTP XML (http://192.168.1.2/index.xml)
and writes live time-series readings to InfluxDB v2.
"""

import time
import sys
import xml.etree.ElementTree as ET
import requests
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

INFLUX_URL    = "http://localhost:8086"
INFLUX_TOKEN  = "9upI6oc3KDqHU64Gfq_2JJ9zjC4hZId-4w6qbenxgIEpvJU0TdIDp3dzgjEV5g8idgwC3dO2X58j8Vo5b33BnQ=="
INFLUX_ORG    = "heatwatch"
INFLUX_BUCKET = "temperature_data"
AIME_URL      = "http://192.168.1.2/index.xml"
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
    """Poll PPI AIME 8U XML hardware interface"""
    resp = requests.get(AIME_URL, timeout=2.0)
    resp.raise_for_status()
    tree = ET.fromstring(resp.content)
    
    channels = {}
    for i in range(1, 9):
        ch_key = f"CH{i}"
        elem = tree.find(ch_key)
        if elem is not None and elem.text:
            try:
                channels[ch_key] = float(elem.text.strip())
            except ValueError:
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
    print(f"[HeatWatch 3 Poller] Starting LIVE PPI AIME 8U polling loop ({AIME_URL})...")

    while True:
        try:
            data = poll_aime_hardware()
            if data:
                print(f"[PPI AIME 8U Live Readings] {data}")
                write_to_influx(data)
            else:
                print(f"[Poller Warning] XML received from {AIME_URL} but no channel tags found.")
        except requests.exceptions.RequestException as req_err:
            print(f"[Poller Status] Waiting for PPI AIME 8U hardware connection at {AIME_URL}...")
        except KeyboardInterrupt:
            print("\n[HeatWatch 3 Poller] Stopped.")
            sys.exit(0)
        except Exception as err:
            print(f"[Poller Error] {err}")

        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
