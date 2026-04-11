import { describe, expect, it, vi } from 'vitest';
import { Customer } from '@domain/Customer.aggregate';
import { CustomerRank } from '@domain/CustomerRank.enum';
import { InMemoryCustomerRepository } from '@adapter/persistence/InMemoryCustomerRepository.adapter';
import { RegisterCustomerService } from '@usecase/RegisterCustomer.service';
import { RegisterUserService } from '@usecase/RegisterUser.service';
import { ShortIdGenerator } from '@adapter/persistence/ShortIdGenerator.adapter';
import type { AccessTokenService } from '@port/AccessTokenService.port';
import type { NewSystemUserRecord, SystemUserRepository } from '@port/SystemUserRepository.port';
import type { TransactionManager } from '@port/TransactionManager.port';

describe('RegisterUserService', () => {
  const transactionManager: TransactionManager = {
    runInTransaction: <T>(fn: () => Promise<T>) => fn(),
  };

  it('creates customer and system user when email is new', async () => {
    const customerRepo = new InMemoryCustomerRepository();
    const registerCustomer = new RegisterCustomerService(
      customerRepo,
      new ShortIdGenerator('C')
    );
    const saved: NewSystemUserRecord[] = [];
    const systemUsers: SystemUserRepository = {
      findByEmail: vi.fn(async (email: string) => {
        const e = email.trim().toLowerCase();
        return saved.find((u) => u.email === e) ?? null;
      }),
      findById: vi.fn(),
      save: vi.fn(async (u: NewSystemUserRecord) => {
        saved.push(u);
      }),
      updateContactFields: vi.fn(),
      updatePasswordHash: vi.fn(),
      findByEmailExcluding: vi.fn().mockResolvedValue(null),
      findByCustomerId: vi.fn().mockResolvedValue(null),
      listForAdmin: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      countActiveAdminsExcluding: vi.fn().mockResolvedValue(0),
      updateAdminFields: vi.fn(),
      updateMirrorFromCustomer: vi.fn(),
      unlinkCustomerLinks: vi.fn(),
      deleteById: vi.fn(),
    };
    const accessTokenService: AccessTokenService = {
      createAccessToken: vi.fn().mockResolvedValue('token-new'),
      verifyAccessToken: vi.fn(),
    };

    const sut = new RegisterUserService(
      transactionManager,
      customerRepo,
      registerCustomer,
      systemUsers,
      new ShortIdGenerator('U'),
      accessTokenService
    );

    const result = await sut.execute({
      fullName: 'New User',
      email: 'new@example.com',
      phone: '0901234567',
      password: 'Password123!',
    });

    expect(result.customerId).toMatch(/^C/);
    expect(result.accessToken).toBe('token-new');
    expect(saved).toHaveLength(1);
    expect(saved[0]?.customerId).toBe(result.customerId);
    const customers = await customerRepo.findAll();
    expect(customers.items).toHaveLength(1);
  });

  it('links system user to existing walk-in customer without duplicating customer', async () => {
    const customerRepo = new InMemoryCustomerRepository();
    await customerRepo.save(
      new Customer({
        id: 'C_WALK',
        fullName: 'Hằng',
        email: 'hang@gmail.com',
        phone: '123456789',
        rank: CustomerRank.BRONZE,
      })
    );

    const registerCustomer = new RegisterCustomerService(
      customerRepo,
      new ShortIdGenerator('C')
    );
    const saved: NewSystemUserRecord[] = [];
    const systemUsers: SystemUserRepository = {
      findByEmail: vi.fn(async (email: string) => {
        const e = email.trim().toLowerCase();
        return saved.find((u) => u.email === e) ?? null;
      }),
      findById: vi.fn(),
      save: vi.fn(async (u: NewSystemUserRecord) => {
        saved.push(u);
      }),
      updateContactFields: vi.fn(),
      updatePasswordHash: vi.fn(),
      findByEmailExcluding: vi.fn().mockResolvedValue(null),
      findByCustomerId: vi.fn().mockResolvedValue(null),
      listForAdmin: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      countActiveAdminsExcluding: vi.fn().mockResolvedValue(0),
      updateAdminFields: vi.fn(),
      updateMirrorFromCustomer: vi.fn(),
      unlinkCustomerLinks: vi.fn(),
      deleteById: vi.fn(),
    };
    const accessTokenService: AccessTokenService = {
      createAccessToken: vi.fn().mockResolvedValue('token-link'),
      verifyAccessToken: vi.fn(),
    };

    const sut = new RegisterUserService(
      transactionManager,
      customerRepo,
      registerCustomer,
      systemUsers,
      new ShortIdGenerator('U'),
      accessTokenService
    );

    const result = await sut.execute({
      fullName: 'Hằng Nguyễn',
      email: 'Hang@gmail.com',
      phone: '0987654321',
      password: 'Password123!',
    });

    expect(result.customerId).toBe('C_WALK');
    const customers = await customerRepo.findAll();
    expect(customers.items).toHaveLength(1);
    expect(customers.items[0]?.fullName).toBe('Hằng Nguyễn');
    expect(customers.items[0]?.phone).toBe('0987654321');
    expect(saved).toHaveLength(1);
    expect(saved[0]?.customerId).toBe('C_WALK');
    expect(accessTokenService.createAccessToken).toHaveBeenCalledWith({
      sub: saved[0]?.userId,
      role: 'customer',
      customerId: 'C_WALK',
    });
  });
});
