import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { WishlistEntry, WishlistRepository } from '@port/WishlistRepository.port';
import { transactionContext } from '@infra/db/transactionContext';

interface WishlistRow extends RowDataPacket {
  shoe_id: string;
  created_at: Date;
}

export class MysqlWishlistRepository implements WishlistRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  private conn(): Pool | PoolConnection {
    return transactionContext.getStore() ?? this.pool;
  }

  async add(customerId: string, shoeId: string): Promise<void> {
    await this.conn().query(
      `INSERT IGNORE INTO customer_wishlist (customer_id, shoe_id) VALUES (?, ?)`,
      [customerId, shoeId]
    );
  }

  async remove(customerId: string, shoeId: string): Promise<void> {
    await this.conn().query(
      `DELETE FROM customer_wishlist WHERE customer_id = ? AND shoe_id = ?`,
      [customerId, shoeId]
    );
  }

  async clear(customerId: string): Promise<void> {
    await this.conn().query(`DELETE FROM customer_wishlist WHERE customer_id = ?`, [customerId]);
  }

  async listOrdered(customerId: string): Promise<WishlistEntry[]> {
    const [rows] = await this.conn().query<WishlistRow[]>(
      `SELECT shoe_id, created_at FROM customer_wishlist
       WHERE customer_id = ?
       ORDER BY created_at DESC`,
      [customerId]
    );
    return rows.map((r) => ({
      shoeId: r.shoe_id,
      createdAt: new Date(r.created_at),
    }));
  }

  async listShoeIds(customerId: string): Promise<string[]> {
    const [rows] = await this.conn().query<RowDataPacket[]>(
      `SELECT shoe_id FROM customer_wishlist WHERE customer_id = ?`,
      [customerId]
    );
    return rows.map((r) => String(r['shoe_id']));
  }
}
