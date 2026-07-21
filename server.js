const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const { InfluxDB } = require('@influxdata/influxdb-client');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const INFLUX_URL    = 'http://localhost:8086';
const INFLUX_TOKEN  = '9upI6oc3KDqHU64Gfq_2JJ9zjC4hZId-4w6qbenxgIEpvJU0TdIDp3dzgjEV5g8idgwC3dO2X58j8Vo5b33BnQ==';
const INFLUX_ORG    = 'heatwatch';
const INFLUX_BUCKET = 'temperature_data';
const CONFIG_FILE   = path.join(__dirname, 'channel_config.json');

const influxDB = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
let queryApi = influxDB.getQueryApi(INFLUX_ORG);

// Default 8-Channel Industrial Telemetry Configuration
const DEFAULT_SENSORS = [
  { id: 'CH1', name: 'Boiler_Temp',          label: 'Boiler Temperature',      hihi: 95, hi: 85, lo: 20, lolo: 10, unit: '°C' },
  { id: 'CH2', name: 'Heat_Exchanger_Inlet',  label: 'Heat Exchanger Inlet',    hihi: 90, hi: 80, lo: 15, lolo: 5,  unit: '°C' },
  { id: 'CH3', name: 'Heat_Exchanger_Outlet', label: 'Heat Exchanger Outlet',   hihi: 85, hi: 75, lo: 10, lolo: 5,  unit: '°C' },
  { id: 'CH4', name: 'Chilled_Water_Supply', label: 'Chilled Water Supply',   hihi: 15, hi: 12, lo: 2,  lolo: 0,  unit: '°C' },
  { id: 'CH5', name: 'Primary_Storage_Tank', label: 'Primary Storage Tank',   hihi: 10, hi: 8,  lo: 2,  lolo: 0,  unit: '°C' },
  { id: 'CH6', name: 'Secondary_Storage',    label: 'Secondary Storage Tank', hihi: 10, hi: 8,  lo: 2,  lolo: 0,  unit: '°C' },
  { id: 'CH7', name: 'Condenser_Loop',       label: 'Condenser Loop',         hihi: 55, hi: 45, lo: 10, lolo: 5,  unit: '°C' },
  { id: 'CH8', name: 'Ambient_Plant_Room',   label: 'Ambient Plant Room',     hihi: 45, hi: 38, lo: 10, lolo: 5,  unit: '°C' },
];

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load channel config:', e.message);
  }
  return JSON.parse(JSON.stringify(DEFAULT_SENSORS));
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  } catch (e) {
    console.error('Failed to save channel config:', e.message);
  }
}

let SENSORS = loadConfig();

// CPU calculation helper
function getCpuUsageTicks() {
  const cpus = os.cpus();
  let user = 0, nice = 0, sys = 0, idle = 0, irq = 0;
  for (const cpu of cpus) {
    user += cpu.times.user;
    nice += cpu.times.nice;
    sys += cpu.times.sys;
    idle += cpu.times.idle;
    irq += cpu.times.irq;
  }
  return { idle, total: user + nice + sys + idle + irq };
}

let lastCpuStats = getCpuUsageTicks();

function getCpuUsagePercent() {
  const current = getCpuUsageTicks();
  const idleDiff = current.idle - lastCpuStats.idle;
  const totalDiff = current.total - lastCpuStats.total;
  lastCpuStats = current;
  if (totalDiff === 0) return 0;
  return Math.round(100 * (1 - idleDiff / totalDiff));
}

