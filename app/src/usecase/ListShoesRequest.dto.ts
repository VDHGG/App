import type { ListShoesFilters } from '@port/ShoeRepository.port';

export type ListShoesRequest = Omit<ListShoesFilters, 'limit' | 'offset'> & {
  page?: number;
  pageSize?: number;
};
