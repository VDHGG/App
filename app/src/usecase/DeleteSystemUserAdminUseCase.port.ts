export type DeleteSystemUserAdminRequest = {
  userId: string;
  requestingUserId: string;
};

export interface DeleteSystemUserAdminUseCase {
  execute(request: DeleteSystemUserAdminRequest): Promise<void>;
}