// REST API Endpoints
app.get('/api/system', (req, res) => {
  try {
    let cpuTemp = '--';
    try {
      cpuTemp = execSync('vcgencmd measure_temp 2>/dev/null').toString().trim().replace('temp=', '') || '--';
    } catch (e) {
      try {
        const raw = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8');
        cpuTemp = (parseInt(raw) / 1000).toFixed(1) + "°C";
      } catch (e2) {}
    }

    let memUsed = '--', memTotal = '--', memPct = 0;
    try {
      const totalMB = Math.round(os.totalmem() / 1024 / 1024);
      const freeMB = Math.round(os.freemem() / 1024 / 1024);
      const usedMB = totalMB - freeMB;
      memUsed = usedMB + 'MB';
      memTotal = totalMB + 'MB';
      memPct = Math.round((usedMB / totalMB) * 100);
    } catch (e) {}

    let diskUsed = '--', diskTotal = '--', diskPct = 0;
    try {
      const diskLine = execSync('df -h / | tail -1').toString().trim().split(/\s+/);
      diskTotal = diskLine[1];
      diskUsed = diskLine[2];
      diskPct = parseInt(diskLine[4]) || 0;
    } catch (e) {}

    const cpu = getCpuUsagePercent();
    let dbSize = '--';
    try {
      dbSize = execSync('sudo du -sh /var/lib/influxdb 2>/dev/null').toString().trim().split(/\s+/)[0] || '--';
    } catch (e) {}

    res.json({
      cpu,
      cpuTemp,
      memUsed,
      memTotal,
      memPct,
      diskUsed,
      diskTotal,
      diskPct,
      dbSize,
      uptime: Math.floor(os.uptime()),
      platform: `${os.hostname()} (${os.arch()})`
    });
  } catch (e) {
    res.json({ cpu: 0, cpuTemp: '--', memUsed: '--', memTotal: '--', memPct: 0, diskUsed: '--', diskTotal: '--', diskPct: 0, dbSize: '--', uptime: 0, platform: 'Linux' });
  }
});

app.get('/api/config', (req, res) => res.json(SENSORS));

app.post('/api/config', (req, res) => {
  if (Array.isArray(req.body) && req.body.length > 0) {
    SENSORS = req.body;
    saveConfig(SENSORS);
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: 'Invalid config format' });
  }
});

app.get('/api/stats', async (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const q = `from(bucket:"${INFLUX_BUCKET}") |> range(start:${todayStart.toISOString()}) |> filter(fn:(r)=>r._measurement=="temperature") |> count()`;
  try {
    const rows = await queryApi.collectRows(q);
    const total = rows.reduce((acc, r) => acc + (r._value || 0), 0);
    res.json({ total });
  } catch (e) {
    res.json({ total: 0 });
  }
});

app.get('/api/history', async (req, res) => {
  const { range = '1h', sensor = 'all' } = req.query;
  let rangeStart = '-1h';
  if (range === '6h') rangeStart = '-6h';
  else if (range === '24h') rangeStart = '-24h';
  else if (range === '7d') rangeStart = '-7d';

  let filterSensor = '';
  if (sensor !== 'all') {
    filterSensor = `|> filter(fn: (r) => r.channel == "${sensor}" or r._field == "${sensor}")`;
  }

  const q = `from(bucket: "${INFLUX_BUCKET}")
    |> range(start: ${rangeStart})
    |> filter(fn: (r) => r._measurement == "temperature")
    ${filterSensor}
    |> yield(name: "mean")`;

  try {
    const rows = await queryApi.collectRows(q);
    const data = rows.map(r => ({
      time: r._time,
      channel: r.channel || r._field,
      value: r._value
    }));
    res.json({ ok: true, data });
  } catch (e) {
    res.json({ ok: false, error: e.message, data: [] });
  }
});

// Live Simulation Generator for smooth offline testing
let simValues = DEFAULT_SENSORS.map((s, i) => (22.5 + i * 8.0));

function broadcastTelemetry() {
  if (wss.clients.size === 0) return;

  const now = new Date().toISOString();
  
  const packet = SENSORS.map((s, i) => {
    let jitter = (Math.random() - 0.49) * 0.7;
    simValues[i] = Math.max(-5, Math.min(115, simValues[i] + jitter));
    
    return {
      id: s.id,
      name: s.name,
      label: s.label,
      val: simValues[i].toFixed(1),
      hihi: s.hihi, hi: s.hi, lo: s.lo, lolo: s.lolo, unit: s.unit || '°C'
    };
  });

  const payload = JSON.stringify({ type: 'telemetry', time: now, sensors: packet });

  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(payload);
  });
}

setInterval(broadcastTelemetry, 2000);

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'config', sensors: SENSORS }));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[HeatWatch 3] Dashboard server listening on port ${PORT}`);
});
