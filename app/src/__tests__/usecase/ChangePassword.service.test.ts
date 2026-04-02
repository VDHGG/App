import { describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { ChangePasswordService } from '@usecase/ChangePassword.service';
import { ValidationError } from '@domain/errors/ValidationError';
import type { SystemUserRepository } from '@port/SystemUserRepository.port';

describe('ChangePasswordService', () => {
  it('updates hash when current password is correct', async () => {
    const hash = bcrypt.hashSync('old-secret', 10);
    const updatePasswordHash = vi.fn().mockResolvedValue(undefined);
    const systemUsers: SystemUserRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn().mockResolvedValue({
        userId: 'U1',
        fullName: 'A',
        email: 'a@x.com',
        phone: null,
        roleId: 1,
        passwordHash: hash,
        customerId: null,
        isActive: true,
      }),
      save: vi.fn(),
      updateContactFields: vi.fn(),
      updatePasswordHash,
      findByEmailExcluding: vi.fn().mockResolvedValue(null),
      findByCustomerId: vi.fn().mockResolvedValue(null),
      listForAdmin: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      countActiveAdminsExcluding: vi.fn().mockResolvedValue(0),
      updateAdminFields: vi.fn(),
      updateMirrorFromCustomer: vi.fn(),
    };

    const sut = new ChangePasswordService(systemUsers);
    await sut.execute({
      userId: 'U1',
      currentPassword: 'old-secret',
      newPassword: 'new-secret-ok',
    });

    expect(updatePasswordHash).toHaveBeenCalledTimes(1);
    const [userId, newHash] = updatePasswordHash.mock.calls[0];
    expect(userId).toBe('U1');
    expect(bcrypt.compareSync('new-secret-ok', newHash as string)).toBe(true);
  });

  it('throws when current password is wrong', async () => {
    const hash = bcrypt.hashSync('secret', 10);
    const systemUsers: SystemUserRepository = {
      findByEmail: vi.fn(),
      findById: vi.fn().mockResolvedValue({
        userId: 'U1',
        fullName: 'A',
        email: 'a@x.com',
        phone: null,
        roleId: 1,
        passwordHash: hash,
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

    const sut = new ChangePasswordService(systemUsers);
    await expect(
      sut.execute({
        userId: 'U1',
        currentPassword: 'wrong',
        newPassword: 'new-secret-ok',
      })
    ).rejects.toBeInstanceOf(ValidationError);
    expect(systemUsers.updatePasswordHash).not.toHaveBeenCalled();
  });
});
