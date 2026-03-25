import type { DeactivateShoeRequest } from './DeactivateShoeRequest.dto';
import type { DeactivateShoeResponse } from './DeactivateShoeResponse.dto';

export interface DeactivateShoeUseCase {
  execute(request: DeactivateShoeRequest): Promise<DeactivateShoeResponse>;
}
