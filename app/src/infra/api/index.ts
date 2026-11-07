import '../loadEnv';
import express from 'express';
import { MysqlContainer } from '../MysqlContainer';
import { createRouter } from '@adapter/http/router';
import { errorHandler } from '@adapter/http/middleware/errorHandler';

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

app.use(express.json({ limit: '64kb' }));
app.use('/api/v1', (_req, _res, next) => {
  void container
    .getExpirePendingOnlinePaymentsService()
    .execute()
    .catch((err) => console.error('[expire pending payments]', err));
  next();
});
app.use('/api/v1', createRouter(container));
app.use(errorHandler);

export default app;
