import type { ChangePasswordRequest } from './ChangePasswordRequest.dto';

export interface ChangePasswordUseCase {
  execute(request: ChangePasswordRequest): Promise<void>;
}
