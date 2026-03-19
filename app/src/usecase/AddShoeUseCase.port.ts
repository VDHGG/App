import type { AddShoeRequest } from '@usecase/AddShoeRequest.dto';
import type { AddShoeResponse } from '@usecase/AddShoeResponse.dto';

export interface AddShoeUseCase {
  execute(request: AddShoeRequest): Promise<AddShoeResponse>;
}
