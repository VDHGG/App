import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import type { RentalPeriod } from '@domain/RentalPeriod.vo';
import type { VariantDeactivationPolicy } from '@domain/ShoeVariant.entity';
import type { RentalAvailabilityChecker } from '@port/RentalAvailabilityChecker.port';
import { transactionContext } from '@infra/db/transactionContext';
import { NotFoundError } from '@domain/errors/NotFoundError';

interface CountRow extends RowDataPacket {
  reserved_qty: number;
}

function toSqlDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export class MysqlRentalAvailabilityChecker implements RentalAvailabilityChecker {
  private readonly pool: Pool;
  private readonly deactivationPolicy: VariantDeactivationPolicy;

  constructor(pool: Pool, deactivationPolicy: VariantDeactivationPolicy) {
    this.pool = pool;
    this.deactivationPolicy = deactivationPolicy;
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

    const alreadyDeactivatedQuantity = await this.getReservedQuantityForVariant(variantId, period);

    this.deactivationPolicy.ensureDeactivateForRental(
      variantId,
      totalStock,
      alreadyDeactivatedQuantity,
      requestedQuantity
    );
  }

  async getReservedQuantityForVariant(
    variantId: string,
    period: RentalPeriod
  ): Promise<number> {
    const conn = this.conn();
    const [reservedRows] = await conn.query<CountRow[]>(
      `SELECT COALESCE(SUM(ri.quantity), 0) AS reserved_qty
       FROM rental_items ri
       JOIN rentals r ON r.rental_id = ri.rental_id
       WHERE ri.variant_id = ?
         AND r.status IN ('RESERVED', 'ACTIVE')
         AND r.start_date           <= ?
         AND r.expected_return_date >= ?`,
      [variantId, toSqlDate(period.endDate), toSqlDate(period.startDate)]
    );
    return Number(reservedRows[0]?.reserved_qty ?? 0);
  }
}
