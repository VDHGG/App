import type { RentalStatus } from '@domain/RentalStatus.enum';

export type ListRentalsRequest = {
  status?: RentalStatus;
};
