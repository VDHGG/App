import 'dotenv/config';
import express from 'express';
import { MysqlContainer } from './MysqlContainer';
import { createRouter } from '@adapter/http/router';
import { errorHandler } from '@adapter/http/middleware/errorHandler';

const PORT = Number(process.env.PORT ?? 3000);

const container = new MysqlContainer();
const app = express();

app.use(express.json());
app.use('/api/v1', createRouter(container));
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}/api/v1`);
});

process.on('SIGTERM', async () => {
  server.close();
  await container.close();
});
