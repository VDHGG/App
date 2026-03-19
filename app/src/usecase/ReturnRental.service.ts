import type { CustomerRepository } from '@port/CustomerRepository.port';
import type { RentalRepository } from '@port/RentalRepository.port';
import type { ReturnRentalRequest } from './ReturnRentalRequest.dto';
import type { ReturnRentalResponse } from './ReturnRentalResponse.dto';
import type { ReturnRentalUseCase } from '@usecase/ReturnRentalUseCase.port';
import { ValidationError } from '@domain/errors/ValidationError';
import { NotFoundError } from '@domain/errors/NotFoundError';

export class ReturnRentalService implements ReturnRentalUseCase {
  private readonly rentalRepository: RentalRepository;
  private readonly customerRepository: CustomerRepository;

  constructor(rentalRepository: RentalRepository, customerRepository: CustomerRepository) {
    this.rentalRepository = rentalRepository;
    this.customerRepository = customerRepository;
  }

  async execute(request: ReturnRentalRequest): Promise<ReturnRentalResponse> {
    if (!request.rentalId || request.rentalId.trim().length === 0) {
      throw new ValidationError('Rental id is required.');
    }

    const rental = await this.rentalRepository.findById(request.rentalId);

    if (!rental) {
      throw new NotFoundError('Rental', request.rentalId);
    }

    const totalItems = rental.totalItems;
    const returnedAt = request.returnedAt ?? new Date();

    rental.completeReturn(returnedAt, request.note);

    const customer = await this.customerRepository.findById(rental.customerId);

    if (customer) {
      customer.completeRental(totalItems);
      await this.customerRepository.save(customer);
    }

    await this.rentalRepository.save(rental);

    return {
      rentalId: rental.id,
      customerId: rental.customerId,
      status: rental.status,
      totalItems,
      basePrice: rental.basePrice,
      lateFee: rental.lateFee,
      totalAmount: rental.totalAmount,
      returnedAt: rental.returnedAt as Date,
    };
  }
}
