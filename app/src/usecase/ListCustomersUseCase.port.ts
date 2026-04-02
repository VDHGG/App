import type { ListCustomersRequest } from '@usecase/ListCustomersRequest.dto';
import type { ListCustomersResponse } from '@usecase/ListCustomersResponse.dto';

export interface ListCustomersUseCase {
  execute(request?: ListCustomersRequest): Promise<ListCustomersResponse>;
}
