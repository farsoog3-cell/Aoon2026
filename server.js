import express from "express";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const app = express();
app.use(express.json());

/* ========= DATABASE ========= */

mongoose.connect("mongodb://127.0.0.1:27017/jewelsDB");

const UserSchema = new mongoose.Schema({
  userId: String,
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
  const { userId } = req.body;

  const user = await User.create({ userId });
  res.json(user);
});

/* ========= TRANSFER JEWELS ========= */

app.post("/transfer", async (req, res) => {
  const { fromID, toID, amount } = req.body;

  const sender = await User.findOne({ userId: fromID });
  const receiver = await User.findOne({ userId: toID });

  if (!sender || !receiver)
    return res.status(404).json({ error: "User not found" });

  if (sender.balance < amount)
    return res.status(400).json({ error: "Not enough balance" });

  sender.balance -= amount;
  receiver.balance += amount;

  await sender.save();
  await receiver.save();

  await Transaction.create({
    from: fromID,
    to: toID,
    amount
  });

  res.json({ message: "Transfer successful" });
});

/* ========= GET BALANCE ========= */

app.get("/balance/:id", async (req, res) => {
  const user = await User.findOne({ userId: req.params.id });

  if (!user)
    return res.status(404).json({ error: "User not found" });

  res.json({ balance: user.balance });
});

app.listen(3000, () => {
  console.log("Server running 🚀");
});
