import express from "express";
import http from "http";
import { Server } from "socket.io";
import { spawn } from "child_process";
import fs from "fs";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

let k6Process = null;
let lastSummary = null;

// ================= API =================
app.post("/start", (req, res) => {
  const { url, vus, duration } = req.body;

  if (!url || !vus || !duration) {
    return res.status(400).json({ error: "الرجاء ملء جميع الحقول" });
  }

  if (k6Process) {
    return res.json({ error: "يوجد اختبار جاري بالفعل" });
  }

  // إنشاء سكريبت k6
  const script = `
    import http from 'k6/http';
    import { sleep } from 'k6';
    import { Trend } from 'k6/metrics';

    export const httpTrend = new Trend('http_req_duration_trend');

    export const options = {
      vus: ${vus},
      duration: '${duration}s',
    };

    export default function () {
      const res = http.get('${url}');
      httpTrend.add(res.timings.duration);
      sleep(1);
    }
  `;
  fs.writeFileSync("test.js", script);

  // تشغيل k6
  k6Process = spawn("k6", ["run", "--summary-export=summary.json", "test.js"]);

  k6Process.stdout.on("data", (data) => {
    const text = data.toString();
    io.emit("log", text);

    // محاولة استخراج الوقت المتوسط من log
    const match = text.match(/http_req_duration_trend.*avg=(\\d+\\.\\d+)/);
    if (match) {
      const avg = parseFloat(match[1]);
      io.emit("avg", avg);
    }
  });

  k6Process.on("close", () => {
    if (fs.existsSync("summary.json")) {
      lastSummary = JSON.parse(fs.readFileSync("summary.json"));
      io.emit("summary", lastSummary);
      fs.unlinkSync("summary.json");
    }
    if (fs.existsSync("test.js")) fs.unlinkSync("test.js");
    k6Process = null;
  });

  res.json({ success: true });
});

app.post("/stop", (req, res) => {
  if (k6Process) {
    k6Process.kill("SIGINT");
    return res.json({ stopped: true });
  }
  res.json({ error: "لا يوجد اختبار جاري" });
});

// ================= DASHBOARD =================
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Load Testing Dashboard</title>
  <script src="/socket.io/socket.io.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { background:#0f172a; color:white; font-family:Arial; padding:20px; }
    input, button { padding:8px; margin:5px; border-radius:5px; border:none; }
    button { background:#2563eb; color:white; cursor:pointer; }
    canvas { background:#111827; margin-top:20px; border-radius:10px; }
    .logs { background:#111827; height:200px; overflow:auto; margin-top:20px; padding:10px; }
  </style>
</head>
<body>

<h1>🚀 Professional Load Testing</h1>

<input id="url" placeholder="https://example.com" size="40"/>
<input id="vus" type="number" placeholder="Users"/>
<input id="duration" type="number" placeholder="Seconds"/>

<button onclick="start()">Start</button>
<button onclick="stop()">Stop</button>

<canvas id="chart"></canvas>

<div class="logs" id="logs"></div>

<script>
const socket = io();
const ctx = document.getElementById('chart');
const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [{
      label: 'Avg Response Time (ms)',
      data: [],
      borderColor: 'lime',
      fill: false
    }]
  },
  options: {
    animation: false,
    scales: { y: { beginAtZero: true } }
  }
});

function start() {
  fetch('/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: document.getElementById('url').value,
      vus: parseInt(document.getElementById('vus').value),
      duration: parseInt(document.getElementById('duration').value)
    })
  });
}

function stop() {
  fetch('/stop', { method: 'POST' });
}

socket.on("log", (data) => {
  const logs = document.getElementById("logs");
  logs.innerHTML += data + "<br>";
  logs.scrollTop = logs.scrollHeight;
});

socket.on("avg", (avg) => {
  const time = new Date().toLocaleTimeString();
  chart.data.labels.push(time);
  chart.data.datasets[0].data.push(avg);
  chart.update();
});

socket.on("summary", (summary) => {
  console.log("اختبار انتهى. ملخص:", summary);
});
</script>

</body>
</html>
  `);
});

// ================= SERVER START =================
server.listen(3000, () => {
  console.log("🔥 Server running on http://localhost:3000");
});
