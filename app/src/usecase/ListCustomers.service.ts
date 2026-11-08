import type { CustomerRepository } from '@port/CustomerRepository.port';
import { normalizePage, normalizePageSize, totalPages } from '../lib/pagination';
import type { ListCustomersRequest } from './ListCustomersRequest.dto';
import type { ListCustomersResponse } from './ListCustomersResponse.dto';
import type { ListCustomersUseCase } from '@usecase/ListCustomersUseCase.port';

export class ListCustomersService implements ListCustomersUseCase {
  private readonly customerRepository: CustomerRepository;

  constructor(customerRepository: CustomerRepository) {
    this.customerRepository = customerRepository;
  }

  async execute(request?: ListCustomersRequest): Promise<ListCustomersResponse> {
    const paginate = request?.page !== undefined;
    const page = normalizePage(request?.page);
    const pageSize = normalizePageSize(request?.pageSize);
    const limit = paginate ? pageSize : undefined;
    const offset = paginate ? (page - 1) * pageSize : undefined;

    const { search, rank, isActive } = request ?? {};
    const searchOpt =
      search !== undefined && search.trim() !== '' ? { search: search.trim() } : {};

    if (rank !== undefined || isActive !== undefined) {
      const { items } = await this.customerRepository.findAll(
        Object.keys(searchOpt).length > 0 ? { ...searchOpt } : undefined
      );
      const filtered = items.filter((c) => {
        if (rank !== undefined && c.rank !== rank) return false;
        if (isActive !== undefined && c.isActive !== isActive) return false;
        return true;
      });
      const filteredTotal = filtered.length;
      const pagedItems = paginate
        ? filtered.slice(offset ?? 0, (offset ?? 0) + pageSize)
        : filtered;
      const effectivePageSize = paginate ? pageSize : Math.max(filteredTotal, 1);

      return {
        customers: pagedItems.map((c) => ({
          customerId: c.id,
          fullName: c.fullName,
          email: c.email,
          phone: c.phone,
          rank: c.rank,
          isActive: c.isActive,
          currentRentedItems: c.currentRentedItems,
        })),
        total: filteredTotal,
        page: paginate ? page : 1,
        pageSize: effectivePageSize,
        totalPages: totalPages(filteredTotal, effectivePageSize),
      };
    }

    const { items, total } = await this.customerRepository.findAll(
      limit !== undefined
        ? { limit, offset, ...searchOpt }
        : Object.keys(searchOpt).length > 0
          ? { ...searchOpt }
          : undefined
    );

    const effectivePageSize = paginate ? pageSize : Math.max(total, 1);

    return {
      customers: items.map((c) => ({
        customerId: c.id,
        fullName: c.fullName,
        email: c.email,
        phone: c.phone,
        rank: c.rank,
        isActive: c.isActive,
        currentRentedItems: c.currentRentedItems,
      })),
      total,
      page: paginate ? page : 1,
      pageSize: effectivePageSize,
      totalPages: totalPages(total, effectivePageSize),
    };
  }
}
