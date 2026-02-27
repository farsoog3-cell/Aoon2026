const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
app.use(express.json());

let browser = null;
let page = null;
let messages = [];
let viewers = "0";
let interval = null;

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.send(`
  <html>
  <body style="background:#111;color:white;text-align:center;font-family:Arial">
    <h2>TikTok Live Monitor</h2>
    <input id="username" placeholder="username بدون @">
    <button onclick="start()">ابدأ</button>
    <h3 id="viewers"></h3>
    <div id="chat" style="height:300px;overflow:auto;border:1px solid #444;margin-top:10px;padding:10px"></div>

<script>
function start(){
  const username=document.getElementById("username").value;
  fetch("/start",{
    method:"POST",
    headers:{ "Content-Type":"application/json"},
    body:JSON.stringify({username})
  });

  setInterval(()=>{
    fetch("/data")
    .then(r=>r.json())
    .then(d=>{
      document.getElementById("viewers").innerText="👀 "+d.viewers;
      document.getElementById("chat").innerHTML=d.messages.map(m=>"<p>"+m+"</p>").join("");
    });
  },3000);
}
</script>
  </body>
  </html>
  `);
});

// بدء المراقبة
app.post("/start", async (req,res)=>{
  const username = req.body.username?.replace("@","");
  if(!username) return res.json({error:"اكتب اسم الحساب"});

  try{

    if(browser){
      clearInterval(interval);
      await browser.close();
    }

    browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process"
      ]
    });

    page = await browser.newPage();

    await page.goto(`https://www.tiktok.com/@${username}/live`, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // انتظر تحميل الصفحة
    await new Promise(r => setTimeout(r, 10000));

    interval = setInterval(async ()=>{
      try{
        messages = await page.evaluate(()=>{
          return Array.from(document.querySelectorAll('[data-e2e="chat-message"]'))
            .map(e=>e.innerText)
            .slice(-50);
        });

        viewers = await page.evaluate(()=>{
          const el=document.querySelector('[data-e2e="live-people-count"]');
          return el ? el.innerText : "0";
        });

      }catch(e){}
    },3000);

    res.json({status:"connected"});

  }catch(err){
    console.log("ERROR:",err);
    res.json({error:"فشل تشغيل المتصفح"});
  }
});

app.get("/data",(req,res)=>{
  res.json({messages,viewers});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT,()=>console.log("Server running on port",PORT));
