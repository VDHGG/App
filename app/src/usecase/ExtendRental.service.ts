import type { RentalRepository } from '@port/RentalRepository.port';
import type { RentalAvailabilityChecker } from '@port/RentalAvailabilityChecker.port';
import { NotFoundError } from '@domain/errors/NotFoundError';
import type { RentalStatus } from '@domain/RentalStatus.enum';

export interface ExtendRentalRequest {
  rentalId: string;
  newEndDate: Date;
  note?: string;
  requestingCustomerId?: string;
}

export interface ExtendRentalResponse {
  rentalId: string;
  status: RentalStatus;
  startDate: Date;
  endDate: Date;
  basePrice: number;
  totalAmount: number;
}

export class ExtendRentalService {
  private readonly rentalRepository: RentalRepository;
  private readonly availabilityChecker: RentalAvailabilityChecker;

  constructor(rentalRepository: RentalRepository, availabilityChecker: RentalAvailabilityChecker) {
    this.rentalRepository = rentalRepository;
    this.availabilityChecker = availabilityChecker;
  }

  async execute(req: ExtendRentalRequest): Promise<ExtendRentalResponse> {
    const rental = await this.rentalRepository.findById(req.rentalId);
    if (!rental) {
      throw new NotFoundError('Rental', req.rentalId);
    }

    if (req.requestingCustomerId) {
      rental.assertOwnedBy(req.requestingCustomerId, 'You do not have permission to modify this rental.');
    }

    const extensionPeriod = rental.buildExtensionPeriod(req.newEndDate);
    const sortedItems = [...rental.items].sort((a, b) => a.variantId.localeCompare(b.variantId));
    for (const item of sortedItems) {
      await this.availabilityChecker.ensureVariantAvailable(item.variantId, item.quantity, extensionPeriod);
    }

    rental.extendPeriod(extensionPeriod.endDate, req.note);
    await this.rentalRepository.save(rental);

    return {
      rentalId: rental.id,
      status: rental.status,
      startDate: rental.period.startDate,
      endDate: rental.period.endDate,
      basePrice: rental.basePrice,
      totalAmount: rental.totalAmount,
    };
  }
}
