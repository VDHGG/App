import type { RentalRepository } from '@port/RentalRepository.port';
import { normalizePage, normalizePageSize, totalPages } from '../lib/pagination';
import type { ListRentalsRequest } from './ListRentalsRequest.dto';
import type { ListRentalsResponse } from './ListRentalsResponse.dto';
import type { ListRentalsUseCase } from '@usecase/ListRentalsUseCase.port';

export class ListRentalsService implements ListRentalsUseCase {
  private readonly rentalRepository: RentalRepository;

  constructor(rentalRepository: RentalRepository) {
    this.rentalRepository = rentalRepository;
  }

  async execute(request?: ListRentalsRequest): Promise<ListRentalsResponse> {
    const paginate = request?.page !== undefined;
    const page = normalizePage(request?.page);
    const pageSize = normalizePageSize(request?.pageSize);
    const limit = paginate ? pageSize : undefined;
    const offset = paginate ? (page - 1) * pageSize : undefined;

    const { customerId, status, startDateFrom, startDateTo, amountBucket, search } = request ?? {};
    const { items, total } = await this.rentalRepository.findList({
      ...(customerId ? { customerId } : {}),
      ...(status ? { status } : {}),
      ...(startDateFrom ? { startDateFrom } : {}),
      ...(startDateTo ? { startDateTo } : {}),
      ...(amountBucket ? { amountBucket } : {}),
      ...(search !== undefined && search.trim() !== '' ? { search: search.trim() } : {}),
      ...(limit !== undefined ? { limit, offset } : {}),
    });

    const effectivePageSize = paginate ? pageSize : Math.max(total, 1);
    const now = new Date();
    const nowNorm = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    return {
      rentals: items.map((r) => {
        const isOverdue = r.isOverdue(now);
        const endNorm = new Date(
          r.period.endDate.getFullYear(),
          r.period.endDate.getMonth(),
          r.period.endDate.getDate()
        ).getTime();
        const overdueDays = isOverdue ? Math.max(0, Math.floor((nowNorm - endNorm) / 86400000)) : 0;
        const dailyRate = r.basePrice / r.period.durationInDays;
        const estimatedLateFee = isOverdue ? Math.round(overdueDays * dailyRate * 0.5) : r.lateFee;

        return {
          rentalId: r.id,
          customerId: r.customerId,
          status: r.status,
          totalItems: r.totalItems,
          basePrice: r.basePrice,
          totalAmount: r.totalAmount,
          startDate: r.period.startDate,
          endDate: r.period.endDate,
          isOverdue,
          overdueDays,
          estimatedLateFee,
        };
      }),
      total,
      page: paginate ? page : 1,
      pageSize: effectivePageSize,
      totalPages: totalPages(total, effectivePageSize),
    };
  }
}
