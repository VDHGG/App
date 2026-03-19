import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCustomerRepository } from '@adapter/persistence/InMemoryCustomerRepository.adapter';
import { ShortIdGenerator } from '@adapter/persistence/ShortIdGenerator.adapter';
import { RegisterCustomerService } from '@usecase/RegisterCustomer.service';
import { ListCustomersService } from '@usecase/ListCustomers.service';

let customerRepo: InMemoryCustomerRepository;
let listCustomers: ListCustomersService;

beforeEach(() => {
  customerRepo = new InMemoryCustomerRepository();
  listCustomers = new ListCustomersService(customerRepo);
});

describe('ListCustomersService', () => {
  it('returns empty list when no customers', async () => {
    const result = await listCustomers.execute();

    expect(result.customers).toEqual([]);
  });

  it('returns all customers', async () => {
    const register = new RegisterCustomerService(customerRepo, new ShortIdGenerator('U'));
    await register.execute({ fullName: 'A', email: 'a@x.com' });
    await register.execute({ fullName: 'B', email: 'b@x.com' });

    const result = await listCustomers.execute();

    expect(result.customers).toHaveLength(2);
    expect(result.customers.map((c) => c.fullName).sort()).toEqual(['A', 'B']);
  });
});
