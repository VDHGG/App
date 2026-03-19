import type { RentalRepository } from '@port/RentalRepository.port';
import type { ListRentalsRequest } from './ListRentalsRequest.dto';
import type { ListRentalsResponse } from './ListRentalsResponse.dto';
import type { ListRentalsUseCase } from '@usecase/ListRentalsUseCase.port';

export class ListRentalsService implements ListRentalsUseCase {
  private readonly rentalRepository: RentalRepository;

  constructor(rentalRepository: RentalRepository) {
    this.rentalRepository = rentalRepository;
  }

  async execute(request?: ListRentalsRequest): Promise<ListRentalsResponse> {
    const rentals = request?.status
      ? await this.rentalRepository.findByStatus(request.status)
      : await this.rentalRepository.findAll();

    return {
      rentals: rentals.map((r) => ({
        rentalId: r.id,
        customerId: r.customerId,
        status: r.status,
        totalItems: r.totalItems,
        basePrice: r.basePrice,
        totalAmount: r.totalAmount,
        startDate: r.period.startDate,
        endDate: r.period.endDate,
      })),
    };
  }
}
