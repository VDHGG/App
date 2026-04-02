import type { ListRentalsFilters } from '@port/RentalRepository.port';

export type ListRentalsRequest = Omit<ListRentalsFilters, 'limit' | 'offset'> & {
  page?: number;
  pageSize?: number;
};
