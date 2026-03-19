import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryCustomerRepository } from '@adapter/persistence/InMemoryCustomerRepository.adapter';
import { ShortIdGenerator } from '@adapter/persistence/ShortIdGenerator.adapter';
import { Customer } from '@domain/Customer.aggregate';
import { CustomerRank } from '@domain/CustomerRank.enum';
import { RegisterCustomerService } from '@usecase/RegisterCustomer.service';

let customerRepo: InMemoryCustomerRepository;
let service: RegisterCustomerService;

beforeEach(() => {
  customerRepo = new InMemoryCustomerRepository();
  service = new RegisterCustomerService(customerRepo, new ShortIdGenerator('U'));
});


describe('RegisterCustomerService - happy path', () => {
  it('creates and persists a customer with BRONZE rank by default', async () => {
    const result = await service.execute({
      fullName: 'Nguyen Van A',
      email: 'a@gmail.com',
    });

    expect(result.fullName).toBe('Nguyen Van A');
    expect(result.email).toBe('a@gmail.com');
    expect(result.rank).toBe(CustomerRank.BRONZE);
    expect(result.customerId).toBeTruthy();

    const saved = await customerRepo.findById(result.customerId);
    expect(saved).not.toBeNull();
    expect(saved?.email).toBe('a@gmail.com');
  });

  it('creates a customer with the specified rank', async () => {
    const result = await service.execute({
      fullName: 'Tran Thi B',
      email: 'b@gmail.com',
      rank: CustomerRank.GOLD,
    });

    expect(result.rank).toBe(CustomerRank.GOLD);
  });

  it('normalizes email to lowercase', async () => {
    const result = await service.execute({
      fullName: 'Le Van C',
      email: 'C@GMAIL.COM',
    });

    expect(result.email).toBe('c@gmail.com');
  });
});


describe('RegisterCustomerService - error cases', () => {
  it('throws when fullName is empty', async () => {
    await expect(
      service.execute({ fullName: '', email: 'x@gmail.com' })
    ).rejects.toThrow(/full name/i);
  });

  it('throws when email is empty', async () => {
    await expect(
      service.execute({ fullName: 'Test User', email: '' })
    ).rejects.toThrow(/email/i);
  });

  it('throws when email is already registered', async () => {
    await customerRepo.save(
      new Customer({ id: 'U999', fullName: 'Existing', email: 'dup@gmail.com' })
    );

    await expect(
      service.execute({ fullName: 'New User', email: 'dup@gmail.com' })
    ).rejects.toThrow('already registered');
  });

  it('treats email check as case-insensitive', async () => {
    await customerRepo.save(
      new Customer({ id: 'U999', fullName: 'Existing', email: 'dup@gmail.com' })
    );

    await expect(
      service.execute({ fullName: 'New User', email: 'DUP@GMAIL.COM' })
    ).rejects.toThrow('already registered');
  });
});
