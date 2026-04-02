import bcrypt from 'bcryptjs';
import { BusinessRuleError } from '@domain/errors/BusinessRuleError';
import { ConflictError } from '@domain/errors/ConflictError';
import { NotFoundError } from '@domain/errors/NotFoundError';
import { ValidationError } from '@domain/errors/ValidationError';
import type { CustomerRepository } from '@port/CustomerRepository.port';
import type { SystemUserRepository } from '@port/SystemUserRepository.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import type { AdminUpdateSystemUserRequest } from './AdminUpdateSystemUserRequest.dto';
import type { AdminUpdateSystemUserResponse } from './AdminUpdateSystemUserResponse.dto';
import type { AdminUpdateSystemUserUseCase } from './AdminUpdateSystemUserUseCase.port';

const ADMIN_ROLE_ID = 2;

function normalizePhone(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  return t.replace(/[\s().-]/g, '') || null;
}

export class AdminUpdateSystemUserService implements AdminUpdateSystemUserUseCase {
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

  async execute(request: AdminUpdateSystemUserRequest): Promise<AdminUpdateSystemUserResponse> {
    const emailNorm = request.email.trim().toLowerCase();
    const phoneNorm = normalizePhone(request.phone);
    const fullName = request.fullName.trim();

    const current = await this.systemUsers.findById(request.userId);
    if (!current) {
      throw new NotFoundError('User', request.userId);
    }

    const otherUser = await this.systemUsers.findByEmailExcluding(emailNorm, request.userId);
    if (otherUser) {
      throw new ConflictError('EMAIL_CONFLICT', 'Another account already uses this email.');
    }

    const wasActiveAdmin = current.roleId === ADMIN_ROLE_ID && current.isActive;
    const willBeActiveAdmin = request.roleId === ADMIN_ROLE_ID && request.isActive;
    if (wasActiveAdmin && !willBeActiveAdmin) {
      const otherAdmins = await this.systemUsers.countActiveAdminsExcluding(request.userId);
      if (otherAdmins < 1) {
        throw new BusinessRuleError(
          'LAST_ADMIN',
          'At least one active admin account must remain in the system.'
        );
      }
    }

    if (request.customerId) {
      const cust = await this.customers.findById(request.customerId);
      if (!cust) {
        throw new ValidationError('Linked customer id was not found.');
      }
      const otherCustomer = await this.customers.findByEmail(emailNorm);
      if (otherCustomer && otherCustomer.id !== request.customerId) {
        throw new ConflictError(
          'EMAIL_CONFLICT',
          'This email belongs to a different customer profile.'
        );
      }
    }

    const passwordHash =
      request.newPassword && request.newPassword.trim().length > 0
        ? bcrypt.hashSync(request.newPassword.trim(), 10)
        : null;

    await this.transactionManager.runInTransaction(async () => {
      await this.systemUsers.updateAdminFields(request.userId, {
        fullName,
        email: emailNorm,
        phone: phoneNorm,
        roleId: request.roleId,
        isActive: request.isActive,
        customerId: request.customerId,
      });

      if (passwordHash) {
        await this.systemUsers.updatePasswordHash(request.userId, passwordHash);
      }

      if (request.customerId) {
        const customer = await this.customers.findById(request.customerId);
        if (!customer) {
          throw new ValidationError('Linked customer profile was not found.');
        }
        customer.rename(fullName);
        customer.changeEmail(emailNorm);
        customer.changePhone(phoneNorm);
        if (request.isActive) {
          customer.activate();
        } else {
          customer.deactivate();
        }
        await this.customers.save(customer);
      }
    });

    const updated = await this.systemUsers.findById(request.userId);
    if (!updated) {
      throw new Error('User missing after update.');
    }

    return {
      user: {
        userId: updated.userId,
        fullName: updated.fullName,
        email: updated.email,
        phone: updated.phone,
        roleId: updated.roleId,
        customerId: updated.customerId,
        isActive: updated.isActive,
      },
    };
  }
}
