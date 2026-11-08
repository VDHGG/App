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
    expect(result.total).toBe(0);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('returns all customers', async () => {
    const register = new RegisterCustomerService(customerRepo, new ShortIdGenerator('U'));
    await register.execute({ fullName: 'A', email: 'a@x.com', phone: '0911111111' });
    await register.execute({ fullName: 'B', email: 'b@x.com', phone: '0922222222' });

    const result = await listCustomers.execute();

    expect(result.customers).toHaveLength(2);
    expect(result.customers.map((c) => c.fullName).sort()).toEqual(['A', 'B']);
    expect(result.total).toBe(2);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('filters customers by rank and isActive with accurate pagination', async () => {
    const register = new RegisterCustomerService(customerRepo, new ShortIdGenerator('U'));
    const c1 = await register.execute({
      fullName: 'Diamond One',
      email: 'd1@x.com',
      phone: '0911111111',
      rank: 'DIAMOND' as never,
    });
    await register.execute({
      fullName: 'Diamond Two',
      email: 'd2@x.com',
      phone: '0922222222',
      rank: 'DIAMOND' as never,
    });
    await register.execute({
      fullName: 'Gold One',
      email: 'g1@x.com',
      phone: '0933333333',
      rank: 'GOLD' as never,
    });

    const entity1 = await customerRepo.findById(c1.customerId);
    entity1!.deactivate();
    await customerRepo.save(entity1!);

    const diamondAll = await listCustomers.execute({ rank: 'DIAMOND' });
    expect(diamondAll.total).toBe(2);
    expect(diamondAll.customers).toHaveLength(2);

    const diamondActive = await listCustomers.execute({ rank: 'DIAMOND', isActive: true });
    expect(diamondActive.total).toBe(1);
    expect(diamondActive.customers[0].fullName).toBe('Diamond Two');

    const diamondLocked = await listCustomers.execute({ rank: 'DIAMOND', isActive: false });
    expect(diamondLocked.total).toBe(1);
    expect(diamondLocked.customers[0].fullName).toBe('Diamond One');

    const diamondPaged = await listCustomers.execute({ rank: 'DIAMOND', page: 1, pageSize: 1 });
    expect(diamondPaged.total).toBe(2);
    expect(diamondPaged.customers).toHaveLength(1);
    expect(diamondPaged.totalPages).toBe(2);
  });
});
