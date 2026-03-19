import type { Shoe } from '@domain/Shoe.aggregate';
import type { ShoeRepository } from '@port/ShoeRepository.port';

export class InMemoryShoeRepository implements ShoeRepository {
  private readonly store = new Map<string, Shoe>();

  async findById(id: string): Promise<Shoe | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<Shoe[]> {
    return Array.from(this.store.values());
  }

  async findByVariantId(variantId: string): Promise<Shoe | null> {
    for (const shoe of this.store.values()) {
      if (shoe.findVariantById(variantId)) {
        return shoe;
      }
    }
    return null;
  }

  async save(shoe: Shoe): Promise<void> {
    this.store.set(shoe.id, shoe);
  }
}
