export type DeleteRentalAdminRequest = {
  rentalId: string;
};

export interface DeleteRentalAdminUseCase {
  execute(request: DeleteRentalAdminRequest): Promise<void>;
}
