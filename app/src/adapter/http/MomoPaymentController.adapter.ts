import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import type { GetRentalUseCase } from '@usecase/GetRentalUseCase.port';
import { asyncRoute } from './middleware/routeMiddleware';
import { momoCreatePayment, verifyMomoIpnSignature } from '@infra/momo/momoGateway';
import { ValidationError } from '@domain/errors/ValidationError';

const CreateBodySchema = z.object({
  rentalId: z.string().min(1),
});

function isMomoConfigured(): boolean {
  return (
    process.env.MOMO_ENABLED === 'true' &&
    Boolean(process.env.MOMO_ACCESS_KEY?.trim()) &&
    Boolean(process.env.MOMO_SECRET_KEY?.trim()) &&
    Boolean(process.env.MOMO_PARTNER_CODE?.trim()) &&
    Boolean(process.env.FRONTEND_ORIGIN?.trim())
  );
}

function usdToVnd(usd: number): number {
  const raw = process.env.PAYMENT_USD_TO_VND_RATE?.trim();
  const rate = raw ? Number(raw) : 25000;
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 25000;
  const vnd = Math.round(usd * safeRate);
  return Math.max(1000, vnd);
}

export class MomoPaymentController {
  private readonly getRental: GetRentalUseCase;

  constructor(getRental: GetRentalUseCase) {
    this.getRental = getRental;
  }

  routes(createGuards: RequestHandler[]): Router {
    const router = Router();
    router.post('/payments/momo/create', ...createGuards, asyncRoute(this.create.bind(this)));
    router.post('/payments/momo/ipn', asyncRoute(this.ipn.bind(this)));
    return router;
  }

  private async create(req: Request, res: Response): Promise<void> {
    if (!isMomoConfigured()) {
      res.json({ skipped: true, payUrl: null });
      return;
    }

    const auth = req.auth;
    if (!auth?.customerId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Account is not linked to a customer profile.',
      });
      return;
    }

    const body = CreateBodySchema.parse(req.body);

    const rental = await this.getRental.execute({
      rentalId: body.rentalId,
      requestingCustomerId: auth.customerId,
    });

    if (rental.status !== 'RESERVED') {
      throw new ValidationError('Only RESERVED rentals can be paid online.');
    }

    const partnerCode = process.env.MOMO_PARTNER_CODE!.trim();
    const accessKey = process.env.MOMO_ACCESS_KEY!.trim();
    const secretKey = process.env.MOMO_SECRET_KEY!.trim();
    const partnerName = process.env.MOMO_PARTNER_NAME?.trim() || 'Rental Shoe';
    const storeId = process.env.MOMO_STORE_ID?.trim() || 'RentalShoeStore';
    const requestType = process.env.MOMO_REQUEST_TYPE?.trim() || 'captureWallet';
    const apiHost = process.env.MOMO_API_HOST?.trim() || 'https://test-payment.momo.vn';
    const apiPath = process.env.MOMO_API_PATH?.trim() || '/v2/gateway/api/create';
    const apiUrl = `${apiHost.replace(/\/$/, '')}${apiPath.startsWith('/') ? '' : '/'}${apiPath}`;

    const frontend = process.env.FRONTEND_ORIGIN!.replace(/\/$/, '');
    const redirectUrl = `${frontend}/payment/momo/return`;

    const port = process.env.PORT ?? '3000';
    const apiPublic =
      process.env.API_PUBLIC_BASE_URL?.trim() || `http://localhost:${port}`;
    const ipnUrl = `${apiPublic.replace(/\/$/, '')}/api/v1/payments/momo/ipn`;

    const orderId = `RS${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
    const requestId = orderId;
    const orderInfo = `Rental ${rental.rentalId}`.slice(0, 240);
    const amountVnd = usdToVnd(rental.totalAmount);

    const result = await momoCreatePayment({
      partnerCode,
      accessKey,
      secretKey,
      partnerName,
      storeId,
      orderId,
      requestId,
      amountVnd,
      orderInfo,
      redirectUrl,
      ipnUrl,
      requestType,
      apiUrl,
    });

    if (!result.ok) {
      res.status(502).json({
        error: 'PAYMENT_GATEWAY_ERROR',
        message: result.message,
        details: { resultCode: result.resultCode },
      });
      return;
    }

    res.json({ skipped: false, payUrl: result.payUrl });
  }

  private async ipn(req: Request, res: Response): Promise<void> {
    const secret = process.env.MOMO_SECRET_KEY?.trim();
    const body = req.body as Record<string, string | number | undefined>;

    if (secret && Object.keys(body).length > 0) {
      const asStrings: Record<string, string | number | undefined> = {};
      for (const [k, v] of Object.entries(body)) {
        asStrings[k] = v;
      }
      if (!verifyMomoIpnSignature(asStrings, secret)) {
        res.status(400).json({ message: 'Invalid MoMo signature' });
        return;
      }
    }

    if (body.resultCode === 0 || body.resultCode === '0') {
      console.log('[momo ipn] Payment success', {
        orderId: body.orderId,
        transId: body.transId,
        amount: body.amount,
      });
    } else {
      console.log('[momo ipn] Payment notification', {
        resultCode: body.resultCode,
        message: body.message,
        orderId: body.orderId,
      });
    }

    res.status(200).json({ resultCode: 0, message: 'Success' });
  }
}
