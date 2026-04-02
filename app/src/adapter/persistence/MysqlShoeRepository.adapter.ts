import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { Shoe } from '@domain/Shoe.aggregate';
import { ShoeVariant } from '@domain/ShoeVariant.entity';
import type { ListShoesFilters, ListShoesResult, ShoeRepository } from '@port/ShoeRepository.port';
import { transactionContext } from '@infra/db/transactionContext';

interface ShoeVariantRow extends RowDataPacket {
  variant_id: string;
  size: number;
  color: string;
  on_hand_quantity: number;
  available_quantity: number;
}

interface ShoeRow extends RowDataPacket {
  shoe_id: string;
  name: string;
  brand: string;
  category: string;
  description: string | null;
  price_per_day: number;
  is_active: number;
  image_public_id: string | null;
}

const VARIANTS_SQL = `
  SELECT sv.variant_id, sv.size, col.name AS color, sv.on_hand_quantity,
         sv.on_hand_quantity - COALESCE(active.reserved_qty, 0) AS available_quantity
  FROM shoe_variants sv
  JOIN colors col ON col.id = sv.color_id
  LEFT JOIN (
    SELECT ri.variant_id, SUM(ri.quantity) AS reserved_qty
    FROM rental_items ri
    JOIN rentals r ON r.rental_id = ri.rental_id
    WHERE r.status IN ('RESERVED', 'ACTIVE')
    GROUP BY ri.variant_id
  ) AS active ON active.variant_id = sv.variant_id
  WHERE sv.shoe_id = ?
`;

