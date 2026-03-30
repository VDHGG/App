import './loadEnv';
import express from 'express';
import { MysqlContainer } from './MysqlContainer';
import { createRouter } from '@adapter/http/router';
import { errorHandler } from '@adapter/http/middleware/errorHandler';

const PORT = Number(process.env.PORT ?? 3000);

const container = new MysqlContainer();
const app = express();

app.get('/health', async (_req, res) => {
  const database = await container.pingDatabase();
  const status = database ? 200 : 503;
  res.status(status).json({
    status: database ? 'ok' : 'degraded',
    database: database ? 'up' : 'down',
  });
});

app.use(express.json());
app.use('/api/v1', createRouter(container));
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}  (base path /api/v1 — open UI with: npm run dev → http://localhost:5173)`);
});

process.on('SIGTERM', async () => {
  server.close();
  await container.close();
});
