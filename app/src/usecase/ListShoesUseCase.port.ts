import type { ListShoesRequest } from '@usecase/ListShoesRequest.dto';
import type { ListShoesResponse } from '@usecase/ListShoesResponse.dto';

export interface ListShoesUseCase {
  execute(request?: ListShoesRequest): Promise<ListShoesResponse>;
}
