import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCustomerRepository } from '@adapter/persistence/InMemoryCustomerRepository.adapter';
import { ShortIdGenerator } from '@adapter/persistence/ShortIdGenerator.adapter';
import { RegisterCustomerService } from '@usecase/RegisterCustomer.service';
import { GetCustomerService } from '@usecase/GetCustomer.service';

let customerRepo: InMemoryCustomerRepository;
let getCustomer: GetCustomerService;

beforeEach(() => {
  customerRepo = new InMemoryCustomerRepository();
  getCustomer = new GetCustomerService(customerRepo);
});

describe('GetCustomerService', () => {
  it('returns customer by id', async () => {
    const register = new RegisterCustomerService(customerRepo, new ShortIdGenerator('U'));
    const created = await register.execute({
      fullName: 'Nguyen Van A',
      email: 'a@test.com',
      phone: '0912000111',
    });

    const result = await getCustomer.execute({ customerId: created.customerId });

    expect(result.customerId).toBe(created.customerId);
    expect(result.fullName).toBe('Nguyen Van A');
    expect(result.email).toBe('a@test.com');
    expect(result.phone).toBe('0912000111');
    expect(result.currentRentedItems).toBe(0);
  });

  it('throws when customerId is empty', async () => {
    await expect(getCustomer.execute({ customerId: '' })).rejects.toThrow(
      'Customer id is required'
    );
  });

  it('throws when customer not found', async () => {
    await expect(getCustomer.execute({ customerId: 'GHOST' })).rejects.toThrow(
      /Customer.*GHOST.*not found/
    );
  });
});
