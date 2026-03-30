import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { ConflictError } from '@domain/errors/ConflictError';
import { NotFoundError } from '@domain/errors/NotFoundError';
import { ValidationError } from '@domain/errors/ValidationError';
import type { CatalogLookupRow } from '@port/CatalogLookup.port';
import type { CatalogAdminRepository } from '@port/CatalogAdminRepository.port';

type LookupTable = 'brands' | 'categories';

export class MysqlCatalogAdmin implements CatalogAdminRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  private ensureName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 100) {
      throw new ValidationError('Name must be between 1 and 100 characters.');
    }
    return trimmed;
  }

  private async assertNameUnique(
    table: LookupTable,
    name: string,
    excludeId?: number
  ): Promise<void> {
    const sql =
      excludeId !== undefined
        ? `SELECT id FROM ${table} WHERE LOWER(TRIM(name)) = LOWER(?) AND id <> ?`
        : `SELECT id FROM ${table} WHERE LOWER(TRIM(name)) = LOWER(?)`;
    const params = excludeId !== undefined ? [name, excludeId] : [name];
    const [rows] = await this.pool.query<RowDataPacket[]>(sql, params);
    if (rows.length > 0) {
      throw new ValidationError('A record with this name already exists.');
    }
  }

  async createBrand(name: string): Promise<CatalogLookupRow> {
    const n = this.ensureName(name);
    await this.assertNameUnique('brands', n);
    const [result] = await this.pool.query<ResultSetHeader>('INSERT INTO brands (name) VALUES (?)', [
      n,
    ]);
    return { id: result.insertId, name: n };
  }

  async updateBrand(id: number, name: string): Promise<void> {
    const n = this.ensureName(name);
    await this.assertNameUnique('brands', n, id);
    const [result] = await this.pool.query<ResultSetHeader>(
      'UPDATE brands SET name = ? WHERE id = ?',
      [n, id]
    );
    if (result.affectedRows === 0) {
      throw new NotFoundError('Brand', String(id));
    }
  }

  async deleteBrand(id: number): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS c FROM shoes WHERE brand_id = ?',
      [id]
    );
    const c = Number(rows[0]?.['c'] ?? 0);
    if (c > 0) {
      throw new ConflictError(
        'BRAND_IN_USE',
        `Cannot delete: ${c} shoe(s) still reference this brand.`
      );
    }
    const [result] = await this.pool.query<ResultSetHeader>('DELETE FROM brands WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      throw new NotFoundError('Brand', String(id));
    }
  }

  async createCategory(name: string): Promise<CatalogLookupRow> {
    const n = this.ensureName(name);
    await this.assertNameUnique('categories', n);
    const [result] = await this.pool.query<ResultSetHeader>(
      'INSERT INTO categories (name) VALUES (?)',
      [n]
    );
    return { id: result.insertId, name: n };
  }

  async updateCategory(id: number, name: string): Promise<void> {
    const n = this.ensureName(name);
    await this.assertNameUnique('categories', n, id);
    const [result] = await this.pool.query<ResultSetHeader>(
      'UPDATE categories SET name = ? WHERE id = ?',
      [n, id]
    );
    if (result.affectedRows === 0) {
      throw new NotFoundError('Category', String(id));
    }
  }

  async deleteCategory(id: number): Promise<void> {
    const [rows] = await this.pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS c FROM shoes WHERE category_id = ?',
      [id]
    );
    const c = Number(rows[0]?.['c'] ?? 0);
    if (c > 0) {
      throw new ConflictError(
        'CATEGORY_IN_USE',
        `Cannot delete: ${c} shoe(s) still reference this category.`
      );
    }
    const [result] = await this.pool.query<ResultSetHeader>(
      'DELETE FROM categories WHERE id = ?',
      [id]
    );
    if (result.affectedRows === 0) {
      throw new NotFoundError('Category', String(id));
    }
  }
}
