import type { CreateRentalRequest } from '@usecase/CreateRentalRequest.dto';
import type { CreateRentalResponse } from '@usecase/CreateRentalResponse.dto';

export interface CreateRentalUseCase {
  execute(request: CreateRentalRequest): Promise<CreateRentalResponse>;
}
