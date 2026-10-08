import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { sample } from "@/lib/menu";

let dbInstance: any = null;

function createRawDb(): InstanceType<typeof DatabaseSync> {
  // On Vercel / serverless, process.cwd() is read-only.
  // Use os.tmpdir() (/tmp), which is guaranteed writable.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    try {
      const tmpPath = path.join(os.tmpdir(), "as426.sqlite");
      return new DatabaseSync(tmpPath);
    } catch {
      return new DatabaseSync(":memory:");
    }
  }

  // Local development: try .data folder, fallback to tmpdir or memory
  try {
    const dataDir = path.resolve(process.cwd(), ".data");
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbPath = path.join(dataDir, "as426.sqlite");
    return new DatabaseSync(dbPath);
  } catch {
    try {
      return new DatabaseSync(path.join(os.tmpdir(), "as426.sqlite"));
    } catch {
      return new DatabaseSync(":memory:");
    }
  }
}

function ensureColumn(rawDb: InstanceType<typeof DatabaseSync>, tableName: string, colName: string, colDef: string) {
  try {
    const cols = rawDb.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === colName)) {
      rawDb.exec(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colDef}`);
    }
  } catch (err: any) {
    console.error(`Error ensuring column ${colName} on ${tableName}:`, err.message);
  }
}

export function getSqliteD1() {
  if (dbInstance) return dbInstance;
  if ((globalThis as any).__sqliteDbInstance) {
    dbInstance = (globalThis as any).__sqliteDbInstance;
    return dbInstance;
  }

  const rawDb = createRawDb();

  // 1. Initialize core tables
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS menu (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      revision INTEGER DEFAULT 1 NOT NULL
    );

    CREATE TABLE IF NOT EXISTS restaurants (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      address TEXT DEFAULT '' NOT NULL,
      contact_phone TEXT DEFAULT '' NOT NULL,
      contact_email TEXT DEFAULT '' NOT NULL,
      welcome_message TEXT DEFAULT '' NOT NULL,
      note TEXT DEFAULT '' NOT NULL,
      status TEXT DEFAULT 'active' NOT NULL,
      archived_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
      email TEXT PRIMARY KEY NOT NULL
    );

    CREATE TABLE IF NOT EXISTS restaurant_members (
      restaurant_id TEXT NOT NULL,
      email TEXT NOT NULL,
      PRIMARY KEY(restaurant_id, email)
    );

    CREATE TABLE IF NOT EXISTS waiters (
      restaurant_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY(restaurant_id, email)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY NOT NULL,
      restaurant_id TEXT NOT NULL,
      restaurant_name TEXT NOT NULL,
      table_label TEXT NOT NULL,
      customer_name TEXT DEFAULT '' NOT NULL,
      notes TEXT DEFAULT '' NOT NULL,
      items TEXT NOT NULL,
      total INTEGER NOT NULL,
      status TEXT DEFAULT 'new' NOT NULL,
      request_hash TEXT NOT NULL,
      tracking_hash TEXT,
      customer_token TEXT,
      is_test INTEGER DEFAULT 0 NOT NULL,
      status_history TEXT,
      accepted_by TEXT,
      accepted_at TEXT,
      preparing_by TEXT,
      preparing_at TEXT,
      delivered_by TEXT,
      delivered_at TEXT,
      cancelled_by TEXT,
      cancelled_at TEXT,
      completed_at TEXT,
      completed_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT DEFAULT '' NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      restaurant_id TEXT,
      status TEXT DEFAULT 'active' NOT NULL,
      must_change_password INTEGER DEFAULT 0 NOT NULL,
      session_version INTEGER DEFAULT 1 NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY NOT NULL,
      action TEXT NOT NULL,
      actor_id TEXT,
      actor_email TEXT,
      actor_role TEXT,
      target_type TEXT,
      target_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY NOT NULL,
      restaurant_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      message TEXT NOT NULL,
      name TEXT DEFAULT '' NOT NULL,
      created_at TEXT NOT NULL,
      read_at TEXT
    );

    CREATE TABLE IF NOT EXISTS dish_ratings (
      id TEXT PRIMARY KEY NOT NULL,
      order_id TEXT NOT NULL,
      restaurant_id TEXT NOT NULL,
      dish_id TEXT NOT NULL,
      dish_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT DEFAULT '' NOT NULL,
      customer_token TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(order_id, dish_id)
    );

    CREATE TABLE IF NOT EXISTS dish_insights_notifications (
      id TEXT PRIMARY KEY NOT NULL,
      restaurant_id TEXT NOT NULL,
      date TEXT NOT NULL,
      best_seller_id TEXT,
      best_seller_name TEXT,
      best_seller_qty INTEGER DEFAULT 0 NOT NULL,
      top_rated_id TEXT,
      top_rated_name TEXT,
      top_rated_score REAL,
      top_rated_count INTEGER DEFAULT 0 NOT NULL,
      zero_sales_count INTEGER DEFAULT 0 NOT NULL,
      zero_sales_dishes TEXT DEFAULT '[]' NOT NULL,
      summary_text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(restaurant_id, date)
    );

    CREATE TABLE IF NOT EXISTS notification_reads (
      notification_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      read_at TEXT NOT NULL,
      PRIMARY KEY(notification_id, user_email)
    );
  `);

  rawDb.exec(`
    CREATE INDEX IF NOT EXISTS idx_dish_ratings_rest_dish ON dish_ratings(restaurant_id, dish_id);
    CREATE INDEX IF NOT EXISTS idx_dish_ratings_created ON dish_ratings(created_at);
    CREATE INDEX IF NOT EXISTS idx_dish_insights_rest_date ON dish_insights_notifications(restaurant_id, date);
  `);

  // Ensure migrations on existing databases
  ensureColumn(rawDb, "accounts", "id", "TEXT");
  ensureColumn(rawDb, "accounts", "password_hash", "TEXT");
  ensureColumn(rawDb, "accounts", "status", "TEXT DEFAULT 'active'");
  ensureColumn(rawDb, "accounts", "must_change_password", "INTEGER DEFAULT 0");
  ensureColumn(rawDb, "accounts", "session_version", "INTEGER DEFAULT 1");
  ensureColumn(rawDb, "accounts", "updated_at", "TEXT");

  ensureColumn(rawDb, "orders", "customer_token", "TEXT");
  ensureColumn(rawDb, "orders", "is_test", "INTEGER DEFAULT 0");
  ensureColumn(rawDb, "orders", "status_history", "TEXT");
  ensureColumn(rawDb, "orders", "accepted_by", "TEXT");
  ensureColumn(rawDb, "orders", "accepted_at", "TEXT");
  ensureColumn(rawDb, "orders", "preparing_by", "TEXT");
  ensureColumn(rawDb, "orders", "preparing_at", "TEXT");
  ensureColumn(rawDb, "orders", "delivered_by", "TEXT");
  ensureColumn(rawDb, "orders", "delivered_at", "TEXT");
  ensureColumn(rawDb, "orders", "cancelled_by", "TEXT");
  ensureColumn(rawDb, "orders", "cancelled_at", "TEXT");

  ensureColumn(rawDb, "restaurants", "status", "TEXT DEFAULT 'active'");
  ensureColumn(rawDb, "restaurants", "archived_at", "TEXT");

  const now = new Date().toISOString();

  // Seed default restaurant Ember & Spice
  const existingRestaurant = rawDb.prepare("SELECT id FROM restaurants WHERE id = ?").get("ember-spice");
  if (!existingRestaurant) {
    rawDb.prepare(`
      INSERT OR REPLACE INTO restaurants (id, name, slug, address, contact_phone, contact_email, welcome_message, note, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
    );
  }

  // Seed Super Admin
  rawDb.prepare(`
    INSERT OR REPLACE INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "acc_super_admin",
    "admin@as426.studios",
    "admin@009988763366", // verifyPassword supports both plain text initial seed and scrypt$ hashes
    "Super Admin",
    "super_admin",
    null,
    "active",
    0,
    1,
    now,
    now
  );

  // Seed Restaurant Admin (Manager)
  rawDb.prepare(`
    INSERT OR REPLACE INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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
  );

  // Seed Waiter
  rawDb.prepare(`
    INSERT OR REPLACE INTO accounts (id, email, password_hash, name, role, restaurant_id, status, must_change_password, session_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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
  );

  // Maintain backward-compatibility tables
  rawDb.prepare("INSERT OR IGNORE INTO members (email) VALUES (?)").run("admin@as426.studios");
  rawDb.prepare("INSERT OR IGNORE INTO members (email) VALUES (?)").run("admin@as426.com");
  rawDb.prepare("INSERT OR IGNORE INTO restaurant_members (restaurant_id, email) VALUES (?, ?)").run("ember-spice", "admin@as426.studios");
  rawDb.prepare("INSERT OR IGNORE INTO restaurant_members (restaurant_id, email) VALUES (?, ?)").run("ember-spice", "admin@as426.com");
  rawDb.prepare("INSERT OR IGNORE INTO waiters (restaurant_id, email, name, created_at) VALUES (?, ?, ?, ?)").run(
    "ember-spice",
    "staff@as426.com",
    "Rahul (Staff)",
    now
  );

  // Seed Sample Menu
  const existingMenu = rawDb.prepare("SELECT id FROM menu WHERE id = ?").get("ember-spice");
  if (!existingMenu) {
    rawDb.prepare("INSERT INTO menu (id, data, revision) VALUES (?, ?, 1)").run("ember-spice", JSON.stringify(sample));
  }

  // Seed Sample Initial Orders if none exist
  const countRow = rawDb.prepare("SELECT count(*) as count FROM orders").get() as any;
  if (!countRow || countRow.count === 0) {
    const insertOrder = rawDb.prepare(`
      INSERT INTO orders (id, restaurant_id, restaurant_name, table_label, customer_name, notes, items, total, status, request_hash, is_test, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);
    insertOrder.run(
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
    );
    insertOrder.run(
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
    );
  }

  // D1 compatibility wrapper
  dbInstance = {
    prepare(queryStr: string) {
      let boundParams: unknown[] = [];
      return {
        bind(...params: unknown[]) {
          boundParams = params;
          return this;
        },
        async first<T = unknown>(col?: string): Promise<T | null> {
          try {
            const stmt = rawDb.prepare(queryStr);
            const row = stmt.get(...(boundParams as any[])) as any;
            if (!row) return null;
            if (col) return row[col] ?? null;
            return row as T;
          } catch (err: any) {
            console.error("[sqlite first] error:", err.message, "SQL:", queryStr);
            throw err;
          }
        },
        async all<T = unknown>(): Promise<{ results: T[]; meta: { changes: number } }> {
          try {
            const stmt = rawDb.prepare(queryStr);
            const rows = stmt.all(...(boundParams as any[])) as T[];
            return { results: rows || [], meta: { changes: 0 } };
          } catch (err: any) {
            console.error("[sqlite all] error:", err.message, "SQL:", queryStr);
            throw err;
          }
        },
        async run(): Promise<{ meta: { changes: number } }> {
          try {
            const stmt = rawDb.prepare(queryStr);
            const res = stmt.run(...(boundParams as any[]));
            return { meta: { changes: Number(res.changes || 0) } };
          } catch (err: any) {
            console.error("[sqlite run] error:", err.message, "SQL:", queryStr);
            throw err;
          }
        },
      };
    },
    async exec(sql: string) {
      rawDb.exec(sql);
      return { count: 1, duration: 0 };
    },
    async batch(stmts: any[]) {
      const results = [];
      for (const s of stmts) {
        results.push(await s.run());
      }
      return results;
    },
  };

  (globalThis as any).__sqliteDbInstance = dbInstance;
  return dbInstance;
}
