import type { UpdateShoeRequest } from './UpdateShoeRequest.dto';
import type { UpdateShoeResponse } from './UpdateShoeResponse.dto';

export interface UpdateShoeUseCase {
  execute(request: UpdateShoeRequest): Promise<UpdateShoeResponse>;
}
