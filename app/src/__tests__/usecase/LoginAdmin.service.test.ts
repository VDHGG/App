import { describe, expect, it, vi } from 'vitest';
import { LoginAdminService } from '@usecase/LoginAdmin.service';
import { UnauthorizedError } from '@domain/errors/UnauthorizedError';
import type { AccessTokenService } from '@port/AccessTokenService.port';
import type { AdminAuthenticator } from '@port/AdminAuthenticator.port';

describe('LoginAdminService', () => {
  it('returns access token when credentials are valid', async () => {
    const adminAuthenticator: AdminAuthenticator = {
      verifyAdminCredentials: vi.fn().mockResolvedValue(true),
    };
    const accessTokenService: AccessTokenService = {
      createAccessToken: vi.fn().mockResolvedValue('signed-jwt'),
      verifyAccessToken: vi.fn(),
    };

    const sut = new LoginAdminService(adminAuthenticator, accessTokenService);
    const result = await sut.execute({ email: 'a@b.com', password: 'secret' });

    expect(result).toEqual({ accessToken: 'signed-jwt', tokenType: 'Bearer' });
    expect(adminAuthenticator.verifyAdminCredentials).toHaveBeenCalledWith('a@b.com', 'secret');
    expect(accessTokenService.createAccessToken).toHaveBeenCalledWith({
      sub: 'admin',
      role: 'admin',
    });
  });

  it('throws UnauthorizedError when credentials are invalid', async () => {
    const adminAuthenticator: AdminAuthenticator = {
      verifyAdminCredentials: vi.fn().mockResolvedValue(false),
    };
    const accessTokenService: AccessTokenService = {
      createAccessToken: vi.fn(),
      verifyAccessToken: vi.fn(),
    };

    const sut = new LoginAdminService(adminAuthenticator, accessTokenService);

    await expect(sut.execute({ email: 'a@b.com', password: 'wrong' })).rejects.toBeInstanceOf(
      UnauthorizedError
    );
    expect(accessTokenService.createAccessToken).not.toHaveBeenCalled();
  });
});
