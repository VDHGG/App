import type { Shoe } from '@domain/Shoe.aggregate';

export type ShoePriceBucket = 'all' | 'lt10' | '10to20' | '20to50' | 'gt50';

export type ShoeStockBucket = 'all' | '0' | '1to5' | '6plus';

export type ListShoesFilters = {
  priceBucket?: ShoePriceBucket;
  stockBucket?: ShoeStockBucket;
};

export interface ShoeRepository {
  findById(id: string): Promise<Shoe | null>;
  findAll(filters?: ListShoesFilters): Promise<Shoe[]>;
  findByVariantId(variantId: string): Promise<Shoe | null>;
  save(shoe: Shoe): Promise<void>;
}
