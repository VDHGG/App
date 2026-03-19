import 'dotenv/config';
import mysql from 'mysql2/promise';

export type { Pool, PoolConnection } from 'mysql2/promise';

export function createPool(): mysql.Pool {
  return mysql.createPool({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.DB_NAME ?? 'shoe_rental_system_v2',
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
    timezone: '+00:00',
  });
}
