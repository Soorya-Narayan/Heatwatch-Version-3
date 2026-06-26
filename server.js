const express = require('express');
const http = require('http');
const https = require('https');
const { WebSocketServer } = require('ws');
const { InfluxDB } = require('@influxdata/influxdb-client');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const INFLUX_URL    = 'http://localhost:8086';
const INFLUX_TOKEN  = '9upI6oc3KDqHU64Gfq_2JJ9zjC4hZId-4w6qbenxgIEpvJU0TdIDp3dzgjEV5g8idgwC3dO2X58j8Vo5b33BnQ==';
const INFLUX_ORG    = 'milma_kattappana';
const INFLUX_BUCKET = 'temperature_data';
const CONFIG_FILE   = path.join(__dirname, 'channel_config.json');

const influxDB = new InfluxDB({ url: INFLUX_URL, token: INFLUX_TOKEN });
const queryApi = influxDB.getQueryApi(INFLUX_ORG);

const DEFAULT_SENSORS = [
  { id:'CH1', name:'Pasteurizer_Inlet',  label:'Pasteurizer Inlet',  hihi:90, hi:80, lo:10, lolo:5  },
  { id:'CH2', name:'Pasteurizer_Outlet', label:'Pasteurizer Outlet', hihi:85, hi:75, lo:10, lolo:5  },
  { id:'CH3', name:'Chiller_1',          label:'Chiller 1',          hihi:15, hi:12, lo:2,  lolo:0  },
  { id:'CH4', name:'Chiller_2',          label:'Chiller 2',          hihi:15, hi:12, lo:2,  lolo:0  },
  { id:'CH5', name:'Storage_Tank_1',     label:'Storage Tank 1',     hihi:10, hi:8,  lo:2,  lolo:0  },
  { id:'CH6', name:'Storage_Tank_2',     label:'Storage Tank 2',     hihi:10, hi:8,  lo:2,  lolo:0  },
  { id:'CH7', name:'Boiler_Feed',        label:'Boiler Feed',        hihi:95, hi:85, lo:20, lolo:10 },
  { id:'CH8', name:'Ambient',            label:'Ambient',            hihi:45, hi:38, lo:10, lolo:5  },
];

function loadConfig() {
  try { if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE,'utf8')); } catch(e) {}
  return JSON.parse(JSON.stringify(DEFAULT_SENSORS));
}
function saveConfig(c) { fs.writeFileSync(CONFIG_FILE, JSON.stringify(c,null,2)); }
let SENSORS = loadConfig();

const { execSync } = require('child_process');

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
  const total = user + nice + sys + idle + irq;
  return { idle, total };
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

app.get('/api/system', (req, res) => {
  try {
    const cpuTemp = execSync("vcgencmd measure_temp 2>/dev/null").toString().trim().replace("temp=","") || '--';
    const memLines = execSync("free -m").toString().split('\n')[1].trim().split(/\s+/);
    const memTotal = parseInt(memLines[1]);
    const memUsed  = parseInt(memLines[2]);
    const memPct   = Math.round(memUsed / memTotal * 100);
    const diskLine = execSync("df -h / | tail -1").toString().trim().split(/\s+/);
    const diskTotal = diskLine[1], diskUsed = diskLine[2], diskPct = parseInt(diskLine[4]);
    const cpu = getCpuUsagePercent();
    let dbSize = '--';
    try { dbSize = execSync("sudo du -sh /var/lib/influxdb 2>/dev/null").toString().trim().split(/\s+/)[0]; } catch(e) {}
    res.json({ cpu, cpuTemp, memUsed: memUsed+'MB', memTotal: memTotal+'MB', memPct, diskUsed, diskTotal, diskPct, dbSize });
  } catch(e) {
    console.error('System stats error:', e.message);
    res.json({ cpu:0, cpuTemp:'--', memUsed:'--', memTotal:'--', memPct:0, diskUsed:'--', diskTotal:'--', diskPct:0, dbSize:'--' });
  }
});

app.get('/api/config', (req,res) => res.json(SENSORS));
app.post('/api/config', (req,res) => { SENSORS = req.body; saveConfig(SENSORS); res.json({ok:true}); });

app.get('/api/stats', async (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  const q = `from(bucket:"${INFLUX_BUCKET}")|>range(start:${todayStart.toISOString()})|>filter(fn:(r)=>r._measurement=="temperature")|>count()`;
  try {
    const rows = await queryApi.collectRows(q);
    const total = rows.reduce((acc, row) => acc + (row._value || 0), 0);
    res.json({ total });
  } catch(e) {
    res.json({ total: 0 });
  }
});

function getAggregateWindow(range) {
  const match = range.match(/-?(\d+)([mhd])/);
  if (!match) return '1m';
  const val = parseInt(match[1]);
  const unit = match[2];

  let minutes = 0;
  if (unit === 'm') minutes = val;
  else if (unit === 'h') minutes = val * 60;
  else if (unit === 'd') minutes = val * 24 * 60;

  if (minutes <= 30) return '10s';
  if (minutes <= 60) return '1m';
  if (minutes <= 360) return '5m';
  if (minutes <= 1440) return '15m';
  if (minutes <= 10080) return '2h';
  if (minutes <= 43200) return '12h';
  if (minutes <= 129600) return '24h';
  if (minutes <= 259200) return '48h';
  if (minutes <= 525600) return '96h';
  return '168h';
}

