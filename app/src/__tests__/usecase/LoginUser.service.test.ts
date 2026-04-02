import { describe, expect, it, vi } from 'vitest';
import { LoginUserService } from '@usecase/LoginUser.service';
import { UnauthorizedError } from '@domain/errors/UnauthorizedError';
import type { AccessTokenService } from '@port/AccessTokenService.port';
import type { SystemUserRepository } from '@port/SystemUserRepository.port';
import bcrypt from 'bcryptjs';

describe('LoginUserService', () => {
  it('returns access token when credentials are valid', async () => {
    const hash = bcrypt.hashSync('secret', 10);
    const systemUsers: SystemUserRepository = {
      findByEmail: vi.fn().mockResolvedValue({
        userId: 'U1',
        fullName: 'A',
        email: 'a@b.com',
        phone: null,
        roleId: 2,
        passwordHash: hash,
        customerId: null,
        isActive: true,
      }),
      findById: vi.fn(),
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
    const accessTokenService: AccessTokenService = {
      createAccessToken: vi.fn().mockResolvedValue('signed-jwt'),
      verifyAccessToken: vi.fn(),
    };
    const sut = new LoginUserService(systemUsers, accessTokenService);
    const result = await sut.execute({ email: 'a@b.com', password: 'secret' });
    expect(result).toEqual({
      accessToken: 'signed-jwt',
      tokenType: 'Bearer',
      role: 'admin',
      customerId: null,
    });
    expect(accessTokenService.createAccessToken).toHaveBeenCalledWith({
      sub: 'U1',
      role: 'admin',
    });
  });

  it('includes customerId in token for customer role', async () => {
    const hash = bcrypt.hashSync('x', 10);
    const systemUsers: SystemUserRepository = {
      findByEmail: vi.fn().mockResolvedValue({
        userId: 'U2',
        fullName: 'B',
        email: 'c@d.com',
        phone: '090',
        roleId: 1,
        passwordHash: hash,
        customerId: 'C99',
        isActive: true,
      }),
      findById: vi.fn(),
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
    const accessTokenService: AccessTokenService = {
      createAccessToken: vi.fn().mockResolvedValue('tok'),
      verifyAccessToken: vi.fn(),
    };
    const sut = new LoginUserService(systemUsers, accessTokenService);
    await sut.execute({ email: 'c@d.com', password: 'x' });
    expect(accessTokenService.createAccessToken).toHaveBeenCalledWith({
      sub: 'U2',
      role: 'customer',
      customerId: 'C99',
    });
  });

  it('throws when password wrong', async () => {
    const systemUsers: SystemUserRepository = {
      findByEmail: vi.fn().mockResolvedValue({
        userId: 'U1',
        fullName: 'A',
        email: 'a@b.com',
        phone: null,
        roleId: 2,
        passwordHash: bcrypt.hashSync('ok', 10),
        customerId: null,
        isActive: true,
      }),
      findById: vi.fn(),
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
    const accessTokenService: AccessTokenService = {
      createAccessToken: vi.fn(),
      verifyAccessToken: vi.fn(),
    };
    const sut = new LoginUserService(systemUsers, accessTokenService);
    await expect(sut.execute({ email: 'a@b.com', password: 'wrong' })).rejects.toBeInstanceOf(
      UnauthorizedError
    );
  });
});
