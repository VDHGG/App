import type { RentalStatus } from '@domain/RentalStatus.enum';

export type CancelRentalResponse = {
  rentalId: string;
  customerId: string;
  status: RentalStatus;
  totalItems: number;
  cancelledAt: Date;
};
