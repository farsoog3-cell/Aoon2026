import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

/* ================= DATABASE ================= */

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("MongoDB Connected ✅"))
  .catch(err => {
    console.error("DB Error", err);
    process.exit(1);
  });

const UserSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  balance: { type: Number, default: 0 }
});

const User = mongoose.model("User", UserSchema);

/* ================= SIMPLE ADMIN PASSWORD ================= */

const ADMIN_PASSWORD = "123456"; // ❗ غيرها بكلمة سر قوية

function auth(req, res, next) {
  const pass = req.headers["admin-pass"];
  if (pass !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

/* ================= ADMIN ADD GEMS API ================= */

app.post("/admin/add-gems", auth, async (req, res) => {
  try {

    const { userId, amount } = req.body;

    if (!userId || !amount)
      return res.status(400).json({ error: "Missing data" });

    if (amount <= 0)
      return res.status(400).json({ error: "Invalid amount" });

    const user = await User.findOne({ userId });

    if (!user)
      return res.status(404).json({ error: "User not found" });

    user.balance += Number(amount);
    await user.save();

    res.json({
      message: "Gems Added ✅",
      newBalance: user.balance
    });

  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
});

/* ================= ADMIN PANEL PAGE ================= */

app.get("/admin", (req, res) => {

  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
  <title>Admin Panel</title>
  <style>
  body{
    background:#111;
    color:white;
    font-family:Arial;
    text-align:center;
    padding:50px;
  }
  input{
    padding:10px;
    margin:10px;
    width:250px;
  }
  button{
    padding:10px 20px;
    background:green;
    color:white;
    border:none;
    cursor:pointer;
  }
  </style>
  </head>
  <body>

  <h2>Admin Login 🔐</h2>

  <input id="password" type="password" placeholder="Enter Admin Password"><br><br>

  <button onclick="login()">Login</button>

  <div id="panel" style="display:none;margin-top:30px;">
    <h2>Add Gems 🚀</h2>

    <input id="userId" placeholder="User ID"><br>
    <input id="amount" type="number" placeholder="Gems Amount"><br>

    <button onclick="send()">Send Gems</button>

    <p id="result"></p>
  </div>

  <script>

  let adminPass = "";

  function login(){
    adminPass = document.getElementById("password").value;
    document.getElementById("panel").style.display = "block";
  }

  async function send(){

    const userId = document.getElementById("userId").value;
    const amount = document.getElementById("amount").value;

    const res = await fetch("/admin/add-gems", {
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "admin-pass": adminPass
      },
      body:JSON.stringify({ userId, amount })
    });

    const data = await res.json();

    document.getElementById("result").innerText =
      JSON.stringify(data);
  }

  </script>

  </body>
  </html>
  `);

});

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Server Running 🚀 on port", PORT);
});
