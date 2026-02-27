import express from "express";
import { WebcastPushConnection } from "tiktok-live-connector";

const app = express();
const PORT = process.env.PORT || 3000;

// ضع هنا اسم مستخدم تيك توك للبث
const TIKTOK_USERNAME = "username_تيك_توك";

let viewers = 0;
let messages = [];

const connection = new WebcastPushConnection(TIKTOK_USERNAME);

// الاتصال بالبث
connection.connect().then(state => {
  console.log(`✅ متصل ببث تيك توك: ${TIKTOK_USERNAME}`);
}).catch(err => {
  console.error("❌ خطأ في الاتصال بالبث:", err);
});

// استقبال الدردشات
connection.on("chat", (data) => {
  messages.push({ user: data.uniqueId, message: data.comment });
  if (messages.length > 50) messages.shift(); // الاحتفاظ بآخر 50 رسالة فقط
});

// تحديث عدد المشاهدين
connection.on("viewers", (data) => {
  viewers = data.viewerCount;
});

// صفحة الويب لعرض البيانات
app.get("/", (req, res) => {
  const chatHTML = messages.map(m => `<p><b>${m.user}</b>: ${m.message}</p>`).join("");
  res.send(`
    <h1>بث تيك توك: ${TIKTOK_USERNAME}</h1>
    <p>عدد المشاهدين: ${viewers}</p>
    <h2>الدردشات:</h2>
    <div style="max-height:400px; overflow:auto; border:1px solid #ccc; padding:10px;">${chatHTML}</div>
  `);
});

// تشغيل السيرفر
app.listen(PORT, () => {
  console.log(`🚀 السيرفر يعمل على http://localhost:${PORT}`);
});
