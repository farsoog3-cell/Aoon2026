// server.js
const express = require("express");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
app.use(express.json());

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
    input, button { padding:10px; margin:5px; }
    #status { margin-top:15px; font-weight:bold; }
    #chat { margin-top:20px; height:300px; overflow:auto; border:1px solid #444; padding:10px; text-align:left; background:#222; }
    .message { display:flex; align-items:center; margin-bottom:5px; }
    .message img { width:30px; height:30px; border-radius:50%; margin-right:8px; }
  </style>
</head>
<body>
  <h2>مراقبة بث TikTok</h2>
  <input id="username" placeholder="اكتب اسم الحساب فقط">
  <button onclick="start()">ابدأ البث</button>

  <div id="status">⏳ لم يتم الاتصال بعد</div>
  <div id="chat"></div>

  <h3>إرسال رسالة حقيقية للبث:</h3>
  <input id="message" placeholder="اكتب رسالتك هنا">
  <button onclick="sendMessage()">أرسل</button>

  <script>
    let pollingInterval = null;

    function renderMessages(data){
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
    }

    function start() {
      const username = document.getElementById("username").value.trim();
      if(!username) return alert("❌ أدخل اسم الحساب");

      document.getElementById("status").innerText = "⏳ جاري الاتصال...";
      fetch("/start", {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ username })
      })
      .then(res=>res.json())
      .then(data=>{
        if(data.error){
          document.getElementById("status").innerText=data.error;
          return;
        }
        document.getElementById("status").innerText="✅ متصل بالبث";

        if(pollingInterval) clearInterval(pollingInterval);
        pollingInterval = setInterval(()=>{
          fetch("/data")
          .then(res=>res.json())
          .then(data=>{
            document.getElementById("status").innerText = "👀 المشاهدين الآن: "+data.viewers;
            renderMessages(data);
          });
        }, 2000);
      });
    }

    function sendMessage() {
      const msgInput = document.getElementById("message");
      const msg = msgInput.value.trim();
      if(!msg) return;

      fetch("/localChat", {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ message: msg })
      })
      .then(res => res.json())
      .then(data => {
        if(!data.error){
          // أضف الرسالة فورًا للـ chat
          const chat = document.getElementById("chat");
          chat.innerHTML += \`
            <div class="message">
              <img src="https://via.placeholder.com/30">
              <span>📝 أنت: \${msg}</span>
            </div>
          \`;
          chat.scrollTop = chat.scrollHeight;
          msgInput.value = "";
        } else {
          alert(data.error);
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
  if(!username) return res.json({ error: "❌ أدخل اسم الحساب" });

  if(connection) {
    try { connection.disconnect(); } catch(e){}
    connection = null;
  }

  viewers = 0;
  messages = [];

  connection = new WebcastPushConnection(username);

  try{
    await connection.connect();

    connection.on("roomUser", data => { viewers = data.viewerCount; });

    connection.on("chat", data => {
      messages.push({
        avatar: data.profilePictureUrl || "https://via.placeholder.com/30",
        text: "💬 " + data.nickname + ": " + data.comment
      });
      if(messages.length>50) messages.shift();
    });

    // إعادة الاتصال التلقائي عند الانقطاع
    connection.on("disconnected", () => {
      console.log("تم قطع الاتصال، محاولة إعادة الاتصال بعد 5 ثواني...");
      setTimeout(async ()=>{
        try{ await connection.connect(); }catch(e){ console.log("فشل إعادة الاتصال"); }
      }, 5000);
    });

    res.json({ status:"connected" });
  }catch(err){
    res.json({ error:"❌ الحساب غير مباشر أو فشل الاتصال" });
  }
});

// إعادة بيانات البث
app.get("/data",(req,res)=>{
  res.json({ viewers, messages });
});

// إرسال رسالة حقيقية للبث
app.post("/localChat", async (req,res)=>{
  const msg = req.body.message;
  if(!msg) return res.json({ error:"❌ الرسالة فارغة" });

  if(!connection){
    return res.json({ error:"❌ لم يتم الاتصال بالبث" });
  }

  try{
    await connection.sendComment(msg); // إرسال للبث المباشر
    messages.push({
      avatar: "https://via.placeholder.com/30",
      text: "📝 أنت: " + msg
    });
    if(messages.length>50) messages.shift();

    res.json({ status:"ok" });
  }catch(err){
    console.log(err);
    res.json({ error:"❌ فشل إرسال الرسالة" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log("Server running on port "+PORT));
