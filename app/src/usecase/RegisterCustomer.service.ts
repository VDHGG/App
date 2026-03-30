import { Customer } from '@domain/Customer.aggregate';
import type { CustomerRepository } from '@port/CustomerRepository.port';
import type { IdGenerator } from '@port/IdGenerator.port';
import type { RegisterCustomerRequest } from './RegisterCustomerRequest.dto';
import type { RegisterCustomerResponse } from './RegisterCustomerResponse.dto';
import type { RegisterCustomerUseCase } from '@usecase/RegisterCustomerUseCase.port';
import { ConflictError } from '@domain/errors/ConflictError';

export class RegisterCustomerService implements RegisterCustomerUseCase {
  private readonly customerRepository: CustomerRepository;
  private readonly idGenerator: IdGenerator;

  constructor(customerRepository: CustomerRepository, idGenerator: IdGenerator) {
    this.customerRepository = customerRepository;
    this.idGenerator = idGenerator;
  }

  async execute(request: RegisterCustomerRequest): Promise<RegisterCustomerResponse> {
    const existing = await this.customerRepository.findByEmail(request.email);

    if (existing) {
      throw new ConflictError(
        'EMAIL_CONFLICT',
        `Email ${request.email.trim().toLowerCase()} is already registered.`
      );
    }

    const customer = new Customer({
      id: this.idGenerator.next(),
      fullName: request.fullName,
      email: request.email,
      phone: request.phone,
      rank: request.rank,
    });

    await this.customerRepository.save(customer);

    return {
      customerId: customer.id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      rank: customer.rank,
    };
  }
}
