import { ConflictError } from '@domain/errors/ConflictError';
import type { AccessTokenService } from '@port/AccessTokenService.port';
import type { CustomerRepository } from '@port/CustomerRepository.port';
import type { IdGenerator } from '@port/IdGenerator.port';
import type { SystemUserRepository } from '@port/SystemUserRepository.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import type { RegisterCustomerUseCase } from '@usecase/RegisterCustomerUseCase.port';
import type { RegisterUserRequest } from './RegisterUserRequest.dto';
import type { LoginUserResponse } from './LoginUserResponse.dto';
import type { RegisterUserUseCase } from './RegisterUserUseCase.port';
import bcrypt from 'bcryptjs';

const USER_ROLE_ID = 1;

function normalizeFullName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function normalizeSignupPhone(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const digits = t.replace(/[\s().-]/g, '');
  return digits.length > 0 ? digits : null;
}

export class RegisterUserService implements RegisterUserUseCase {
  private readonly transactionManager: TransactionManager;
  private readonly customerRepository: CustomerRepository;
  private readonly registerCustomer: RegisterCustomerUseCase;
  private readonly systemUsers: SystemUserRepository;
  private readonly userIdGenerator: IdGenerator;
  private readonly accessTokenService: AccessTokenService;

  constructor(
    transactionManager: TransactionManager,
    customerRepository: CustomerRepository,
    registerCustomer: RegisterCustomerUseCase,
    systemUsers: SystemUserRepository,
    userIdGenerator: IdGenerator,
    accessTokenService: AccessTokenService
  ) {
    this.transactionManager = transactionManager;
    this.customerRepository = customerRepository;
    this.registerCustomer = registerCustomer;
    this.systemUsers = systemUsers;
    this.userIdGenerator = userIdGenerator;
    this.accessTokenService = accessTokenService;
  }

  async execute(request: RegisterUserRequest): Promise<LoginUserResponse> {
    const email = request.email.trim().toLowerCase();
    const fullName = normalizeFullName(request.fullName);
    const phoneForUser = normalizeSignupPhone(request.phone);

    const existingUser = await this.systemUsers.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('EMAIL_CONFLICT', 'An account with this email already exists.');
    }

    const passwordHash = bcrypt.hashSync(request.password, 10);

    const { customerId } = await this.transactionManager.runInTransaction(async () => {
      const existingCustomer = await this.customerRepository.findByEmail(email);

      if (existingCustomer) {
        existingCustomer.rename(fullName);
        existingCustomer.changePhone(phoneForUser);
        await this.customerRepository.save(existingCustomer);

        await this.systemUsers.save({
          userId: this.userIdGenerator.next(),
          fullName,
          email,
          phone: phoneForUser,
          roleId: USER_ROLE_ID,
          passwordHash,
          customerId: existingCustomer.id,
          isActive: true,
        });

        return { customerId: existingCustomer.id };
      }

      const cust = await this.registerCustomer.execute({
        fullName,
        email,
        phone: request.phone.trim(),
        rank: undefined,
      });

      await this.systemUsers.save({
        userId: this.userIdGenerator.next(),
        fullName,
        email,
        phone: phoneForUser,
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
