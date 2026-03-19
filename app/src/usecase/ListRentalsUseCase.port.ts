import type { ListRentalsRequest } from '@usecase/ListRentalsRequest.dto';
import type { ListRentalsResponse } from '@usecase/ListRentalsResponse.dto';

export interface ListRentalsUseCase {
  execute(request?: ListRentalsRequest): Promise<ListRentalsResponse>;
}
