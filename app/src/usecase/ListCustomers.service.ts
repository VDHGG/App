import type { CustomerRepository } from '@port/CustomerRepository.port';
import type { ListCustomersResponse } from './ListCustomersResponse.dto';
import type { ListCustomersUseCase } from '@usecase/ListCustomersUseCase.port';

export class ListCustomersService implements ListCustomersUseCase {
  private readonly customerRepository: CustomerRepository;

  constructor(customerRepository: CustomerRepository) {
    this.customerRepository = customerRepository;
  }

  async execute(): Promise<ListCustomersResponse> {
    const customers = await this.customerRepository.findAll();

    return {
      customers: customers.map((c) => ({
        customerId: c.id,
        fullName: c.fullName,
        email: c.email,
        rank: c.rank,
        currentRentedItems: c.currentRentedItems,
      })),
    };
  }
}
