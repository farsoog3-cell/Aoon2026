// server.js
const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

/*
  قاعدة بيانات مؤقتة (يمكن ربطها بـ MongoDB لاحقاً)
*/
let transactions = [];

/*
  API لإرسال طلب مجوهرات
  هذا لا يرسل شيء للعبة مباشرة
  بل يسجل الطلب فقط
*/
app.post("/send-gems", (req, res) => {
    const { userId, gems } = req.body;

    if (!userId || !gems) {
        return res.status(400).json({ message: "UserID and Gems required" });
    }

    const request = {
        id: transactions.length + 1,
        userId,
        gems,
        status: "pending",
        time: new Date()
    };

    transactions.push(request);

    res.json({
        message: "Request received successfully",
        data: request
    });
});

/*
  عرض الطلبات (Admin)
*/
app.get("/transactions", (req, res) => {
    res.json(transactions);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
