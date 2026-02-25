const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = process.env.PORT || 3000;

let players = {};
let bots = {};
const cards = [
  {id:0,name:"بطاقة 1",multiplier:2},
  {id:1,name:"بطاقة 2",multiplier:5},
  {id:2,name:"بطاقة 3",multiplier:10}
];
let currentBets = [];

// صفحة HTML
app.get("/", (req,res)=>{
res.send(`
<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="UTF-8">
<title>🎰 كازينو بطاقات</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="/socket.io/socket.io.js"></script>
<style>
body{font-family:sans-serif;background:linear-gradient(45deg,#7b1fa2,#f06292);min-height:100vh;color:white;display:flex;flex-direction:column;align-items:center;padding:10px;}
#casinoTable{display:flex;gap:20px;margin-top:20px;position:relative;}
.card{width:150px;height:200px;background:white;color:black;border-radius:15px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:2rem;font-weight:bold;position:relative;cursor:pointer;transition:0.3s;}
.card:hover{transform:scale(1.05);}
.card.selected{box-shadow:0 0 40px lime;transform:scale(1.1);}
.chip{position:absolute;width:30px;height:30px;border-radius:50%;background:gold;text-align:center;line-height:30px;transition:all 1s ease;}
#frame{position:absolute;border:4px solid yellow;width:160px;height:210px;border-radius:15px;transition:all 0.2s;}
#balanceDiv{font-size:1.5rem;font-weight:bold;}
#playersDiv{margin-top:10px;width:500px;}
.playerItem{display:flex;justify-content:space-between;margin-bottom:5px;}
#messages{margin-top:10px;}
#countdown{font-size:1.5rem;margin-top:10px;}
</style>
</head>
<body>
<h1 class="text-4xl font-bold">🎰 كازينو بطاقات</h1>
<div id="balanceDiv">رصيدك: 500</div>
<div id="casinoTable"></div>
<div id="playersDiv"></div>
<div id="messages"></div>
<div id="countdown">🕒 </div>

<audio id="betSound" src="https://www.soundjay.com/button/beep-07.wav"></audio>
<audio id="winSound" src="https://www.soundjay.com/button/beep-10.wav"></audio>
<audio id="loseSound" src="https://www.soundjay.com/button/beep-05.wav"></audio>

<script>
const socket = io();
let myID;
let balance=500;
const table = document.getElementById("casinoTable");
const balanceDiv = document.getElementById("balanceDiv");
const messages = document.getElementById("messages");
const playersDiv = document.getElementById("playersDiv");
const countdownDiv = document.getElementById("countdown");
const betSound = document.getElementById("betSound");
const winSound = document.getElementById("winSound");
const loseSound = document.getElementById("loseSound");

const cardsList = ${JSON.stringify(cards)};
const frame = document.createElement("div");
frame.id="frame";
document.body.appendChild(frame);

// إنشاء البطاقات
cardsList.forEach((c)=>{
  const div=document.createElement("div");
  div.id="card"+c.id;
  div.className="card";
  div.innerHTML = \`\${c.name}<br><span style="font-size:1.5rem">×\${c.multiplier}</span>\`;
  div.onclick = ()=>{
    const amount = prompt("أدخل مبلغ الرهان (رصيدك:"+balance+")","50")*1;
    if(amount>balance){alert("رصيدك غير كافي"); return;}
    socket.emit("placeBet",{card:c.id,amount:amount,multiplier:c.multiplier});
    messages.innerText="وضعت رهانك على "+c.name+" بمبلغ "+amount;
    animateChipToCard(c.id);
    betSound.play();
  };
  table.appendChild(div);
});

// تحريك chip
function animateChipToCard(cardIndex){
  const chip = document.createElement("div");
  chip.className="chip";
  chip.innerText="💎";
  document.body.appendChild(chip);
  chip.style.left = "50%";
  chip.style.top = "80%";
  const card = document.getElementById("card"+cardIndex);
  const rect = card.getBoundingClientRect();
  setTimeout(()=>{chip.style.left = rect.left + rect.width/2 -15+"px"; chip.style.top = rect.top + rect.height/2 -15+"px";},50);
  setTimeout(()=>chip.remove(),1200);
}

// تحديث رصيد اللاعبين
function updatePlayersList(players){
  playersDiv.innerHTML="";
  players.forEach(p=>{
    const div=document.createElement("div");
    div.className="playerItem";
    div.innerHTML=\`<span>\${p.username}</span><span>رصيد: \${p.balance} | رهان: \${p.amount||0}</span>\`;
    playersDiv.appendChild(div);
  });
}

// حركة الإطار
function spinFrame(callback){
  let i=0;
  const interval = setInterval(()=>{
    frame.style.left = document.getElementById("card"+i).getBoundingClientRect().left-5+"px";
    frame.style.top = document.getElementById("card"+i).getBoundingClientRect().top-5+"px";
    i=(i+1)%3;
  },100);
  setTimeout(()=>{
    clearInterval(interval);
    const winner = Math.floor(Math.random()*3);
    frame.style.left = document.getElementById("card"+winner).getBoundingClientRect().left-5+"px";
    frame.style.top = document.getElementById("card"+winner).getBoundingClientRect().top-5+"px";
    callback(winner);
  },3000);
}

// استقبال تحديث اللاعبين
socket.on("updatePlayers",data=>{
  updatePlayersList(data);
  // تنظيف chips
  cardsList.forEach((c)=>{document.getElementById("card"+c.id).querySelectorAll(".chip").forEach(e=>e.remove());});
  data.forEach(p=>{
    if(p.betCard!==undefined){
      const div=document.getElementById("card"+p.betCard);
      const chip = document.createElement("div");
      chip.className="chip";
      chip.innerText="💎";
      div.appendChild(chip);
    }
  });
});

// استقبال نتيجة الجولة
socket.on("roundResult",data=>{
  let countdown=5;
  countdownDiv.innerText="🕒 "+countdown;
  const countdownInterval = setInterval(()=>{
    countdown--; countdownDiv.innerText="🕒 "+countdown;
    if(countdown<=0) clearInterval(countdownInterval);
  },1000);

  spinFrame((winnerCard)=>{
    const divWin = document.getElementById("card"+winnerCard);
    divWin.classList.add("selected");
    setTimeout(()=>divWin.classList.remove("selected"),2000);

    if(data.winnerIDs.includes(myID)){
      balance += data.winAmounts[myID];
      winSound.play();
      alert("🎉 فزت! رصيدك +"+data.winAmounts[myID]);
    }else if(data.loserIDs.includes(myID)){
      balance -= data.loseAmounts[myID];
      loseSound.play();
      alert("💀 خسرت! رصيدك -"+data.loseAmounts[myID]);
    }else alert("🔹 انتهت الجولة");
    updateBalance();
  });
});

myID=socket.id;
socket.emit("setUser",{username:"لاعب"+Math.floor(Math.random()*1000)});
</script>
</body>
</html>
`);
});

