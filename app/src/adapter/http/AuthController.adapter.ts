import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import type { LoginUserUseCase } from '@usecase/LoginUserUseCase.port';
import type { RegisterUserUseCase } from '@usecase/RegisterUserUseCase.port';
import type { SystemUserRepository } from '@port/SystemUserRepository.port';
import type { CustomerRepository } from '@port/CustomerRepository.port';
import type { TransactionManager } from '@port/TransactionManager.port';
import type { UpdateProfileUseCase } from '@usecase/UpdateProfileUseCase.port';
import type { ChangePasswordUseCase } from '@usecase/ChangePasswordUseCase.port';
import { getDiscountPercentByRank } from '@domain/CustomerRank.enum';
import {
  ChangePasswordSchema,
  LoginBodySchema,
  RegisterUserSchema,
  UpdateProfileSchema,
} from './auth.schema';
import { asyncRoute, transactionalRoute } from './middleware/routeMiddleware';
import rateLimit from 'express-rate-limit';

export function createAuthRateLimiter(): RequestHandler {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'RATE_LIMITED', message: 'Too many attempts. Try again later.' },
  });
}

export class AuthController {
  private readonly loginUser: LoginUserUseCase;
  private readonly registerUser: RegisterUserUseCase;
  private readonly systemUsers: SystemUserRepository;
  private readonly transactionManager: TransactionManager;
  private readonly updateProfile: UpdateProfileUseCase;
  private readonly changePassword: ChangePasswordUseCase;
  private readonly bearerAuth: RequestHandler;
  private readonly customerRepository?: CustomerRepository;

  constructor(
    loginUser: LoginUserUseCase,
    registerUser: RegisterUserUseCase,
    systemUsers: SystemUserRepository,
    transactionManager: TransactionManager,
    updateProfile: UpdateProfileUseCase,
    changePassword: ChangePasswordUseCase,
    bearerAuth: RequestHandler,
    customerRepository?: CustomerRepository
  ) {
    this.loginUser = loginUser;
    this.registerUser = registerUser;
    this.systemUsers = systemUsers;
    this.transactionManager = transactionManager;
    this.updateProfile = updateProfile;
    this.changePassword = changePassword;
    this.bearerAuth = bearerAuth;
    this.customerRepository = customerRepository;
  }

  routes(authLimiter: RequestHandler): Router {
    const router = Router();
    router.post('/login', authLimiter, asyncRoute(this.login.bind(this)));
    router.post('/register', authLimiter, asyncRoute(this.register.bind(this)));
    router.get('/me', this.bearerAuth, asyncRoute(this.me.bind(this)));
    router.patch(
      '/me',
      this.bearerAuth,
      transactionalRoute(this.transactionManager, this.patchMe.bind(this))
    );
    router.post(
      '/change-password',
      authLimiter,
      this.bearerAuth,
      asyncRoute(this.changePasswordHandler.bind(this))
    );
    return router;
  }

  private async login(req: Request, res: Response): Promise<void> {
    const body = LoginBodySchema.parse(req.body);
    const result = await this.loginUser.execute(body);
    res.json(result);
  }

  private async register(req: Request, res: Response): Promise<void> {
    const body = RegisterUserSchema.parse(req.body);
    const result = await this.registerUser.execute(body);
    res.status(201).json(result);
  }

  private async me(req: Request, res: Response): Promise<void> {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
      return;
    }
    const row = await this.systemUsers.findById(auth.sub);
    if (!row || !row.isActive) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'User not found or account disabled.' });
      return;
    }
    const customerId = auth.customerId ?? row.customerId;
    let rank = undefined;
    let rankDiscountPercent = undefined;
    if (customerId && this.customerRepository) {
      const c = await this.customerRepository.findById(customerId);
      if (c) {
        if (!c.isActive) {
          res.status(401).json({ error: 'UNAUTHORIZED', message: 'Customer profile is disabled.' });
          return;
        }
        rank = c.rank;
        rankDiscountPercent = getDiscountPercentByRank(c.rank);
      }
    }

    res.json({
      sub: auth.sub,
      role: auth.role,
      customerId,
      fullName: row.fullName,
      email: row.email,
      phone: row.phone,
      ...(rank !== undefined ? { rank, rankDiscountPercent } : {}),
    });
  }

  private async patchMe(req: Request, res: Response): Promise<void> {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
      return;
    }
    const body = UpdateProfileSchema.parse(req.body);
    const result = await this.updateProfile.execute({
      userId: auth.sub,
      fullName: body.fullName,
      email: body.email,
      phone: body.phone,
    });
    res.json(result);
  }

  private async changePasswordHandler(req: Request, res: Response): Promise<void> {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
      return;
    }
    const body = ChangePasswordSchema.parse(req.body);
    await this.changePassword.execute({
      userId: auth.sub,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
    res.status(204).send();
  }
}
