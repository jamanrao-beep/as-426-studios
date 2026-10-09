import mysql from "mysql2/promise";
import { sample } from "../lib/menu.ts";

const connectionConfig = {
  host: process.env.MYSQL_HOST || "srv839.hstgr.io",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "u580210733_ts_admin",
  password: process.env.MYSQL_PASSWORD || "Admin@009988763366",
  database: process.env.MYSQL_DATABASE || "u580210733_table_secret",
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

    // 3. Insert default restaurant Ember & Spice
    await conn.query(`
      INSERT INTO restaurants (id, name, slug, address, contact_phone, contact_email, welcome_message, note, status, manager_qr_visible, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `, [
      "ember-spice",
      "Ember & Spice",
      "ember-spice",
      "42 Connaught Place, New Delhi",
      "+91 98100 12345",
      "contact@emberspice.com",
      "Welcome to Ember & Spice. Explore our signature coal-fired kitchen selections.",
      "Taxes and 5% service charge included. Please inform your server about any allergies.",
      "active",
      now,
      now
    ]);

    // 4. Insert clean Super Admin
    await conn.query(`
      INSERT INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', 0, 1, ?, ?)
    `, [
      "acc_super_admin",
      "admin@as426.studios",
      "admin@009988763366",
      "Super Admin",
      "super_admin",
      null,
      now,
      now
    ]);

    // 5. Insert clean Manager
    await conn.query(`
      INSERT INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', 0, 1, ?, ?)
    `, [
      "acc_mgr_ember",
      "admin@as426.com",
      "admin123",
      "Restaurant Manager",
      "admin",
      "ember-spice",
      now,
      now
    ]);

    // 6. Insert clean Waiter
    await conn.query(`
      INSERT INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'active', 0, 1, ?, ?)
    `, [
      "acc_waiter_ember",
      "staff@as426.com",
      "staff123",
      "Rahul (Staff)",
      "waiter",
      "ember-spice",
      now,
      now
    ]);

    // 7. Insert mapping rows
    await conn.query(`INSERT INTO members (email) VALUES (?)`, ["admin@as426.studios"]);
    await conn.query(`INSERT INTO members (email) VALUES (?)`, ["admin@as426.com"]);
    await conn.query(`INSERT INTO restaurant_members (restaurant_id, email) VALUES (?, ?)`, ["ember-spice", "admin@as426.studios"]);
    await conn.query(`INSERT INTO restaurant_members (restaurant_id, email) VALUES (?, ?)`, ["ember-spice", "admin@as426.com"]);
    await conn.query(`
      INSERT INTO waiters (restaurant_id, email, name, created_at)
      VALUES (?, ?, ?, ?)
    `, ["ember-spice", "staff@as426.com", "Rahul (Staff)", now]);

    // 8. Insert clean Ember & Spice menu
    await conn.query(`
      INSERT INTO menu (id, data, revision)
      VALUES (?, ?, 1)
    `, ["ember-spice", JSON.stringify(sample)]);

    console.log("✅ Database successfully reset to clean testing state!");
    console.log("   - Orders: 0");
    console.log("   - Ratings: 0");
    console.log("   - Reviews: 0");
    console.log("   - Super Admin: admin@as426.studios / admin@009988763366");
    console.log("   - Manager: admin@as426.com / admin123");
    console.log("   - Waiter: staff@as426.com / staff123");
  } finally {
    await conn.end();
  }
}

resetClean();
