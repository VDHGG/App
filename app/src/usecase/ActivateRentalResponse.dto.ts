import type { RentalStatus } from '@domain/RentalStatus.enum';

export type ActivateRentalResponse = {
  rentalId: string;
  customerId: string;
  status: RentalStatus;
  activatedAt: Date;
};
