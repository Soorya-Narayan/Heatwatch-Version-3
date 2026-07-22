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
const SETUP_FILE    = path.join(__dirname, 'setup_config.json');

const influxDB = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
let queryApi = influxDB.getQueryApi(INFLUX_ORG);

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

function loadSetupState() {
  try {
    if (fs.existsSync(SETUP_FILE)) {
      return JSON.parse(fs.readFileSync(SETUP_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading setup file:', e.message);
  }
  return { isConfigured: false, user: null, sensors: DEFAULT_SENSORS };
}

function saveSetupState(data) {
  try {
    fs.writeFileSync(SETUP_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error saving setup file:', e.message);
  }
}

let SYSTEM_STATE = loadSetupState();

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

// Robust Universal PPI AIME 8U Parser (HTML / XML / JSON / Text)
function parsePpiResponse(text) {
  const readings = {};
  if (!text) return readings;

  // 1. PPI Ethernet Module Native XML Schema (<chan><number>1</number><processValue>25.9</processValue>...</chan>)
  if (text.includes('<channelData>') || text.includes('<chan>')) {
    const chanBlocks = text.split(/<\/chan>/i);
    chanBlocks.forEach(block => {
      const numMatch = block.match(/<number>\s*(\d+)\s*<\/number>/i) || block.match(/<chanName>\s*CH?0*(\d+)\s*<\/chanName>/i);
      const valMatch = block.match(/<processValue>\s*([^<]+?)\s*<\/processValue>/i);

      if (numMatch && valMatch) {
        const chNum = parseInt(numMatch[1], 10);
        const valStr = valMatch[1].trim();
        const num = parseFloat(valStr);
        if (chNum >= 1 && chNum <= 8) {
          const chKey = `CH${chNum}`;
          if (!isNaN(num)) {
            readings[chKey] = num;
          } else if (valStr.toUpperCase().includes('OPEN') || valStr.toUpperCase().includes('ERR')) {
            readings[chKey] = 'OPEN';
          }
        }
      }
    });

    if (Object.keys(readings).length > 0) return readings;
  }

  // 2. Direct Tag / Cell Parser Fallback
  for (let i = 1; i <= 8; i++) {
    const chKey = `CH${i}`;
    let match = text.match(new RegExp(`<CH0?${i}>\\s*([^<]+?)\\s*</CH0?${i}>`, 'i'));
    if (!match) {
      match = text.match(new RegExp(`CH0?${i}\\s*</t[dh]>\\s*<td[^>]*>\\s*([^<]+?)\\s*</td>`, 'i'));
    }
    if (!match) {
      match = text.match(new RegExp(`CH0?${i}["'\\s:=]*?(-?\\d+(?:\\.\\d+)?)`, 'i'));
    }

    if (match) {
      const valStr = match[1].trim();
      const num = parseFloat(valStr);
      if (!isNaN(num)) {
        readings[chKey] = num;
      }
    }
  }

  return readings;
}

// Direct HTTP Polling from PPI AIME 8U Hardware at 192.168.1.2
async function fetchPpiHardwareDirect() {
  const urls = [
    'http://192.168.1.2/',
    'http://192.168.1.2/index.html',
    'http://192.168.1.2/index.xml',
    'http://192.168.1.2/monitoring.html'
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const text = await res.text();
        const readings = parsePpiResponse(text);
        if (Object.keys(readings).length > 0) {
          return readings;
        }
      }
    } catch(e) {}
  }
  return null;
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

app.get('/api/ppi-debug', async (req, res) => {
  const debugInfo = { timestamp: new Date().toISOString(), attempts: [] };
  const urls = [
    'http://192.168.1.2/',
    'http://192.168.1.2/index.html',
    'http://192.168.1.2/index.xml',
    'http://192.168.1.2/monitoring.html'
  ];

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const start = Date.now();
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      const status = response.status;
      const rawText = await response.text();
      const parsed = parsePpiResponse(rawText);
      
      debugInfo.attempts.push({
        url,
        status,
        latencyMs: Date.now() - start,
        rawLength: rawText ? rawText.length : 0,
        rawSnippet: rawText ? rawText.substring(0, 300).replace(/\s+/g, ' ') : '',
        parsed
      });
    } catch (err) {
      debugInfo.attempts.push({
        url,
        error: err.message
      });
    }
  }

  res.json(debugInfo);
});

app.get('/api/setup-status', (req, res) => {
  res.json({
    isConfigured: !!SYSTEM_STATE.isConfigured,
    user: SYSTEM_STATE.user ? {
      username: SYSTEM_STATE.user.username,
      role: SYSTEM_STATE.user.role,
      accessLevel: SYSTEM_STATE.user.accessLevel
    } : null,
    sensors: SYSTEM_STATE.sensors || DEFAULT_SENSORS
  });
});

app.post('/api/setup', (req, res) => {
  const { username, role, accessLevel, password, recoveryPin, sensors } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and Password are required' });
  }

  SYSTEM_STATE = {
    isConfigured: true,
    user: { username, role: role || 'Administrator', accessLevel: accessLevel || 'Full Access', password, recoveryPin: recoveryPin || '1234' },
    sensors: sensors && sensors.length === 8 ? sensors : DEFAULT_SENSORS
  };

  saveSetupState(SYSTEM_STATE);
  console.log(`[HeatWatch 3] Setup completed for user: ${username}`);
  res.json({ ok: true });
});

