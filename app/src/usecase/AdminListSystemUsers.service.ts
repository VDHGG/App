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
    const { roleId, isActive } = request ?? {};

    if (roleId !== undefined || isActive !== undefined) {
      const { items } = await this.systemUsers.listForAdmin({
        limit: 500,
        offset: 0,
        ...(search ? { search } : {}),
      });
      const filtered = items.filter((u) => {
        if (roleId !== undefined && u.roleId !== roleId) return false;
        if (isActive !== undefined && u.isActive !== isActive) return false;
        return true;
      });
      const filteredTotal = filtered.length;
      const pageItems = filtered.slice(offset, offset + pageSize);

      return {
        users: pageItems.map((u) => ({
          userId: u.userId,
          fullName: u.fullName,
          email: u.email,
          phone: u.phone,
          roleId: u.roleId,
          customerId: u.customerId,
          isActive: u.isActive,
        })),
        total: filteredTotal,
        page,
        pageSize,
        totalPages: totalPages(filteredTotal, pageSize),
      };
    }

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
