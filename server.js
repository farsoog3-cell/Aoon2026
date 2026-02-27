import express from "express";
import http from "http";
import { Server } from "socket.io";
import { spawn } from "child_process";
import fs from "fs";
import { WebcastPushConnection } from "tiktok-live-connector";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

let k6Process = null;

// ================= API Load Testing =================
app.post("/start-test", (req, res) => {
  const { url, vus, duration } = req.body;

  if (!url || !vus || !duration)
    return res.status(400).json({ error: "الرجاء ملء جميع الحقول" });

  if (k6Process) return res.json({ error: "يوجد اختبار جاري بالفعل" });

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

  k6Process = spawn("k6", ["run", "--summary-export=summary.json", "test.js"]);

  k6Process.stdout.on("data", (data) => {
    const text = data.toString();
    io.emit("log", text);

    const match = text.match(/http_req_duration_trend.*avg=(\\d+\\.\\d+)/);
    if (match) io.emit("avg", parseFloat(match[1]));
  });

  k6Process.on("close", () => {
    if (fs.existsSync("summary.json")) {
      const summary = JSON.parse(fs.readFileSync("summary.json"));
      io.emit("summary", summary);
      fs.unlinkSync("summary.json");
    }
    if (fs.existsSync("test.js")) fs.unlinkSync("test.js");
    k6Process = null;
  });

  res.json({ success: true });
});

app.post("/stop-test", (req, res) => {
  if (k6Process) {
    k6Process.kill("SIGINT");
    return res.json({ stopped: true });
  }
  res.json({ error: "لا يوجد اختبار جاري" });
});

// ================= API TikTok Live =================
let tiktokConnection = null;

app.post("/start-tiktok", (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: "أدخل اسم المستخدم" });

  if (tiktokConnection) tiktokConnection.disconnect();

  tiktokConnection = new WebcastPushConnection(username);

  tiktokConnection.on("chat", (data) => {
    io.emit("tiktok-chat", { user: data.uniqueId, message: data.comment });
  });

  tiktokConnection.on("viewerCountUpdate", (data) => {
    io.emit("tiktok-viewers", data.viewerCount);
  });

  tiktokConnection.connect();

  res.json({ success: true });
});

app.post("/stop-tiktok", (req, res) => {
  if (tiktokConnection) {
    tiktokConnection.disconnect();
    tiktokConnection = null;
    return res.json({ stopped: true });
  }
  res.json({ error: "لا يوجد بث TikTok جاري" });
});

// ================= DASHBOARD =================
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Load Testing & TikTok Dashboard</title>
  <script src="/socket.io/socket.io.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body { font-family:Arial; background:#0f172a; color:white; margin:0; padding:20px; }
    .container { max-width:1200px; margin:auto; }
    input, button { width:100%; max-width:300px; padding:10px; margin:5px 0; border-radius:5px; border:none; }
    button { background:#2563eb; color:white; cursor:pointer; }
    canvas { width:100% !important; height:auto !important; margin-top:20px; border-radius:10px; }
    .logs, .chat { width:100%; max-height:300px; overflow:auto; background:#111827; padding:10px; border-radius:5px; margin-top:10px; }
    .flex { display:flex; gap:10px; flex-wrap:wrap; }
  </style>
</head>
<body>
<div class="container">
<h1>🚀 Load Testing + TikTok Dashboard</h1>

<h2>Load Test</h2>
<div class="flex">
<input id="url" placeholder="https://example.com"/>
<input id="vus" type="number" placeholder="Users"/>
<input id="duration" type="number" placeholder="Seconds"/>
<button onclick="startTest()">Start Test</button>
<button onclick="stopTest()">Stop Test</button>
</div>
<canvas id="chart"></canvas>
<div class="logs" id="logs"></div>

<h2>TikTok Live</h2>
<div class="flex">
<input id="tiktok-user" placeholder="TikTok Username"/>
<button onclick="startTikTok()">Start TikTok</button>
<button onclick="stopTikTok()">Stop TikTok</button>
</div>
<p>Viewers: <span id="viewers">0</span></p>
<div class="chat" id="chat"></div>

<script>
const socket = io();

// ========== Load Test ==========
const ctx = document.getElementById('chart');
const chart = new Chart(ctx, {
  type:'line',
  data:{ labels:[], datasets:[{ label:'Avg Response Time (ms)', data:[], borderColor:'lime', fill:false }] },
  options:{ animation:false, scales:{ y:{ beginAtZero:true } } }
});

function startTest(){
  fetch('/start-test',{ method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      url: document.getElementById('url').value,
      vus: parseInt(document.getElementById('vus').value),
      duration: parseInt(document.getElementById('duration').value)
    })
  });
}
function stopTest(){ fetch('/stop-test',{ method:'POST' }); }

socket.on("log", data=>{
  const logs = document.getElementById("logs");
  logs.innerHTML += data + "<br>";
  logs.scrollTop = logs.scrollHeight;
});
socket.on("avg", avg=>{
  const time = new Date().toLocaleTimeString();
  chart.data.labels.push(time);
  chart.data.datasets[0].data.push(avg);
  chart.update();
});

// ========== TikTok Live ==========
function startTikTok(){
  fetch('/start-tiktok',{ method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ username: document.getElementById('tiktok-user').value })
  });
}
function stopTikTok(){ fetch('/stop-tiktok',{ method:'POST' }); }

socket.on("tiktok-chat", data=>{
  const chatBox = document.getElementById("chat");
  chatBox.innerHTML += "<b>"+data.user+"</b>: "+data.message+"<br>";
  chatBox.scrollTop = chatBox.scrollHeight;
});
socket.on("tiktok-viewers", count=>{
  document.getElementById("viewers").innerText = count;
});
</script>
</div>
</body>
</html>
  `);
});

// ================= SERVER START =================
server.listen(3000,()=>console.log("🔥 Server running on http://localhost:3000"));
