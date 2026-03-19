import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { Rental } from '@domain/Rental.aggregate';
import { RentalItem } from '@domain/RentalItem.vo';
import { RentalPeriod } from '@domain/RentalPeriod.vo';
import type { RentalStatus } from '@domain/RentalStatus.enum';
import type { RentalRepository } from '@port/RentalRepository.port';
import { transactionContext } from '@infra/db/transactionContext';

interface RentalRow extends RowDataPacket {
  rental_id: string;
  customer_id: string;
  start_date: Date;
  expected_return_date: Date;
  actual_return_date: Date | null;
  status: string;
  late_fee: number;
  note: string | null;
  created_at: Date;
  activated_at: Date | null;
  cancelled_at: Date | null;
}

interface RentalItemRow extends RowDataPacket {
  variant_id: string;
  quantity: number;
  price_per_day: number;
  shoe_id: string;
  shoe_name: string;
  size: number;
  color: string;
}

const RENTAL_SQL = `
  SELECT rental_id, customer_id, start_date, expected_return_date,
         actual_return_date, status, late_fee, note, created_at,
         activated_at, cancelled_at
  FROM rentals
  WHERE rental_id = ?
`;

const ITEMS_SQL = `
  SELECT variant_id, quantity, price_per_day, shoe_id, shoe_name, size, color
  FROM rental_items
  WHERE rental_id = ?
`;

function toRental(row: RentalRow, items: RentalItemRow[]): Rental {
  const rentalItems = items.map(
    (i) =>
      new RentalItem({
        shoeId: i.shoe_id,
        variantId: i.variant_id,
        shoeName: i.shoe_name,
        size: i.size,
        color: i.color,
        pricePerDay: Number(i.price_per_day),
        quantity: i.quantity,
      })
  );

  return new Rental({
    id: row.rental_id,
    customerId: row.customer_id,
    items: rentalItems,
    period: new RentalPeriod(new Date(row.start_date), new Date(row.expected_return_date)),
    status: row.status as RentalStatus,
    lateFee: Number(row.late_fee),
    note: row.note ?? null,
    createdAt: new Date(row.created_at),
    activatedAt: row.activated_at ? new Date(row.activated_at) : null,
    returnedAt: row.actual_return_date ? new Date(row.actual_return_date) : null,
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at) : null,
  });
}

export class MysqlRentalRepository implements RentalRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  private conn(): Pool | PoolConnection {
    return transactionContext.getStore() ?? this.pool;
  }

  async findById(id: string): Promise<Rental | null> {
    const conn = this.conn();
    const [rentalRows] = await conn.query<RentalRow[]>(RENTAL_SQL, [id]);
    if (rentalRows.length === 0) return null;

    const [itemRows] = await conn.query<RentalItemRow[]>(ITEMS_SQL, [id]);
    return toRental(rentalRows[0], itemRows);
  }

  async findAll(): Promise<Rental[]> {
    const conn = this.conn();

    const [rentalRows] = await conn.query<RentalRow[]>(
      `SELECT rental_id, customer_id, start_date, expected_return_date,
              actual_return_date, status, late_fee, note, created_at,
              activated_at, cancelled_at
       FROM rentals ORDER BY created_at DESC`
    );

    const rentals: Rental[] = [];
    for (const row of rentalRows) {
      const [itemRows] = await conn.query<RentalItemRow[]>(ITEMS_SQL, [row.rental_id]);
      rentals.push(toRental(row, itemRows));
    }
    return rentals;
  }

  async findByStatus(status: RentalStatus): Promise<Rental[]> {
    const conn = this.conn();

    const [rentalRows] = await conn.query<RentalRow[]>(
      `SELECT rental_id, customer_id, start_date, expected_return_date,
              actual_return_date, status, late_fee, note, created_at,
              activated_at, cancelled_at
       FROM rentals WHERE status = ? ORDER BY created_at DESC`,
      [status]
    );

    const rentals: Rental[] = [];
    for (const row of rentalRows) {
      const [itemRows] = await conn.query<RentalItemRow[]>(ITEMS_SQL, [row.rental_id]);
      rentals.push(toRental(row, itemRows));
    }
    return rentals;
  }

  async save(rental: Rental): Promise<void> {
    const conn = this.conn();

    await conn.query(
      `INSERT INTO rentals
         (rental_id, customer_id, start_date, expected_return_date,
          status, late_fee, note, created_at, activated_at,
          actual_return_date, cancelled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         status                = VALUES(status),
         late_fee              = VALUES(late_fee),
         note                  = VALUES(note),
         activated_at          = VALUES(activated_at),
         actual_return_date    = VALUES(actual_return_date),
         cancelled_at          = VALUES(cancelled_at),
         updated_at            = NOW()`,
      [
        rental.id,
        rental.customerId,
        rental.period.startDate,
        rental.period.endDate,
        rental.status,
        rental.lateFee,
        rental.note ?? null,
        rental.createdAt,
        rental.activatedAt ?? null,
        rental.returnedAt ?? null,
        rental.cancelledAt ?? null,
      ]
    );

    for (const item of rental.items) {
      await conn.query(
        `INSERT IGNORE INTO rental_items
           (rental_id, variant_id, shoe_id, shoe_name, size, color, price_per_day, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rental.id,
          item.variantId,
          item.shoeId,
          item.shoeName,
          item.size,
          item.color,
          item.pricePerDay,
          item.quantity,
        ]
      );
    }
  }
}
