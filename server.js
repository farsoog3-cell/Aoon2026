const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = process.env.PORT || 3000;

let players = {};
const cards = ["بطاقة 1","بطاقة 2","بطاقة 3","بطاقة 4"];
const avatars = ["🧑","👩","👨","👧","🧒","👱‍♀️","👱‍♂️","🧔","👵","👴"];
let currentBets = [];

app.get("/", (req,res)=>{
  res.send(`
<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="UTF-8">
<title>🎰 كازينو رهانات جماعي</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="/socket.io/socket.io.js"></script>
<style>
body{font-family:sans-serif;background:linear-gradient(45deg,#7b1fa2,#f06292);min-height:100vh;color:white;}
#casinoTable{background:#8b0000;border-radius:20px;padding:20px;display:grid;grid-template-columns:repeat(4,1fr);gap:20px;position:relative;}
.card{background:#fff;color:black;border-radius:15px;padding:20px;text-align:center;position:relative;cursor:pointer;transition:0.3s;min-height:120px;}
.card:hover{transform:scale(1.05);box-shadow:0 0 20px gold;}
.card.selected{box-shadow:0 0 40px lime;transform:scale(1.1);}
.chip{position:absolute;width:30px;height:30px;border-radius:50%;background:gold;text-align:center;line-height:30px;transition:all 1s ease;}
.playerList{background:#4a148c;padding:10px;border-radius:15px;max-height:400px;overflow-y:auto;}
.playerItem{display:flex;justify-content:space-between;margin-bottom:5px;}
#timer{font-size:1.5rem;font-weight:bold;margin-top:10px;text-align:center;}
</style>
</head>
<body class="flex flex-col items-center p-4">
<h1 class="text-4xl font-bold mb-4">🎰 كازينو رهانات جماعي</h1>
<div id="balanceDiv" class="text-xl mb-2">رصيدك: ...</div>
<div class="flex gap-4 w-full max-w-5xl">
  <div id="casinoTable" class="flex-1"></div>
  <div class="playerList w-64">
    <h2 class="font-bold mb-2">قائمة اللاعبين</h2>
    <div id="playersDiv"></div>
    <div id="timer">🕒 15</div>
  </div>
</div>
<div class="flex gap-2 mt-4">
<label class="text-white">مبلغ الرهان:
<select id="betAmount" class="p-2 rounded text-black">
<option value="10">10</option><option value="20">20</option><option value="50">50</option><option value="100">100</option>
</select>
</label>
<label class="text-white">المضاعف:
<select id="multiplier" class="p-2 rounded text-black">
<option value="2">×2</option><option value="3">×3</option><option value="5">×5</option><option value="10">×10</option>
</select>
</label>
</div>
<button onclick="placeBet()" class="bg-yellow-500 px-4 py-2 rounded mt-2 text-black font-bold">🎯 ضع الرهان</button>
<div id="messages" class="mt-2"></div>

<audio id="betSound" src="https://www.soundjay.com/button/beep-07.wav"></audio>
<audio id="winSound" src="https://www.soundjay.com/button/beep-10.wav"></audio>
<audio id="loseSound" src="https://www.soundjay.com/button/beep-05.wav"></audio>
<audio id="casinoMusic" src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3" loop autoplay></audio>

<script>
const socket = io();
let myID; 
let balance=500; 
let myBet=null;
const table = document.getElementById("casinoTable");
const balanceDiv = document.getElementById("balanceDiv");
const messages = document.getElementById("messages");
const betAmount = document.getElementById("betAmount");
const multiplier = document.getElementById("multiplier");
const playersDiv = document.getElementById("playersDiv");
const timerDiv = document.getElementById("timer");
const betSound = document.getElementById("betSound");
const winSound = document.getElementById("winSound");
const loseSound = document.getElementById("loseSound");

const cardsList = ${JSON.stringify(cards)};
cardsList.forEach((c,i)=>{
  const div=document.createElement("div");
  div.id="card"+i;
  div.className="card";
  div.innerText=c;
  table.appendChild(div);
});

// تحديث الرصيد
function updateBalance(){ balanceDiv.innerText="رصيدك: "+balance; }
updateBalance();

// تحديث قائمة اللاعبين
function updatePlayersList(players){
  playersDiv.innerHTML="";
  players.forEach(p=>{
    const div=document.createElement("div");
    div.className="playerItem";
    div.innerHTML=\`<span>\${p.avatar||"👤"} \${p.username}</span><span>\${p.balance}</span>\`;
    playersDiv.appendChild(div);
  });
}

// إنشاء chip متحرك
function animateChipToCard(cardIndex){
  const chip = document.createElement("div");
  chip.className="chip";
  chip.innerText="💎";
  document.body.appendChild(chip);
  chip.style.left = "50%";
  chip.style.top = "80%";
  const card = document.getElementById("card"+cardIndex);
  const rect = card.getBoundingClientRect();
  setTimeout(()=>{
    chip.style.left = rect.left + rect.width/2 - 15 + "px";
    chip.style.top = rect.top + rect.height/2 - 15 + "px";
  },50);
  setTimeout(()=>chip.remove(),1200);
}

// وضع الرهان
function placeBet(){
  const cardIndex = prompt("اختر رقم البطاقة (0-"+(cardsList.length-1)+")")*1;
  const amount = parseInt(betAmount.value);
  const multi = parseInt(multiplier.value);
  if(cardIndex<0||cardIndex>=cardsList.length){ alert("رقم بطاقة غير صالح"); return;}
  if(amount>balance){ alert("رصيدك لا يكفي"); return;}
  myBet={card:cardIndex,amount,multiplier:multi};
  socket.emit("placeBet",myBet);
  messages.innerText="وضعت رهانك على البطاقة "+cardIndex;
  betSound.play();
  animateChipToCard(cardIndex);
}

// مؤقت الجولة
let countdown = 15;
function startTimer(){
  countdown = 15;
  timerDiv.innerText = "🕒 "+countdown;
  const interval = setInterval(()=>{
    countdown--;
    timerDiv.innerText = "🕒 "+countdown;
    if(countdown<=0) clearInterval(interval);
  },1000);
}

// استقبال تحديثات اللاعبين
socket.on("updatePlayers", data=>{
  updatePlayersList(data);
  // تنظيف البطاقات
  cardsList.forEach((c,i)=>{
    const div=document.getElementById("card"+i);
    div.innerHTML=c;
    data.forEach(p=>{
      if(p.betCard===i){
        const chip=document.createElement("div");
        chip.className="chip";
        chip.innerText="💎";
        div.appendChild(chip);
      }
    });
  });
});

// استقبال نتيجة الجولة
socket.on("roundResult", data=>{
  const winningCard = data.winningCard;
  const divWin = document.getElementById("card"+winningCard);
  divWin.classList.add("selected");

  if(data.winnerIDs.includes(myID)) winSound.play();
  else if(data.loserIDs.includes(myID)) loseSound.play();

  setTimeout(()=>divWin.classList.remove("selected"),2000);

  if(data.winnerIDs.includes(myID)){
    balance += data.winAmounts[myID];
    alert("🎉 فزت! رصيدك +"+data.winAmounts[myID]);
  }else if(data.loserIDs.includes(myID)){
    balance -= data.loseAmounts[myID];
    alert("💀 خسرت! رصيدك -"+data.loseAmounts[myID]);
  }else alert("🔹 انتهت الجولة");

  myBet=null; updateBalance();
  startTimer();
});

myID=socket.id;
socket.emit("setUser",{username:"لاعب"+Math.floor(Math.random()*1000),avatar: ["🧑","👩","👨","👧","🧒","👱‍♀️","👱‍♂️","🧔","👵","👴"][Math.floor(Math.random()*10)]});

startTimer();
</script>
</body>
</html>
`);
});

