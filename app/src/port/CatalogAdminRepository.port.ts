import type { CatalogLookupRow } from '@port/CatalogLookup.port';

export interface CatalogAdminRepository {
  createBrand(name: string): Promise<CatalogLookupRow>;
  updateBrand(id: number, name: string): Promise<void>;
  deleteBrand(id: number): Promise<void>;

  createCategory(name: string): Promise<CatalogLookupRow>;
  updateCategory(id: number, name: string): Promise<void>;
  deleteCategory(id: number): Promise<void>;
}
