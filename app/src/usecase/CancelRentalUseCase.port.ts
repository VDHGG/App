import type { CancelRentalRequest } from '@usecase/CancelRentalRequest.dto';
import type { CancelRentalResponse } from '@usecase/CancelRentalResponse.dto';

export interface CancelRentalUseCase {
  execute(request: CancelRentalRequest): Promise<CancelRentalResponse>;
}
