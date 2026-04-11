export type DeleteCustomerAdminRequest = {
  customerId: string;
};

export interface DeleteCustomerAdminUseCase {
  execute(request: DeleteCustomerAdminRequest): Promise<void>;
}
