import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import type { AdminListSystemUsersUseCase } from '@usecase/AdminListSystemUsersUseCase.port';
import type { AdminUpdateSystemUserUseCase } from '@usecase/AdminUpdateSystemUserUseCase.port';
import type { SystemUserRepository } from '@port/SystemUserRepository.port';
import { NotFoundError } from '@domain/errors/NotFoundError';
import {
  AdminUpdateSystemUserBodySchema,
  ListSystemUsersQuerySchema,
} from './adminSystemUser.schema';
import { asyncRoute, transactionalRoute } from './middleware/routeMiddleware';
import type { TransactionManager } from '@port/TransactionManager.port';

export type AdminSystemUserRouteGuards = {
  admin?: RequestHandler[];
};

export class AdminSystemUserController {
  private readonly systemUsers: SystemUserRepository;
  private readonly listUsers: AdminListSystemUsersUseCase;
  private readonly updateUser: AdminUpdateSystemUserUseCase;

  constructor(
    systemUsers: SystemUserRepository,
    listUsers: AdminListSystemUsersUseCase,
    updateUser: AdminUpdateSystemUserUseCase
  ) {
    this.systemUsers = systemUsers;
    this.listUsers = listUsers;
    this.updateUser = updateUser;
  }

  routes(transactionManager: TransactionManager, guards?: AdminSystemUserRouteGuards): Router {
    const router = Router();
    const admin = guards?.admin ?? [];
    router.get('/', ...admin, asyncRoute(this.list.bind(this)));
    router.get('/:userId', ...admin, asyncRoute(this.getById.bind(this)));
    router.patch(
      '/:userId',
      ...admin,
      transactionalRoute(transactionManager, this.patch.bind(this))
    );
    return router;
  }

  private async list(req: Request, res: Response): Promise<void> {
    const query = ListSystemUsersQuerySchema.parse(req.query);
    const result = await this.listUsers.execute({
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
      ...(query.search !== undefined && query.search.trim() !== '' ? { search: query.search.trim() } : {}),
    });
    res.json(result);
  }

  private async getById(req: Request, res: Response): Promise<void> {
    const userId = req.params['userId'] as string;
    const user = await this.systemUsers.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }
    res.json({
      userId: user.userId,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      roleId: user.roleId,
      customerId: user.customerId,
      isActive: user.isActive,
    });
  }

  private async patch(req: Request, res: Response): Promise<void> {
    const userId = req.params['userId'] as string;
    const body = AdminUpdateSystemUserBodySchema.parse(req.body);
    const result = await this.updateUser.execute({
      userId,
      fullName: body.fullName,
      email: body.email,
      phone: body.phone ?? null,
      roleId: body.roleId,
      isActive: body.isActive,
      customerId: body.customerId,
      ...(body.newPassword !== undefined ? { newPassword: body.newPassword } : {}),
    });
    res.json(result);
  }
}
