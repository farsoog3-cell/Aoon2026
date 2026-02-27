const express = require("express");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
app.use(express.json());

let connection = null;
let viewers = 0;
let messages = [];

// الصفحة الرئيسية
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
#chat { margin-top:20px; height:400px; overflow:auto; border:1px solid #444; padding:10px; background:#222; text-align:left; }
</style>
</head>
<body>

<h2>مراقبة بث TikTok</h2>

<input id="username" placeholder="اكتب اسم الحساب بدون @">
<button onclick="start()">ابدأ البث</button>

<div id="status">⏳ غير متصل</div>
<div id="chat"></div>

<script>
let interval;

function start(){
  const username = document.getElementById("username").value.trim();
  if(!username){
    alert("اكتب اسم الحساب");
    return;
  }

  fetch("/start",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({username})
  })
  .then(res=>res.json())
  .then(data=>{
    if(data.error){
      document.getElementById("status").innerText = data.error;
    } else {
      document.getElementById("status").innerText = "✅ متصل بالبث";

      if(interval) clearInterval(interval);
      interval = setInterval(loadData,2000);
    }
  })
  .catch(()=>{
    document.getElementById("status").innerText="❌ خطأ في الاتصال بالسيرفر";
  });
}

function loadData(){
  fetch("/data")
  .then(res=>res.json())
  .then(data=>{
    document.getElementById("status").innerText = "👀 المشاهدين الآن: "+data.viewers;

    const chat = document.getElementById("chat");
    chat.innerHTML="";
    data.messages.forEach(m=>{
      chat.innerHTML += "<div>"+m+"</div>";
    });

    chat.scrollTop = chat.scrollHeight;
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

  if(!username){
    return res.json({error:"❌ أدخل اسم الحساب بدون @"});
  }

  try{
    if(connection){
      connection.disconnect();
      connection = null;
    }

    viewers = 0;
    messages = [];

    connection = new WebcastPushConnection(username);

    await connection.connect();

    connection.on("roomUser", data=>{
      viewers = data.viewerCount;
    });

    connection.on("chat", data=>{
      messages.push(data.nickname + ": " + data.comment);
      if(messages.length > 50) messages.shift();
    });

    res.json({status:"connected"});

  }catch(err){
    console.log(err);
    res.json({error:"❌ الحساب غير مباشر أو فشل الاتصال"});
  }
});

// إرسال البيانات للصفحة
app.get("/data",(req,res)=>{
  res.json({viewers,messages});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log("Server running on port "+PORT));
