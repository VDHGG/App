import { UnauthorizedError } from '@domain/errors/UnauthorizedError';
import type { AccessTokenService } from '@port/AccessTokenService.port';
import type { AuthRole } from '@port/AccessTokenService.port';
import type { SystemUserRepository } from '@port/SystemUserRepository.port';
import type { LoginUserRequest } from './LoginUserRequest.dto';
import type { LoginUserResponse } from './LoginUserResponse.dto';
import type { LoginUserUseCase } from './LoginUserUseCase.port';
import bcrypt from 'bcryptjs';

function roleIdToAuthRole(roleId: number): AuthRole {
  if (roleId === 2) return 'admin';
  return 'customer';
}

export class LoginUserService implements LoginUserUseCase {
  private readonly systemUsers: SystemUserRepository;
  private readonly accessTokenService: AccessTokenService;

  constructor(systemUsers: SystemUserRepository, accessTokenService: AccessTokenService) {
    this.systemUsers = systemUsers;
    this.accessTokenService = accessTokenService;
  }

  async execute(request: LoginUserRequest): Promise<LoginUserResponse> {
    const email = request.email.trim().toLowerCase();
    const password = request.password;

    const user = await this.systemUsers.findByEmail(email);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const hash = user.passwordHash?.trim() ?? '';
    if (!hash || !bcrypt.compareSync(password, hash)) {
      throw new UnauthorizedError('AUTH_INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    const role = roleIdToAuthRole(user.roleId);
    const tokenPayload = {
      sub: user.userId,
      role,
      ...(user.customerId ? { customerId: user.customerId } : {}),
    };

    const accessToken = await this.accessTokenService.createAccessToken(tokenPayload);

    return {
      accessToken,
      tokenType: 'Bearer',
      role,
      customerId: user.customerId,
    };
  }
}
