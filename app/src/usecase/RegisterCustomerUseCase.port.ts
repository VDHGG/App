import type { RegisterCustomerRequest } from '@usecase/RegisterCustomerRequest.dto';
import type { RegisterCustomerResponse } from '@usecase/RegisterCustomerResponse.dto';

export interface RegisterCustomerUseCase {
  execute(request: RegisterCustomerRequest): Promise<RegisterCustomerResponse>;
}
