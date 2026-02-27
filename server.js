const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
app.use(express.json());

let bot = null;
let messages = [];

app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
<title>TikTok Live Controller</title>
<style>
body { background:#111; color:#fff; font-family:Arial; text-align:center; }
input, button { padding:10px; margin:5px; }
#chat { margin-top:20px; height:300px; overflow:auto; border:1px solid #444; padding:10px; background:#222; text-align:left;}
</style>
</head>
<body>

<h2>تحكم بث TikTok</h2>

<input id="liveUrl" placeholder="ضع رابط البث المباشر">
<button onclick="startBot()">تشغيل البوت</button>

<h3>إرسال رسالة</h3>
<input id="message" placeholder="اكتب رسالتك">
<button onclick="sendMessage()">إرسال</button>

<div id="chat"></div>

<script>
function refreshChat(){
  fetch("/messages")
  .then(res=>res.json())
  .then(data=>{
    const chat = document.getElementById("chat");
    chat.innerHTML = "";
    data.forEach(m=>{
      chat.innerHTML += "<div>"+m+"</div>";
    });
    chat.scrollTop = chat.scrollHeight;
  });
}

function startBot(){
  const liveUrl = document.getElementById("liveUrl").value.trim();
  if(!liveUrl) return alert("أدخل رابط البث");

  fetch("/start",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({liveUrl})
  }).then(res=>res.json())
  .then(data=>{
    alert(data.message || data.error);
  });
}

function sendMessage(){
  const msg = document.getElementById("message").value.trim();
  if(!msg) return;

  fetch("/send",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({message:msg})
  }).then(res=>res.json())
  .then(data=>{
    if(data.error) alert(data.error);
    else {
      document.getElementById("message").value="";
      refreshChat();
    }
  });
}

setInterval(refreshChat,2000);
</script>

</body>
</html>
`);
});


// تشغيل البوت
app.post("/start", async (req,res)=>{
  const { liveUrl } = req.body;
  if(!liveUrl) return res.json({ error:"رابط غير صالح" });

  try{

    const browser = await puppeteer.launch({
      headless:false,
      userDataDir:"./tiktok-session", // حفظ الجلسة هنا
      args:["--no-sandbox","--disable-setuid-sandbox"]
    });

    const page = await browser.newPage();
    await page.setViewport({width:1280,height:800});

    await page.goto("https://www.tiktok.com/");

    console.log("إذا كانت أول مرة، سجل دخولك الآن...");
    await new Promise(r => setTimeout(r,20000));

    await page.goto(liveUrl,{waitUntil:"networkidle2"});

    bot = { browser, page };

    res.json({ message:"✅ البوت جاهز" });

  }catch(err){
    console.log(err);
    res.json({ error:"فشل تشغيل البوت" });
  }
});


// إرسال رسالة حقيقية
app.post("/send", async (req,res)=>{
  if(!bot) return res.json({ error:"البوت غير مشغل" });

  const { message } = req.body;
  if(!message) return res.json({ error:"رسالة فارغة" });

  try{
    const inputSelector = 'div[data-e2e="live-chat-input"] div[contenteditable="true"]';

    await bot.page.waitForSelector(inputSelector,{timeout:5000});
    await bot.page.focus(inputSelector);
    await bot.page.keyboard.type(message,{delay:50});
    await bot.page.keyboard.press("Enter");

    messages.push("📝 أنت: "+message);
    if(messages.length>50) messages.shift();

    res.json({ status:"ok" });

  }catch(err){
    console.log(err);
    res.json({ error:"فشل الإرسال" });
  }
});

app.get("/messages",(req,res)=>{
  res.json(messages);
});

app.listen(3000,()=>console.log("Server running on port 3000"));
