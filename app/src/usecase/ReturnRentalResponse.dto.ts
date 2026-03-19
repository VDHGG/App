import type { RentalStatus } from '@domain/RentalStatus.enum';

export type ReturnRentalResponse = {
  rentalId: string;
  customerId: string;
  status: RentalStatus;
  totalItems: number;
  basePrice: number;
  lateFee: number;
  totalAmount: number;
  returnedAt: Date;
};
