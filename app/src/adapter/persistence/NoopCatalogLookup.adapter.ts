import type {
  CatalogLookupPort,
  CatalogLookupRow,
  ShoeCatalogIds,
} from '@port/CatalogLookup.port';

export class NoopCatalogLookup implements CatalogLookupPort {
  async listBrands(): Promise<CatalogLookupRow[]> {
    return [];
  }

  async listCategories(): Promise<CatalogLookupRow[]> {
    return [];
  }

  async listColors(): Promise<CatalogLookupRow[]> {
    return [];
  }

  async getBrandNameById(): Promise<string | null> {
    return null;
  }

  async getCategoryNameById(): Promise<string | null> {
    return null;
  }

  async getColorNameById(): Promise<string | null> {
    return null;
  }

  async getShoeCatalogIds(): Promise<ShoeCatalogIds | null> {
    return null;
  }
}
