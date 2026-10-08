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

export function getSqliteD1() {
  if (dbInstance) return dbInstance;
  if ((globalThis as any).__sqliteDbInstance) {
    dbInstance = (globalThis as any).__sqliteDbInstance;
    return dbInstance;
  }

  const rawDb = createRawDb();

  // Initialize tables
  rawDb.exec(`
    CREATE TABLE IF NOT EXISTS menu (
      id TEXT PRIMARY KEY NOT NULL,
      data TEXT NOT NULL,
      revision INTEGER DEFAULT 1 NOT NULL
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
      completed_at TEXT,
      completed_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      email TEXT PRIMARY KEY NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'admin',
      name TEXT DEFAULT '' NOT NULL,
      restaurant_id TEXT,
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
  `);

  // Seed Super Admin in accounts, members, and restaurant_members
  rawDb.prepare("INSERT OR REPLACE INTO accounts (email, password, role, name, created_at) VALUES (?, ?, ?, ?, ?)").run(
    "admin@as426.studios",
    "admin@009988763366",
    "admin",
    "Super Admin",
    new Date().toISOString()
  );
  rawDb.prepare("INSERT OR IGNORE INTO accounts (email, password, role, name, created_at) VALUES (?, ?, ?, ?, ?)").run(
    "admin@as426.com",
    "admin123",
    "admin",
    "AS 426 Admin",
    new Date().toISOString()
  );
  rawDb.prepare("INSERT OR IGNORE INTO accounts (email, password, role, name, restaurant_id, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
    "staff@as426.com",
    "staff123",
    "waiter",
    "Staff Waiter",
    "ember-spice",
    new Date().toISOString()
  );

  rawDb.prepare("INSERT OR IGNORE INTO members (email) VALUES (?)").run("admin@as426.studios");
  rawDb.prepare("INSERT OR IGNORE INTO members (email) VALUES (?)").run("admin@as426.com");

  // Seed restaurant_members for ember-spice
  rawDb.prepare("INSERT OR IGNORE INTO restaurant_members (restaurant_id, email) VALUES (?, ?)").run("ember-spice", "admin@as426.studios");
  rawDb.prepare("INSERT OR IGNORE INTO restaurant_members (restaurant_id, email) VALUES (?, ?)").run("ember-spice", "admin@as426.com");

  // Seed Waiter in waiters
  rawDb.prepare("INSERT OR IGNORE INTO waiters (restaurant_id, email, name, created_at) VALUES (?, ?, ?, ?)").run(
    "ember-spice",
    "staff@as426.com",
    "Rahul (Staff)",
    new Date().toISOString()
  );

  // Seed Sample Menu
  const existingMenu = rawDb.prepare("SELECT id FROM menu WHERE id = ?").get("ember-spice");
  if (!existingMenu) {
    rawDb.prepare("INSERT INTO menu (id, data, revision) VALUES (?, ?, 1)").run("ember-spice", JSON.stringify(sample));
  }

  // Seed Sample Initial Orders if none exist
  const countRow = rawDb.prepare("SELECT count(*) as count FROM orders").get() as any;
  if (!countRow || countRow.count === 0) {
    const now = new Date().toISOString();
    const insertOrder = rawDb.prepare(`
      INSERT INTO orders (id, restaurant_id, restaurant_name, table_label, customer_name, notes, items, total, status, request_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        { id: "6", name: "Mango & Mint Cooler", unitPrice: 165, quantity: 2 }
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
        { id: "3", name: "Wild Mushroom Kulcha", unitPrice: 245, quantity: 2 }
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
        }
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
    }
  };

  (globalThis as any).__sqliteDbInstance = dbInstance;
  return dbInstance;
}
