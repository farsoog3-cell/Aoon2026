// server.js
const express = require("express");
const fileUpload = require("express-fileupload");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(fileUpload());

// نستخدم هذا لتقديم واجهة مباشرة بدون ملفات HTML
app.get("/", (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>Zom فيديو</title>
      <style>
        body { font-family: Arial; text-align:center; padding:50px; background:#f0f0f0; }
        button { padding:10px 20px; font-size:16px; cursor:pointer; margin-top:20px; }
        input[type=file] { margin:20px 0; }
        h1 { color:#333; }
      </style>
    </head>
    <body>
      <h1>🦅 Zom فيديو</h1>
      <form action="/upload" method="post" enctype="multipart/form-data">
        <input type="file" name="video" accept="video/*" required><br>
        <button type="submit">رفع وتحسين الفيديو</button>
      </form>
    </body>
    </html>
  `;
  res.send(html);
});

// رفع الفيديو ومعالجته
app.post("/upload", async (req, res) => {
  if (!req.files || !req.files.video) return res.status(400).send("يرجى رفع فيديو");

  const video = req.files.video;
  const uploadDir = path.join(__dirname, "uploads");
  const outputDir = path.join(__dirname, "outputs");

  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const uploadPath = path.join(uploadDir, video.name);
  const outputPath = path.join(outputDir, "enhanced_" + video.name);

  await video.mv(uploadPath);

  ffmpeg.ffprobe(uploadPath, (err, metadata) => {
    if (err) return res.status(500).send("خطأ في تحليل الفيديو");

    ffmpeg(uploadPath)
      .outputOptions([
        "-vf eq=contrast=1.2:brightness=0.05:saturation=1.3",
        "-c:v libx264",
        "-crf 23",
      ])
      .save(outputPath)
      .on("end", () => {
        res.download(outputPath, () => {
          fs.unlinkSync(uploadPath);
          fs.unlinkSync(outputPath);
        });
      });
  });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
