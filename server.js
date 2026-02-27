const express = require("express");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
app.use(express.json());

let connection = null;
let viewers = 0;
let messages = [];
let isConnected = false;

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

<script>
let interval;

function start(){
  const username = document.getElementById("username").value.trim();
  if(!username) return alert("اكتب اسم الحساب");

  fetch("/start",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({username})
  })
  .then(res=>res.json())
  .then(data=>{
    if(data.error){
      document.getElementById("status").innerText=data.error;
      return;
    }

    document.getElementById("status").innerText="متصل ✔";

    if(interval) clearInterval(interval);
    interval=setInterval(loadData,1500);
  });
}

function loadData(){
  fetch("/data")
  .then(res=>res.json())
  .then(data=>{
    document.getElementById("status").innerText="👀 "+data.viewers+" مشاهد";

    const chat=document.getElementById("chat");
    chat.innerHTML="";
    data.messages.forEach(m=>{
      chat.innerHTML+="<div>"+m+"</div>";
    });
    chat.scrollTop=chat.scrollHeight;
  });
}
</script>

</body>
</html>
`);
});

// بدء الاتصال
app.post("/start", async (req,res)=>{
  const username = req.body.username;
  if(!username) return res.json({error:"اكتب اسم الحساب"});

  try{
    if(connection){
      connection.disconnect();
      connection=null;
    }

    viewers=0;
    messages=[];
    isConnected=false;

    connection = new WebcastPushConnection(username,{
      processInitialData:true,
      enableExtendedGiftInfo:true
    });

    await connection.connect();
    isConnected=true;

    connection.on("roomUser", data=>{
      viewers=data.viewerCount || 0;
    });

    connection.on("chat", data=>{
      messages.push(data.nickname+": "+data.comment);
      if(messages.length>100) messages.shift();
    });

    connection.on("disconnected", ()=>{
      isConnected=false;
    });

    res.json({status:"connected"});

  }catch(err){
    console.log("ERROR:",err);
    res.json({error:"فشل الاتصال بالبث"});
  }
});

app.get("/data",(req,res)=>{
  res.json({viewers,messages});
});

const PORT=3000;
app.listen(PORT,()=>console.log("Running on http://localhost:3000"));
