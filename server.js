const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = process.env.PORT || 3000;

let players = {};
const avatars = ["🧑","👩","👨","👧","🧒","👱‍♀️","👱‍♂️","🧔","👵","👴"];
const cards = ["البطاقة 1","البطاقة 2","البطاقة 3","البطاقة 4"]; // البطاقات

// صفحة اللعبة HTML/CSS/JS مدمجة
app.get("/", (req,res)=>{
    res.send(`
<!DOCTYPE html>
<html lang="ar">
<head>
<meta charset="UTF-8">
<title>لعبة الرهان الجماعية</title>
<script src="https://cdn.tailwindcss.com"></script>
<script src="/socket.io/socket.io.js"></script>
</head>
<body class="bg-gradient-to-br from-purple-400 via-pink-400 to-yellow-300 min-h-screen flex flex-col items-center p-4 font-sans">
<h1 class="text-4xl font-bold text-white mb-6 text-center animate-bounce">🎲 لعبة الرهان الجماعية</h1>

<div id="balanceDiv" class="text-white text-xl mb-4">رصيدك: ...</div>

<div id="cardsGrid" class="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl mb-4"></div>

<div class="flex gap-4 mb-4">
<label>اختر مبلغ الرهان:
<select id="betAmount" class="p-2 rounded text-black">
<option value="10">10</option>
<option value="20">20</option>
<option value="50">50</option>
<option value="100">100</option>
</select>
</label>
<label>اختر المضاعف:
<select id="multiplier" class="p-2 rounded text-black">
<option value="2">×2</option>
<option value="3">×3</option>
<option value="20">×20</option>
</select>
</label>
</div>

<button onclick="placeBet()" class="bg-red-500 text-white px-6 py-2 rounded-xl shadow-lg hover:bg-red-600 transition animate-pulse mb-4">🎯 ضع الرهان</button>

<div id="messages" class="text-white text-lg mb-4"></div>

<script>
const socket = io();
let myID;
let balance = 500; // الرصيد الابتدائي
let myBet = null;

const cards = ${JSON.stringify(cards)};

// إنشاء شبكة البطاقات
const cardsGrid = document.getElementById("cardsGrid");
cards.forEach((c,i)=>{
    const div = document.createElement("div");
    div.id = "card"+i;
    div.innerText = c;
    div.className = "bg-white bg-opacity-80 p-6 rounded-xl shadow-lg text-center cursor-pointer transition hover:scale-105";
    cardsGrid.appendChild(div);
});

// عرض الرصيد
const balanceDiv = document.getElementById("balanceDiv");
function updateBalance(){ balanceDiv.innerText = "رصيدك: "+balance; }
updateBalance();

// وضع الرهان
function placeBet(){
    const cardIndex = prompt("اختر رقم البطاقة (0-"+(cards.length-1)+")")*1;
    const amount = parseInt(document.getElementById("betAmount").value);
    const multiplier = parseInt(document.getElementById("multiplier").value);
    if(cardIndex<0 || cardIndex>=cards.length){ alert("رقم بطاقة غير صالح"); return; }
    if(amount>balance){ alert("رصيدك لا يكفي"); return; }
    myBet = { card: cardIndex, amount, multiplier };
    socket.emit("placeBet", myBet);
    document.getElementById("messages").innerText="وضعت الرهان على البطاقة "+cardIndex;
}

// استقبال التحديثات من السيرفر
socket.on("updatePlayers", data => {
    data.forEach(p=>{
        const cardDiv = document.getElementById("card"+p.betCard);
        if(p.betCard!==undefined){
            cardDiv.innerText = cards[p.betCard]+" ("+p.username+" يراهن "+p.amount+")";
        }
    });
});

socket.on("roundResult", data => {
    if(data.winnerID===myID){
        balance += data.winAmount;
        alert("🎉 ربح! رصيدك +"+data.winAmount);
    } else if(data.loserIDs.includes(myID)){
        balance -= data.loseAmount;
        alert("💀 خسرت! رصيدك -"+data.loseAmount);
    } else { alert("🔹 الجولة انتهت"); }
    myBet = null;
    updateBalance();
    // إعادة تعيين البطاقات
    cards.forEach((c,i)=>{ document.getElementById("card"+i).innerText=c; });
});
</script>
</body>
</html>
`);
});

// WebSocket
let currentBets = [];

io.on("connection", socket=>{
    console.log("لاعب دخل:", socket.id);
    players[socket.id] = {id:socket.id, username:"لاعب"+Math.floor(Math.random()*1000), balance:500};

    socket.emit("updatePlayers", Object.values(players));

    socket.on("placeBet", bet=>{
        players[socket.id].betCard = bet.card;
        players[socket.id].amount = bet.amount;
        players[socket.id].multiplier = bet.multiplier;
        currentBets.push({id:socket.id, ...bet});
        io.emit("updatePlayers", Object.values(players));
    });

    socket.on("disconnect", ()=>{
        delete players[socket.id];
        io.emit("updatePlayers", Object.values(players));
    });
});

// تشغيل الجولة كل 15 ثانية
setInterval(()=>{
    if(currentBets.length===0) return; // لا رهانات
    // تحديد البطاقة الفائزة عشوائيا
    const winningCard = Math.floor(Math.random()*cards.length);
    const winnerIDs = currentBets.filter(b=>b.card===winningCard).map(b=>b.id);
    const loserIDs = currentBets.filter(b=>b.card!==winningCard).map(b=>b.id);

    // حساب المكاسب والخسائر
    winnerIDs.forEach(id=>{
        const p = players[id];
        const b = currentBets.find(b=>b.id===id);
        const winAmount = b.amount*b.multiplier;
        p.balance += winAmount;
        io.to(id).emit("roundResult",{winnerID:id,winAmount,loserIDs:[],loseAmount:0});
    });
    loserIDs.forEach(id=>{
        const p = players[id];
        const b = currentBets.find(b=>b.id===id);
        const loseAmount = b.amount;
        p.balance -= loseAmount;
        io.to(id).emit("roundResult",{winnerID:null,loseAmount,loserIDs:[id]});
    });

    // إعادة تعيين الجولة
    currentBets = [];
    Object.values(players).forEach(p=>{ delete p.betCard; delete p.amount; delete p.multiplier; });
    io.emit("updatePlayers", Object.values(players));

},15000);

server.listen(port, ()=>console.log("Server running on port "+port));