export class MysqlShoeRepository implements ShoeRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  private conn(): Pool | PoolConnection {
    return transactionContext.getStore() ?? this.pool;
  }

  async findById(shoeId: string): Promise<Shoe | null> {
    const conn = this.conn();

    const [shoeRows] = await conn.query<ShoeRow[]>(
      `SELECT s.shoe_id, s.name, b.name AS brand, cat.name AS category,
              s.description, s.price_per_day, s.is_active, s.image_public_id
       FROM shoes s
       JOIN brands b     ON b.id = s.brand_id
       JOIN categories cat ON cat.id = s.category_id
       WHERE s.shoe_id = ?`,
      [shoeId]
    );
    if (shoeRows.length === 0) return null;

    const [variantRows] = await conn.query<ShoeVariantRow[]>(VARIANTS_SQL, [shoeId]);
    const row = shoeRows[0];

    const shoe = new Shoe({
      id: row.shoe_id,
      name: row.name,
      brand: row.brand,
      category: row.category,
      description: row.description ?? null,
      pricePerDay: Number(row.price_per_day),
      isActive: Number(row.is_active) === 1,
      imagePublicId: row.image_public_id ?? null,
    });

    for (const v of variantRows) {
      shoe.addVariant(
        new ShoeVariant({
          id: v.variant_id,
          size: v.size,
          color: v.color,
          totalQuantity: v.on_hand_quantity,
          availableQuantity: Math.max(0, Number(v.available_quantity)),
        })
      );
    }

    return shoe;
  }

  async findByVariantId(variantId: string): Promise<Shoe | null> {
    const [idRows] = await this.conn().query<RowDataPacket[]>(
      'SELECT shoe_id FROM shoe_variants WHERE variant_id = ?',
      [variantId]
    );
    if (idRows.length === 0) return null;

    return this.findById(idRows[0]['shoe_id'] as string);
  }

  async findAll(filters?: ListShoesFilters): Promise<ListShoesResult> {
    const conditions: string[] = ['1=1'];

    const priceBucket = filters?.priceBucket ?? 'all';
    if (priceBucket === 'lt10') {
      conditions.push('s.price_per_day < 10');
    } else if (priceBucket === '10to20') {
      conditions.push('s.price_per_day >= 10 AND s.price_per_day < 20');
    } else if (priceBucket === '20to50') {
      conditions.push('s.price_per_day >= 20 AND s.price_per_day <= 50');
    } else if (priceBucket === 'gt50') {
      conditions.push('s.price_per_day > 50');
    }

    const stockBucket = filters?.stockBucket ?? 'all';
    const stockExpr = 'COALESCE(v.stock_sum, 0)';
    if (stockBucket === '0') {
      conditions.push(`${stockExpr} = 0`);
    } else if (stockBucket === '1to5') {
      conditions.push(`${stockExpr} BETWEEN 1 AND 5`);
    } else if (stockBucket === '6plus') {
      conditions.push(`${stockExpr} >= 6`);
    }

    const whereClause = conditions.join(' AND ');
    const baseFrom = `
      FROM shoes s
      LEFT JOIN (
        SELECT shoe_id, SUM(on_hand_quantity) AS stock_sum
        FROM shoe_variants
        GROUP BY shoe_id
      ) v ON v.shoe_id = s.shoe_id
      WHERE ${whereClause}`;

    const [countRows] = await this.conn().query<RowDataPacket[]>(
      `SELECT COUNT(s.shoe_id) AS cnt ${baseFrom}`
    );
    const total = Number(countRows[0]?.['cnt'] ?? 0);

    let listSql = `SELECT s.shoe_id ${baseFrom} ORDER BY s.shoe_id`;
    const listParams: unknown[] = [];
    if (filters?.limit !== undefined) {
      listSql += ' LIMIT ? OFFSET ?';
      listParams.push(filters.limit, filters.offset ?? 0);
    }

    const [rows] = await this.conn().query<RowDataPacket[]>(listSql, listParams);
    const shoes: Shoe[] = [];
    for (const row of rows) {
      const shoe = await this.findById(row['shoe_id'] as string);
      if (shoe) shoes.push(shoe);
    }
    return { items: shoes, total };
  }

  async save(shoe: Shoe): Promise<void> {
    const conn = this.conn();

    const brandId = await this.getOrCreateLookup(conn, 'brands', shoe.brand);
    const categoryId = await this.getOrCreateLookup(conn, 'categories', shoe.category);

    await conn.query(
      `INSERT INTO shoes (shoe_id, name, brand_id, category_id, description, price_per_day, is_active, image_public_id, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         name         = VALUES(name),
         brand_id     = VALUES(brand_id),
         category_id  = VALUES(category_id),
         description  = VALUES(description),
         price_per_day = VALUES(price_per_day),
         is_active    = VALUES(is_active),
         image_public_id = VALUES(image_public_id),
         updated_at   = NOW()`,
      [
        shoe.id,
        shoe.name,
        brandId,
        categoryId,
        shoe.description ?? null,
        shoe.pricePerDay,
        shoe.isActive ? 1 : 0,
        shoe.imagePublicId,
      ]
    );

    for (const variant of shoe.variants) {
      const colorId = await this.getOrCreateLookup(conn, 'colors', variant.color);

      await conn.query(
        `INSERT INTO shoe_variants (variant_id, shoe_id, size, color_id, on_hand_quantity, updated_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           size             = VALUES(size),
           color_id         = VALUES(color_id),
           on_hand_quantity = VALUES(on_hand_quantity),
           updated_at       = NOW()`,
        [variant.id, shoe.id, variant.size, colorId, variant.totalQuantity]
      );
    }
  }

  private async getOrCreateLookup(
    conn: Pool | PoolConnection,
    table: string,
    name: string
  ): Promise<number> {
    const [rows] = await conn.query<RowDataPacket[]>(
      `SELECT id FROM \`${table}\` WHERE name = ?`,
      [name]
    );
    if (rows.length > 0) return rows[0]['id'] as number;

    const [result] = await conn.query<import('mysql2/promise').ResultSetHeader>(
      `INSERT INTO \`${table}\` (name) VALUES (?)`,
      [name]
    );
    return result.insertId;
  }
}
