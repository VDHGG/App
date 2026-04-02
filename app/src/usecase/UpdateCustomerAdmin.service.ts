import { ConflictError } from '@domain/errors/ConflictError';
import { NotFoundError } from '@domain/errors/NotFoundError';
import type { CustomerRepository } from '@port/CustomerRepository.port';
import type { SystemUserRepository } from '@port/SystemUserRepository.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import type { UpdateCustomerAdminRequest } from './UpdateCustomerAdminRequest.dto';
import type { UpdateCustomerAdminResponse } from './UpdateCustomerAdminResponse.dto';
import type { UpdateCustomerAdminUseCase } from './UpdateCustomerAdminUseCase.port';

function normalizePhone(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const t = raw.trim();
  if (t.length === 0) return null;
  return t.replace(/[\s().-]/g, '') || null;
}

export class UpdateCustomerAdminService implements UpdateCustomerAdminUseCase {
  private readonly transactionManager: TransactionManager;
  private readonly customers: CustomerRepository;
  private readonly systemUsers: SystemUserRepository;

  constructor(
    transactionManager: TransactionManager,
    customers: CustomerRepository,
    systemUsers: SystemUserRepository
  ) {
    this.transactionManager = transactionManager;
    this.customers = customers;
    this.systemUsers = systemUsers;
  }

  async execute(request: UpdateCustomerAdminRequest): Promise<UpdateCustomerAdminResponse> {
    const emailNorm = request.email.trim().toLowerCase();
    const phoneNorm = normalizePhone(request.phone);

    const customer = await this.customers.findById(request.customerId);
    if (!customer) {
      throw new NotFoundError('Customer', request.customerId);
    }

    const other = await this.customers.findByEmail(emailNorm);
    if (other && other.id !== request.customerId) {
      throw new ConflictError('EMAIL_CONFLICT', 'Another customer already uses this email.');
    }

    await this.transactionManager.runInTransaction(async () => {
      customer.rename(request.fullName.trim());
      customer.changeEmail(emailNorm);
      customer.changePhone(phoneNorm);
      customer.changeRank(request.rank);
      if (request.isActive) {
        customer.activate();
      } else {
        customer.deactivate();
      }
      await this.customers.save(customer);

      const user = await this.systemUsers.findByCustomerId(request.customerId);
      if (user) {
        await this.systemUsers.updateMirrorFromCustomer(user.userId, {
          fullName: request.fullName.trim(),
          email: emailNorm,
          phone: phoneNorm,
          isActive: request.isActive,
        });
      }
    });

    const refreshed = await this.customers.findById(request.customerId);
    if (!refreshed) {
      throw new Error('Customer missing after update.');
    }

    return {
      customerId: refreshed.id,
      fullName: refreshed.fullName,
      email: refreshed.email,
      phone: refreshed.phone,
      rank: refreshed.rank,
      isActive: refreshed.isActive,
      currentRentedItems: refreshed.currentRentedItems,
    };
  }
}