// WebSocket
io.on("connection", socket=>{
  players[socket.id]={id:socket.id,username:"لاعب"+Math.floor(Math.random()*1000),balance:500};
  socket.emit("updatePlayers",Object.values(players));

  socket.on("setUser", data=>{
    if(players[socket.id]) players[socket.id].username=data.username;
    io.emit("updatePlayers",Object.values(players));
  });

  socket.on("placeBet", bet=>{
    const player = players[socket.id];
    if(player.balance<bet.amount) return;
    player.betCard = bet.card;
    player.amount = bet.amount;
    player.multiplier = bet.multiplier;
    currentBets.push({id:socket.id,...bet});
    io.emit("updatePlayers",Object.values(players));
  });

  socket.on("disconnect", ()=>{
    delete players[socket.id];
    io.emit("updatePlayers",Object.values(players));
  });
});

// إضافة 5 بوتات
for(let i=0;i<5;i++){
  const botID="bot"+i;
  bots[botID]={id:botID,username:"بوت"+(i+1),balance:500};
}

// جولات كل 10 ثواني
setInterval(()=>{
  // بوتات تراهن عشوائياً
  Object.values(bots).forEach(bot=>{
    const card = Math.floor(Math.random()*3);
    const amount = Math.floor(Math.random()*50)+10;
    if(bot.balance>=amount){
      bot.betCard=card;
      bot.amount=amount;
      bot.multiplier = cards[card].multiplier;
      currentBets.push({id:bot.id,...bot});
    }
  });

  if(currentBets.length===0) return;

  const winnerCard=Math.floor(Math.random()*3);
  const winnerIDs=currentBets.filter(b=>b.card===winnerCard).map(b=>b.id);
  const loserIDs=currentBets.filter(b=>b.card!==winnerCard).map(b=>b.id);

  const winAmounts={},loseAmounts={};
  winnerIDs.forEach(id=>{
    const b=currentBets.find(b=>b.id===id);
    if(players[id]) players[id].balance += b.amount*b.multiplier;
    else if(bots[id]) bots[id].balance += b.amount*b.multiplier;
    winAmounts[id]=b.amount*b.multiplier;
  });

  loserIDs.forEach(id=>{
    const b=currentBets.find(b=>b.id===id);
    if(players[id]) players[id].balance -= b.amount;
    else if(bots[id]) bots[id].balance -= b.amount;
    loseAmounts[id]=b.amount;
  });

  // إرسال النتائج
  Object.keys(players).forEach(id=>{
    io.to(id).emit("roundResult",{winnerCard,winnerIDs,loserIDs,winAmounts,loseAmounts});
  });

  currentBets=[];
  Object.values(players).forEach(p=>{delete p.betCard; delete p.amount; delete p.multiplier;});
  Object.values(bots).forEach(b=>{delete b.betCard; delete b.amount; delete b.multiplier;});
  io.emit("updatePlayers",Object.values(players).concat(Object.values(bots)));
},10000);

server.listen(port,()=>console.log("Server running on port "+port));
