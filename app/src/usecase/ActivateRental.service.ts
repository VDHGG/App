import type { RentalRepository } from '@port/RentalRepository.port';
import type { ActivateRentalRequest } from './ActivateRentalRequest.dto';
import type { ActivateRentalResponse } from './ActivateRentalResponse.dto';
import type { ActivateRentalUseCase } from '@usecase/ActivateRentalUseCase.port';
import { ValidationError } from '@domain/errors/ValidationError';
import { NotFoundError } from '@domain/errors/NotFoundError';

export class ActivateRentalService implements ActivateRentalUseCase {
  private readonly rentalRepository: RentalRepository;

  constructor(rentalRepository: RentalRepository) {
    this.rentalRepository = rentalRepository;
  }

  async execute(request: ActivateRentalRequest): Promise<ActivateRentalResponse> {
    if (!request.rentalId || request.rentalId.trim().length === 0) {
      throw new ValidationError('Rental id is required.');
    }

    const rental = await this.rentalRepository.findById(request.rentalId);

    if (!rental) {
      throw new NotFoundError('Rental', request.rentalId);
    }

    rental.activate(request.activatedAt ?? new Date());

    await this.rentalRepository.save(rental);

    return {
      rentalId: rental.id,
      customerId: rental.customerId,
      status: rental.status,
      activatedAt: rental.activatedAt as Date,
    };
  }
}
