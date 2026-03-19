import type { Shoe } from '@domain/Shoe.aggregate';

export interface ShoeRepository {
  findById(id: string): Promise<Shoe | null>;
  findAll(): Promise<Shoe[]>;
  findByVariantId(variantId: string): Promise<Shoe | null>;
  save(shoe: Shoe): Promise<void>;
}
