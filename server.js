// server.js
const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
app.use(express.json());

let bot = null;
let messages = [];
let viewers = 0;

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
  <input id="liveUrl" placeholder="ضع رابط البث المباشر هنا">
  <button onclick="start()">ابدأ البث</button>

  <div id="status">⏳ لم يتم الاتصال بعد</div>
  <div id="chat"></div>

  <h3>إرسال رسالة حقيقية للبث:</h3>
  <input id="message" placeholder="اكتب رسالتك هنا">
  <button onclick="sendMessage()">أرسل</button>

  <script>
    function renderMessages(){
      const chat = document.getElementById("chat");
      chat.innerHTML = "";
      fetch("/data")
        .then(res=>res.json())
        .then(data=>{
          data.messages.forEach(msg=>{
            chat.innerHTML += \`
              <div class="message">
                <img src="https://via.placeholder.com/30">
                <span>\${msg.text}</span>
              </div>
            \`;
          });
          chat.scrollTop = chat.scrollHeight;
        });
    }

    function start(){
      const liveUrl = document.getElementById("liveUrl").value.trim();
      if(!liveUrl) return alert("❌ أدخل رابط البث");

      fetch("/startBot", {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ liveUrl })
      })
      .then(res=>res.json())
      .then(data=>{
        if(data.error) document.getElementById("status").innerText = data.error;
        else document.getElementById("status").innerText = "✅ البوت جاهز لإرسال الرسائل";
      });

      // تحديث الرسائل كل ثانيتين
      setInterval(renderMessages, 2000);
    }

    function sendMessage(){
      const msgInput = document.getElementById("message");
      const msg = msgInput.value.trim();
      if(!msg) return;

      fetch("/sendMessage", {
        method:"POST",
        headers: {"Content-Type":"application/json"},
        body: JSON.stringify({ message: msg })
      })
      .then(res=>res.json())
      .then(data=>{
        if(!data.error){
          msgInput.value = "";
          renderMessages();
        } else alert(data.error);
      });
    }
  </script>
</body>
</html>
  `);
});

// بدء البوت Puppeteer
app.post("/startBot", async (req,res)=>{
  const { liveUrl } = req.body;
  if(!liveUrl) return res.json({ error:"❌ رابط البث فارغ" });

  try{
    const browser = await puppeteer.launch({ headless:false });
    const page = await browser.newPage();
    await page.setViewport({ width:1280, height:800 });

    await page.goto('https://www.tiktok.com/login');
    console.log("⏳ سجّل الدخول يدويًا الآن...");
    await page.waitForTimeout(30000); // وقت لتسجيل الدخول يدوياً

    await page.goto(liveUrl, { waitUntil: 'networkidle2' });
    console.log("✅ البث جاهز لإرسال الرسائل");

    bot = {
      page,
      browser,
      sendMessage: async (msg)=>{
        try{
          const inputSelector = 'div[data-e2e="live-chat-input"] div[contenteditable="true"]';
          await page.waitForSelector(inputSelector, { timeout:5000 });
          await page.focus(inputSelector);
          await page.keyboard.type(msg, { delay:50 });
          await page.keyboard.press('Enter');

          // حفظ الرسالة محليًا
          messages.push({ text: "📝 أنت: " + msg });
          if(messages.length>50) messages.shift();
        }catch(err){
          console.log("❌ فشل إرسال الرسالة:", err.message);
        }
      }
    };

    res.json({ status:"ok" });
  }catch(err){
    console.log(err);
    res.json({ error:"❌ فشل بدء البوت" });
  }
});

// إرسال رسالة حقيقية
app.post("/sendMessage", async (req,res)=>{
  const { message: msg } = req.body;
  if(!msg) return res.json({ error:"❌ الرسالة فارغة" });
  if(!bot) return res.json({ error:"❌ البوت غير متصل" });

  try{
    await bot.sendMessage(msg);
    res.json({ status:"ok" });
  }catch(err){
    console.log(err);
    res.json({ error:"❌ فشل إرسال الرسالة" });
  }
});

// بيانات الرسائل للواجهة
app.get("/data",(req,res)=>{
  res.json({ messages });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log("Server running on port "+PORT));
