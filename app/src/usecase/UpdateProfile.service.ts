import { ConflictError } from '@domain/errors/ConflictError';
import { ValidationError } from '@domain/errors/ValidationError';
import type { AuthRole } from '@port/AccessTokenService.port';
import type { CustomerRepository } from '@port/CustomerRepository.port';
import type { SystemUserRepository } from '@port/SystemUserRepository.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import type { UpdateProfileRequest } from './UpdateProfileRequest.dto';
import type { UpdateProfileResponse } from './UpdateProfileResponse.dto';
import type { UpdateProfileUseCase } from './UpdateProfileUseCase.port';

function roleIdToAuthRole(roleId: number): AuthRole {
  if (roleId === 2) return 'admin';
  return 'customer';
}

function normalizePhone(raw: string): string | null {
  const t = raw.trim();
  if (t.length === 0) return null;
  return t.replace(/[\s().-]/g, '') || null;
}

export class UpdateProfileService implements UpdateProfileUseCase {
  private readonly transactionManager: TransactionManager;
  private readonly systemUsers: SystemUserRepository;
  private readonly customers: CustomerRepository;

  constructor(
    transactionManager: TransactionManager,
    systemUsers: SystemUserRepository,
    customers: CustomerRepository
  ) {
    this.transactionManager = transactionManager;
    this.systemUsers = systemUsers;
    this.customers = customers;
  }

  async execute(request: UpdateProfileRequest): Promise<UpdateProfileResponse> {
    const emailNorm = request.email.trim().toLowerCase();
    const phoneNorm = normalizePhone(request.phone);

    const current = await this.systemUsers.findById(request.userId);
    if (!current || !current.isActive) {
      throw new ValidationError('User account not found or inactive.');
    }

    const otherUser = await this.systemUsers.findByEmail(emailNorm);
    if (otherUser && otherUser.userId !== request.userId) {
      throw new ConflictError('EMAIL_CONFLICT', 'An account with this email already exists.');
    }

    if (current.customerId) {
      const otherCustomer = await this.customers.findByEmail(emailNorm);
      if (otherCustomer && otherCustomer.id !== current.customerId) {
        throw new ConflictError(
          'EMAIL_CONFLICT',
          'This email is already used by another customer profile.'
        );
      }
    }

    await this.transactionManager.runInTransaction(async () => {
      await this.systemUsers.updateContactFields(request.userId, {
        fullName: request.fullName.trim(),
        email: emailNorm,
        phone: phoneNorm,
      });

      if (current.customerId) {
        const customer = await this.customers.findById(current.customerId);
        if (!customer) {
          throw new ValidationError('Linked customer profile was not found.');
        }
        customer.rename(request.fullName.trim());
        customer.changeEmail(emailNorm);
        customer.changePhone(phoneNorm);
        await this.customers.save(customer);
      }
    });

    const updated = await this.systemUsers.findById(request.userId);
    if (!updated) {
      throw new Error('Profile update failed: user record missing after commit.');
    }

    return {
      sub: updated.userId,
      role: roleIdToAuthRole(updated.roleId),
      customerId: updated.customerId,
      fullName: updated.fullName,
      email: updated.email,
      phone: updated.phone,
    };
  }
}
