import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type {
  ListSystemUsersOptions,
  ListSystemUsersResult,
  NewSystemUserRecord,
  SystemUserAdminUpdate,
  SystemUserContactUpdate,
  SystemUserRecord,
  SystemUserRepository,
} from '@port/SystemUserRepository.port';
import { transactionContext } from '@infra/db/transactionContext';

interface UserRow extends RowDataPacket {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role_id: number;
  password_hash: string | null;
  customer_id: string | null;
  is_active: number;
}

function toRecord(row: UserRow): SystemUserRecord {
  return {
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    roleId: Number(row.role_id),
    passwordHash: row.password_hash,
    customerId: row.customer_id,
    isActive: Number(row.is_active) === 1,
  };
}

const FROM_USERS = `SELECT user_id, full_name, email, phone, role_id, password_hash, customer_id, is_active, created_at FROM system_users`;

export class MysqlSystemUserRepository implements SystemUserRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  private conn(): Pool | PoolConnection {
    return transactionContext.getStore() ?? this.pool;
  }

  async findByEmail(email: string): Promise<SystemUserRecord | null> {
    const [rows] = await this.conn().query<UserRow[]>(
      `${FROM_USERS} WHERE email = ? LIMIT 1`,
      [email.trim().toLowerCase()]
    );
    return rows.length > 0 ? toRecord(rows[0]) : null;
  }

  async findByEmailExcluding(email: string, excludeUserId: string): Promise<SystemUserRecord | null> {
    const [rows] = await this.conn().query<UserRow[]>(
      `${FROM_USERS} WHERE email = ? AND user_id <> ? LIMIT 1`,
      [email.trim().toLowerCase(), excludeUserId]
    );
    return rows.length > 0 ? toRecord(rows[0]) : null;
  }

  async findByCustomerId(customerId: string): Promise<SystemUserRecord | null> {
    const [rows] = await this.conn().query<UserRow[]>(
      `${FROM_USERS} WHERE customer_id = ? LIMIT 1`,
      [customerId]
    );
    return rows.length > 0 ? toRecord(rows[0]) : null;
  }

  async findById(userId: string): Promise<SystemUserRecord | null> {
    const [rows] = await this.conn().query<UserRow[]>(
      `${FROM_USERS} WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    return rows.length > 0 ? toRecord(rows[0]) : null;
  }

  async save(user: NewSystemUserRecord): Promise<void> {
    await this.conn().query(
      `INSERT INTO system_users (
        user_id, full_name, email, phone, password_hash, customer_id, role_id, is_active, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        user.userId,
        user.fullName,
        user.email.trim().toLowerCase(),
        user.phone,
        user.passwordHash,
        user.customerId,
        user.roleId,
        user.isActive ? 1 : 0,
      ]
    );
  }

  async updateContactFields(userId: string, fields: SystemUserContactUpdate): Promise<void> {
    await this.conn().query(
      `UPDATE system_users
       SET full_name = ?, email = ?, phone = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [
        fields.fullName,
        fields.email.trim().toLowerCase(),
        fields.phone,
        userId,
      ]
    );
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.conn().query(
      `UPDATE system_users SET password_hash = ?, updated_at = NOW() WHERE user_id = ?`,
      [passwordHash, userId]
    );
  }

  async listForAdmin(options: ListSystemUsersOptions): Promise<ListSystemUsersResult> {
    const conn = this.conn();
    const q = options.search?.trim() ?? '';
    const hasSearch = q.length > 0;
    const like = hasSearch ? `%${q}%` : '';

    const whereClause = hasSearch
      ? `WHERE (email LIKE ? OR full_name LIKE ? OR user_id LIKE ? OR IFNULL(phone,'') LIKE ?)`
      : '';
    const filterParams = hasSearch ? [like, like, like, like] : [];

    const [countRows] = await conn.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM system_users ${whereClause}`,
      filterParams
    );
    const total = Number(countRows[0]?.['cnt'] ?? 0);

    const listSql = `${FROM_USERS} ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const [rows] = await conn.query<UserRow[]>(listSql, [...filterParams, options.limit, options.offset]);
    return { items: rows.map((r) => toRecord(r)), total };
  }

  async countActiveAdminsExcluding(excludeUserId: string): Promise<number> {
    const [rows] = await this.conn().query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM system_users WHERE role_id = 2 AND is_active = 1 AND user_id <> ?`,
      [excludeUserId]
    );
    return Number(rows[0]?.['cnt'] ?? 0);
  }

  async updateAdminFields(userId: string, fields: SystemUserAdminUpdate): Promise<void> {
    await this.conn().query(
      `UPDATE system_users SET
         full_name = ?, email = ?, phone = ?, role_id = ?, is_active = ?, customer_id = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [
        fields.fullName,
        fields.email.trim().toLowerCase(),
        fields.phone,
        fields.roleId,
        fields.isActive ? 1 : 0,
        fields.customerId,
        userId,
      ]
    );
  }

  async updateMirrorFromCustomer(
    userId: string,
    fields: { fullName: string; email: string; phone: string | null; isActive: boolean }
  ): Promise<void> {
    await this.conn().query(
      `UPDATE system_users SET
         full_name = ?, email = ?, phone = ?, is_active = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [
        fields.fullName,
        fields.email.trim().toLowerCase(),
        fields.phone,
        fields.isActive ? 1 : 0,
        userId,
      ]
    );
  }
}
