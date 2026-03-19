import type { Rental } from '@domain/Rental.aggregate';
import type { RentalStatus } from '@domain/RentalStatus.enum';
import type { RentalRepository } from '@port/RentalRepository.port';

export class InMemoryRentalRepository implements RentalRepository {
  private readonly store = new Map<string, Rental>();

  async findById(id: string): Promise<Rental | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<Rental[]> {
    return Array.from(this.store.values());
  }

  async findByStatus(status: RentalStatus): Promise<Rental[]> {
    return Array.from(this.store.values()).filter((rental) => rental.status === status);
  }

  async save(rental: Rental): Promise<void> {
    this.store.set(rental.id, rental);
  }
}
