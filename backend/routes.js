import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { all, get, run } from './db.js';
import { buildGraph, kShortestPaths, walkingMinutes } from './dijkstra.js';

const router = express.Router();

// Dummy authentication middleware - replace with your actual JWT/Auth logic
const requireAuth = (req, res, next) => {
  // e.g., verify token here
  next(); 
};

router.get('/locations', async (req, res) => {
  try {
    const { q, type } = req.query;
    let sql = `SELECT * FROM locations WHERE 1=1`;
    const params = [];

    if (q) {
      params.push(`%${q}%`);
      sql += ` AND name ILIKE $${params.length}`;
    }
    if (type) {
      params.push(type);
      sql += ` AND type = $${params.length}`;
    }

    sql += ` ORDER BY name ASC`;
    const rows = await all(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/locations/:id', async (req, res) => {
  try {
    const loc = await get(`SELECT * FROM locations WHERE id=$1`, [req.params.id]);
    if (!loc) return res.status(404).json({ error: 'Not found' });
    res.json(loc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/locations', requireAuth, async (req, res) => {
  try {
    const { name, type, description, indoor_link, x, y } = req.body ?? {};
    if (!name || !type) return res.status(400).json({ error: 'name and type required' });

    const id = uuidv4();
    await run(
      `INSERT INTO locations (id,name,type,description,indoor_link,x,y) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, name, type, description ?? null, indoor_link ?? null, x ?? null, y ?? null]
    );

    const location = await get(`SELECT * FROM locations WHERE id=$1`, [id]);
    res.status(201).json(location);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/locations/:id', requireAuth, async (req, res) => {
  try {
    const { name, type, description, indoor_link, x, y } = req.body ?? {};
    await run(
      `UPDATE locations SET name=$1, type=$2, description=$3, indoor_link=$4, x=$5, y=$6 WHERE id=$7`,
      [name, type, description ?? null, indoor_link ?? null, x ?? null, y ?? null, req.params.id]
    );
    const updated = await get(`SELECT * FROM locations WHERE id=$1`, [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/locations/:id', requireAuth, async (req, res) => {
  try {
    await run(`DELETE FROM edges WHERE from_id=$1 OR to_id=$2`, [req.params.id, req.params.id]);
    await run(`DELETE FROM locations WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/edges', async (req, res) => {
  try {
    const rows = await all(`
      SELECT e.*, f.name AS from_name, f.type AS from_type, t.name AS to_name, t.type AS to_type
      FROM edges e JOIN locations f ON f.id=e.from_id JOIN locations t ON t.id=e.to_id ORDER BY f.name,t.name
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/edges', requireAuth, async (req, res) => {
  try {
    const { from_id, to_id, distance, bidirectional = true, label } = req.body ?? {};
    const id = uuidv4();
    await run(
      `INSERT INTO edges (id,from_id,to_id,distance,bidirectional,label) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, from_id, to_id, Number(distance), bidirectional, label ?? null]
    );
    const edge = await get(`SELECT * FROM edges WHERE id=$1`, [id]);
    res.status(201).json(edge);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/edges/:id', requireAuth, async (req, res) => {
  try {
    await run(`DELETE FROM edges WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/edges/:id', requireAuth, async (req, res) => {
  try {
    const { from_id, to_id, distance, bidirectional, label } = req.body ?? {};
    await run(
      `UPDATE edges SET from_id=$1, to_id=$2, distance=$3, bidirectional=$4, label=$5 WHERE id=$6`,
      [from_id, to_id, Number(distance), bidirectional, label ?? null, req.params.id]
    );
    const updated = await get(`SELECT * FROM edges WHERE id=$1`, [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/route', async (req, res) => {
  try {
    const { from, to, k = 3 } = req.query;
    const edges = await all(`SELECT * FROM edges`);
    const locations = await all(`SELECT * FROM locations`);
    const locMap = Object.fromEntries(locations.map(l => [l.id, l]));
    
    const graph = buildGraph(edges);
    const paths = kShortestPaths(graph, from, to, Number(k));

    if (!paths.length) return res.status(404).json({ error: 'No path found' });

    const result = paths.map((p, idx) => ({
      rank: idx + 1,
      totalDist: Math.round(p.totalDist),
      walkingMinutes: walkingMinutes(p.totalDist),
      steps: p.path.map(step => ({
        location: locMap[step.node] ?? { id: step.node, name: step.node },
        via: step.via
      }))
    }));

    res.json({ routes: result, from: locMap[from], to: locMap[to] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const locCount = (await get(`SELECT COUNT(*)::int AS c FROM locations`))?.c ?? 0;
    const edgeCount = (await get(`SELECT COUNT(*)::int AS c FROM edges`))?.c ?? 0;
    const typeBreakdown = await all(`
      SELECT type, COUNT(*)::int AS count FROM locations GROUP BY type ORDER BY count DESC
    `);
    res.json({ locations: locCount, edges: edgeCount, typeBreakdown });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/auth/login', (req, res) => {
  const { username, password } = req.body ?? {};
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    res.json({ ok: true, token: 'admin-session' });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

export default router;