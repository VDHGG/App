import type { ActivateRentalRequest } from '@usecase/ActivateRentalRequest.dto';
import type { ActivateRentalResponse } from '@usecase/ActivateRentalResponse.dto';

export interface ActivateRentalUseCase {
  execute(request: ActivateRentalRequest): Promise<ActivateRentalResponse>;
}
