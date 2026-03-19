import type { GetCustomerRequest } from '@usecase/GetCustomerRequest.dto';
import type { GetCustomerResponse } from '@usecase/GetCustomerResponse.dto';

export interface GetCustomerUseCase {
  execute(request: GetCustomerRequest): Promise<GetCustomerResponse>;
}
