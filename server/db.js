/**
 * db.js — SQLite via sql.js (pure JS, no native build needed)
 *
 * To switch to PostgreSQL:
 *   npm install pg
 *   Replace this file with a pg Pool wrapper exporting { run, get, all }
 *   matching the same interface.
 */
import { createRequire } from 'module';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../campus.sqlite.bin');

let db;

export async function initDb() {
  const { default: initSqlJs } = await import('sql.js');
  const SQL = await initSqlJs();

  if (existsSync(DB_PATH)) {
    const buf = readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  // Persist to disk on every write (simple approach for this project)
  const origRun = db.run.bind(db);
  db.runAndSave = (...args) => {
    origRun(...args);
    writeFileSync(DB_PATH, db.export());
  };

  createSchema();
  seedAdmin();
  return db;
}

function createSchema() {
  db.run(`PRAGMA journal_mode=WAL;`);

  db.run(`
    CREATE TABLE IF NOT EXISTS locations (
      id            TEXT PRIMARY KEY,
      name          TEXT NOT NULL,
      type          TEXT NOT NULL,  -- building|block|hostel|cafeteria|department|landmark|road|path
      description   TEXT,
      indoor_link   TEXT,           -- link for indoor navigation button
      x             REAL,           -- canvas x for visual map (optional)
      y             REAL,           -- canvas y
      created_at    TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS edges (
      id          TEXT PRIMARY KEY,
      from_id     TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      to_id       TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
      distance    REAL NOT NULL,    -- metres
      bidirectional INTEGER DEFAULT 1,
      label       TEXT,             -- e.g. "Main Road", "Shortcut"
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `);

  writeFileSync(DB_PATH, db.export());
}

function seedAdmin() {
  console.log('✅ Admin authentication: username: admin  password: password');
}

// ─── Query helpers ────────────────────────────────────────────────────────────
export function run(sql, params = []) {
  db.runAndSave(sql, params);
}

export function get(sql, params = []) {
  const res = db.exec(sql, params);
  if (!res.length || !res[0].values.length) return null;
  const { columns, values } = res[0];
  return Object.fromEntries(columns.map((c, i) => [c, values[0][i]]));
}

export function all(sql, params = []) {
  const res = db.exec(sql, params);
  if (!res.length) return [];
  const { columns, values } = res[0];
  return values.map(row => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
}