app.post('/api/reset-setup', (req, res) => {
  try {
    if (fs.existsSync(SETUP_FILE)) {
      fs.unlinkSync(SETUP_FILE);
    }
  } catch (e) {}

  SYSTEM_STATE = { isConfigured: false, user: null, sensors: DEFAULT_SENSORS };
  console.log('[HeatWatch 3] Setup state reset to unconfigured.');
  res.json({ ok: true });
});

app.post('/api/verify-password', (req, res) => {
  const { password } = req.body;
  if (!SYSTEM_STATE.user || !SYSTEM_STATE.user.password) {
    return res.status(400).json({ success: false, error: 'System not set up yet' });
  }

  if (password === SYSTEM_STATE.user.password) {
    return res.json({ success: true });
  } else {
    return res.json({ success: false, error: 'Incorrect Password' });
  }
});

app.post('/api/reset-password-with-pin', (req, res) => {
  const { pin, newPassword } = req.body;
  if (!SYSTEM_STATE.user) {
    return res.status(400).json({ success: false, error: 'System not configured' });
  }

  const currentPin = SYSTEM_STATE.user.recoveryPin || '1234';
  if (pin !== currentPin) {
    return res.json({ success: false, error: 'Incorrect Security Recovery PIN' });
  }

  if (!newPassword || newPassword.length < 1) {
    return res.json({ success: false, error: 'Please enter a valid new password' });
  }

  SYSTEM_STATE.user.password = newPassword;
  saveSetupState(SYSTEM_STATE);
  console.log('[HeatWatch 3] Password updated successfully via Security PIN reset.');
  res.json({ success: true });
});

app.get('/api/config', (req, res) => res.json(SYSTEM_STATE.sensors || DEFAULT_SENSORS));

app.post('/api/config', (req, res) => {
  const { password, sensors } = req.body;
  
  if (SYSTEM_STATE.user && password !== SYSTEM_STATE.user.password) {
    return res.status(401).json({ error: 'Unauthorized: Invalid password' });
  }

  if (Array.isArray(sensors) && sensors.length === 8) {
    SYSTEM_STATE.sensors = sensors;
    saveSetupState(SYSTEM_STATE);
    res.json({ ok: true });
  } else {
    res.status(400).json({ error: 'Invalid sensor array' });
  }
});

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

app.post('/api/delete', async (req, res) => {
  const { password, start, stop } = req.body;

  if (SYSTEM_STATE.user && password !== SYSTEM_STATE.user.password) {
    return res.status(401).json({ error: 'Unauthorized: Invalid password' });
  }

  try {
    const response = await fetch(`${INFLUX_URL}/api/v2/delete?org=${INFLUX_ORG}&bucket=${INFLUX_BUCKET}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${INFLUX_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        start: new Date(start || 0).toISOString(),
        stop: new Date(stop || Date.now()).toISOString(),
        predicate: '_measurement="temperature"'
      })
    });
    if (response.ok) {
      res.json({ ok: true, message: 'Historical data deleted successfully' });
    } else {
      const errText = await response.text();
      res.status(500).json({ error: errText });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// -------------------------------------------------------------
// Live Telemetry Broadcaster
// -------------------------------------------------------------
async function broadcastTelemetry() {
  if (wss.clients.size === 0) return;

  const now = new Date().toISOString();
  const currentSensors = SYSTEM_STATE.sensors || DEFAULT_SENSORS;
  let latestReadings = {};

  // First priority: Fetch live hardware directly from PPI AIME 8U HTTP API
  const directReadings = await fetchPpiHardwareDirect();
  if (directReadings && Object.keys(directReadings).length > 0) {
    latestReadings = directReadings;
  } else {
    // Second priority: Fallback to last recorded points in InfluxDB
    try {
      const q = `from(bucket: "${INFLUX_BUCKET}")
        |> range(start: -5m)
        |> filter(fn: (r) => r._measurement == "temperature")
        |> last()`;
      const rows = await queryApi.collectRows(q);

      if (rows && rows.length > 0) {
        rows.forEach(r => {
          const ch = r.channel || r._field;
          if (ch) latestReadings[ch] = r._value;
        });
      }
    } catch (e) {}
  }

  const packet = currentSensors.map(s => {
    const rawVal = latestReadings[s.id];
    const numVal = parseFloat(rawVal);
    const isOpenFault = rawVal === 'OPEN' || rawVal === 'ERR' || numVal >= 999 || numVal <= -999;
    const isOffline = rawVal === undefined || rawVal === null || isNaN(numVal) || isOpenFault;

    return {
      id: s.id,
      name: s.name,
      label: s.label,
      val: isOffline ? '--' : numVal.toFixed(1),
      offline: isOffline,
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
  ws.send(JSON.stringify({
    type: 'init',
    isConfigured: !!SYSTEM_STATE.isConfigured,
    user: SYSTEM_STATE.user ? { username: SYSTEM_STATE.user.username, role: SYSTEM_STATE.user.role } : null,
    sensors: SYSTEM_STATE.sensors || DEFAULT_SENSORS
  }));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[HeatWatch 3] Server running on port ${PORT}`);
});
