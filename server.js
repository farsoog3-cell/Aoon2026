const express = require("express");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();
app.use(express.json());

let connection = null;
let viewers = 0;
let messages = [];
let isConnected = false;

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
#chat { height:300px; overflow:auto; border:1px solid #444; padding:10px; background:#222; text-align:left; }
.message { display:flex; align-items:center; margin-bottom:6px; }
.message img { width:30px; height:30px; border-radius:50%; margin-right:8px; }
</style>
</head>
<body>

<h2>مراقبة بث TikTok</h2>

<input id="username" placeholder="اكتب اسم الحساب بدون @">
<button onclick="start()">ابدأ</button>

<div id="status">⏳ غير متصل</div>
<div id="chat"></div>

<script>
let interval = null;

function start(){
  const username = document.getElementById("username").value.trim().replace("@","");
  if(!username) return alert("اكتب اسم الحساب");

  document.getElementById("status").innerText="⏳ جاري الاتصال...";

  fetch("/start",{
    method:"POST",
    headers:{ "Content-Type":"application/json"},
    body:JSON.stringify({username})
  })
  .then(r=>r.json())
  .then(data=>{
    if(data.error){
      document.getElementById("status").innerText=data.error;
      return;
    }

    document.getElementById("status").innerText="✅ متصل";

    if(interval) clearInterval(interval);

    interval=setInterval(()=>{
      fetch("/data")
      .then(r=>r.json())
      .then(data=>{
        document.getElementById("status").innerText="👀 المشاهدين: "+data.viewers;

        const chat=document.getElementById("chat");
        chat.innerHTML="";
        data.messages.forEach(m=>{
          chat.innerHTML+=\`
            <div class="message">
              <img src="\${m.avatar}" onerror="this.src='https://via.placeholder.com/30'">
              <span>\${m.text}</span>
            </div>
          \`;
        });
        chat.scrollTop=chat.scrollHeight;
      });
    },2000);
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
  if(!username) return res.json({ error:"❌ اكتب اسم الحساب" });

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
      fetchRoomInfoOnConnect:true,
      enableExtendedGiftInfo:true
    });

    await connection.connect();

    isConnected=true;

    console.log("Connected to:",username);

    connection.on("roomUser",data=>{
      viewers=data.viewerCount;
    });

    connection.on("chat",data=>{
      messages.push({
        avatar:data.profilePictureUrl || "https://via.placeholder.com/30",
        text:"💬 "+data.nickname+": "+data.comment
      });

      if(messages.length>100) messages.shift();
    });

    connection.on("disconnected",()=>{
      console.log("Disconnected");
      isConnected=false;
    });

    res.json({status:"connected"});

  }catch(err){
    console.log("Connection Error:",err.message);
    res.json({ error:"❌ الحساب غير مباشر أو تيك توك منع الاتصال" });
  }
});

app.get("/data",(req,res)=>{
  res.json({ viewers, messages });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log("Server running on port",PORT));
