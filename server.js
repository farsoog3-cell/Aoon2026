const express = require("express");
const http = require("http");
const { WebSocketServer } = require("ws");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let connection = null;
let viewers = 0;
let messages = [];

// صفحة الويب
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>TikTok Live Monitor</title>
<style>
body { background:#111; color:#fff; font-family:Arial; text-align:center; }
#status { margin-top:15px; font-weight:bold; }
#chat { margin-top:20px; height:400px; overflow:auto; border:1px solid #444; padding:10px; text-align:left; background:#222; }
.message { display:flex; align-items:center; margin-bottom:5px; }
.message img { width:30px; height:30px; border-radius:50%; margin-right:8px; }
input, button { padding:10px; margin:5px; }
</style>
</head>
<body>
<h2>مراقبة بث TikTok</h2>
<input id="username" placeholder="اكتب اسم الحساب فقط">
<button onclick="start()">ابدأ البث</button>

<div id="status">⏳ لم يتم الاتصال بعد</div>
<div id="chat"></div>

<script>
let ws;

function start() {
  const username = document.getElementById("username").value.trim();
  if(!username){ alert("أدخل اسم الحساب"); return; }

  fetch("/start", {
    method:"POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ username })
  })
  .then(res=>res.json())
  .then(data=>{
    if(data.error){
      document.getElementById("status").innerText = data.error;
    } else {
      document.getElementById("status").innerText = "✅ متصل بالبث";

      if(ws) ws.close();
      ws = new WebSocket("ws://"+location.host);

      ws.onmessage = function(event){
        const data = JSON.parse(event.data);
        document.getElementById("status").innerText = "👀 المشاهدين الآن: "+data.viewers;

        const chat = document.getElementById("chat");
        chat.innerHTML = "";
        data.messages.forEach(msg=>{
          chat.innerHTML += \`
            <div class="message">
              <img src="\${msg.avatar}" onerror="this.src='https://via.placeholder.com/30'">
              <span>\${msg.text}</span>
            </div>
          \`;
        });
        chat.scrollTop = chat.scrollHeight;
      };
    }
  });
}
</script>
</body>
</html>
  `);
});

// بدء الاتصال بالبث
app.post("/start", async (req,res)=>{
  const username = req.body.username;
  if(!username) return res.json({ error:"❌ أدخل اسم الحساب" });

  try {
    if(connection) connection.disconnect();
    viewers = 0;
    messages = [];

    connection = new WebcastPushConnection(username);
    await connection.connect();

    connection.on("roomUser", data => { viewers = data.viewerCount; });
    connection.on("chat", data => {
      messages.push({
        avatar: data.profilePictureUrl || "https://via.placeholder.com/30",
        text: "💬 " + data.nickname + ": " + data.comment
      });
      if(messages.length>100) messages.shift();
      broadcast();
    });

    res.json({ status:"connected" });
  } catch(err) {
    res.json({ error:"❌ الحساب غير مباشر أو فشل الاتصال بالبث" });
  }
});

// WebSocket لبث البيانات مباشرة
function broadcast(){
  const data = JSON.stringify({ viewers, messages });
  wss.clients.forEach(client => {
    if(client.readyState === 1) client.send(data);
  });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
