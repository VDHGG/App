import type { Shoe } from '@domain/Shoe.aggregate';
import type { ListShoesFilters, ListShoesResult, ShoeRepository } from '@port/ShoeRepository.port';

function totalStock(shoe: Shoe): number {
  return shoe.variants.reduce((sum, v) => sum + v.totalQuantity, 0);
}

function matchesPriceBucket(shoe: Shoe, bucket: ListShoesFilters['priceBucket']): boolean {
  const p = shoe.pricePerDay;
  switch (bucket ?? 'all') {
    case 'all':
      return true;
    case 'lt10':
      return p < 10;
    case '10to20':
      return p >= 10 && p < 20;
    case '20to50':
      return p >= 20 && p <= 50;
    case 'gt50':
      return p > 50;
    default:
      return true;
  }
}

function matchesStockBucket(shoe: Shoe, bucket: ListShoesFilters['stockBucket']): boolean {
  const stock = totalStock(shoe);
  switch (bucket ?? 'all') {
    case 'all':
      return true;
    case '0':
      return stock === 0;
    case '1to5':
      return stock >= 1 && stock <= 5;
    case '6plus':
      return stock >= 6;
    default:
      return true;
  }
}

export class InMemoryShoeRepository implements ShoeRepository {
  private readonly store = new Map<string, Shoe>();

  async findById(id: string): Promise<Shoe | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(filters?: ListShoesFilters): Promise<ListShoesResult> {
    let list = Array.from(this.store.values()).filter(
      (s) => matchesPriceBucket(s, filters?.priceBucket) && matchesStockBucket(s, filters?.stockBucket)
    );
    list.sort((a, b) => a.id.localeCompare(b.id));
    const total = list.length;
    const limit = filters?.limit;
    const offset = filters?.offset ?? 0;
    if (limit !== undefined) {
      list = list.slice(offset, offset + limit);
    }
    return { items: list, total };
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
