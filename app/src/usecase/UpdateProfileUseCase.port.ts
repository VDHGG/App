import type { UpdateProfileRequest } from './UpdateProfileRequest.dto';
import type { UpdateProfileResponse } from './UpdateProfileResponse.dto';

export interface UpdateProfileUseCase {
  execute(request: UpdateProfileRequest): Promise<UpdateProfileResponse>;
}
