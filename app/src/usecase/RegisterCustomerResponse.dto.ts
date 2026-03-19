import type { CustomerRank } from '@domain/CustomerRank.enum';

export type RegisterCustomerResponse = {
  customerId: string;
  fullName: string;
  email: string;
  rank: CustomerRank;
};
