import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import routes from './routes.js';

const PORT = process.env.PORT ?? 3001;

async function start() {
  await initDb();

  const app = express();
  app.use(cors({ origin: '*' }));
  app.use(express.json());
  app.use('/api', routes);

  app.get('/health', (_, res) => res.json({ status: 'ok' }));

  app.listen(PORT, () => {
    console.log(`🚀 Campus Nav API running on http://localhost:${PORT}`);
  });
}

start().catch(err => { console.error(err); process.exit(1); });