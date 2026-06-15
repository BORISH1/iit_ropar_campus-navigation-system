import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function initDb() {
  const client = await pool.connect();
  client.release();
  console.log("✅ Connected to Neon PostgreSQL");
}

export async function run(sql, params = []) {
  return pool.query(sql, params);
}

export async function get(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

export async function all(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}