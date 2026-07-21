#!/usr/bin/env python3
"""
HeatWatch 3 — Industrial Telemetry Data Poller
Polls PPI AIME 8U RTD hardware via HTTP XML or generates simulation telemetry
and writes time-series records to InfluxDB v2.
"""

import time
import sys
import random
import xml.etree.ElementTree as ET
import requests
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

INFLUX_URL    = "http://localhost:8086"
INFLUX_TOKEN  = "9upI6oc3KDqHU64Gfq_2JJ9zjC4hZId-4w6qbenxgIEpvJU0TdIDp3dzgjEV5g8idgwC3dO2X58j8Vo5b33BnQ=="
INFLUX_ORG    = "heatwatch"
INFLUX_BUCKET = "temperature_data"
AIME_URL      = "http://192.168.1.2/index.xml"
POLL_INTERVAL = 3

client = None
write_api = None

try:
    client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
    write_api = client.write_api(write_options=SYNCHRONOUS)
    print(f"[HeatWatch 3 Poller] Connected to InfluxDB at {INFLUX_URL}")
except Exception as e:
    print(f"[HeatWatch 3 Poller] InfluxDB init warning: {e}")

simulated_temps = [82.5, 76.0, 14.2, 4.5, 3.8, 4.1, 48.0, 28.5]

def poll_aime_hardware():
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

def generate_simulation():
    channels = {}
    for i in range(8):
        ch_key = f"CH{i+1}"
        jitter = (random.random() - 0.48) * 0.6
        simulated_temps[i] = max(-10.0, min(120.0, simulated_temps[i] + jitter))
        channels[ch_key] = round(simulated_temps[i], 1)
    return channels

def write_to_influx(data):
    if not write_api:
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
    except Exception:
        pass

def main():
    print("[HeatWatch 3 Poller] Starting telemetry collection loop...")
    sim_mode = False

    while True:
        try:
            if not sim_mode:
                try:
                    data = poll_aime_hardware()
                    print(f"[AIME 8U Hardware] {data}")
                except Exception:
                    print(f"[Poller Notice] Hardware unreachable ({AIME_URL}). Running simulation mode.")
                    sim_mode = True
                    data = generate_simulation()
            else:
                data = generate_simulation()
                print(f"[Simulated Telemetry] {data}")

            write_to_influx(data)

        except KeyboardInterrupt:
            sys.exit(0)
        except Exception as err:
            print(f"[Poller Error] {err}")

        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
