import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
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

async function restore(backupFilePath) {
  if (!backupFilePath) {
    // Find latest backup in backups/
    const backupDir = path.resolve(process.cwd(), "backups");
    if (!fs.existsSync(backupDir)) {
      console.error("No backups directory found.");
      process.exit(1);
    }
    const files = fs.readdirSync(backupDir).filter((f) => f.endsWith(".json")).sort();
    if (files.length === 0) {
      console.error("No backup files found in backups/");
      process.exit(1);
    }
    backupFilePath = path.join(backupDir, files[files.length - 1]);
  }

  console.log(`🔄 Restoring database from: ${backupFilePath}...`);
  const content = JSON.parse(fs.readFileSync(backupFilePath, "utf-8"));

  const conn = await mysql.createConnection(connectionConfig);
  try {
    for (const [tableName, rows] of Object.entries(content.tables)) {
      // Clear current rows in table
      await conn.query(`DELETE FROM ${tableName}`);
      if (Array.isArray(rows) && rows.length > 0) {
        for (const row of rows) {
          const keys = Object.keys(row);
          const values = Object.values(row);
          const placeholders = keys.map(() => "?").join(", ");
          await conn.query(
            `INSERT INTO ${tableName} (${keys.join(", ")}) VALUES (${placeholders})`,
            values
          );
        }
      }
      console.log(`  ✓ Restored table '${tableName}': ${(rows || []).length} rows`);
    }
    console.log(`✅ Database successfully restored from ${backupFilePath}`);
  } finally {
    await conn.end();
  }
}

const targetFile = process.argv[2];
restore(targetFile);
