const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = 3000;

let players = {};
let bots = {};
let currentBets = [];

const cards = [
  {id:0,m:2},
  {id:1,m:5},
  {id:2,m:10}
];

let countdown = 20;

app.get("/", (req,res)=>{
res.send(`<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="UTF-8">
<title>🎰 Casino Cards</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="/socket.io/socket.io.js"></script>

<style>
body{background:linear-gradient(45deg,#3f0d54,#d72660);color:white;font-family:sans-serif;text-align:center}
.card{width:160px;height:220px;background:white;color:black;border-radius:18px;display:flex;flex-direction:column;justify-content:center;align-items:center;font-size:42px;font-weight:bold;cursor:pointer;transition:.3s}
.card:hover{transform:scale(1.05)}
.selected{box-shadow:0 0 50px lime}
#table{display:flex;gap:20px;justify-content:center;margin-top:20px}
.betBtn{background:gold;color:black;padding:6px 12px;border-radius:8px;margin:4px;cursor:pointer;font-weight:bold}
.betBtn.sel{background:lime}
#frame{position:absolute;border:4px solid yellow;border-radius:20px;width:170px;height:230px;pointer-events:none}
</style>
</head>

<body>

<h1 class="text-4xl mt-4">🎰 كازينو البطاقات</h1>

<div id="balance"></div>
<div id="countdown"></div>

<div id="bets"></div>

<div id="table"></div>

<div id="players"></div>

<audio id="betS" src="https://www.soundjay.com/button/beep-07.wav"></audio>
<audio id="winS" src="https://www.soundjay.com/button/beep-10.wav"></audio>
<audio id="loseS" src="https://www.soundjay.com/button/beep-05.wav"></audio>
<audio autoplay loop src="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"></audio>

<script>

const socket = io();

let balance = localStorage.getItem("balance") 
  ? parseInt(localStorage.getItem("balance"))
  : 500;

let myBet = 10;
let myID;

const balanceDiv = document.getElementById("balance");
const table = document.getElementById("table");
const playersDiv = document.getElementById("players");
const countdownDiv = document.getElementById("countdown");

function save(){
  localStorage.setItem("balance",balance);
}

function updateBalance(){
  balanceDiv.innerHTML = "💰 رصيدك: " + balance;
}

updateBalance();

// ===== أزرار الرهان =====
const betsDiv = document.getElementById("bets");
[10,20,30,40,50].forEach(v=>{
  const b=document.createElement("div");
  b.className="betBtn";
  b.innerText=v;
  b.onclick=()=>{
    myBet=v;
    document.querySelectorAll(".betBtn").forEach(x=>x.classList.remove("sel"));
    b.classList.add("sel");
  }
  betsDiv.appendChild(b);
});

// ===== البطاقات =====
const cards = ${JSON.stringify(cards)};

cards.forEach(c=>{
  const d=document.createElement("div");
  d.className="card";
  d.id="card"+c.id;
  d.innerHTML="×"+c.m;

  d.onclick=()=>{
    if(balance < myBet) return alert("رصيد غير كافي");

    balance -= myBet;
    save();
    updateBalance();

    socket.emit("bet",{card:c.id,amount:myBet,m:c.m});
    document.getElementById("betS").play();
  }

  table.appendChild(d);
});

// ===== عرض اللاعبين =====
socket.on("players",list=>{
  playersDiv.innerHTML="<h3>👥 اللاعبين</h3>";
  list.forEach(p=>{
    playersDiv.innerHTML += p.name + " | 💰"+p.balance+
      (p.amount? " | 🎯"+p.amount:"") + "<br>";
  });
});

// ===== العد التنازلي =====
socket.on("count",t=>{
  countdownDiv.innerHTML = "⏳ يبدأ خلال: " + t;
});

// ===== نتيجة الجولة =====
socket.on("result",data=>{

  let i=0;
  const spin = setInterval(()=>{
    document.getElementById("card"+(i%3)).classList.add("selected");
    setTimeout(()=>document.getElementById("card"+(i%3)).classList.remove("selected"),100);
    i++;
  },100);

  setTimeout(()=>{
    clearInterval(spin);

    const winCard = data.win;

    document.getElementById("card"+winCard).classList.add("selected");

    if(data.winners.includes(myID)){
      const w = data.amounts[myID];
      balance += w;
      document.getElementById("winS").play();
      alert("🎉 ربحت "+w);
    } else if(data.losers.includes(myID)){
      document.getElementById("loseS").play();
    }

    save();
    updateBalance();

    setTimeout(()=>{
      document.getElementById("card"+winCard).classList.remove("selected");
    },3000);

  },3000);
});

myID = socket.id;

</script>
</body>
</html>`);
});

// ===== WebSocket =====

io.on("connection",socket=>{

  players[socket.id]={id:socket.id,name:"لاعب"+Math.floor(Math.random()*1000),balance:500};

  socket.on("bet",b=>{
    const p=players[socket.id];
    p.betCard=b.card;
    p.amount=b.amount;
    p.m=b.m;
    currentBets.push({id:socket.id,...b});
  });

  socket.on("disconnect",()=>{
    delete players[socket.id];
  });
});

// ===== البوتات =====
for(let i=0;i<5;i++){
  bots["bot"+i]={id:"bot"+i,name:"بوت"+(i+1),balance:500};
}

// ===== نظام الجولة =====
setInterval(()=>{

  // عد تنازلي
  let t=20;
  const cd = setInterval(()=>{
    io.emit("count",t);
    t--;
    if(t<0) clearInterval(cd);
  },1000);

  setTimeout(()=>{

    // رهانات البوتات
    Object.values(bots).forEach(b=>{
      const card=Math.floor(Math.random()*3);
      const amt=(Math.floor(Math.random()*5)+1)*10;
      if(b.balance>=amt){
        b.betCard=card;
        b.amount=amt;
        b.m=cards[card].m;
        currentBets.push({id:b.id,...b});
      }
    });

    const win = Math.floor(Math.random()*3);

    const winners = currentBets.filter(x=>x.card===win).map(x=>x.id);
    const losers = currentBets.filter(x=>x.card!==win).map(x=>x.id);

    const amounts={};

    winners.forEach(id=>{
      const b=currentBets.find(x=>x.id===id);
      const w=b.amount*b.m;
      amounts[id]=w;
      if(players[id]) players[id].balance+=w;
      if(bots[id]) bots[id].balance+=w;
    });

    io.emit("result",{win,winners,losers,amounts});

    currentBets=[];

  },20000);

},21000);

server.listen(port,()=>console.log("Running on 3000"));
