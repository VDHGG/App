import { UnauthorizedError } from '@domain/errors/UnauthorizedError';
import type { AccessTokenService } from '@port/AccessTokenService.port';
import type { AdminAuthenticator } from '@port/AdminAuthenticator.port';
import type { LoginAdminRequest } from './LoginAdminRequest.dto';
import type { LoginAdminResponse } from './LoginAdminResponse.dto';
import type { LoginAdminUseCase } from './LoginAdminUseCase.port';

export class LoginAdminService implements LoginAdminUseCase {
  private readonly adminAuthenticator: AdminAuthenticator;
  private readonly accessTokenService: AccessTokenService;

  constructor(adminAuthenticator: AdminAuthenticator, accessTokenService: AccessTokenService) {
    this.adminAuthenticator = adminAuthenticator;
    this.accessTokenService = accessTokenService;
  }

  async execute(request: LoginAdminRequest): Promise<LoginAdminResponse> {
    const email = request.email.trim();
    const password = request.password.trim();

    const ok = await this.adminAuthenticator.verifyAdminCredentials(email, password);

    if (!ok) {
      throw new UnauthorizedError(
        'AUTH_INVALID_CREDENTIALS',
        'Invalid email or password.'
      );
    }

    const accessToken = await this.accessTokenService.createAccessToken({
      sub: 'admin',
      role: 'admin',
    });

    return {
      accessToken,
      tokenType: 'Bearer',
    };
  }
}
