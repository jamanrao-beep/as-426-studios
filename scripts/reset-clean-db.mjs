import mysql from "mysql2/promise";
import { sample } from "../lib/menu.ts";
import crypto from "node:crypto";

// Seed passwords come from the environment, or are generated and printed once. Never hard-coded.
const generated = [];
function seedHash(envName, label) {
  const password = process.env[envName] || crypto.randomBytes(9).toString("base64url");
  if (!process.env[envName]) generated.push(`${label}: ${password}`);
  const salt = crypto.randomBytes(16).toString("hex");
  return `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString("hex")}`;
}

for (const k of ["MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"]) {
  if (!process.env[k]) {
    console.error(`Missing ${k}. Set the MySQL environment variables before running this script.`);
    process.exit(1);
  }
}


const connectionConfig = {
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  ssl: { rejectUnauthorized: false }
};

async function resetClean() {
  console.log("🧹 Resetting Hostinger MySQL database to a clean testing state...");
  const conn = await mysql.createConnection(connectionConfig);

  try {
    // 1. Wipe transient testing data
    await conn.query("DELETE FROM orders");
    await conn.query("DELETE FROM dish_ratings");
    await conn.query("DELETE FROM reviews");
    await conn.query("DELETE FROM audit_logs");
    await conn.query("DELETE FROM dish_insights_notifications");
    await conn.query("DELETE FROM notification_reads");
    console.log("  ✓ Cleared all orders, dish ratings, reviews, notifications, and audit logs");

    // 2. Reset accounts to clean seed
    await conn.query("DELETE FROM accounts");
    await conn.query("DELETE FROM waiters");
    await conn.query("DELETE FROM members");
    await conn.query("DELETE FROM restaurant_members");
    await conn.query("DELETE FROM restaurants");
    await conn.query("DELETE FROM menu");

    const now = new Date().toISOString();

    // 4. Insert clean Super Admin
    await conn.query(`
      INSERT INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', 0, 1, ?, ?)
    `, [
      "acc_super_admin",
      "admin@as426.studios",
      seedHash("SEED_SUPER_ADMIN_PASSWORD", "Super Admin"),
      "Super Admin",
      "super_admin",
      null,
      now,
      now
    ]);

    console.log("✅ Database successfully reset to clean testing state!");
    console.log("   - Orders: 0");
    console.log("   - Ratings: 0");
    console.log("   - Reviews: 0");
    console.log("   Seeded account: admin@as426.studios (Super Admin). Create restaurants, managers and waiters from the dashboard.");
    if (generated.length) console.log(["Temporary passwords (shown once, change them after first login):", ...generated].join(String.fromCharCode(10)));
  } finally {
    await conn.end();
  }
}

resetClean();
