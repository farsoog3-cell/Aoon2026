const { WebcastPushConnection } = require("tiktok-live-connector");
const readline = require("readline");

// حماية الأخطاء غير المتوقعة
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

// واجهة لإدخال اسم المستخدم
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function startStream(username) {
    console.log(`🚀 محاولة الاتصال ببث ${username}...`);

    try {
        const connection = new WebcastPushConnection(username);

        connection.on("streamEnd", () => {
            console.log("⚠️ انتهى البث أو تم إغلاقه.");
        });

        connection.on("viewerCountUpdate", (count) => {
            console.clear();
            console.log(`👀 عدد المشاهدين الآن: ${count}`);
            console.log("📩 أحدث الرسائل:\n");
        });

        connection.on("chat", (data) => {
            console.log(`🗨️ ${data.user.uniqueId} (${data.user.avatarThumb}) : ${data.comment}`);
        });

        connection.connect()
            .then(() => console.log("✅ تم الاتصال بالبث بنجاح!"))
            .catch(err => {
                console.error("❌ لم أستطع الاتصال بالبث. ربما لا يوجد بث مباشر الآن.");
                console.error(err.message);
            });

    } catch (err) {
        console.error("❌ حدث خطأ:", err.message);
    }
}

// طلب اسم المستخدم من Terminal
function askUsername() {
    rl.question("🔹 أدخل اسم مستخدم تيك توك للبث: ", (username) => {
        if (!username) {
            console.log("❌ اسم المستخدم مطلوب!");
            askUsername();
            return;
        }
        startStream(username);
        // يمكن إعادة المحاولة إذا فشل الاتصال
        askUsername();
    });
}

askUsername();
