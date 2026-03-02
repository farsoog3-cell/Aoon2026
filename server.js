const express = require("express");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// قاعدة بيانات مؤقتة
let users = {
  "1001": { balance: 1000 },
  "1002": { balance: 500 },
  "1003": { balance: 250 }
};

let transactions = [];

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.json({
    message: "Party Star Jewels Server Running",
    endpoints: {
      checkBalance: "GET /balance/:id",
      transfer: "POST /transfer",
      transactions: "GET /transactions"
    }
  });
});

// عرض الرصيد
app.get("/balance/:id", (req, res) => {
  const id = req.params.id;

  if (!users[id]) {
    return res.status(404).json({ error: "ID not found" });
  }

  res.json({
    id: id,
    balance: users[id].balance
  });
});

// تحويل المجوهرات
app.post("/transfer", (req, res) => {
  const { fromID, toID, amount } = req.body;

  if (!fromID || !toID || !amount) {
    return res.status(400).json({ error: "Missing data" });
  }

  if (!users[fromID] || !users[toID]) {
    return res.status(404).json({ error: "Invalid ID" });
  }

  if (amount <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  if (users[fromID].balance < amount) {
    return res.status(400).json({ error: "Not enough jewels" });
  }

  // تنفيذ التحويل
  users[fromID].balance -= amount;
  users[toID].balance += amount;

  const transaction = {
    id: uuidv4(),
    from: fromID,
    to: toID,
    amount: amount,
    date: new Date()
  };

  transactions.push(transaction);

  res.json({
    message: "Transfer successful",
    transaction: transaction
  });
});

// عرض جميع العمليات
app.get("/transactions", (req, res) => {
  res.json(transactions);
});

// إنشاء مستخدم جديد
app.post("/create", (req, res) => {
  const { id, balance } = req.body;

  if (!id) {
    return res.status(400).json({ error: "ID required" });
  }

  if (users[id]) {
    return res.status(400).json({ error: "ID already exists" });
  }

  users[id] = {
    balance: balance || 0
  };

  res.json({
    message: "User created",
    user: users[id]
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
