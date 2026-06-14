import { Router } from 'express';
import { createRequire } from 'module';
import { run, get, all } from './db.js';
import { buildGraph, kShortestPaths, walkingMinutes } from './dijkstra.js';

const require = createRequire(import.meta.url);
const { v4: uuidv4 } = require('uuid');

// ─── Simple Authentication Middleware ────────────────────────────────────────
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'password';

const requireAuth = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Authorization required' });
  }
  const credentials = Buffer.from(auth.slice(6), 'base64').toString();
  const [username, password] = credentials.split(':');
  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
};

const router = Router();

// ─── Auth ────────────────────────────────────────────────────────────────────
router.post('/auth/login', (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });

  if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
    res.json({ ok: true, message: 'Login successful' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// ─── Locations (public read, admin write) ────────────────────────────────────
router.get('/locations', (req, res) => {
  const { q, type } = req.query;
  let sql = `SELECT * FROM locations WHERE 1=1`;
  const params = [];
  if (q) { sql += ` AND name LIKE ?`; params.push(`%${q}%`); }
  if (type) { sql += ` AND type=?`; params.push(type); }
  sql += ` ORDER BY name ASC`;
  res.json(all(sql, params));
});

router.get('/locations/:id', (req, res) => {
  const loc = get(`SELECT * FROM locations WHERE id=?`, [req.params.id]);
  if (!loc) return res.status(404).json({ error: 'Not found' });
  res.json(loc);
});

router.post('/locations', requireAuth, (req, res) => {
  const { name, type, description, indoor_link, x, y } = req.body ?? {};
  if (!name || !type) return res.status(400).json({ error: 'name and type required' });
  const id = uuidv4();
  run(
    `INSERT INTO locations (id,name,type,description,indoor_link,x,y) VALUES (?,?,?,?,?,?,?)`,
    [id, name, type, description ?? null, indoor_link ?? null, x ?? null, y ?? null]
  );
  res.status(201).json(get(`SELECT * FROM locations WHERE id=?`, [id]));
});

router.put('/locations/:id', requireAuth, (req, res) => {
  const { name, type, description, indoor_link, x, y } = req.body ?? {};
  run(
    `UPDATE locations SET name=?,type=?,description=?,indoor_link=?,x=?,y=? WHERE id=?`,
    [name, type, description ?? null, indoor_link ?? null, x ?? null, y ?? null, req.params.id]
  );
  res.json(get(`SELECT * FROM locations WHERE id=?`, [req.params.id]));
});

router.delete('/locations/:id', requireAuth, (req, res) => {
  // Edges are cascade-deleted via FK
  run(`DELETE FROM edges WHERE from_id=? OR to_id=?`, [req.params.id, req.params.id]);
  run(`DELETE FROM locations WHERE id=?`, [req.params.id]);
  res.json({ ok: true });
});

// ─── Edges ────────────────────────────────────────────────────────────────────
router.get('/edges', (req, res) => {
  const rows = all(`
    SELECT e.*,
      f.name AS from_name, f.type AS from_type,
      t.name AS to_name,   t.type AS to_type
    FROM edges e
    JOIN locations f ON f.id = e.from_id
    JOIN locations t ON t.id = e.to_id
    ORDER BY f.name, t.name
  `);
  res.json(rows);
});

router.post('/edges', requireAuth, (req, res) => {
  const { from_id, to_id, distance, bidirectional = 1, label } = req.body ?? {};
  if (!from_id || !to_id || !distance) return res.status(400).json({ error: 'from_id, to_id, distance required' });
  const id = uuidv4();
  run(
    `INSERT INTO edges (id,from_id,to_id,distance,bidirectional,label) VALUES (?,?,?,?,?,?)`,
    [id, from_id, to_id, Number(distance), bidirectional ? 1 : 0, label ?? null]
  );
  res.status(201).json(get(`
    SELECT e.*, f.name as from_name, t.name as to_name
    FROM edges e JOIN locations f ON f.id=e.from_id JOIN locations t ON t.id=e.to_id
    WHERE e.id=?
  `, [id]));
});

router.put('/edges/:id', requireAuth, (req, res) => {
  const { from_id, to_id, distance, bidirectional, label } = req.body ?? {};
  run(
    `UPDATE edges SET from_id=?,to_id=?,distance=?,bidirectional=?,label=? WHERE id=?`,
    [from_id, to_id, Number(distance), bidirectional ? 1 : 0, label ?? null, req.params.id]
  );
  res.json(get(`
    SELECT e.*, f.name as from_name, t.name as to_name
    FROM edges e JOIN locations f ON f.id=e.from_id JOIN locations t ON t.id=e.to_id
    WHERE e.id=?
  `, [req.params.id]));
});

router.delete('/edges/:id', requireAuth, (req, res) => {
  run(`DELETE FROM edges WHERE id=?`, [req.params.id]);
  res.json({ ok: true });
});

// ─── Routing ──────────────────────────────────────────────────────────────────
router.get('/route', (req, res) => {
  const { from, to, k = 3 } = req.query;
  if (!from || !to) return res.status(400).json({ error: 'from and to location IDs required' });
  if (from === to) return res.status(400).json({ error: 'Source and destination must differ' });

  const edges = all(`SELECT * FROM edges`);
  const locations = all(`SELECT * FROM locations`);
  const locMap = Object.fromEntries(locations.map(l => [l.id, l]));

  const graph = buildGraph(edges);
  const paths = kShortestPaths(graph, from, to, Number(k));

  if (!paths.length) return res.status(404).json({ error: 'No path found between these locations' });

  const result = paths.map((p, idx) => ({
    rank: idx + 1,
    totalDist: Math.round(p.totalDist),
    walkingMinutes: walkingMinutes(p.totalDist),
    steps: p.path.map(step => ({
      location: locMap[step.node] ?? { id: step.node, name: step.node },
      via: step.via,
    })),
  }));

  res.json({ routes: result, from: locMap[from], to: locMap[to] });
});

// ─── Stats (admin dashboard) ──────────────────────────────────────────────────
router.get('/stats', requireAuth, (req, res) => {
  const locCount = get(`SELECT COUNT(*) as c FROM locations`)?.c ?? 0;
  const edgeCount = get(`SELECT COUNT(*) as c FROM edges`)?.c ?? 0;
  const typeBreakdown = all(`SELECT type, COUNT(*) as count FROM locations GROUP BY type ORDER BY count DESC`);
  res.json({ locations: locCount, edges: edgeCount, typeBreakdown });
});

export default router;