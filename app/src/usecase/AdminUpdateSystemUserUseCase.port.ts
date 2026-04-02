import type { AdminUpdateSystemUserRequest } from './AdminUpdateSystemUserRequest.dto';
import type { AdminUpdateSystemUserResponse } from './AdminUpdateSystemUserResponse.dto';

export interface AdminUpdateSystemUserUseCase {
  execute(request: AdminUpdateSystemUserRequest): Promise<AdminUpdateSystemUserResponse>;
}
