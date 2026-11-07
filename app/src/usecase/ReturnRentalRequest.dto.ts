export type ReturnRentalRequest = {
  rentalId: string;
  returnedAt?: Date;
  note?: string;
  damageFee?: number;
};
