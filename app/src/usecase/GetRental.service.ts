import type { RentalRepository } from '@port/RentalRepository.port';
import type { GetRentalRequest } from './GetRentalRequest.dto';
import type { GetRentalResponse } from './GetRentalResponse.dto';
import type { GetRentalUseCase } from '@usecase/GetRentalUseCase.port';
import { NotFoundError } from '@domain/errors/NotFoundError';
import { ValidationError } from '@domain/errors/ValidationError';

function getVietnamTodayDate(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === 'year')?.value ?? now.getFullYear());
  const m = Number(parts.find((p) => p.type === 'month')?.value ?? now.getMonth() + 1);
  const d = Number(parts.find((p) => p.type === 'day')?.value ?? now.getDate());
  return new Date(y, m - 1, d);
}

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

    const now = getVietnamTodayDate();
    const isOverdue = rental.isOverdue(now);
    const endNorm = new Date(
      rental.period.endDate.getFullYear(),
      rental.period.endDate.getMonth(),
      rental.period.endDate.getDate()
    ).getTime();
    const nowNorm = now.getTime();
    const overdueDays = isOverdue ? Math.max(0, Math.floor((nowNorm - endNorm) / 86400000)) : 0;
    const dailyRate = rental.basePrice / rental.period.durationInDays;
    const estimatedLateFee = isOverdue ? Math.round(overdueDays * dailyRate * 0.5) : rental.lateFee;

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
      isOverdue,
      overdueDays,
      estimatedLateFee,
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
