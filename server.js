const express = require("express");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
app.use(express.json());

let connection = null;
let viewers = 0;
let likes = 0;
let gifts = 0;
let messages = [];
let giftMessages = [];
let roomInfo = {};

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>TikTok Live Monitor</title>
  <style>
    body { background:#111; color:#fff; font-family:Arial; margin:0; overflow:hidden; }
    .container { display:flex; height:100vh; }
    .main { flex:3; padding:10px; }
    .sidebar { flex:1; border-left:1px solid #444; padding:10px; background:#1a1a1a; overflow-y:auto; position:relative; }
    input, button { padding:10px; margin:5px; }
    #status { margin-top:15px; font-weight:bold; }
    #info { margin-top:10px; font-size:16px; }
    #chat { margin-top:20px; height:70%; overflow:auto; border:1px solid #444; padding:10px; text-align:left; background:#222; }
    .message { display:flex; align-items:center; margin-bottom:5px; }
    .message img { width:30px; height:30px; border-radius:50%; margin-right:8px; }
    /* فقاعات الهدايا */
    .gift-bubble {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      background: #ffd700;
      color:#000;
      padding:5px 10px;
      border-radius:20px;
      font-weight:bold;
      display:flex;
      align-items:center;
      gap:5px;
      opacity:0.9;
      animation: floatUp 2s linear forwards;
    }
    .gift-bubble img { width:20px; height:20px; border-radius:50%; }
    @keyframes floatUp {
      0% { bottom:0; opacity:1; }
      100% { bottom:300px; opacity:0; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="main">
      <h2>مراقبة بث TikTok</h2>
      <input id="username" placeholder="اكتب اسم الحساب فقط">
      <button onclick="start()">ابدأ البث</button>

      <div id="status">⏳ لم يتم الاتصال بعد</div>
      <div id="info"></div>
      <div id="chat"></div>

      <h3>محاكاة إرسال رسالة:</h3>
      <input id="message" placeholder="اكتب رسالتك هنا">
      <button onclick="sendMessage()">أرسل</button>
    </div>
    <div class="sidebar">
      <h3>🎁 الهدايا</h3>
      <div id="giftContainer" style="position:relative; height:90%;"></div>
    </div>
  </div>

  <script>
    function start() {
      const username = document.getElementById("username").value;
      document.getElementById("status").innerText = "⏳ جاري الاتصال...";
      fetch("/start", {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ username })
      })
      .then(res=>res.json())
      .then(data=>{
        if(data.error){ document.getElementById("status").innerText=data.error; }
        else { document.getElementById("status").innerText="✅ متصل بالبث"; }
      });

      setInterval(()=>{
        fetch("/data")
        .then(res=>res.json())
        .then(data=>{
          document.getElementById("status").innerText = "👀 المشاهدين الآن: "+data.viewers;
          document.getElementById("info").innerHTML = "❤️ لايكات: "+data.likes+"<br>ℹ️ العنوان: "+(data.roomInfo.title || "غير معروف")+" | المكان: "+(data.roomInfo.location || "غير معروف")+" | الوقت: "+(data.roomInfo.startTime || "غير معروف");

          // الدردشة
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

          // فقاعات الهدايا
          const giftContainer = document.getElementById("giftContainer");
          data.giftMessages.forEach(gmsg=>{
            const bubble = document.createElement("div");
            bubble.className = "gift-bubble";
            bubble.innerHTML = \`<img src="\${gmsg.avatar}" onerror="this.src='https://via.placeholder.com/20'">\${gmsg.text}\`;
            bubble.style.left = Math.random() * 80 + "%"; // مواقع عشوائية على العرض
            giftContainer.appendChild(bubble);
            setTimeout(()=>{ giftContainer.removeChild(bubble); }, 2000);
          });
        });
      }, 2000);
    }

    function sendMessage() {
      const msg = document.getElementById("message").value.trim();
      if(!msg) return;
      fetch("/localChat", {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ message: msg })
      }).then(res=>res.json())
      .then(data=>{
        if(!data.error){
          document.getElementById("message").value="";
        }
      });
    }
  </script>
</body>
</html>
  `);
});

app.post("/start", async (req,res)=>{
  const username = req.body.username;
  if(!username) return res.json({ error: "❌ أدخل اسم الحساب" });

  if(connection) {
    connection.disconnect();
    connection = null;
  }

  viewers = 0;
  likes = 0;
  gifts = 0;
  messages = [];
  giftMessages = [];
  roomInfo = {};

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

    connection.on("like", data => {
      likes += data.likeCount;
      messages.push({
        avatar: "https://via.placeholder.com/30",
        text: `❤️ حصلنا على ${data.likeCount} لايك جديد!`
      });
      if(messages.length>50) messages.shift();
    });

    connection.on("gift", data => {
      gifts += data.repeatCount || 1;
      giftMessages.push({
        avatar: data.profilePictureUrl || "https://via.placeholder.com/30",
        text: `${data.nickname} أرسل ${data.giftName} x${data.repeatCount || 1}`
      });
      if(giftMessages.length>50) giftMessages.shift();
    });

    connection.on("roomInfo", data => {
      roomInfo = {
        title: data.room.title,
        location: data.room.location || "غير معروف",
        startTime: new Date(data.room.startTime).toLocaleString()
      };
    });

    res.json({ status:"connected" });
  }catch(err){
    console.log(err);
    res.json({ error:"❌ الحساب غير مباشر أو فشل الاتصال" });
  }
});

app.get("/data",(req,res)=>{
  res.json({ viewers, likes, gifts, messages, giftMessages, roomInfo });
});

app.post("/localChat",(req,res)=>{
  const msg = req.body.message;
  if(!msg) return res.json({ error:"❌ الرسالة فارغة" });

  messages.push({
    avatar: "https://via.placeholder.com/30",
    text: "📝 أنت: " + msg
  });
  if(messages.length>50) messages.shift();
  res.json({ status:"ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log("Server running"));
