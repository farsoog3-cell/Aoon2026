const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
app.use(express.json());

let browser;
let page;
let messages = [];
let viewers = "غير معروف";

// الصفحة
app.get("/", (req, res) => {
  res.send(`
  <h2>TikTok Live Monitor</h2>
  <input id="user" placeholder="username بدون @">
  <button onclick="start()">ابدأ</button>
  <h3 id="viewers"></h3>
  <div id="chat"></div>

<script>
function start(){
  const username = document.getElementById("user").value;
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
  `);
});

// بدء المراقبة
app.post("/start", async (req,res)=>{
  const username = req.body.username?.replace("@","");
  if(!username) return res.json({error:"اكتب اسم الحساب"});

  try{
    if(browser) await browser.close();

    browser = await puppeteer.launch({
      headless: false,
      args: ["--no-sandbox","--disable-setuid-sandbox"]
    });

    page = await browser.newPage();

    await page.goto(`https://www.tiktok.com/@${username}/live`, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    console.log("فتح البث بنجاح");

    setInterval(async ()=>{
      try{
        messages = await page.evaluate(()=>{
          return Array.from(document.querySelectorAll('[data-e2e="chat-message"]'))
            .map(e=>e.innerText)
            .slice(-30);
        });

        viewers = await page.evaluate(()=>{
          const el=document.querySelector('[data-e2e="live-people-count"]');
          return el ? el.innerText : "غير معروف";
        });

      }catch(e){}
    },3000);

    res.json({status:"ok"});
  }catch(err){
    console.log(err);
    res.json({error:"فشل تشغيل المتصفح"});
  }
});

app.get("/data",(req,res)=>{
  res.json({messages,viewers});
});

app.listen(3000,()=>console.log("Server on http://localhost:3000"));
