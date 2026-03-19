import type { ReturnRentalRequest } from '@usecase/ReturnRentalRequest.dto';
import type { ReturnRentalResponse } from '@usecase/ReturnRentalResponse.dto';

export interface ReturnRentalUseCase {
  execute(request: ReturnRentalRequest): Promise<ReturnRentalResponse>;
}
