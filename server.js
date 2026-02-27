const express = require("express");
const { WebcastPushConnection } = require("tiktok-live-connector");

const app = express();

app.use(express.json());
app.set("trust proxy", true);

let connection = null;
let viewers = 0;
let messages = [];

app.get("/", (req, res) => {
  res.send("TikTok Live Server Running ✅");
});

app.post("/start", async (req, res) => {
  const username = req.body.username;

  if (!username) {
    return res.json({ error: "أدخل اسم الحساب بدون @" });
  }

  try {
    if (connection) {
      connection.disconnect();
      connection = null;
    }

    viewers = 0;
    messages = [];

    connection = new WebcastPushConnection(username, {
      enableExtendedGiftInfo: true,
    });

    await connection.connect();

    connection.on("connected", () => {
      console.log("Connected to live");
    });

    connection.on("roomUser", (data) => {
      viewers = data.viewerCount;
    });

    connection.on("chat", (data) => {
      messages.push(data.nickname + ": " + data.comment);
      if (messages.length > 50) messages.shift();
    });

    res.json({ status: "connected" });

  } catch (err) {
    console.log("FULL ERROR:", err);
    res.json({ error: "فشل الاتصال - راجع Logs في Render" });
  }
});

app.get("/data", (req, res) => {
  res.json({ viewers, messages });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server started on port " + PORT);
});
