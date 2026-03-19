import type { RentalStatus } from '@domain/RentalStatus.enum';

export type RentalSummary = {
  rentalId: string;
  customerId: string;
  status: RentalStatus;
  totalItems: number;
  basePrice: number;
  totalAmount: number;
  startDate: Date;
  endDate: Date;
};

export type ListRentalsResponse = {
  rentals: RentalSummary[];
};
