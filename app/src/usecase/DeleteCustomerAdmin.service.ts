import { NotFoundError } from '@domain/errors/NotFoundError';
import { ValidationError } from '@domain/errors/ValidationError';
import type { CustomerRepository } from '@port/CustomerRepository.port';
import type { RentalRepository } from '@port/RentalRepository.port';
import type { SystemUserRepository } from '@port/SystemUserRepository.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import type { DeleteCustomerAdminRequest } from './DeleteCustomerAdminUseCase.port';
import type { DeleteCustomerAdminUseCase } from './DeleteCustomerAdminUseCase.port';

export class DeleteCustomerAdminService implements DeleteCustomerAdminUseCase {
  private readonly transactionManager: TransactionManager;
  private readonly customers: CustomerRepository;
  private readonly rentals: RentalRepository;
  private readonly systemUsers: SystemUserRepository;

  constructor(
    transactionManager: TransactionManager,
    customers: CustomerRepository,
    rentals: RentalRepository,
    systemUsers: SystemUserRepository
  ) {
    this.transactionManager = transactionManager;
    this.customers = customers;
    this.rentals = rentals;
    this.systemUsers = systemUsers;
  }

  async execute(request: DeleteCustomerAdminRequest): Promise<void> {
    const customerId = request.customerId?.trim() ?? '';
    if (!customerId) {
      throw new ValidationError('Customer id is required.');
    }
    const existing = await this.customers.findById(customerId);
    if (!existing) {
      throw new NotFoundError('Customer', customerId);
    }

    await this.transactionManager.runInTransaction(async () => {
      await this.rentals.deleteByCustomerId(customerId);
      await this.systemUsers.unlinkCustomerLinks(customerId);
      await this.customers.deleteById(customerId);
    });
  }
}