// WebSocket
io.on("connection", socket=>{
  players[socket.id]={id:socket.id,username:"لاعب"+Math.floor(Math.random()*1000),balance:500,avatar: avatars[Math.floor(Math.random()*avatars.length)]};
  socket.emit("updatePlayers",Object.values(players));

  socket.on("setUser", data=>{
    if(players[socket.id]){
      players[socket.id].username=data.username;
      players[socket.id].avatar=data.avatar;
    }
    io.emit("updatePlayers",Object.values(players));
  });

  socket.on("placeBet", bet=>{
    const player = players[socket.id];
    if(player.balance < bet.amount){
      socket.emit("errorMessage","رصيدك لا يكفي!");
      return;
    }
    player.betCard=bet.card;
    player.amount=bet.amount;
    player.multiplier=bet.multiplier;
    currentBets.push({id:socket.id,...bet});
    io.emit("updatePlayers",Object.values(players));
  });

  socket.on("disconnect", ()=>{
    delete players[socket.id];
    io.emit("updatePlayers",Object.values(players));
  });
});

// جولات كل 15 ثانية
setInterval(()=>{
  if(currentBets.length===0) return;
  const winningCard=Math.floor(Math.random()*cards.length);
  const winnerIDs=currentBets.filter(b=>b.card===winningCard).map(b=>b.id);
  const loserIDs=currentBets.filter(b=>b.card!==winningCard).map(b=>b.id);

  const winAmounts={},loseAmounts={};
  winnerIDs.forEach(id=>{
    const b=currentBets.find(b=>b.id===id);
    players[id].balance += b.amount*b.multiplier;
    winAmounts[id]=b.amount*b.multiplier;
  });
  loserIDs.forEach(id=>{
    const b=currentBets.find(b=>b.id===id);
    players[id].balance -= b.amount;
    loseAmounts[id]=b.amount;
  });

  Object.keys(players).forEach(id=>{
    io.to(id).emit("roundResult",{winningCard,winnerIDs,loserIDs,winAmounts,loseAmounts});
  });

  currentBets=[];
  Object.values(players).forEach(p=>{delete p.betCard; delete p.amount; delete p.multiplier;});
  io.emit("updatePlayers",Object.values(players));
},15000);

server.listen(port,()=>console.log("Server running on port "+port));
