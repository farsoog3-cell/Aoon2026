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

  if (k6Process) {
    return res.json({ error: "يوجد اختبار جاري بالفعل" });
  }

  const script = `
    import http from 'k6/http';
    import { sleep } from 'k6';

    export const options = {
      vus: ${vus},
      duration: '${duration}s',
    };

    export default function () {
      http.get('${url}');
      sleep(1);
    }
  `;

  fs.writeFileSync("test.js", script);

  k6Process = spawn("k6", ["run", "--summary-export=summary.json", "test.js"]);

  k6Process.stdout.on("data", (data) => {
    io.emit("log", data.toString());
  });

  k6Process.on("close", () => {
    if (fs.existsSync("summary.json")) {
      lastSummary = JSON.parse(fs.readFileSync("summary.json"));
      io.emit("summary", lastSummary);
    }
    k6Process = null;
  });

  res.json({ success: true });
});

app.post("/stop", (req, res) => {
  if (k6Process) {
    k6Process.kill("SIGINT");
    k6Process = null;
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
            label: 'Avg Response Time',
            data: [],
            borderColor: 'lime',
            fill: false
          }]
        }
      });

      function start() {
        fetch('/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: document.getElementById('url').value,
            vus: document.getElementById('vus').value,
            duration: document.getElementById('duration').value
          })
        });
      }

      function stop() {
        fetch('/stop', { method: 'POST' });
      }

      socket.on("log", (data) => {
        document.getElementById("logs").innerHTML += data + "<br>";
      });

      socket.on("summary", (summary) => {
        const avg = summary.metrics.http_req_duration.avg;
        chart.data.labels.push("Test");
        chart.data.datasets[0].data.push(avg);
        chart.update();
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
