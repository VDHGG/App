import type { RentalRepository } from '@port/RentalRepository.port';
import type { RentalAvailabilityChecker } from '@port/RentalAvailabilityChecker.port';
import { RentalPeriod } from '@domain/RentalPeriod.vo';
import { NotFoundError } from '@domain/errors/NotFoundError';
import { ForbiddenError } from '@domain/errors/ForbiddenError';
import { ValidationError } from '@domain/errors/ValidationError';
import { BusinessRuleError } from '@domain/errors/BusinessRuleError';
import { RentalStatus } from '@domain/RentalStatus.enum';

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

    if (req.requestingCustomerId && rental.customerId !== req.requestingCustomerId) {
      throw new ForbiddenError('FORBIDDEN', 'You do not have permission to modify this rental.');
    }

    if (rental.status !== RentalStatus.RESERVED && rental.status !== RentalStatus.ACTIVE) {
      throw new BusinessRuleError(
        'INVALID_RENTAL_STATE',
        `Only RESERVED or ACTIVE rental can be extended. Current status: ${rental.status}.`
      );
    }

    const oldEnd = rental.period.endDate;
    const oldEndNorm = new Date(oldEnd.getFullYear(), oldEnd.getMonth(), oldEnd.getDate());
    const newEndNorm = new Date(
      req.newEndDate.getFullYear(),
      req.newEndDate.getMonth(),
      req.newEndDate.getDate()
    );
    if (newEndNorm.getTime() <= oldEndNorm.getTime()) {
      throw new ValidationError('New return date must be after current return date.');
    }
    const extStart = new Date(
      oldEndNorm.getFullYear(),
      oldEndNorm.getMonth(),
      oldEndNorm.getDate() + 1
    );
    const extensionPeriod = new RentalPeriod(extStart, newEndNorm);
    for (const item of rental.items) {
      await this.availabilityChecker.ensureVariantAvailable(item.variantId, item.quantity, extensionPeriod);
    }

    rental.extendPeriod(newEndNorm, req.note);
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
