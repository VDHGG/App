import type { ListShoesResponse } from '@usecase/ListShoesResponse.dto';

export interface ListShoesUseCase {
  execute(): Promise<ListShoesResponse>;
}
