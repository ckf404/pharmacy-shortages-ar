import "dotenv/config";
import { randomBytes, scrypt as scryptCallback } from "crypto";
import { promisify } from "util";
import mysql from "mysql2/promise";

const scrypt = promisify(scryptCallback);
const salt = randomBytes(16).toString("hex");
const hash = (await scrypt("Ckf99", salt, 64)).toString("hex");
const passwordHash = `scrypt$${salt}$${hash}`;
const pool = mysql.createPool(process.env.DATABASE_URL);

const [existing] = await pool.query("SELECT id FROM users WHERE username = ? LIMIT 1", ["fares"]);
if (existing.length === 0) {
  await pool.query(
    "INSERT INTO users (name, username, passwordHash, role, active, createdAt, updatedAt) VALUES (?, ?, ?, 'admin', 1, UTC_TIMESTAMP(), UTC_TIMESTAMP())",
    ["فارس", "fares", passwordHash],
  );
  console.log("Initial local admin created: fares");
} else {
  console.log("Initial local admin already exists: fares");
}

await pool.query(
  "INSERT INTO shortage_rollover_settings (id, timezone, hour, minute, enabled, createdAt, updatedAt) VALUES (1, 'Africa/Cairo', 0, 0, 1, UTC_TIMESTAMP(), UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE id = id",
);

await pool.end();
