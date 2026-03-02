import express from "express";
import mongoose from "mongoose";

const app = express();
app.use(express.json());

/* ========= DATABASE ========= */

mongoose.connect("mongodb://127.0.0.1:27017/jewelsDB")
  .then(() => console.log("MongoDB Connected ✅"))
  .catch(err => console.error("DB Error ❌", err));

const UserSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  balance: { type: Number, default: 0 }
});

const TransactionSchema = new mongoose.Schema({
  from: String,
  to: String,
  amount: Number,
  date: { type: Date, default: Date.now }
});

const User = mongoose.model("User", UserSchema);
const Transaction = mongoose.model("Transaction", TransactionSchema);

/* ========= CREATE USER ========= */

app.post("/create", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId)
      return res.status(400).json({ error: "UserId required" });

    const exists = await User.findOne({ userId });

    if (exists)
      return res.status(400).json({ error: "User already exists" });

    const user = await User.create({ userId });

    res.json(user);

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ========= TRANSFER JEWELS ========= */

app.post("/transfer", async (req, res) => {
  try {

    const { fromID, toID, amount } = req.body;

    if (!fromID || !toID || !amount)
      return res.status(400).json({ error: "Missing data" });

    if (amount <= 0)
      return res.status(400).json({ error: "Invalid amount" });

    const sender = await User.findOne({ userId: fromID });
    const receiver = await User.findOne({ userId: toID });

    if (!sender || !receiver)
      return res.status(404).json({ error: "User not found" });

    if (sender.balance < amount)
      return res.status(400).json({ error: "Not enough balance" });

    /* ====== UPDATE BALANCE SAFELY ====== */

    sender.balance -= amount;
    receiver.balance += amount;

    await sender.save();
    await receiver.save();

    await Transaction.create({
      from: fromID,
      to: toID,
      amount
    });

    res.json({ message: "Transfer successful ✅" });

  } catch (err) {
    res.status(500).json({ error: "Transfer failed" });
  }
});

/* ========= GET BALANCE ========= */

app.get("/balance/:id", async (req, res) => {
  try {

    const user = await User.findOne({ userId: req.params.id });

    if (!user)
      return res.status(404).json({ error: "User not found" });

    res.json({ balance: user.balance });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ========= START SERVER ========= */

app.listen(3000, () => {
  console.log("Server running 🚀 on port 3000");
});
