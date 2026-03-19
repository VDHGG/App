import type { GetRentalRequest } from '@usecase/GetRentalRequest.dto';
import type { GetRentalResponse } from '@usecase/GetRentalResponse.dto';

export interface GetRentalUseCase {
  execute(request: GetRentalRequest): Promise<GetRentalResponse>;
}
