import type { Pool } from 'mysql2/promise';
import { transactionContext } from '@infra/db/transactionContext';
import type { TransactionManager } from '@port/TransactionManager.port';

export class MysqlTransactionManager implements TransactionManager {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async runInTransaction<T>(work: () => Promise<T>): Promise<T> {
    const connection = await this.pool.getConnection();
    await connection.beginTransaction();

    return transactionContext.run(connection, async () => {
      try {
        const result = await work();
        await connection.commit();
        return result;
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }
    });
  }
}
