// server.js
const express = require("express");
const fileUpload = require("express-fileupload");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(fileUpload());

// واجهة احترافية مع اختيار الجودة
app.get("/", (req, res) => {
  const html = `
  <!DOCTYPE html>
  <html lang="ar">
  <head>
    <meta charset="UTF-8">
    <title>Zom فيديو - تحسين الدقة</title>
    <style>
      body {
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background: linear-gradient(135deg,#4facfe,#00f2fe);
        margin:0; padding:0; color:#fff;
        display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh;
      }
      h1 { font-size:3em; margin-bottom:10px; text-shadow: 2px 2px 5px #000; }
      form { background: rgba(0,0,0,0.3); padding:30px; border-radius:20px; display:flex; flex-direction:column; align-items:center; }
      input[type=file], select { padding:10px; border-radius:10px; border:none; margin-bottom:20px; }
      button { padding:15px 30px; font-size:18px; border:none; border-radius:15px; background:#00f2fe; color:#000; font-weight:bold; cursor:pointer; transition:0.3s; }
      button:hover { background:#4facfe; color:#fff; transform:scale(1.05); }
      #progressContainer { width:80%; background: rgba(0,0,0,0.2); height:30px; border-radius:15px; margin-top:20px; overflow:hidden; }
      #progressBar { width:0%; height:100%; background: linear-gradient(to right, #00f2fe, #4facfe); transition:0.2s; }
      #status { margin-top:15px; font-weight:bold; font-size:1.2em; text-shadow: 1px 1px 2px #000; }
      video { margin-top:20px; max-width:80%; border-radius:20px; box-shadow:0 0 20px rgba(0,0,0,0.5);}
    </style>
  </head>
  <body>
    <h1>🦅 Zom فيديو</h1>
    <form id="uploadForm" enctype="multipart/form-data">
      <input type="file" name="video" accept="video/*" required>
      <select name="quality" id="quality">
        <option value="720">720p</option>
        <option value="1080" selected>1080p</option>
        <option value="2160">4K</option>
      </select>
      <button type="submit">رفع وتحسين الفيديو</button>
    </form>
    <div id="progressContainer"><div id="progressBar"></div></div>
    <div id="status"></div>
    <video id="preview" controls style="display:none;"></video>

    <script src="/socket.io/socket.io.js"></script>
    <script>
      const socket = io();
      const form = document.getElementById('uploadForm');
      const bar = document.getElementById('progressBar');
      const status = document.getElementById('status');
      const preview = document.getElementById('preview');

      form.addEventListener('submit', e => {
        e.preventDefault();
        const file = form.video.files[0];
        const quality = document.getElementById('quality').value;
        if(!file) return alert('اختر فيديو');
        const data = new FormData();
        data.append('video', file);
        data.append('quality', quality);

        fetch('/upload', { method:'POST', body:data })
        .then(res => res.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob);
          preview.src = url;
          preview.style.display = 'block';
          status.innerText = 'تمت المعالجة! يمكنك تشغيل الفيديو أو تحميله.';
          const a = document.createElement('a');
          a.href = url;
          a.download = file.name.replace(/\.\w+$/, '_enhanced.mp4');
          a.click();
        });
      });

      socket.on('progress', percent => {
        bar.style.width = percent + '%';
        status.innerText = 'جارٍ معالجة الفيديو: ' + percent.toFixed(1) + '%';
      });

      socket.on('done', () => {
        bar.style.width = '100%';
      });
    </script>
  </body>
  </html>
  `;
  res.send(html);
});

// رفع الفيديو ومعالجته مع اختيار الجودة
app.post("/upload", async (req, res) => {
  if (!req.files || !req.files.video) return res.status(400).send("يرجى رفع فيديو");

  const video = req.files.video;
  const quality = req.body.quality || "1080";

  const uploadDir = path.join(__dirname, "uploads");
  const outputDir = path.join(__dirname, "outputs");

  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const uploadPath = path.join(uploadDir, video.name);
  const outputPath = path.join(outputDir, "enhanced_" + video.name);

  await video.mv(uploadPath);

  // تحديد الدقة النهائية حسب اختيار المستخدم
  let scaleFilter = `scale=-2:${quality}`;

  ffmpeg(uploadPath)
    .outputOptions([
      `-vf ${scaleFilter},eq=contrast=1.3:brightness=0.05:saturation=1.4`,
      "-c:v libx264",
      "-crf 20"
    ])
    .on('progress', progress => {
      if(progress.percent) io.emit('progress', progress.percent);
    })
    .on('end', () => {
      io.emit('done');
      res.download(outputPath, () => {
        fs.unlinkSync(uploadPath);
        fs.unlinkSync(outputPath);
      });
    })
    .on('error', err => {
      console.error(err);
      res.status(500).send("خطأ في معالجة الفيديو");
    })
    .save(outputPath);
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
