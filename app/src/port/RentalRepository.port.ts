import type { Rental } from '@domain/Rental.aggregate';
import type { RentalStatus } from '@domain/RentalStatus.enum';

export interface RentalRepository {
  findById(id: string): Promise<Rental | null>;
  findAll(): Promise<Rental[]>;
  findByStatus(status: RentalStatus): Promise<Rental[]>;
  save(rental: Rental): Promise<void>;
}
