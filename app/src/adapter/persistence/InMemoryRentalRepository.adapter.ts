import type { Rental } from '@domain/Rental.aggregate';
import type { ListRentalsFilters, RentalRepository } from '@port/RentalRepository.port';

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function matchesAmount(r: Rental, bucket: ListRentalsFilters['amountBucket']): boolean {
  const t = r.totalAmount;
  switch (bucket ?? 'all') {
    case 'all':
      return true;
    case 'lt50':
      return t < 50;
    case '50to150':
      return t >= 50 && t <= 150;
    case '150to300':
      return t > 150 && t <= 300;
    case 'gt300':
      return t > 300;
    default:
      return true;
  }
}

export class InMemoryRentalRepository implements RentalRepository {
  private readonly store = new Map<string, Rental>();

  async findById(id: string): Promise<Rental | null> {
    return this.store.get(id) ?? null;
  }

  async findList(filters?: ListRentalsFilters): Promise<Rental[]> {
    let list = Array.from(this.store.values());
    if (filters?.status) {
      list = list.filter((r) => r.status === filters.status);
    }
    if (filters?.startDateFrom) {
      const from = filters.startDateFrom;
      list = list.filter((r) => toYmd(r.period.startDate) >= from);
    }
    if (filters?.startDateTo) {
      const to = filters.startDateTo;
      list = list.filter((r) => toYmd(r.period.startDate) <= to);
    }
    if (filters?.amountBucket && filters.amountBucket !== 'all') {
      list = list.filter((r) => matchesAmount(r, filters.amountBucket));
    }
    list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return list;
  }

  async save(rental: Rental): Promise<void> {
    this.store.set(rental.id, rental);
  }
}
