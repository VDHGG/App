import { NotFoundError } from '@domain/errors/NotFoundError';
import { ValidationError } from '@domain/errors/ValidationError';
import type { RentalRepository } from '@port/RentalRepository.port';
import type { VoucherRepository } from '@port/VoucherRepository.port';
import type { DeleteRentalAdminRequest, DeleteRentalAdminUseCase } from './DeleteRentalAdminUseCase.port';

export class DeleteRentalAdminService implements DeleteRentalAdminUseCase {
  private readonly rentals: RentalRepository;
  private readonly voucherRepository?: VoucherRepository;

  constructor(rentals: RentalRepository, voucherRepository?: VoucherRepository) {
    this.rentals = rentals;
    this.voucherRepository = voucherRepository;
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
    if (
      this.voucherRepository &&
      (existing.status === 'RESERVED' || existing.status === 'ACTIVE')
    ) {
      const match = (existing.note ?? '').match(/Voucher\s+([A-Za-z0-9_-]+)\s+-\d+%/i);
      if (match) {
        await this.voucherRepository.decrementUsedCount(match[1].toUpperCase());
      }
    }
    await this.rentals.deleteById(rentalId);
  }
}
