import { Router } from 'express';
import type { Request, Response } from 'express';
import type { LoginAdminUseCase } from '@usecase/LoginAdminUseCase.port';
import { LoginAdminSchema } from './auth.schema';
import { asyncRoute } from './middleware/routeMiddleware';
import type { RequestHandler } from 'express';

export class AuthController {
  private readonly loginAdmin: LoginAdminUseCase;
  private readonly bearerAuth: RequestHandler;

  constructor(loginAdmin: LoginAdminUseCase, bearerAuth: RequestHandler) {
    this.loginAdmin = loginAdmin;
    this.bearerAuth = bearerAuth;
  }

  routes(): Router {
    const router = Router();
    router.post('/login', asyncRoute(this.login.bind(this)));
    router.get('/me', this.bearerAuth, asyncRoute(this.me.bind(this)));
    return router;
  }

  private async login(req: Request, res: Response): Promise<void> {
    const body = LoginAdminSchema.parse(req.body);
    const result = await this.loginAdmin.execute(body);
    res.json(result);
  }

  private async me(req: Request, res: Response): Promise<void> {
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
      return;
    }
    res.json({ sub: auth.sub, role: auth.role });
  }
}
