 export type CatalogLookupRow = {
  id: number;
  name: string;
};

export type ShoeCatalogIds = {
  brandId: number;
  categoryId: number;
  variants: { variantId: string; colorId: number }[];
};

export interface CatalogLookupPort {
  listBrands(): Promise<CatalogLookupRow[]>;
  listCategories(): Promise<CatalogLookupRow[]>;
  listColors(): Promise<CatalogLookupRow[]>;
  getBrandNameById(id: number): Promise<string | null>;
  getCategoryNameById(id: number): Promise<string | null>;
  getColorNameById(id: number): Promise<string | null>;
  getShoeCatalogIds(shoeId: string): Promise<ShoeCatalogIds | null>;
}
