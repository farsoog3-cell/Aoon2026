const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
app.use(express.json());

let browser = null;
let page = null;
let messages = [];

app.post("/start", async (req, res) => {
  const username = req.body.username?.replace("@", "");
  if (!username) return res.json({ error: "اكتب اسم الحساب" });

  try {
    if (browser) await browser.close();

    browser = await puppeteer.launch({
      headless: false, // مهم حتى يبدو طبيعي
      args: ["--no-sandbox"]
    });

    page = await browser.newPage();
    await page.goto(`https://www.tiktok.com/@${username}/live`, {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    // انتظار تحميل الشات
    await page.waitForTimeout(10000);

    // مراقبة التعليقات كل 3 ثواني
    setInterval(async () => {
      try {
        const newMessages = await page.evaluate(() => {
          const elements = document.querySelectorAll('[data-e2e="chat-message"]');
          return Array.from(elements).map(el => el.innerText);
        });

        messages = newMessages.slice(-50);
      } catch (e) {}
    }, 3000);

    res.json({ status: "connected" });
  } catch (err) {
    res.json({ error: "فشل الاتصال بالبث" });
  }
});

app.get("/data", (req, res) => {
  res.json({ messages });
});

app.listen(3000, () => console.log("Server running on 3000"));
