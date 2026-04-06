import type { Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  RentalPaymentRecord,
  RentalPaymentRepository,
  RentalPaymentStatus,
} from '@port/RentalPaymentRepository.port';
import { transactionContext } from '@infra/db/transactionContext';

interface PaymentRow extends RowDataPacket {
  id: number;
  rental_id: string;
  customer_id: string;
  provider: string;
  gateway_order_id: string;
  gateway_request_id: string | null;
  amount_vnd: number;
  status: string;
  expires_at: Date;
}

function mapRow(r: PaymentRow): RentalPaymentRecord {
  return {
    id: r.id,
    rentalId: r.rental_id,
    customerId: r.customer_id,
    provider: r.provider,
    gatewayOrderId: r.gateway_order_id,
    gatewayRequestId: r.gateway_request_id,
    amountVnd: r.amount_vnd,
    status: r.status as RentalPaymentStatus,
    expiresAt: new Date(r.expires_at),
  };
}

export class MysqlRentalPaymentRepository implements RentalPaymentRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  private conn(): Pool | PoolConnection {
    return transactionContext.getStore() ?? this.pool;
  }

  async countMomoAttemptsSince(customerId: string, since: Date): Promise<number> {
    const [rows] = await this.conn().query<RowDataPacket[]>(
      `SELECT COUNT(*) AS cnt FROM rental_payments
       WHERE customer_id = ? AND provider = 'momo' AND created_at >= ?`,
      [customerId, since]
    );
    return Number(rows[0]?.['cnt'] ?? 0);
  }

  async cancelPendingForRental(rentalId: string): Promise<void> {
    await this.conn().query(
      `UPDATE rental_payments SET status = 'CANCELLED', updated_at = NOW()
       WHERE rental_id = ? AND status = 'PENDING'`,
      [rentalId]
    );
  }

  async insertPending(row: {
    rentalId: string;
    customerId: string;
    provider: string;
    gatewayOrderId: string;
    gatewayRequestId: string | null;
    amountVnd: number;
    expiresAt: Date;
  }): Promise<number> {
    const [res] = await this.conn().query<ResultSetHeader>(
      `INSERT INTO rental_payments (
        rental_id, customer_id, provider, gateway_order_id, gateway_request_id,
        amount_vnd, status, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?)`,
      [
        row.rentalId,
        row.customerId,
        row.provider,
        row.gatewayOrderId,
        row.gatewayRequestId,
        row.amountVnd,
        row.expiresAt,
      ]
    );
    return res.insertId;
  }

  async findByGatewayOrderId(gatewayOrderId: string): Promise<RentalPaymentRecord | null> {
    const [rows] = await this.conn().query<PaymentRow[]>(
      `SELECT id, rental_id, customer_id, provider, gateway_order_id, gateway_request_id,
              amount_vnd, status, expires_at
       FROM rental_payments WHERE gateway_order_id = ? LIMIT 1`,
      [gatewayOrderId]
    );
    return rows.length > 0 ? mapRow(rows[0]) : null;
  }

  async updateFromIpn(
    id: number,
    patch: {
      status: RentalPaymentStatus;
      paidAt?: Date | null;
      gatewayTransId?: string | null;
      gatewayResultCode?: string | null;
      gatewayMessage?: string | null;
      rawIpnJson?: string | null;
    }
  ): Promise<void> {
    await this.conn().query(
      `UPDATE rental_payments SET
        status = ?,
        paid_at = ?,
        gateway_trans_id = ?,
        gateway_result_code = ?,
        gateway_message = ?,
        raw_ipn_json = ?,
        updated_at = NOW()
       WHERE id = ?`,
      [
        patch.status,
        patch.paidAt ?? null,
        patch.gatewayTransId ?? null,
        patch.gatewayResultCode ?? null,
        patch.gatewayMessage ?? null,
        patch.rawIpnJson ?? null,
        id,
      ]
    );
  }

  async listPendingExpired(before: Date, limit: number): Promise<RentalPaymentRecord[]> {
    const [rows] = await this.conn().query<PaymentRow[]>(
      `SELECT id, rental_id, customer_id, provider, gateway_order_id, gateway_request_id,
              amount_vnd, status, expires_at
       FROM rental_payments
       WHERE status = 'PENDING' AND expires_at < ?
       ORDER BY expires_at ASC
       LIMIT ?`,
      [before, limit]
    );
    return rows.map(mapRow);
  }

  async setStatus(id: number, status: RentalPaymentStatus): Promise<void> {
    await this.conn().query(`UPDATE rental_payments SET status = ?, updated_at = NOW() WHERE id = ?`, [
      status,
      id,
    ]);
  }
}
