import { describe, expect, it, vi } from 'vitest';
import { UpdateProfileService } from '@usecase/UpdateProfile.service';
import { ConflictError } from '@domain/errors/ConflictError';
import type { CustomerRepository } from '@port/CustomerRepository.port';
import type { SystemUserRepository } from '@port/SystemUserRepository.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import { Customer } from '@domain/Customer.aggregate';

describe('UpdateProfileService', () => {
  it('updates system user and linked customer in one transaction', async () => {
    const systemUsers: SystemUserRepository = {
      findByEmail: vi.fn().mockResolvedValue(null),
      findById: vi
        .fn()
        .mockResolvedValueOnce({
          userId: 'U1',
          fullName: 'Old',
          email: 'old@x.com',
          phone: '0900000001',
          roleId: 1,
          passwordHash: 'h',
          customerId: 'C1',
          isActive: true,
        })
        .mockResolvedValueOnce({
          userId: 'U1',
          fullName: 'New Name',
          email: 'new@x.com',
          phone: '0900000002',
          roleId: 1,
          passwordHash: 'h',
          customerId: 'C1',
          isActive: true,
        }),
      save: vi.fn(),
      updateContactFields: vi.fn(),
      updatePasswordHash: vi.fn(),
      findByEmailExcluding: vi.fn().mockResolvedValue(null),
      findByCustomerId: vi.fn().mockResolvedValue(null),
      listForAdmin: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      countActiveAdminsExcluding: vi.fn().mockResolvedValue(0),
      updateAdminFields: vi.fn(),
      updateMirrorFromCustomer: vi.fn(),
    };

    const customer = new Customer({
      id: 'C1',
      fullName: 'Old',
      email: 'old@x.com',
      phone: '0900000001',
    });

    const customers: CustomerRepository = {
      findByEmail: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(customer),
      findAll: vi.fn(),
      save: vi.fn(),
    };

    const transactionManager: TransactionManager = {
      runInTransaction: (fn) => fn(),
    };

    const sut = new UpdateProfileService(transactionManager, systemUsers, customers);
    const result = await sut.execute({
      userId: 'U1',
      fullName: 'New Name',
      email: 'new@x.com',
      phone: '0900000002',
    });

    expect(systemUsers.updateContactFields).toHaveBeenCalledWith('U1', {
      fullName: 'New Name',
      email: 'new@x.com',
      phone: '0900000002',
    });
    expect(customers.save).toHaveBeenCalled();
    expect(result.email).toBe('new@x.com');
    expect(result.fullName).toBe('New Name');
  });

  it('throws when email belongs to another user', async () => {
    const systemUsers: SystemUserRepository = {
      findByEmail: vi.fn().mockResolvedValue({
        userId: 'U2',
        fullName: 'X',
        email: 'taken@x.com',
        phone: null,
        roleId: 1,
        passwordHash: 'h',
        customerId: null,
        isActive: true,
      }),
      findById: vi.fn().mockResolvedValue({
        userId: 'U1',
        fullName: 'A',
        email: 'a@x.com',
        phone: null,
        roleId: 1,
        passwordHash: 'h',
        customerId: null,
        isActive: true,
      }),
      save: vi.fn(),
      updateContactFields: vi.fn(),
      updatePasswordHash: vi.fn(),
      findByEmailExcluding: vi.fn().mockResolvedValue(null),
      findByCustomerId: vi.fn().mockResolvedValue(null),
      listForAdmin: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      countActiveAdminsExcluding: vi.fn().mockResolvedValue(0),
      updateAdminFields: vi.fn(),
      updateMirrorFromCustomer: vi.fn(),
    };

    const customers: CustomerRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      save: vi.fn(),
    };

    const transactionManager: TransactionManager = {
      runInTransaction: (fn) => fn(),
    };

    const sut = new UpdateProfileService(transactionManager, systemUsers, customers);
    await expect(
      sut.execute({
        userId: 'U1',
        fullName: 'A',
        email: 'taken@x.com',
        phone: '0900000001',
      })
    ).rejects.toBeInstanceOf(ConflictError);
    expect(systemUsers.updateContactFields).not.toHaveBeenCalled();
  });
});
