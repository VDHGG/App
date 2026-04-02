import type { SystemUserRepository } from '@port/SystemUserRepository.port';
import { normalizePage, normalizePageSize, totalPages } from '../lib/pagination';
import type { AdminListSystemUsersRequest } from './AdminListSystemUsersRequest.dto';
import type { AdminListSystemUsersResponse } from './AdminListSystemUsersResponse.dto';
import type { AdminListSystemUsersUseCase } from './AdminListSystemUsersUseCase.port';

export class AdminListSystemUsersService implements AdminListSystemUsersUseCase {
  private readonly systemUsers: SystemUserRepository;

  constructor(systemUsers: SystemUserRepository) {
    this.systemUsers = systemUsers;
  }

  async execute(request?: AdminListSystemUsersRequest): Promise<AdminListSystemUsersResponse> {
    const page = normalizePage(request?.page);
    const pageSize = normalizePageSize(request?.pageSize);
    const offset = (page - 1) * pageSize;
    const search = request?.search?.trim() ?? '';

    const { items, total } = await this.systemUsers.listForAdmin({
      limit: pageSize,
      offset,
      ...(search ? { search } : {}),
    });

    return {
      users: items.map((u) => ({
        userId: u.userId,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        roleId: u.roleId,
        customerId: u.customerId,
        isActive: u.isActive,
      })),
      total,
      page,
      pageSize,
      totalPages: totalPages(total, pageSize),
    };
  }
}
