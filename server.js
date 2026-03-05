import express from "express"
import { v4 as uuidv4 } from "uuid"

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

let sessions = {}

app.get("/", (req,res)=>{

res.send(`

<html>
<head>
<title>Dashboard</title>

<style>

body{
background:#0f172a;
color:white;
font-family:Arial;
text-align:center;
}

button{
padding:12px;
background:#22c55e;
border:none;
border-radius:6px;
cursor:pointer;
}

.box{
background:#1e293b;
padding:20px;
margin:20px;
border-radius:10px;
}

</style>

</head>

<body>

<h1>Session Dashboard</h1>

<button onclick="create()">Create Session</button>

<div id="sessions"></div>

<script>

function create(){

fetch('/create')
.then(r=>r.json())
.then(data=>{

let link=data.link

let div=document.createElement("div")
div.className="box"

div.innerHTML="Session Link:<br>"+link

document.getElementById("sessions").appendChild(div)

})

}

</script>

</body>

</html>

`)

})

app.get("/create",(req,res)=>{

let id=uuidv4().slice(0,6)

sessions[id]={}

res.json({
link: req.protocol + "://" + req.get("host") + "/s/" + id
})

})

app.get("/s/:id",(req,res)=>{

let id=req.params.id

res.send(`

<html>

<body style="font-family:Arial;text-align:center">

<h2>Share Device Info</h2>

<button onclick="send()">Share</button>

<script>

function send(){

let device=navigator.userAgent

navigator.getBattery().then(function(b){

let battery=b.level*100

navigator.geolocation.getCurrentPosition(function(pos){

fetch("/collect",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

id:"${id}",

device:device,

battery:battery,

lat:pos.coords.latitude,

lon:pos.coords.longitude

})

}).then(()=>{

document.body.innerHTML="<h2>Data sent</h2>"

})

})

})

}

</script>

</body>

</html>

`)

})

app.post("/collect",(req,res)=>{

let data=req.body

sessions[data.id]=data

res.json({status:"ok"})

})

app.get("/map/:id",(req,res)=>{

let s=sessions[req.params.id]

res.send(`

<html>

<head>

<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css"/>

<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>

</head>

<body>

<div id="map" style="height:100vh"></div>

<script>

var map=L.map('map').setView([${s.lat},${s.lon}],13)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)

L.marker([${s.lat},${s.lon}]).addTo(map)

</script>

</body>

</html>

`)

})

app.listen(PORT,()=>{

console.log("Server running")

})
