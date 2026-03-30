import type { Rental } from '@domain/Rental.aggregate';
import type { RentalStatus } from '@domain/RentalStatus.enum';

export type RentalAmountBucket = 'all' | 'lt50' | '50to150' | '150to300' | 'gt300';

export type ListRentalsFilters = {
  status?: RentalStatus;
  startDateFrom?: string;
  startDateTo?: string;
  amountBucket?: RentalAmountBucket;
};

export interface RentalRepository {
  findById(id: string): Promise<Rental | null>;
  findList(filters?: ListRentalsFilters): Promise<Rental[]>;
  save(rental: Rental): Promise<void>;
}
