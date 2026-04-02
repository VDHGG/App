export type CancelRentalRequest = {
  rentalId: string;
  cancelledAt?: Date;
  note?: string;
  requestingCustomerId?: string;
};
