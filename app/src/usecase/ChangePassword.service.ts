import { ValidationError } from '@domain/errors/ValidationError';
import type { SystemUserRepository } from '@port/SystemUserRepository.port';
import type { ChangePasswordRequest } from './ChangePasswordRequest.dto';
import type { ChangePasswordUseCase } from './ChangePasswordUseCase.port';
import bcrypt from 'bcryptjs';

export class ChangePasswordService implements ChangePasswordUseCase {
  private readonly systemUsers: SystemUserRepository;

  constructor(systemUsers: SystemUserRepository) {
    this.systemUsers = systemUsers;
  }

  async execute(request: ChangePasswordRequest): Promise<void> {
    const user = await this.systemUsers.findById(request.userId);
    if (!user || !user.isActive) {
      throw new ValidationError('User account not found or inactive.');
    }

    const hash = user.passwordHash?.trim() ?? '';
    if (!hash) {
      throw new ValidationError('This account has no password. Contact support if you need access.');
    }

    if (!bcrypt.compareSync(request.currentPassword, hash)) {
      throw new ValidationError('Current password is incorrect.');
    }

    if (request.currentPassword === request.newPassword) {
      throw new ValidationError('New password must be different from your current password.');
    }

    const newHash = bcrypt.hashSync(request.newPassword, 10);
    await this.systemUsers.updatePasswordHash(request.userId, newHash);
  }
}
