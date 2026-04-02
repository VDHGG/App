import type { CustomerRepository } from '@port/CustomerRepository.port';
import type { RentalRepository } from '@port/RentalRepository.port';
import type { CancelRentalRequest } from './CancelRentalRequest.dto';
import type { CancelRentalResponse } from './CancelRentalResponse.dto';
import type { CancelRentalUseCase } from '@usecase/CancelRentalUseCase.port';
import { ValidationError } from '@domain/errors/ValidationError';
import { NotFoundError } from '@domain/errors/NotFoundError';
import { ForbiddenError } from '@domain/errors/ForbiddenError';

export class CancelRentalService implements CancelRentalUseCase {
  private readonly rentalRepository: RentalRepository;
  private readonly customerRepository: CustomerRepository;

  constructor(rentalRepository: RentalRepository, customerRepository: CustomerRepository) {
    this.rentalRepository = rentalRepository;
    this.customerRepository = customerRepository;
  }

  async execute(request: CancelRentalRequest): Promise<CancelRentalResponse> {
    if (!request.rentalId || request.rentalId.trim().length === 0) {
      throw new ValidationError('Rental id is required.');
    }

    const rental = await this.rentalRepository.findById(request.rentalId);

    if (!rental) {
      throw new NotFoundError('Rental', request.rentalId);
    }

    const totalItems = rental.totalItems;
    const cancelledAt = request.cancelledAt ?? new Date();

    if (request.requestingCustomerId !== undefined) {
      const cid = request.requestingCustomerId.trim();
      if (cid.length === 0) {
        throw new ValidationError('Customer id is required for this operation.');
      }
      if (rental.customerId !== cid) {
        throw new ForbiddenError('FORBIDDEN', 'You cannot cancel this rental.');
      }
      rental.assertCustomerCancellationAllowed(cancelledAt);
    }

    rental.cancel(cancelledAt, request.note);

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
      cancelledAt: rental.cancelledAt as Date,
    };
  }
}
