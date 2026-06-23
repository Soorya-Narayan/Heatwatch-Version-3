import time
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS

INFLUX_URL    = "http://localhost:8086"
INFLUX_TOKEN  = "9upI6oc3KDqHU64Gfq_2JJ9zjC4hZId-4w6qbenxgIEpvJU0TdIDp3dzgjEV5g8idgwC3dO2X58j8Vo5b33BnQ=="
INFLUX_ORG    = "milma_kattappana"
INFLUX_BUCKET = "temperature_data"

AIME_URL      = "http://192.168.1.2/index.xml"
POLL_INTERVAL = 5

SENSOR_NAMES = [
    "Pasteurizer_Inlet",
    "Pasteurizer_Outlet",
    "Chiller_1",
    "Chiller_2",
    "Storage_Tank_1",
    "Storage_Tank_2",
    "Boiler_Feed",
    "Ambient",
]

influx    = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
write_api = influx.write_api(write_options=SYNCHRONOUS)

print("✅ Milma Poller started — reading from AIME 8U via HTTP/XML")

while True:
    try:
        r = requests.get(AIME_URL, timeout=5)
        root = ET.fromstring(r.text)
        channels = root.findall('chan')

        points = []
        for i, chan in enumerate(channels):
            raw = chan.find('processValue').text.strip()
            name = SENSOR_NAMES[i] if i < len(SENSOR_NAMES) else f"CH{i+1}"

            try:
                temp = float(raw)
            except:
                temp = -999.0

            if temp == -999.0 or temp >= 32700.0 or temp <= -200.0:
                print(f"  {name}: NO SENSOR")
                points.append(
                    Point("temperature")
                    .tag("sensor", name)
                    .tag("unit", "RTD")
                    .field("value", -999.0)
                    .time(datetime.now(timezone.utc))
                )
            else:
                print(f"  {name}: {temp}°C")
                points.append(
                    Point("temperature")
                    .tag("sensor", name)
                    .tag("unit", "RTD")
                    .field("value", temp)
                    .time(datetime.now(timezone.utc))
                )

        write_api.write(bucket=INFLUX_BUCKET, org=INFLUX_ORG, record=points)
        print(f"  → Written at {datetime.now().strftime('%H:%M:%S')}\n")

    except Exception as e:
        print(f"❌ Error: {e} — retrying in 5s")

    time.sleep(POLL_INTERVAL)
