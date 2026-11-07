import type { RentalStatus } from '@domain/RentalStatus.enum';

export type RentalSummary = {
  rentalId: string;
  customerId: string;
  status: RentalStatus;
  totalItems: number;
  basePrice: number;
  depositAmount: number;
  totalAmount: number;
  startDate: Date;
  endDate: Date;
  isOverdue: boolean;
  overdueDays: number;
  estimatedLateFee: number;
};

export type ListRentalsResponse = {
  rentals: RentalSummary[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
