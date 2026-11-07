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
    let pendingSend: (() => void) | null = null;
    const origJson = res.json.bind(res);
    const origEnd = res.end.bind(res);

    res.json = ((body?: unknown) => {
      pendingSend = () => {
        origJson(body);
      };
      return res;
    }) as typeof res.json;

    res.end = ((...args: Parameters<typeof origEnd>) => {
      pendingSend = () => {
        origEnd(...args);
      };
      return res;
    }) as typeof res.end;

    transactionManager
      .runInTransaction(async () => {
        await handler(req, res);
      })
      .then(() => {
        res.json = origJson;
        res.end = origEnd;
        if (pendingSend) pendingSend();
      })
      .catch((err) => {
        res.json = origJson;
        res.end = origEnd;
        next(err);
      });
  };
}
