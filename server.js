const { WebcastPushConnection } = require("tiktok-live-connector");
const readline = require("readline");

// واجهة بسيطة لإدخال اسم المستخدم من الـ Console
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("🔹 أدخل اسم مستخدم تيك توك للبث: ", async (TIKTOK_USERNAME) => {
  
  console.log(`🚀 محاولة الاتصال ببث ${TIKTOK_USERNAME}...`);

  const connection = new WebcastPushConnection(TIKTOK_USERNAME);

  // عند انتهاء البث
  connection.on("streamEnd", () => {
    console.log("⚠️ انتهى البث أو تم إغلاقه.");
    process.exit(0);
  });

  // عند تحديث عدد المشاهدين
  connection.on("viewerCountUpdate", (count) => {
    console.clear();
    console.log(`👀 عدد المشاهدين الآن: ${count}`);
    console.log("📩 أحدث الرسائل:\n");
  });

  // عند وصول رسالة جديدة
  connection.on("chat", (data) => {
    console.log(`🗨️ ${data.user.uniqueId} (${data.user.avatarThumb}) : ${data.comment}`);
  });

  try {
    await connection.connect();
    console.log("✅ تم الاتصال بالبث بنجاح!");
  } catch (err) {
    console.error("❌ حدث خطأ أثناء الاتصال بالبث:", err.message);
    process.exit(1);
  }
});
