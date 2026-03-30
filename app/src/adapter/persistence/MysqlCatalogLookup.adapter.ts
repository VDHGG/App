import type { Pool, RowDataPacket } from 'mysql2/promise';
import type {
  CatalogLookupPort,
  CatalogLookupRow,
  ShoeCatalogIds,
} from '@port/CatalogLookup.port';

interface IdNameRow extends RowDataPacket {
  id: number;
  name: string;
}

interface NameRow extends RowDataPacket {
  name: string;
}

interface ShoeIdsRow extends RowDataPacket {
  brand_id: number;
  category_id: number;
}

interface VariantColorRow extends RowDataPacket {
  variant_id: string;
  color_id: number;
}

export class MysqlCatalogLookup implements CatalogLookupPort {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async listBrands(): Promise<CatalogLookupRow[]> {
    const [rows] = await this.pool.query<IdNameRow[]>(
      'SELECT id, name FROM brands ORDER BY name ASC'
    );
    return rows.map((r) => ({ id: Number(r.id), name: r.name }));
  }

  async listCategories(): Promise<CatalogLookupRow[]> {
    const [rows] = await this.pool.query<IdNameRow[]>(
      'SELECT id, name FROM categories ORDER BY name ASC'
    );
    return rows.map((r) => ({ id: Number(r.id), name: r.name }));
  }

  async listColors(): Promise<CatalogLookupRow[]> {
    const [rows] = await this.pool.query<IdNameRow[]>(
      'SELECT id, name FROM colors ORDER BY name ASC'
    );
    return rows.map((r) => ({ id: Number(r.id), name: r.name }));
  }

  async getBrandNameById(id: number): Promise<string | null> {
    const [rows] = await this.pool.query<NameRow[]>('SELECT name FROM brands WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0].name : null;
  }

  async getCategoryNameById(id: number): Promise<string | null> {
    const [rows] = await this.pool.query<NameRow[]>(
      'SELECT name FROM categories WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? rows[0].name : null;
  }

  async getColorNameById(id: number): Promise<string | null> {
    const [rows] = await this.pool.query<NameRow[]>('SELECT name FROM colors WHERE id = ?', [id]);
    return rows.length > 0 ? rows[0].name : null;
  }

  async getShoeCatalogIds(shoeId: string): Promise<ShoeCatalogIds | null> {
    const [shoeRows] = await this.pool.query<ShoeIdsRow[]>(
      `SELECT b.id AS brand_id, c.id AS category_id
       FROM shoes s
       JOIN brands b ON b.id = s.brand_id
       JOIN categories c ON c.id = s.category_id
       WHERE s.shoe_id = ?`,
      [shoeId]
    );
    if (shoeRows.length === 0) return null;

    const [vRows] = await this.pool.query<VariantColorRow[]>(
      `SELECT sv.variant_id, col.id AS color_id
       FROM shoe_variants sv
       JOIN colors col ON col.id = sv.color_id
       WHERE sv.shoe_id = ?`,
      [shoeId]
    );

    return {
      brandId: Number(shoeRows[0].brand_id),
      categoryId: Number(shoeRows[0].category_id),
      variants: vRows.map((r) => ({
        variantId: r.variant_id,
        colorId: Number(r.color_id),
      })),
    };
  }
}
