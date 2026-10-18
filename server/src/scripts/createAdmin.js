import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

// কমান্ড থেকে পাওয়া তথ্য: node src/scripts/createAdmin.js "নাম" email "password"
const [, , name, email, password] = process.argv;

async function createAdmin() {
  if (!name || !email || !password) {
    console.error('Usage: node src/scripts/createAdmin.js "Name" email@example.com \'Password\'');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters long.");
    process.exit(1);
  }

  await connectDB();

  const existingAdmin = await User.exists({ role: "ADMINISTRATOR" });

  if (existingAdmin) {
    console.log("An administrator already exists. No new admin was created.");
    await mongoose.disconnect();
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await User.create({
    name,
    email: email.toLowerCase().trim(),
    passwordHash,
    role: "ADMINISTRATOR",
    isActive: true,
  });

  console.log(`Administrator created: ${email}`);
  await mongoose.disconnect();
  process.exit(0);
}

createAdmin().catch((error) => {
  console.error("Failed to create admin:", error.message);
  process.exit(1);
});
