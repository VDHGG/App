import type { GetShoeRequest } from '@usecase/GetShoeRequest.dto';
import type { GetShoeResponse } from '@usecase/GetShoeResponse.dto';

export interface GetShoeUseCase {
  execute(request: GetShoeRequest): Promise<GetShoeResponse>;
}
