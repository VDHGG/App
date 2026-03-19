import { AsyncLocalStorage } from 'node:async_hooks';
import type { PoolConnection } from 'mysql2/promise';

export const transactionContext = new AsyncLocalStorage<PoolConnection>();
