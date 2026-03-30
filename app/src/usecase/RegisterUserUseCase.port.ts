import type { RegisterUserRequest } from './RegisterUserRequest.dto';
import type { LoginUserResponse } from './LoginUserResponse.dto';

export interface RegisterUserUseCase {
  execute(request: RegisterUserRequest): Promise<LoginUserResponse>;
}
