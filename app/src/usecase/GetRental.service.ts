import type { RentalRepository } from '@port/RentalRepository.port';
import type { GetRentalRequest } from './GetRentalRequest.dto';
import type { GetRentalResponse } from './GetRentalResponse.dto';
import type { GetRentalUseCase } from '@usecase/GetRentalUseCase.port';
import { NotFoundError } from '@domain/errors/NotFoundError';
import { ValidationError } from '@domain/errors/ValidationError';

export class GetRentalService implements GetRentalUseCase {
  private readonly rentalRepository: RentalRepository;

  constructor(rentalRepository: RentalRepository) {
    this.rentalRepository = rentalRepository;
  }

  async execute(request: GetRentalRequest): Promise<GetRentalResponse> {
    if (!request.rentalId || request.rentalId.trim().length === 0) {
      throw new ValidationError('Rental id is required.');
    }

    const rental = await this.rentalRepository.findById(request.rentalId);

    if (!rental) {
      throw new NotFoundError('Rental', request.rentalId);
    }

    if (request.requestingCustomerId !== undefined) {
      const cid = request.requestingCustomerId.trim();
      if (rental.customerId !== cid) {
        throw new NotFoundError('Rental', request.rentalId);
      }
    }

    return {
      rentalId: rental.id,
      customerId: rental.customerId,
      status: rental.status,
      totalItems: rental.totalItems,
      basePrice: rental.basePrice,
      lateFee: rental.lateFee,
      totalAmount: rental.totalAmount,
      startDate: rental.period.startDate,
      endDate: rental.period.endDate,
      items: rental.items.map((item) => ({
        shoeId: item.shoeId,
        variantId: item.variantId,
        shoeName: item.shoeName,
        size: item.size,
        color: item.color,
        pricePerDay: item.pricePerDay,
        quantity: item.quantity,
      })),
      note: rental.note,
      createdAt: rental.createdAt,
      activatedAt: rental.activatedAt,
      returnedAt: rental.returnedAt,
      cancelledAt: rental.cancelledAt,
    };
  }
}
