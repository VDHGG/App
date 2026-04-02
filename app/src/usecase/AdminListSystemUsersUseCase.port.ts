import type { AdminListSystemUsersRequest } from './AdminListSystemUsersRequest.dto';
import type { AdminListSystemUsersResponse } from './AdminListSystemUsersResponse.dto';

export interface AdminListSystemUsersUseCase {
  execute(request?: AdminListSystemUsersRequest): Promise<AdminListSystemUsersResponse>;
}
