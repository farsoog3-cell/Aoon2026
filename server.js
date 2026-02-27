import express from "express";
import http from "http";
import { Server } from "socket.io";
import { spawn } from "child_process";
import fs from "fs";

// ✅ TikTok Live Connector بطريقة متوافقة مع ESM على Render
import pkg from "tiktok-live-connector";
const { WebcastPushConnection } = pkg;

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

let k6Process = null;
let tiktokConnection = null;

// ================= Load Test =================
app.post("/start-test", (req, res) => {
  const { url, vus, duration } = req.body;
  if (!url || !vus || !duration) return res.status(400).json({ error: "املأ جميع الحقول" });
  if (k6Process) return res.json({ error: "يوجد اختبار جاري" });

  const script = `
    import http from 'k6/http';
    import { sleep } from 'k6';
    import { Trend, Counter } from 'k6/metrics';

    export const httpTrend = new Trend('http_req_duration');
    export const httpErrors = new Counter('http_errors');

    export const options = { vus: ${vus}, duration: '${duration}s' };

    export default function () {
      const res = http.get('${url}');
      httpTrend.add(res.timings.duration);
      if(res.status >= 400) httpErrors.add(1);
      sleep(1);
    }
  `;
  fs.writeFileSync("test.js", script);

  k6Process = spawn("k6", ["run", "--summary-export=summary.json", "test.js"]);

  k6Process.stdout.on("data", (data) => {
    const text = data.toString();
    io.emit("log", text);

    const match = text.match(/http_req_duration.*avg=(\\d+\\.\\d+)/);
    if (match) io.emit("avg", parseFloat(match[1]));
    const errMatch = text.match(/http_errors.*count=(\\d+)/);
    if (errMatch) io.emit("errors", parseInt(errMatch[1]));
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
  if (k6Process) { k6Process.kill("SIGINT"); return res.json({ stopped:true }); }
  res.json({ error: "لا يوجد اختبار جاري" });
});

// ================= TikTok Live =================
app.post("/start-tiktok", (req,res)=>{
  const { username } = req.body;
  if(!username) return res.status(400).json({error:"ادخل اسم المستخدم"});
  if(tiktokConnection) tiktokConnection.disconnect();

  tiktokConnection = new WebcastPushConnection(username);

  tiktokConnection.on("chat", data => {
    io.emit("tiktok-chat", { user:data.uniqueId, message:data.comment });
  });
  tiktokConnection.on("viewerCountUpdate", data => {
    io.emit("tiktok-viewers", data.viewerCount);
    if(data.viewerCount < 10) io.emit("alert","عدد المشاهدين منخفض جدًا!");
  });

  tiktokConnection.connect();
  res.json({ success:true });
});

app.post("/stop-tiktok",(req,res)=>{
  if(tiktokConnection){ tiktokConnection.disconnect(); tiktokConnection=null; return res.json({stopped:true}); }
  res.json({ error:"لا يوجد بث جاري" });
});

// ================= Dashboard =================
app.get("/", (req,res)=>{
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>Professional Dashboard</title>
<script src="/socket.io/socket.io.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<style>
body{margin:0;padding:20px;font-family:Arial;background:#0f172a;color:white;}
.container{max-width:1200px;margin:auto;}
input,button{width:100%;max-width:300px;padding:10px;margin:5px 0;border-radius:5px;border:none;}
button{background:#2563eb;color:white;cursor:pointer;}
canvas{width:100%!important;height:auto!important;margin-top:20px;border-radius:10px;}
.logs,.chat{width:100%;max-height:300px;overflow:auto;background:#111827;padding:10px;border-radius:5px;margin-top:10px;}
.flex{display:flex;gap:10px;flex-wrap:wrap;}
.alert{color:red;font-weight:bold;}
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
<p class="alert" id="load-alert"></p>

<h2>TikTok Live</h2>
<div class="flex">
<input id="tiktok-user" placeholder="TikTok Username"/>
<button onclick="startTikTok()">Start TikTok</button>
<button onclick="stopTikTok()">Stop TikTok</button>
</div>
<p>Viewers: <span id="viewers">0</span></p>
<div class="chat" id="chat"></div>
<p class="alert" id="tiktok-alert"></p>

<script>
const socket = io();

// ========== Load Test ==========
const ctx = document.getElementById('chart');
const chart = new Chart(ctx,{
type:'line',
data:{ labels:[], datasets:[
  {label:'Avg (ms)', data:[], borderColor:'lime', fill:false},
  {label:'Errors', data:[], borderColor:'red', fill:false}
]},
options:{animation:false, scales:{y:{beginAtZero:true}}}
});

function startTest(){
  document.getElementById('load-alert').innerText='';
  fetch('/start-test',{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({
    url:document.getElementById('url').value,
    vus:parseInt(document.getElementById('vus').value),
    duration:parseInt(document.getElementById('duration').value)
  })});
}
function stopTest(){ fetch('/stop-test',{method:'POST'}); }

socket.on("log", data=>{
  const logs = document.getElementById("logs");
  logs.innerHTML+=data+"<br>";
  logs.scrollTop=logs.scrollHeight;
});
socket.on("avg", avg=>{
  const time = new Date().toLocaleTimeString();
  chart.data.labels.push(time);
  chart.data.datasets[0].data.push(avg);
  chart.data.datasets[1].data.push(0);
  chart.update();
});
socket.on("errors", count=>{
  const time = new Date().toLocaleTimeString();
  chart.data.labels.push(time);
  chart.data.datasets[1].data.push(count);
  if(count>0) document.getElementById('load-alert').innerText='⚠️ توجد أخطاء أثناء الاختبار!';
  chart.update();
});

// ========== TikTok Live ==========
function startTikTok(){
  document.getElementById('tiktok-alert').innerText='';
  fetch('/start-tiktok',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({username:document.getElementById('tiktok-user').value})
  });
}
function stopTikTok(){ fetch('/stop-tiktok',{method:'POST'}); }

socket.on("tiktok-chat", data=>{
  const chatBox = document.getElementById("chat");
  chatBox.innerHTML+="<b>"+data.user+"</b>: "+data.message+"<br>";
  chatBox.scrollTop=chatBox.scrollHeight;
});
socket.on("tiktok-viewers", count=>{
  document.getElementById("viewers").innerText=count;
});
socket.on("alert", msg=>{
  document.getElementById('tiktok-alert').innerText='⚠️ '+msg;
});
</script>
</div>
</body>
</html>
  `);
});

// ================= Server Start =================
server.listen(3000,()=>console.log("🔥 Server running on http://localhost:3000"));
