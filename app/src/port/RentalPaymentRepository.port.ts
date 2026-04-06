export type RentalPaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';

export type RentalPaymentRecord = {
  id: number;
  rentalId: string;
  customerId: string;
  provider: string;
  gatewayOrderId: string;
  gatewayRequestId: string | null;
  amountVnd: number;
  status: RentalPaymentStatus;
  expiresAt: Date;
};

export interface RentalPaymentRepository {
  countMomoAttemptsSince(customerId: string, since: Date): Promise<number>;
  cancelPendingForRental(rentalId: string): Promise<void>;
  insertPending(row: {
    rentalId: string;
    customerId: string;
    provider: string;
    gatewayOrderId: string;
    gatewayRequestId: string | null;
    amountVnd: number;
    expiresAt: Date;
  }): Promise<number>;
  findByGatewayOrderId(gatewayOrderId: string): Promise<RentalPaymentRecord | null>;
  updateFromIpn(
    id: number,
    patch: {
      status: RentalPaymentStatus;
      paidAt?: Date | null;
      gatewayTransId?: string | null;
      gatewayResultCode?: string | null;
      gatewayMessage?: string | null;
      rawIpnJson?: string | null;
    }
  ): Promise<void>;
  listPendingExpired(before: Date, limit: number): Promise<RentalPaymentRecord[]>;
  setStatus(id: number, status: RentalPaymentStatus): Promise<void>;
}
