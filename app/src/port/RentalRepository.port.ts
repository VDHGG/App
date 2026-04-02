import type { Rental } from '@domain/Rental.aggregate';
import type { RentalStatus } from '@domain/RentalStatus.enum';

export type RentalAmountBucket = 'all' | 'lt50' | '50to150' | '150to300' | 'gt300';

export type ListRentalsFilters = {
  customerId?: string;
  status?: RentalStatus;
  startDateFrom?: string;
  startDateTo?: string;
  amountBucket?: RentalAmountBucket;
  search?: string;
  limit?: number;
  offset?: number;
};

export type ListRentalsResult = {
  items: Rental[];
  total: number;
};

export interface RentalRepository {
  findById(id: string): Promise<Rental | null>;
  findList(filters?: ListRentalsFilters): Promise<ListRentalsResult>;
  save(rental: Rental): Promise<void>;
}
