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
    #localChat { margin-top:10px; }
  </style>
</head>
<body>
  <h2>مراقبة بث TikTok</h2>
  <input id="username" placeholder="اكتب اسم الحساب فقط">
  <button onclick="start()">ابدأ البث</button>

  <div id="status">⏳ لم يتم الاتصال بعد</div>
  <div id="chat"></div>

  <h3>محاكاة إرسال رسالة:</h3>
  <input id="message" placeholder="اكتب رسالتك هنا">
  <button onclick="sendMessage()">أرسل</button>

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

          const chat = document.getElementById("chat");
          chat.innerHTML = "";
          data.messages.forEach(msg=>{
            chat.innerHTML += msg + "<br>";
          });
          chat.scrollTop = chat.scrollHeight;
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

// بدء الاتصال بالبث
app.post("/start", async (req,res)=>{
  const username = req.body.username;
  if(!username) return res.json({ error: "❌ أدخل اسم الحساب" });

  if(connection) connection.disconnect();

  viewers = 0;
  messages = [];

  connection = new WebcastPushConnection(username);

  try{
    await connection.connect();

    connection.on("roomUser", data => { viewers = data.viewerCount; });
    connection.on("chat", data => {
      messages.push("💬 " + data.nickname + ": " + data.comment);
      if(messages.length>50) messages.shift();
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

// إضافة رسالة محلية (محاكاة)
app.post("/localChat",(req,res)=>{
  const msg = req.body.message;
  if(!msg) return res.json({ error:"❌ الرسالة فارغة" });

  messages.push("📝 أنت: " + msg);
  if(messages.length>50) messages.shift();
  res.json({ status:"ok" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log("Server running"));
