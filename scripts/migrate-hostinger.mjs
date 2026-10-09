import mysql from "mysql2/promise";
import { sample } from "../lib/menu.ts";

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "srv839.hstgr.io",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "u580210733_ts_admin",
  password: process.env.MYSQL_PASSWORD || "Admin@009988763366",
  database: process.env.MYSQL_DATABASE || "u580210733_table_secret",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false
  }
});

async function migrate() {
  console.log("🚀 Starting Hostinger MySQL database migration...");
  const conn = await pool.getConnection();

  try {
    // 1. Menu
    await conn.query(`
      CREATE TABLE IF NOT EXISTS menu (
        id VARCHAR(191) PRIMARY KEY NOT NULL,
        data LONGTEXT NOT NULL,
        revision INT DEFAULT 1 NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Restaurants
    await conn.query(`
      CREATE TABLE IF NOT EXISTS restaurants (
        id VARCHAR(191) PRIMARY KEY NOT NULL,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(191) UNIQUE NOT NULL,
        address VARCHAR(255) DEFAULT '' NOT NULL,
        contact_phone VARCHAR(64) DEFAULT '' NOT NULL,
        contact_email VARCHAR(191) DEFAULT '' NOT NULL,
        welcome_message TEXT,
        note TEXT,
        status VARCHAR(64) DEFAULT 'active' NOT NULL,
        manager_qr_visible TINYINT(1) DEFAULT 1 NOT NULL,
        archived_at VARCHAR(64),
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Members
    await conn.query(`
      CREATE TABLE IF NOT EXISTS members (
        email VARCHAR(191) PRIMARY KEY NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Restaurant Members
    await conn.query(`
      CREATE TABLE IF NOT EXISTS restaurant_members (
        restaurant_id VARCHAR(191) NOT NULL,
        email VARCHAR(191) NOT NULL,
        PRIMARY KEY(restaurant_id, email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Waiters
    await conn.query(`
      CREATE TABLE IF NOT EXISTS waiters (
        restaurant_id VARCHAR(191) NOT NULL,
        email VARCHAR(191) NOT NULL,
        name VARCHAR(255) NOT NULL,
        created_at VARCHAR(64) NOT NULL,
        PRIMARY KEY(restaurant_id, email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Orders
    await conn.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(191) PRIMARY KEY NOT NULL,
        restaurant_id VARCHAR(191) NOT NULL,
        restaurant_name VARCHAR(255) NOT NULL,
        table_label VARCHAR(64) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_token VARCHAR(191),
        notes TEXT,
        items LONGTEXT NOT NULL,
        total INT NOT NULL,
        status VARCHAR(64) NOT NULL,
        request_hash VARCHAR(191),
        tracking_hash VARCHAR(191),
        is_test TINYINT(1) DEFAULT 0,
        status_history LONGTEXT,
        accepted_by VARCHAR(191),
        accepted_at VARCHAR(64),
        preparing_by VARCHAR(191),
        preparing_at VARCHAR(64),
        delivered_by VARCHAR(191),
        delivered_at VARCHAR(64),
        completed_by VARCHAR(191),
        completed_at VARCHAR(64),
        cancelled_by VARCHAR(191),
        cancelled_by_id VARCHAR(191),
        cancelled_by_name VARCHAR(255),
        cancelled_by_role VARCHAR(64),
        cancellation_reason TEXT,
        cancelled_at VARCHAR(64),
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        completed_at VARCHAR(64),
        INDEX idx_orders_rest_status (restaurant_id, status),
        INDEX idx_orders_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Accounts
    await conn.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        id VARCHAR(191) PRIMARY KEY NOT NULL,
        email VARCHAR(191) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(64) NOT NULL,
        restaurant_id VARCHAR(191),
        status VARCHAR(64) DEFAULT 'active' NOT NULL,
        must_change_password TINYINT(1) DEFAULT 0 NOT NULL,
        session_version INT DEFAULT 1 NOT NULL,
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        INDEX idx_accounts_role (role),
        INDEX idx_accounts_restaurant (restaurant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Audit logs
    await conn.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(191) PRIMARY KEY NOT NULL,
        restaurant_id VARCHAR(191),
        action VARCHAR(191) NOT NULL,
        actor_id VARCHAR(191),
        actor_email VARCHAR(191),
        actor_role VARCHAR(64),
        target_type VARCHAR(64),
        target_id VARCHAR(191),
        details LONGTEXT,
        created_at VARCHAR(64) NOT NULL,
        INDEX idx_audit_rest (restaurant_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. Reviews
    await conn.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id VARCHAR(191) PRIMARY KEY NOT NULL,
        restaurant_id VARCHAR(191) NOT NULL,
        rating INT NOT NULL,
        message TEXT NOT NULL,
        name VARCHAR(255) DEFAULT '' NOT NULL,
        created_at VARCHAR(64) NOT NULL,
        read_at VARCHAR(64),
        INDEX idx_reviews_rest_date (restaurant_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. Dish ratings
    await conn.query(`
      CREATE TABLE IF NOT EXISTS dish_ratings (
        id VARCHAR(191) PRIMARY KEY NOT NULL,
        order_id VARCHAR(191) NOT NULL,
        restaurant_id VARCHAR(191) NOT NULL,
        dish_id VARCHAR(191) NOT NULL,
        dish_name VARCHAR(255) NOT NULL,
        rating INT NOT NULL,
        comment TEXT,
        customer_token VARCHAR(191),
        created_at VARCHAR(64) NOT NULL,
        updated_at VARCHAR(64) NOT NULL,
        UNIQUE KEY uq_order_dish (order_id, dish_id),
        INDEX idx_dish_ratings_rest (restaurant_id, dish_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11. Dish Insights
    await conn.query(`
      CREATE TABLE IF NOT EXISTS dish_insights_notifications (
        id VARCHAR(191) PRIMARY KEY NOT NULL,
        restaurant_id VARCHAR(191) NOT NULL,
        date VARCHAR(64) NOT NULL,
        best_seller_id VARCHAR(191),
        best_seller_name VARCHAR(255),
        best_seller_qty INT DEFAULT 0 NOT NULL,
        top_rated_id VARCHAR(191),
        top_rated_name VARCHAR(255),
        top_rated_score DOUBLE,
        top_rated_count INT DEFAULT 0 NOT NULL,
        zero_sales_count INT DEFAULT 0 NOT NULL,
        zero_sales_dishes LONGTEXT,
        summary_text TEXT NOT NULL,
        created_at VARCHAR(64) NOT NULL,
        UNIQUE KEY uq_rest_date (restaurant_id, date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 12. Notification Reads
    await conn.query(`
      CREATE TABLE IF NOT EXISTS notification_reads (
        notification_id VARCHAR(191) NOT NULL,
        user_email VARCHAR(191) NOT NULL,
        read_at VARCHAR(64) NOT NULL,
        PRIMARY KEY(notification_id, user_email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log("✅ All 12 tables created successfully!");

    // SEED INITIAL DATA
    const now = new Date().toISOString();

    // 1. Seed Restaurant Ember & Spice
    await conn.query(`
      INSERT INTO restaurants (id, name, slug, address, contact_phone, contact_email, welcome_message, note, status, manager_qr_visible, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON DUPLICATE KEY UPDATE name = VALUES(name), updated_at = VALUES(updated_at)
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

    // 2. Seed Accounts
    // Super Admin
    await conn.query(`
      INSERT INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)
    `, [
      "acc_super_admin",
      "admin@as426.studios",
      "admin@009988763366",
      "Super Admin",
      "super_admin",
      null,
      "active",
      0,
      1,
      now,
      now
    ]);

    // Manager
    await conn.query(`
      INSERT INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)
    `, [
      "acc_mgr_ember",
      "admin@as426.com",
      "admin123",
      "Restaurant Manager",
      "admin",
      "ember-spice",
      "active",
      0,
      1,
      now,
      now
    ]);

    // Waiter
    await conn.query(`
      INSERT INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)
    `, [
      "acc_waiter_ember",
      "staff@as426.com",
      "staff123",
      "Rahul (Staff)",
      "waiter",
      "ember-spice",
      "active",
      0,
      1,
      now,
      now
    ]);

    // 3. Backward compatibility tables
    await conn.query(`INSERT IGNORE INTO members (email) VALUES (?)`, ["admin@as426.studios"]);
    await conn.query(`INSERT IGNORE INTO members (email) VALUES (?)`, ["admin@as426.com"]);
    await conn.query(`INSERT IGNORE INTO restaurant_members (restaurant_id, email) VALUES (?, ?)`, ["ember-spice", "admin@as426.studios"]);
    await conn.query(`INSERT IGNORE INTO restaurant_members (restaurant_id, email) VALUES (?, ?)`, ["ember-spice", "admin@as426.com"]);
    await conn.query(`
      INSERT INTO waiters (restaurant_id, email, name, created_at)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `, ["ember-spice", "staff@as426.com", "Rahul (Staff)", now]);

    // 4. Menu
    await conn.query(`
      INSERT INTO menu (id, data, revision)
      VALUES (?, ?, 1)
      ON DUPLICATE KEY UPDATE revision = VALUES(revision)
    `, ["ember-spice", JSON.stringify(sample)]);

    // 5. Initial orders if empty
    const [orderCountRows] = await conn.query("SELECT COUNT(*) as count FROM orders");
    if (orderCountRows[0].count === 0) {
      await conn.query(`
        INSERT INTO orders (id, restaurant_id, restaurant_name, table_label, customer_name, notes, items, total, status, request_hash, is_test, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `, [
        "ord-101",
        "ember-spice",
        "Ember & Spice",
        "4",
        "Aarav Sharma",
        "Less spicy on the chicken please",
        JSON.stringify([
          { id: "1", name: "Smoked Paneer Tikka", unitPrice: 295, quantity: 1 },
          { id: "6", name: "Mango & Mint Cooler", unitPrice: 165, quantity: 2 },
        ]),
        625,
        "new",
        "req-hash-1",
        now,
        now
      ]);

      await conn.query(`
        INSERT INTO orders (id, restaurant_id, restaurant_name, table_label, customer_name, notes, items, total, status, request_hash, is_test, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `, [
        "ord-102",
        "ember-spice",
        "Ember & Spice",
        "2",
        "Priya Patel",
        "Table near the window",
        JSON.stringify([
          { id: "2", name: "Ghee Roast Chicken", unitPrice: 345, quantity: 1 },
          { id: "3", name: "Wild Mushroom Kulcha", unitPrice: 245, quantity: 2 },
        ]),
        835,
        "preparing",
        "req-hash-2",
        now,
        now
      ]);
    }

    console.log("✅ Seed data populated successfully in Hostinger MySQL!");
  } catch (err) {
    console.error("❌ Migration error:", err);
    throw err;
  } finally {
    conn.release();
    await pool.end();
  }
}

migrate();
