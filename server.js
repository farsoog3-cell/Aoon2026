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
  body { background:#121212; color:#fff; font-family:'Arial', sans-serif; margin:0; }
  .container { display:flex; height:100vh; }
  .main { flex:3; padding:15px; display:flex; flex-direction:column; }
  .sidebar { flex:1; border-left:1px solid #333; padding:15px; background:#1a1a1a; overflow-y:auto; position:relative; }
  
  /* واجهة التفاعل العليا */
  #topBar { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
  .stat { background:#222; padding:8px 12px; border-radius:10px; margin-right:5px; display:flex; align-items:center; gap:5px; }
  .stat span { font-weight:bold; }

  /* الدردشة */
  #chat { flex:1; overflow-y:auto; padding:10px; background:#1e1e1e; border-radius:10px; display:flex; flex-direction:column-reverse; }
  .message { display:flex; align-items:flex-start; margin-bottom:8px; padding:5px; border-bottom:1px solid #333; border-radius:5px; }
  .message img { width:35px; height:35px; border-radius:50%; margin-right:10px; flex-shrink:0; }
  .message span { word-break: break-word; }

  input, button { padding:8px 12px; margin:5px; border-radius:8px; border:none; }
  button { background:#ff2d55; color:#fff; cursor:pointer; }
  button:hover { background:#e0204a; }

  /* الهدايا */
  .gift-bubble { position: absolute; left:50%; transform:translateX(-50%); background:#ffd700; color:#000; padding:5px 10px; border-radius:20px; font-weight:bold; display:flex; align-items:center; gap:5px; opacity:0.9; animation: floatUp 2s linear forwards; }
  .gift-bubble img { width:20px; height:20px; border-radius:50%; }
  @keyframes floatUp { 0% { bottom:0; opacity:1; } 100% { bottom:300px; opacity:0; } }

  /* القلوب */
  #hearts { display:flex; align-items:center; gap:5px; }
  #hearts span { font-size:18px; color:red; font-weight:bold; }
</style>
</head>
<body>
<div class="container">
  <div class="main">
    <div id="topBar">
      <div class="stat">👀 المشاهدين: <span id="viewerCount">0</span></div>
      <div class="stat">❤️ القلوب: <span id="likeCount">0</span></div>
      <div class="stat">🎁 الهدايا: <span id="giftCount">0</span></div>
    </div>

    <div id="chat"></div>

    <div style="display:flex; margin-top:10px;">
      <input id="username" placeholder="اسم الحساب" style="flex:1;">
      <button onclick="start()">ابدأ البث</button>
    </div>

    <div style="display:flex; margin-top:5px;">
      <input id="message" placeholder="اكتب رسالتك هنا" style="flex:1;">
      <button onclick="sendMessage()">أرسل</button>
    </div>
  </div>

  <div class="sidebar">
    <h3>🎁 الهدايا</h3>
    <div id="giftContainer" style="position:relative; height:90%;"></div>
  </div>
</div>

<script>
function start() {
  const username = document.getElementById("username").value;
  fetch("/start", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({username})})
  .then(res=>res.json()).then(data=>{
    if(data.error){ alert(data.error); } else { console.log("Connected!"); }
  });

  setInterval(()=>{
    fetch("/data").then(res=>res.json()).then(data=>{
      document.getElementById("viewerCount").innerText = data.viewers;
      document.getElementById("likeCount").innerText = data.likes;
      document.getElementById("giftCount").innerText = data.gifts;

      // الدردشة
      const chat = document.getElementById("chat");
      chat.innerHTML = "";
      data.messages.forEach(msg=>{
        chat.innerHTML += \`
        <div class="message">
          <img src="\${msg.avatar}" onerror="this.src='https://via.placeholder.com/35'">
          <span>\${msg.text}</span>
        </div>\`;
      });

      // فقاعات الهدايا
      const giftContainer = document.getElementById("giftContainer");
      data.giftMessages.forEach(gmsg=>{
        const bubble = document.createElement("div");
        bubble.className = "gift-bubble";
        bubble.innerHTML = \`<img src="\${gmsg.avatar}" onerror="this.src='https://via.placeholder.com/20'">\${gmsg.text}\`;
        bubble.style.left = Math.random() * 80 + "%";
        giftContainer.appendChild(bubble);
        setTimeout(()=>{ giftContainer.removeChild(bubble); }, 2000);
      });
    });
  }, 2000);
}

function sendMessage() {
  const msg = document.getElementById("message").value.trim();
  if(!msg) return;
  fetch("/localChat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:msg})})
  .then(res=>res.json()).then(data=>{
    if(!data.error) document.getElementById("message").value="";
  });
}
</script>
</body>
</html>
  `);
});

app.post("/start", async (req,res)=>{
  const username = req.body.username;
  if(!username) return res.json({ error:"❌ أدخل اسم الحساب" });
  if(connection) connection.disconnect();
  viewers=0; likes=0; gifts=0; messages=[]; giftMessages=[]; roomInfo={};

  connection = new WebcastPushConnection(username);

  try{
    await connection.connect();

    connection.on("roomUser", data => { viewers = data.viewerCount; });

    connection.on("chat", data => {
      messages.push({avatar: data.profilePictureUrl||"https://via.placeholder.com/30", text:"💬 "+data.nickname+": "+data.comment});
      if(messages.length>50) messages.shift();
    });

    // قلوب بسيطة للـ likes
    connection.on("like", data => { likes += 1; });

    connection.on("gift", data => {
      gifts += data.repeatCount || 1;
      giftMessages.push({avatar: data.profilePictureUrl||"https://via.placeholder.com/30", text:`${data.nickname} أرسل ${data.giftName} x${data.repeatCount||1}`});
      if(giftMessages.length>50) giftMessages.shift();
    });

    connection.on("roomInfo", data => {
      roomInfo = {
        title:data.room.title,
        location:data.room.location||"غير معروف",
        startTime:new Date(data.room.startTime).toLocaleString()
      };
    });

    res.json({status:"connected"});
  }catch(err){ console.log(err); res.json({error:"❌ الحساب غير مباشر أو فشل الاتصال"}); }
});

app.get("/data",(req,res)=>{ res.json({viewers, likes, gifts, messages, giftMessages, roomInfo}); });

app.post("/localChat",(req,res)=>{
  const msg = req.body.message;
  if(!msg) return res.json({error:"❌ الرسالة فارغة"});
  messages.push({avatar:"https://via.placeholder.com/30", text:"📝 أنت: "+msg});
  if(messages.length>50) messages.shift();
  res.json({status:"ok"});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log("Server running"));
