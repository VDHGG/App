import { NotFoundError } from '@domain/errors/NotFoundError';
import { ValidationError } from '@domain/errors/ValidationError';
import type { RentalRepository } from '@port/RentalRepository.port';
import type { DeleteRentalAdminRequest, DeleteRentalAdminUseCase } from './DeleteRentalAdminUseCase.port';

export class DeleteRentalAdminService implements DeleteRentalAdminUseCase {
  private readonly rentals: RentalRepository;

  constructor(rentals: RentalRepository) {
    this.rentals = rentals;
  }

  async execute(request: DeleteRentalAdminRequest): Promise<void> {
    const rentalId = request.rentalId?.trim() ?? '';
    if (!rentalId) {
      throw new ValidationError('Rental id is required.');
    }
    const existing = await this.rentals.findById(rentalId);
    if (!existing) {
      throw new NotFoundError('Rental', rentalId);
    }
    await this.rentals.deleteById(rentalId);
  }
}
