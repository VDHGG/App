import type { LoginAdminRequest } from './LoginAdminRequest.dto';
import type { LoginAdminResponse } from './LoginAdminResponse.dto';

export interface LoginAdminUseCase {
  execute(request: LoginAdminRequest): Promise<LoginAdminResponse>;
}
