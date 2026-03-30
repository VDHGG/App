import { ConflictError } from '@domain/errors/ConflictError';
import type { AccessTokenService } from '@port/AccessTokenService.port';
import type { IdGenerator } from '@port/IdGenerator.port';
import type { SystemUserRepository } from '@port/SystemUserRepository.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import type { RegisterCustomerUseCase } from '@usecase/RegisterCustomerUseCase.port';
import type { RegisterUserRequest } from './RegisterUserRequest.dto';
import type { LoginUserResponse } from './LoginUserResponse.dto';
import type { RegisterUserUseCase } from './RegisterUserUseCase.port';
import bcrypt from 'bcryptjs';

const USER_ROLE_ID = 1;

export class RegisterUserService implements RegisterUserUseCase {
  private readonly transactionManager: TransactionManager;
  private readonly registerCustomer: RegisterCustomerUseCase;
  private readonly systemUsers: SystemUserRepository;
  private readonly userIdGenerator: IdGenerator;
  private readonly accessTokenService: AccessTokenService;

  constructor(
    transactionManager: TransactionManager,
    registerCustomer: RegisterCustomerUseCase,
    systemUsers: SystemUserRepository,
    userIdGenerator: IdGenerator,
    accessTokenService: AccessTokenService
  ) {
    this.transactionManager = transactionManager;
    this.registerCustomer = registerCustomer;
    this.systemUsers = systemUsers;
    this.userIdGenerator = userIdGenerator;
    this.accessTokenService = accessTokenService;
  }

  async execute(request: RegisterUserRequest): Promise<LoginUserResponse> {
    const email = request.email.trim().toLowerCase();
    const existingUser = await this.systemUsers.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('EMAIL_CONFLICT', 'An account with this email already exists.');
    }

    const passwordHash = bcrypt.hashSync(request.password, 10);

    const { customerId } = await this.transactionManager.runInTransaction(async () => {
      const cust = await this.registerCustomer.execute({
        fullName: request.fullName.trim(),
        email,
        phone: request.phone.trim(),
        rank: undefined,
      });

      await this.systemUsers.save({
        userId: this.userIdGenerator.next(),
        fullName: request.fullName.trim(),
        email,
        phone: request.phone.replace(/[\s().-]/g, '') || null,
        roleId: USER_ROLE_ID,
        passwordHash,
        customerId: cust.customerId,
        isActive: true,
      });

      return { customerId: cust.customerId };
    });

    const user = await this.systemUsers.findByEmail(email);
    if (!user) {
      throw new Error('Registration failed: user record missing after commit.');
    }

    const accessToken = await this.accessTokenService.createAccessToken({
      sub: user.userId,
      role: 'customer',
      customerId,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      role: 'customer',
      customerId,
    };
  }
}
