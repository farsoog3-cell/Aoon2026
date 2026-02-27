const express = require("express");
const { WebcastPushConnection } = require("tiktok-live-connector");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());

let connections = {}; // لتخزين كل اتصال للبثوص

// الصفحة
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>TikTok Live Monitor</title>
<style>
body {background:#111;color:#fff;font-family:Arial;text-align:center}
input,button{padding:10px;margin:5px}
#chat{height:400px;overflow:auto;border:1px solid #444;padding:10px;background:#222;text-align:left}
</style>
</head>
<body>

<h2>TikTok Live Monitor</h2>

<input id="username" placeholder="username بدون @">
<button onclick="start()">ابدأ</button>

<div id="status">غير متصل</div>
<div id="chat"></div>

<script src="/socket.io/socket.io.js"></script>
<script>
const socket = io();
let currentUser = "";

function start(){
  const username = document.getElementById("username").value.trim();
  if(!username) return alert("اكتب اسم الحساب");
  currentUser = username;
  socket.emit("start", {username});
}

socket.on("connected", (data) => {
  if(data.username !== currentUser) return;
  document.getElementById("status").innerText = "متصل ✔";
});

socket.on("update", (data) => {
  if(data.username !== currentUser) return;
  document.getElementById("status").innerText = "👀 "+data.viewers+" مشاهد";

  const chat=document.getElementById("chat");
  chat.innerHTML="";
  data.messages.forEach(m=>{
    chat.innerHTML+="<div>"+m+"</div>";
  });
  chat.scrollTop=chat.scrollHeight;
});

socket.on("errorMsg", (data) => {
  if(data.username !== currentUser) return;
  document.getElementById("status").innerText = data.error;
});
</script>

</body>
</html>
  `);
});

// بدء الاتصال عبر WebSocket
io.on("connection", (socket) => {
  socket.on("start", async ({username}) => {
    if(!username) return socket.emit("errorMsg", {username, error:"اكتب اسم الحساب"});

    try {
      // إذا هناك اتصال سابق، افصله
      if(connections[username]) {
        connections[username].connection.disconnect();
        delete connections[username];
      }

      let viewers = 0;
      let messages = [];

      const connection = new WebcastPushConnection(username, {
        processInitialData: true,
        enableExtendedGiftInfo: true
      });

      await connection.connect();

      connections[username] = { connection, viewers, messages };

      // إعلام الواجهة بأننا متصلين
      socket.emit("connected", {username});

      // تحديث المشاهدات
      connection.on("roomUser", data => {
        viewers = data.viewerCount || 0;
        connections[username].viewers = viewers;
        socket.emit("update", {username, viewers, messages});
      });

      // تحديث الدردشة
      connection.on("chat", data => {
        messages.push(data.nickname + ": " + data.comment);
        if(messages.length > 100) messages.shift();
        connections[username].messages = messages;
        socket.emit("update", {username, viewers, messages});
      });

      connection.on("disconnected", () => {
        delete connections[username];
        socket.emit("errorMsg", {username, error:"تم فصل البث"});
      });

      connection.on("error", (err) => {
        console.log("TikTok ERROR:", err);
        socket.emit("errorMsg", {username, error:"حدث خطأ أثناء الاتصال"});
      });

    } catch(err) {
      console.log("ERROR:", err);
      socket.emit("errorMsg", {username, error:"فشل الاتصال بالبث"});
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => console.log("Running on http://localhost:3000"));
