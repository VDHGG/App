import type { CustomerRepository } from '@port/CustomerRepository.port';
import type { GetCustomerRequest } from './GetCustomerRequest.dto';
import type { GetCustomerResponse } from './GetCustomerResponse.dto';
import type { GetCustomerUseCase } from '@usecase/GetCustomerUseCase.port';
import { NotFoundError } from '@domain/errors/NotFoundError';
import { ValidationError } from '@domain/errors/ValidationError';

export class GetCustomerService implements GetCustomerUseCase {
  private readonly customerRepository: CustomerRepository;

  constructor(customerRepository: CustomerRepository) {
    this.customerRepository = customerRepository;
  }

  async execute(request: GetCustomerRequest): Promise<GetCustomerResponse> {
    if (!request.customerId || request.customerId.trim().length === 0) {
      throw new ValidationError('Customer id is required.');
    }

    const customer = await this.customerRepository.findById(request.customerId);

    if (!customer) {
      throw new NotFoundError('Customer', request.customerId);
    }

    return {
      customerId: customer.id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      rank: customer.rank,
      isActive: customer.isActive,
      currentRentedItems: customer.currentRentedItems,
    };
  }
}
