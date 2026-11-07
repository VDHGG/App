import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  SaveVoucherInput,
  VoucherRecord,
  VoucherRepository,
} from '@port/VoucherRepository.port';
import { transactionContext } from '@infra/db/transactionContext';

function toYmd(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === 'string') return val.slice(0, 10);
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(val).slice(0, 10);
}

function mapRow(r: RowDataPacket): VoucherRecord {
  return {
    code: String(r['code']),
    discountPercent: Number(r['discount_percent']),
    description: String(r['description']),
    isActive: Boolean(r['is_active']),
    maxUses: r['max_uses'] !== null && r['max_uses'] !== undefined ? Number(r['max_uses']) : null,
    usedCount: Number(r['used_count'] || 0),
    expiresAt: toYmd(r['expires_at']),
    createdAt: r['created_at'] ? new Date(r['created_at']).toISOString() : new Date().toISOString(),
  };
}

export class MysqlVoucherRepository implements VoucherRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  private conn(): Pool | PoolConnection {
    return transactionContext.getStore() ?? this.pool;
  }

  async findByCode(code: string): Promise<VoucherRecord | null> {
    const key = code.trim().toUpperCase();
    const [rows] = await this.conn().query<RowDataPacket[]>(
      `SELECT code, discount_percent, description, is_active, max_uses, used_count, expires_at, created_at
       FROM vouchers
       WHERE code = ?
       LIMIT 1`,
      [key]
    );
    if (rows.length === 0) return null;
    return mapRow(rows[0]);
  }

  async listAll(): Promise<VoucherRecord[]> {
    const [rows] = await this.conn().query<RowDataPacket[]>(
      `SELECT code, discount_percent, description, is_active, max_uses, used_count, expires_at, created_at
       FROM vouchers
       ORDER BY code ASC`
    );
    return rows.map(mapRow);
  }

  async listActive(todayDateStr: string): Promise<VoucherRecord[]> {
    const [rows] = await this.conn().query<RowDataPacket[]>(
      `SELECT code, discount_percent, description, is_active, max_uses, used_count, expires_at, created_at
       FROM vouchers
       WHERE is_active = 1
         AND (expires_at IS NULL OR expires_at >= ?)
         AND (max_uses IS NULL OR used_count < max_uses)
       ORDER BY code ASC`,
      [todayDateStr]
    );
    return rows.map(mapRow);
  }

  async save(input: SaveVoucherInput): Promise<VoucherRecord> {
    const code = input.code.trim().toUpperCase();
    await this.conn().query(
      `INSERT INTO vouchers (code, discount_percent, description, is_active, max_uses, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         discount_percent = VALUES(discount_percent),
         description      = VALUES(description),
         is_active        = VALUES(is_active),
         max_uses         = VALUES(max_uses),
         expires_at       = VALUES(expires_at),
         updated_at       = NOW()`,
      [
        code,
        input.discountPercent,
        input.description,
        input.isActive ? 1 : 0,
        input.maxUses,
        input.expiresAt,
      ]
    );

    const saved = await this.findByCode(code);
    if (!saved) {
      throw new Error(`Failed to retrieve saved voucher ${code}`);
    }
    return saved;
  }

  async incrementUsedCount(code: string): Promise<void> {
    const key = code.trim().toUpperCase();
    await this.conn().query(
      `UPDATE vouchers SET used_count = used_count + 1 WHERE code = ?`,
      [key]
    );
  }

  async deleteByCode(code: string): Promise<boolean> {
    const key = code.trim().toUpperCase();
    const [result] = await this.conn().query<ResultSetHeader>(
      `DELETE FROM vouchers WHERE code = ?`,
      [key]
    );
    return result.affectedRows > 0;
  }
}
