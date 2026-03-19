import type { Customer } from '@domain/Customer.aggregate';
import type { CustomerRepository } from '@port/CustomerRepository.port';

export class InMemoryCustomerRepository implements CustomerRepository {
  private readonly store = new Map<string, Customer>();

  async findById(id: string): Promise<Customer | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(): Promise<Customer[]> {
    return Array.from(this.store.values());
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const normalized = email.trim().toLowerCase();
    for (const customer of this.store.values()) {
      if (customer.email === normalized) return customer;
    }
    return null;
  }

  async save(customer: Customer): Promise<void> {
    this.store.set(customer.id, customer);
  }
}
