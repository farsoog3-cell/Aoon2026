const express = require("express");
const app = express();

app.use(express.json());

/*
  الصفحة الرئيسية
  عند فتح رابط السيرفر يظهر الفورم مباشرة
*/
app.get("/", (req, res) => {

    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Control Panel</title>

    <style>
    body{
        margin:0;
        font-family:Arial;
        background:linear-gradient(135deg,#0f172a,#1e293b);
        color:white;
        display:flex;
        justify-content:center;
        align-items:center;
        height:100vh;
    }

    .box{
        background:#111827;
        padding:40px;
        border-radius:20px;
        width:350px;
        box-shadow:0 0 30px rgba(0,0,0,0.6);
    }

    input{
        width:100%;
        padding:12px;
        margin:10px 0;
        border:none;
        border-radius:10px;
    }

    button{
        width:100%;
        padding:12px;
        border:none;
        border-radius:10px;
        background:#6366f1;
        color:white;
        font-weight:bold;
        cursor:pointer;
    }

    button:hover{
        background:#4f46e5;
    }

    #result{
        margin-top:15px;
        text-align:center;
    }

    </style>
    </head>
    <body>

    <div class="box">
        <h2 style="text-align:center;">Web Panel</h2>

        <input type="text" id="userId" placeholder="Enter ID">
        <input type="number" id="amount" placeholder="Enter Amount">

        <button onclick="send()">Send</button>

        <div id="result"></div>
    </div>

    <script>

    async function send(){

        const userId = document.getElementById("userId").value;
        const amount = document.getElementById("amount").value;

        const res = await fetch("/api",{
            method:"POST",
            headers:{
                "Content-Type":"application/json"
            },
            body:JSON.stringify({userId,amount})
        });

        const data = await res.json();
        document.getElementById("result").innerText = data.message;
    }

    </script>

    </body>
    </html>
    `);
});


/*
  API يستقبل البيانات
*/
app.post("/api", (req,res)=>{
    const { userId, amount } = req.body;

    if(!userId || !amount){
        return res.json({message:"Missing Data"});
    }

    console.log("Received:", userId, amount);

    res.json({message:"Data Received Successfully"});
});


const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
    console.log("Server running on port " + PORT);
});
