import type { UpdateCustomerAdminRequest } from './UpdateCustomerAdminRequest.dto';
import type { UpdateCustomerAdminResponse } from './UpdateCustomerAdminResponse.dto';

export interface UpdateCustomerAdminUseCase {
  execute(request: UpdateCustomerAdminRequest): Promise<UpdateCustomerAdminResponse>;
}
