import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { Customer } from '@domain/Customer.aggregate';
import type { CustomerRank } from '@domain/CustomerRank.enum';
import type {
  CustomerRepository,
  ListCustomersOptions,
  ListCustomersResult,
} from '@port/CustomerRepository.port';
import { transactionContext } from '@infra/db/transactionContext';

const RANK_TO_ID: Record<string, number> = {
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
  DIAMOND: 4,
};

const LOAD_SQL = `
  SELECT
    c.customer_id,
    c.full_name,
    c.email,
    c.phone,
    c.is_active,
    r.name          AS rank_name,
    COALESCE(SUM(ri.quantity), 0) AS current_rented_items
  FROM customers c
  JOIN ranks r ON r.id = c.rank_id
  LEFT JOIN rentals ren
    ON ren.customer_id = c.customer_id
    AND ren.status IN ('RESERVED', 'ACTIVE')
  LEFT JOIN rental_items ri ON ri.rental_id = ren.rental_id
  WHERE c.customer_id = ?
  GROUP BY c.customer_id, c.full_name, c.email, c.phone, c.is_active, r.name
`;

const LOAD_BY_EMAIL_SQL = LOAD_SQL.replace('WHERE c.customer_id = ?', 'WHERE c.email = ?');

const CUSTOMER_LIST_FROM = `
  FROM customers c
  JOIN ranks r ON r.id = c.rank_id
  LEFT JOIN rentals ren
    ON ren.customer_id = c.customer_id
    AND ren.status IN ('RESERVED', 'ACTIVE')
  LEFT JOIN rental_items ri ON ri.rental_id = ren.rental_id
  GROUP BY c.customer_id, c.full_name, c.email, c.phone, c.is_active, r.name
`;

interface CustomerRow extends RowDataPacket {
  customer_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  is_active: number;
  rank_name: string;
  current_rented_items: number;
}

function toCustomer(row: CustomerRow): Customer {
  return new Customer({
    id: row.customer_id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    isActive: Number(row.is_active) === 1,
    rank: row.rank_name as CustomerRank,
    currentRentedItems: Number(row.current_rented_items),
  });
}

export class MysqlCustomerRepository implements CustomerRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  private conn(): Pool | PoolConnection {
    return transactionContext.getStore() ?? this.pool;
  }

  async findById(id: string): Promise<Customer | null> {
    const [rows] = await this.conn().query<CustomerRow[]>(LOAD_SQL, [id]);
    return rows.length > 0 ? toCustomer(rows[0]) : null;
  }

  async findAll(options?: ListCustomersOptions): Promise<ListCustomersResult> {
    const conn = this.conn();
    const rawSearch = options?.search?.trim() ?? '';
    const hasSearch = rawSearch.length > 0;
    const like = hasSearch ? `%${rawSearch}%` : '';
    const searchClause = hasSearch ? ' AND (c.email LIKE ? OR c.full_name LIKE ?)' : '';
    const searchParams: unknown[] = hasSearch ? [like, like] : [];

    const fromFiltered = CUSTOMER_LIST_FROM.replace(
      'GROUP BY',
      `WHERE 1=1${searchClause} GROUP BY`
    );

    const countSql = `
      SELECT COUNT(*) AS cnt FROM (
        SELECT c.customer_id
        ${fromFiltered}
      ) t
    `;
    const [countRows] = await conn.query<RowDataPacket[]>(countSql, searchParams);
    const total = Number(countRows[0]?.['cnt'] ?? 0);

    const listSql = `
      SELECT
        c.customer_id,
        c.full_name,
        c.email,
        c.phone,
        c.is_active,
        r.name          AS rank_name,
        COALESCE(SUM(ri.quantity), 0) AS current_rented_items
      ${fromFiltered}
      ORDER BY c.customer_id
    `;
    const params: unknown[] = [...searchParams];
    if (options?.limit !== undefined) {
      const listSqlPaged = `${listSql} LIMIT ? OFFSET ?`;
      params.push(options.limit, options.offset ?? 0);
      const [rows] = await conn.query<CustomerRow[]>(listSqlPaged, params);
      return { items: rows.map((row) => toCustomer(row)), total };
    }

    const [rows] = await conn.query<CustomerRow[]>(listSql, searchParams);
    return { items: rows.map((row) => toCustomer(row)), total };
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const [rows] = await this.conn().query<CustomerRow[]>(LOAD_BY_EMAIL_SQL, [
      email.trim().toLowerCase(),
    ]);
    return rows.length > 0 ? toCustomer(rows[0]) : null;
  }

  async save(customer: Customer): Promise<void> {
    const rankId = RANK_TO_ID[customer.rank];

    await this.conn().query(
      `INSERT INTO customers (customer_id, full_name, email, phone, rank_id, is_active, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         full_name  = VALUES(full_name),
         email      = VALUES(email),
         phone      = VALUES(phone),
         rank_id    = VALUES(rank_id),
         is_active  = VALUES(is_active),
         updated_at = NOW()`,
      [
        customer.id,
        customer.fullName,
        customer.email,
        customer.phone,
        rankId,
        customer.isActive ? 1 : 0,
      ]
    );
  }
}
