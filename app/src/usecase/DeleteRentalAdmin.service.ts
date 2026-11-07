import { NotFoundError } from '@domain/errors/NotFoundError';
import { ValidationError } from '@domain/errors/ValidationError';
import type { CustomerRepository } from '@port/CustomerRepository.port';
import type { RentalRepository } from '@port/RentalRepository.port';
import type { VoucherRepository } from '@port/VoucherRepository.port';
import type { DeleteRentalAdminRequest, DeleteRentalAdminUseCase } from './DeleteRentalAdminUseCase.port';

export class DeleteRentalAdminService implements DeleteRentalAdminUseCase {
  private readonly rentals: RentalRepository;
  private readonly voucherRepository?: VoucherRepository;
  private readonly customerRepository?: CustomerRepository;

  constructor(
    rentals: RentalRepository,
    voucherRepository?: VoucherRepository,
    customerRepository?: CustomerRepository
  ) {
    this.rentals = rentals;
    this.voucherRepository = voucherRepository;
    this.customerRepository = customerRepository;
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
    if (existing.status === 'RESERVED' || existing.status === 'ACTIVE') {
      if (this.customerRepository) {
        const customer = await this.customerRepository.findById(existing.customerId);
        if (customer && customer.currentRentedItems >= existing.totalItems) {
          customer.completeRental(existing.totalItems);
          await this.customerRepository.save(customer);
        }
      }
      if (this.voucherRepository) {
        const match = (existing.note ?? '').match(/Voucher\s+([A-Za-z0-9_-]+)\s+-\d+%/i);
        if (match) {
          await this.voucherRepository.decrementUsedCount(match[1].toUpperCase());
        }
      }
    }
    await this.rentals.deleteById(rentalId);
  }
}
