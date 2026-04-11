import { BusinessRuleError } from '@domain/errors/BusinessRuleError';
import { NotFoundError } from '@domain/errors/NotFoundError';
import { ValidationError } from '@domain/errors/ValidationError';
import type { SystemUserRepository } from '@port/SystemUserRepository.port';
import type { DeleteSystemUserAdminRequest } from './DeleteSystemUserAdminUseCase.port';
import type { DeleteSystemUserAdminUseCase } from './DeleteSystemUserAdminUseCase.port';

const ADMIN_ROLE_ID = 2;

export class DeleteSystemUserAdminService implements DeleteSystemUserAdminUseCase {
  private readonly systemUsers: SystemUserRepository;

  constructor(systemUsers: SystemUserRepository) {
    this.systemUsers = systemUsers;
  }

  async execute(request: DeleteSystemUserAdminRequest): Promise<void> {
    const userId = request.userId?.trim() ?? '';
    const requestingUserId = request.requestingUserId?.trim() ?? '';
    if (!userId) {
      throw new ValidationError('User id is required.');
    }
    if (!requestingUserId) {
      throw new ValidationError('Requesting user id is required.');
    }
    if (userId === requestingUserId) {
      throw new ValidationError('You cannot delete your own account.');
    }

    const user = await this.systemUsers.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    if (user.roleId === ADMIN_ROLE_ID && user.isActive) {
      const otherActiveAdmins = await this.systemUsers.countActiveAdminsExcluding(userId);
      if (otherActiveAdmins < 1) {
        throw new BusinessRuleError(
          'LAST_ADMIN',
          'At least one active admin account must remain in the system.'
        );
      }
    }

    await this.systemUsers.deleteById(userId);
  }
}
