import type { Customer } from '@domain/Customer.aggregate';

export type ListCustomersOptions = {
  limit?: number;
  offset?: number;
  /** Case-insensitive substring match on email or full name */
  search?: string;
};

export type ListCustomersResult = {
  items: Customer[];
  total: number;
};

export interface CustomerRepository {
  findById(id: string): Promise<Customer | null>;
  findAll(options?: ListCustomersOptions): Promise<ListCustomersResult>;
  findByEmail(email: string): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
}
