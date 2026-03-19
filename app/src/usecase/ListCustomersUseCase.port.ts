import type { ListCustomersResponse } from '@usecase/ListCustomersResponse.dto';

export interface ListCustomersUseCase {
  execute(): Promise<ListCustomersResponse>;
}