app.get('/api/history/:sensor', async (req,res) => {
  const { sensor } = req.params;
  const range = req.query.range || '-1h';
  const every = getAggregateWindow(range);
  const q = `from(bucket:"${INFLUX_BUCKET}")|>range(start:${range})|>filter(fn:(r)=>r._measurement=="temperature")|>filter(fn:(r)=>r._field=="value")|>filter(fn:(r)=>r.sensor=="${sensor}")|>filter(fn:(r)=>r._value>-999)|>aggregateWindow(every:${every},fn:mean,createEmpty:false)`;
  try { const rows = await queryApi.collectRows(q); res.json(rows.map(r=>({time:r._time,value:parseFloat(r._value.toFixed(2))}))); }
  catch(e) { res.json([]); }
});

app.get('/api/export/csv', async (req,res) => {
  const data = await fetchExportData(req.query.range||'-24h');
  let csv = 'MILMA KATTAPPANA - TEMPERATURE REPORT\n';
  csv += `Generated:,${new Date().toLocaleString()}\n`;
  csv += 'Powered by:,Goose Industrial Solutions Pvt Ltd\n';
  csv += '\n';
  csv += 'Time,'+SENSORS.map(s=>s.label).join(',')+'\n';
  data.forEach(row => { csv += [new Date(row.time).toLocaleString(),...SENSORS.map(s=>row[s.name]??'')].join(',')+'\n'; });
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition',`attachment; filename="milma_kattappana_${Date.now()}.csv"`);
  res.send(csv);
});

app.get('/api/export/json', async (req,res) => {
  const data = await fetchExportData(req.query.range||'-24h');
  res.json({ sensors:SENSORS, data });
});

app.delete('/api/data', async (req,res) => {
  const start = req.query.start || '1970-01-01T00:00:00Z';
  const stop  = req.query.stop  || new Date().toISOString();
  const body = JSON.stringify({
    start,
    stop,
    predicate: '_measurement="temperature"'
  });
  const urlObj = new URL(`${INFLUX_URL}/api/v2/delete?org=${encodeURIComponent(INFLUX_ORG)}&bucket=${encodeURIComponent(INFLUX_BUCKET)}`);
  const isHttps = urlObj.protocol === 'https:';
  const transport = isHttps ? https : http;
  const options = {
    hostname: urlObj.hostname,
    port:     urlObj.port || (isHttps ? 443 : 80),
    path:     urlObj.pathname + urlObj.search,
    method:   'POST',
    headers:  {
      'Authorization': `Token ${INFLUX_TOKEN}`,
      'Content-Type':  'application/json',
      'Content-Length': Buffer.byteLength(body)
    }
  };
  try {
    await new Promise((resolve, reject) => {
      const request = transport.request(options, (response) => {
        let data = '';
        response.on('data', chunk => { data += chunk; });
        response.on('end', () => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            resolve();
          } else {
            reject(new Error(`InfluxDB delete failed: ${response.statusCode} ${data}`));
          }
        });
      });
      request.on('error', reject);
      request.write(body);
      request.end();
    });
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

async function fetchExportData(range) {
  const every = getAggregateWindow(range);
  const q = `from(bucket:"${INFLUX_BUCKET}")|>range(start:${range})|>filter(fn:(r)=>r._measurement=="temperature")|>filter(fn:(r)=>r._field=="value")|>filter(fn:(r)=>r._value>-999)|>aggregateWindow(every:${every},fn:mean,createEmpty:false)|>pivot(rowKey:["_time"],columnKey:["sensor"],valueColumn:"_value")`;
  try {
    const rows = await queryApi.collectRows(q);
    return rows.map(row => {
      const out = {time:row._time};
      SENSORS.forEach(s => { if (row[s.name]!=null) out[s.name]=parseFloat(row[s.name].toFixed(2)); });
      return out;
    });
  } catch(e) { return []; }
}

async function getLatestReadings() {
  const q = `from(bucket:"${INFLUX_BUCKET}")|>range(start:-5m)|>filter(fn:(r)=>r._measurement=="temperature")|>filter(fn:(r)=>r._field=="value")|>last()`;
  const readings = {};
  try {
    const rows = await queryApi.collectRows(q);
    rows.forEach(r => { readings[r.sensor] = parseFloat(r._value.toFixed(2)); });
  } catch(e) {}
  return readings;
}

function getAlarmStatus(s, v) {
  if (v >= s.hihi || v <= s.lolo) return 'fault';
  if (v >= s.hi   || v <= s.lo)   return 'alarm';
  return 'ok';
}

async function broadcast() {
  if (wss.clients.size === 0) return;
  const readings = await getLatestReadings();
  const payload = SENSORS.map(s => {
    const raw = readings[s.name];
    const noSensor = raw == null || raw <= -999;
    return {
      id: s.id, name: s.name, label: s.label,
      value:  noSensor ? null : raw,
      status: noSensor ? 'unknown' : getAlarmStatus(s, raw),
      limits: { hihi:s.hihi, hi:s.hi, lo:s.lo, lolo:s.lolo },
    };
  });
  const msg = JSON.stringify({ type:'live', data:payload });
  wss.clients.forEach(c => { if (c.readyState===1) c.send(msg); });
}

setInterval(broadcast, 2000);
wss.on('connection', () => broadcast());

server.listen(3001, () => console.log('Milma Dashboard running on http://localhost:3001'));
