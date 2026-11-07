import type { CustomerRepository } from '@port/CustomerRepository.port';
import type { RentalRepository } from '@port/RentalRepository.port';
import type { ReturnRentalRequest } from './ReturnRentalRequest.dto';
import type { ReturnRentalResponse } from './ReturnRentalResponse.dto';
import type { ReturnRentalUseCase } from '@usecase/ReturnRentalUseCase.port';
import { ValidationError } from '@domain/errors/ValidationError';
import { NotFoundError } from '@domain/errors/NotFoundError';
import { RentalStatus } from '@domain/RentalStatus.enum';

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

    const customer = await this.customerRepository.findById(rental.customerId);
    const cleanDamageFee = Math.round(request.damageFee ?? 0);

    rental.completeReturn(returnedAt, request.note, request.damageFee ?? 0);

    if (customer) {
      customer.completeRental(totalItems);
    }

    await this.rentalRepository.save(rental);

    if (customer) {
      const returnedList = await this.rentalRepository.findList({
        customerId: customer.id,
        status: RentalStatus.RETURNED,
      });
      const totalSpent = returnedList.items.reduce((sum, r) => sum + r.totalAmount, 0);
      customer.upgradeRankForTotalSpent(totalSpent);

      await this.customerRepository.save(customer);
    }

    return {
      rentalId: rental.id,
      customerId: rental.customerId,
      status: rental.status,
      totalItems,
      basePrice: rental.basePrice,
      lateFee: rental.lateFee,
      damageFee: cleanDamageFee,
      depositAmount: rental.depositAmount,
      totalAmount: rental.totalAmount,
      returnedAt: rental.returnedAt as Date,
    };
  }
}
