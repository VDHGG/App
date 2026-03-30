import type { LoginUserRequest } from './LoginUserRequest.dto';
import type { LoginUserResponse } from './LoginUserResponse.dto';

export interface LoginUserUseCase {
  execute(request: LoginUserRequest): Promise<LoginUserResponse>;
}
