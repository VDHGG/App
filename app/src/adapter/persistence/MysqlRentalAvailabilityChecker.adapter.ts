import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { RentalPeriod } from '@domain/RentalPeriod.vo';
import type { VariantAvailabilityPolicy } from '@domain/ShoeVariant.entity';
import type { RentalAvailabilityChecker } from '@port/RentalAvailabilityChecker.port';
import { transactionContext } from '@infra/db/transactionContext';
import { NotFoundError } from '@domain/errors/NotFoundError';

interface CountRow extends RowDataPacket {
  reserved_qty: number;
}

export class MysqlRentalAvailabilityChecker implements RentalAvailabilityChecker {
  private readonly pool: Pool;
  private readonly availabilityPolicy: VariantAvailabilityPolicy;

  constructor(pool: Pool, availabilityPolicy: VariantAvailabilityPolicy) {
    this.pool = pool;
    this.availabilityPolicy = availabilityPolicy;
  }

  private conn(): Pool | PoolConnection {
    return transactionContext.getStore() ?? this.pool;
  }

  async ensureVariantAvailable(
    variantId: string,
    requestedQuantity: number,
    period: RentalPeriod
  ): Promise<void> {
    const conn = this.conn();

    const [stockRows] = await conn.query<RowDataPacket[]>(
      'SELECT on_hand_quantity FROM shoe_variants WHERE variant_id = ? FOR UPDATE',
      [variantId]
    );
    if (stockRows.length === 0) {
      throw new NotFoundError('Variant', variantId);
    }

    const totalStock = Number(stockRows[0]['on_hand_quantity']);

    const [reservedRows] = await conn.query<CountRow[]>(
      `SELECT COALESCE(SUM(ri.quantity), 0) AS reserved_qty
       FROM rental_items ri
       JOIN rentals r ON r.rental_id = ri.rental_id
       WHERE ri.variant_id = ?
         AND r.status IN ('RESERVED', 'ACTIVE')
         AND r.start_date           <= ?
         AND r.expected_return_date >= ?`,
      [variantId, period.endDate, period.startDate]
    );

    const reservedQuantity = Number(reservedRows[0].reserved_qty);

    this.availabilityPolicy.ensureAvailableForQuantity(
      variantId,
      totalStock,
      reservedQuantity,
      requestedQuantity
    );
  }
}
