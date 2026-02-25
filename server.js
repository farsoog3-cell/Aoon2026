const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = process.env.PORT || 3000;

// قائمة صور بشرية للاعبين
const avatars = ["🧑","👩","👨","👧","🧒","👱‍♀️","👱‍♂️","🧔","👵","👴"];

// اللاعبين
let players = {};

// توليد نرد عشوائي
function rollDice() {
  return [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1
  ];
}

// صفحة اللعبة كاملة من السيرفر
app.get("/", (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="ar">
  <head>
    <meta charset="UTF-8">
    <title>🎲 لعبة النرد الاحترافية</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="/socket.io/socket.io.js"></script>
  </head>
  <body class="bg-gradient-to-br from-purple-400 via-pink-400 to-yellow-300 min-h-screen flex flex-col items-center justify-start p-4 font-sans">

    <h1 class="text-4xl md:text-5xl font-bold text-white mb-6 animate-bounce text-center">🎲 لعبة النرد الجماعية</h1>

    <div id="playersGrid" class="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-3xl mb-6"></div>

    <div class="bg-white bg-opacity-80 p-6 rounded-2xl shadow-lg w-full max-w-md text-center">
      <p class="text-xl mb-4">اضغط الزر لرمي النرد</p>
      <button onclick="roll()" class="bg-red-500 text-white px-6 py-3 rounded-xl text-xl shadow-lg hover:bg-red-600 transition animate-pulse">🎲 رمي النرد</button>
      <h2 id="result" class="text-2xl font-bold mt-4">النتيجة: ...</h2>
    </div>

    <script>
      const socket = io();
      let myID;
      const playersGrid = document.getElementById("playersGrid");
      const result = document.getElementById("result");

      const avatars = ["🧑","👩","👨","👧","🧒","👱‍♀️","👱‍♂️","🧔","👵","👴"];

      // إعداد اسم المستخدم عند الدخول
      let username = prompt("ادخل اسمك") || "لاعب";
      const avatar = avatars[Math.floor(Math.random()*avatars.length)];
      socket.emit("setUser", { username, avatar });

      // استقبال اللاعبين
      socket.on("updatePlayers", data => renderPlayers(data));
      socket.on("result", data => { result.innerText = "النتيجة: " + data.join(" - "); });

      function roll() { socket.emit("roll"); }

      function renderPlayers(players) {
        playersGrid.innerHTML = "";
        Object.values(players).forEach(p => {
          const div = document.createElement("div");
          div.className = "bg-white bg-opacity-80 p-4 rounded-xl shadow-lg flex flex-col items-center";
          div.innerHTML = \`
            <div class="text-5xl mb-2">\${p.avatar}</div>
            <p class="font-bold">\${p.username}</p>
            <p class="text-sm">رصيد: \${p.balance}</p>
          \`;
          playersGrid.appendChild(div);
        });
      }
    </script>

  </body>
  </html>
  `);
});

// WebSocket للألعاب
io.on("connection", socket => {
  console.log("لاعب دخل:", socket.id);

  // إنشاء لاعب جديد
  players[socket.id] = {
    id: socket.id,
    username: "لاعب" + Math.floor(Math.random()*1000),
    avatar: avatars[Math.floor(Math.random()*avatars.length)],
    balance: 100
  };

  // إرسال بيانات جميع اللاعبين
  socket.emit("welcome", { id: socket.id, players });
  io.emit("updatePlayers", players);

  // استقبال إعدادات اللاعب (الاسم والصورة)
  socket.on("setUser", data => {
    if(players[socket.id]) {
      players[socket.id].username = data.username;
      players[socket.id].avatar = data.avatar;
      io.emit("updatePlayers", players);
    }
  });

  // رمي النرد
  socket.on("roll", () => {
    const dice = rollDice();
    // تحديث الرصيد: الفوز إذا مجموع > 10
    Object.keys(players).forEach(id => {
      const sum = dice.reduce((a,b)=>a+b,0);
      if(sum > 10) players[id].balance += 10;
      else players[id].balance -= 10;
    });
    io.emit("result", dice);
    io.emit("updatePlayers", players);
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    io.emit("updatePlayers", players);
    console.log("لاعب خرج:", socket.id);
  });
});

server.listen(port, () => console.log("Server running on port " + port));