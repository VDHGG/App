import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type {
  NewSystemUserRecord,
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

const FROM_USERS = `SELECT user_id, full_name, email, phone, role_id, password_hash, customer_id, is_active FROM system_users`;

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
}
