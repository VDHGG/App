import type { Customer } from '@domain/Customer.aggregate';
import type {
  CustomerRepository,
  ListCustomersOptions,
  ListCustomersResult,
} from '@port/CustomerRepository.port';

export class InMemoryCustomerRepository implements CustomerRepository {
  private readonly store = new Map<string, Customer>();

  async findById(id: string): Promise<Customer | null> {
    return this.store.get(id) ?? null;
  }

  async findAll(options?: ListCustomersOptions): Promise<ListCustomersResult> {
    const list = Array.from(this.store.values()).sort((a, b) => a.id.localeCompare(b.id));
    const total = list.length;
    const limit = options?.limit;
    const offset = options?.offset ?? 0;
    const items =
      limit !== undefined ? list.slice(offset, offset + limit) : list;
    return { items, total };
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
