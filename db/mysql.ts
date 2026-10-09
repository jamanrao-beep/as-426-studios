import mysql, { Pool } from "mysql2/promise";

let poolInstance: Pool | null = null;
let dbInstance: any = null;

export function isMysqlConfigured(): boolean {
  return Boolean(
    process.env.MYSQL_HOST &&
    process.env.MYSQL_USER &&
    process.env.MYSQL_PASSWORD &&
    process.env.MYSQL_DATABASE
  );
}

function getPool(): Pool {
  if (poolInstance) return poolInstance;
  if ((globalThis as any).__mysqlPoolInstance) {
    poolInstance = (globalThis as any).__mysqlPoolInstance;
    return poolInstance!;
  }

  poolInstance = mysql.createPool({
    host: process.env.MYSQL_HOST || "srv839.hstgr.io",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "u580210733_ts_admin",
    password: process.env.MYSQL_PASSWORD || "Admin@009988763366",
    database: process.env.MYSQL_DATABASE || "u580210733_table_secret",
    waitForConnections: true,
    connectionLimit: 15,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
    ssl: {
      rejectUnauthorized: false
    }
  });

  (globalThis as any).__mysqlPoolInstance = poolInstance;
  return poolInstance;
}

/**
 * Normalizes SQLite syntax to MySQL / MariaDB compatible syntax:
 * 1. INSERT OR IGNORE INTO -> INSERT IGNORE INTO
 * 2. INSERT OR REPLACE INTO -> REPLACE INTO
 * 3. ON CONFLICT(...) DO UPDATE SET -> ON DUPLICATE KEY UPDATE
 * 4. excluded.col -> VALUES(col)
 */
export function translateSql(sql: string): string {
  let s = sql;
  s = s.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, "INSERT IGNORE INTO");
  s = s.replace(/INSERT\s+OR\s+REPLACE\s+INTO/gi, "REPLACE INTO");
  s = s.replace(/ON\s+CONFLICT\s*\([^)]*\)\s*DO\s+UPDATE\s+SET/gi, "ON DUPLICATE KEY UPDATE");
  s = s.replace(/excluded\.([a-zA-Z0-9_]+)/gi, "VALUES($1)");
  return s;
}

export function getMysqlDb() {
  if (dbInstance) return dbInstance;
  if ((globalThis as any).__mysqlDbInstance) {
    dbInstance = (globalThis as any).__mysqlDbInstance;
    return dbInstance;
  }

  const pool = getPool();

  dbInstance = {
    prepare(queryStr: string) {
      let boundParams: unknown[] = [];
      const translatedSql = translateSql(queryStr);

      return {
        bind(...params: unknown[]) {
          boundParams = params.map((p) => (p === undefined ? null : p));
          return this;
        },
        async first<T = unknown>(col?: string): Promise<T | null> {
          try {
            const [rows] = await pool.query(translatedSql, boundParams as any[]);
            if (!Array.isArray(rows) || rows.length === 0) return null;
            const row = (rows as any[])[0];
            if (!row) return null;
            if (col) return row[col] ?? null;
            return row as T;
          } catch (err: any) {
            console.error("[mysql first] error:", err.message, "SQL:", translatedSql);
            throw err;
          }
        },
        async all<T = unknown>(): Promise<{ results: T[]; meta: { changes: number } }> {
          try {
            const [rows] = await pool.query(translatedSql, boundParams as any[]);
            return {
              results: Array.isArray(rows) ? (rows as T[]) : [],
              meta: { changes: 0 }
            };
          } catch (err: any) {
            console.error("[mysql all] error:", err.message, "SQL:", translatedSql);
            throw err;
          }
        },
        async run(): Promise<{ meta: { changes: number } }> {
          try {
            const [result] = await pool.query(translatedSql, boundParams as any[]);
            const affectedRows = Number((result as any)?.affectedRows || 0);
            return { meta: { changes: affectedRows } };
          } catch (err: any) {
            console.error("[mysql run] error:", err.message, "SQL:", translatedSql);
            throw err;
          }
        }
      };
    },
    async exec(sql: string) {
      const translated = translateSql(sql);
      await pool.query(translated);
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

  (globalThis as any).__mysqlDbInstance = dbInstance;
  return dbInstance;
}
