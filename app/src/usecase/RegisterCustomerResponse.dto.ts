import type { CustomerRank } from '@domain/CustomerRank.enum';

export type RegisterCustomerResponse = {
  customerId: string;
  fullName: string;
  email: string;
  phone: string | null;
  rank: CustomerRank;
};
