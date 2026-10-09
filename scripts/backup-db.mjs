import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";

const connectionConfig = {
  host: process.env.MYSQL_HOST || "srv839.hstgr.io",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "u580210733_ts_admin",
  password: process.env.MYSQL_PASSWORD || "Admin@009988763366",
  database: process.env.MYSQL_DATABASE || "u580210733_table_secret",
  ssl: { rejectUnauthorized: false }
};

async function backup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFilePath = path.join(backupDir, `backup-${timestamp}.json`);
  console.log(`📦 Creating full Hostinger MySQL backup to: ${backupFilePath}...`);

  const conn = await mysql.createConnection(connectionConfig);
  try {
    const [tables] = await conn.query("SHOW TABLES");
    const dataBackup = {
      timestamp: new Date().toISOString(),
      database: connectionConfig.database,
      tables: {}
    };

    for (const t of tables) {
      const tableName = Object.values(t)[0];
      const [rows] = await conn.query(`SELECT * FROM ${tableName}`);
      dataBackup.tables[tableName] = rows;
      console.log(`  ✓ Saved table '${tableName}': ${(rows || []).length} rows`);
    }

    fs.writeFileSync(backupFilePath, JSON.stringify(dataBackup, null, 2), "utf-8");
    console.log(`✅ Backup successfully saved to ${backupFilePath}`);
    return backupFilePath;
  } finally {
    await conn.end();
  }
}

backup();
