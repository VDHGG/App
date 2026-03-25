import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { TransactionManager } from '@port/TransactionManager.port';

export type AsyncRouteHandler = (req: Request, res: Response) => Promise<void>;

export function asyncRoute(handler: AsyncRouteHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

export function transactionalRoute(
  transactionManager: TransactionManager,
  handler: AsyncRouteHandler
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    transactionManager.runInTransaction(() => handler(req, res)).catch(next);
  };
}
