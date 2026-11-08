import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { GetRentalUseCase } from '@usecase/GetRentalUseCase.port';
import type { RentalPaymentRepository } from '@port/RentalPaymentRepository.port';
import type { ExpirePendingOnlinePaymentsService } from '@usecase/ExpirePendingOnlinePayments.service';
import { asyncRoute } from './middleware/routeMiddleware';
import {
  buildSandboxFallbackPayUrl,
  momoCreatePayment,
  verifyMomoIpnSignature,
} from '@infra/momo/momoGateway';
import { ValidationError } from '@domain/errors/ValidationError';
import { RateLimitError } from '@domain/errors/RateLimitError';

const CreateBodySchema = z.object({
  rentalId: z.string().min(1),
});

function resolveRequestOrigin(req: Request): string | null {
  const rawOrigin = req.headers.origin;
  if (typeof rawOrigin === 'string' && /^https?:\/\//i.test(rawOrigin)) {
    return rawOrigin.trim().replace(/\/$/, '');
  }
  const rawReferer = req.headers.referer;
  if (typeof rawReferer === 'string' && /^https?:\/\//i.test(rawReferer)) {
    try {
      return new URL(rawReferer).origin;
    } catch {
      // fall through
    }
  }
  const rawHost = req.headers['x-forwarded-host'] ?? req.headers.host;
  const host = Array.isArray(rawHost) ? rawHost[0] : rawHost;
  if (!host) return null;
  const rawProto = req.headers['x-forwarded-proto'];
  const proto =
    (Array.isArray(rawProto) ? rawProto[0] : rawProto) ||
    (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');
  return `${proto.split(',')[0].trim()}://${host.split(',')[0].trim()}`;
}

function isMomoConfigured(): boolean {
  return (
    process.env.MOMO_ENABLED === 'true' &&
    Boolean(process.env.MOMO_ACCESS_KEY?.trim()) &&
    Boolean(process.env.MOMO_SECRET_KEY?.trim()) &&
    Boolean(process.env.MOMO_PARTNER_CODE?.trim())
  );
}

function usdToVnd(usd: number): number {
  const raw = process.env.PAYMENT_USD_TO_VND_RATE?.trim();
  const rate = raw ? Number(raw) : 1;
  const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  const vnd = Math.round(usd * safeRate);
  return Math.max(1000, vnd);
}

function paymentPendingMinutes(): number {
  const n = Number(process.env.PAYMENT_PENDING_MINUTES?.trim() ?? '15');
  if (!Number.isFinite(n)) return 15;
  return Math.min(1440, Math.max(1, Math.floor(n)));
}

function maxMomoAttemptsPerHour(): number {
  const n = Number(process.env.MOMO_MAX_PAYMENT_ATTEMPTS_PER_HOUR?.trim() ?? '5');
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.floor(n));
}

export class MomoPaymentController {
  private readonly getRental: GetRentalUseCase;
  private readonly rentalPayments: RentalPaymentRepository;
  private readonly expirePendingOnlinePayments?: ExpirePendingOnlinePaymentsService;
  private readonly pool?: Pool;

  constructor(
    getRental: GetRentalUseCase,
    rentalPayments: RentalPaymentRepository,
    expirePendingOnlinePayments?: ExpirePendingOnlinePaymentsService,
    pool?: Pool
  ) {
    this.getRental = getRental;
    this.rentalPayments = rentalPayments;
    this.expirePendingOnlinePayments = expirePendingOnlinePayments;
    this.pool = pool;
  }

  routes(
    createGuards: RequestHandler[],
    statusGuards: RequestHandler[] = createGuards,
    adminGuards: RequestHandler[] = statusGuards
  ): Router {
    const router = Router();
    router.get('/payments/momo', ...adminGuards, asyncRoute(this.listAdmin.bind(this)));
    router.post('/payments/momo/create', ...createGuards, asyncRoute(this.create.bind(this)));
    router.get('/payments/momo/status', ...statusGuards, asyncRoute(this.getStatus.bind(this)));
    router.post('/payments/momo/ipn', asyncRoute(this.ipn.bind(this)));
    return router;
  }

  private async listAdmin(req: Request, res: Response): Promise<void> {
    if (this.expirePendingOnlinePayments) {
      await this.expirePendingOnlinePayments.execute().catch(() => undefined);
    }

    const rawStatus = String(req.query['status'] ?? 'ALL').trim().toUpperCase();
    const allowedStatuses = new Set(['ALL', 'PAID', 'PENDING', 'FAILED', 'EXPIRED', 'CANCELLED']);
    if (!allowedStatuses.has(rawStatus)) {
      throw new ValidationError('Invalid payment status filter.');
    }

    const search = String(req.query['search'] ?? '').trim();
    const limit = Math.min(200, Math.max(1, Number(req.query['limit'] ?? 100) || 100));

    if (!this.pool) {
      res.json({
        status: rawStatus,
        search: search || null,
        payments: [],
        total: 0,
        summary: {
          totalTransactions: 0,
          totalPaidAmount: 0,
          totalPaidVnd: 0,
          totalPendingVnd: 0,
          paidCount: 0,
          pendingCount: 0,
          failedCount: 0,
          expiredCount: 0,
          cancelledCount: 0,
          expiredOrFailedCount: 0,
        },
      });
      return;
    }

    const conditions: string[] = [];
    const params: Array<string | number> = [];

    if (rawStatus !== 'ALL') {
      conditions.push('rp.status = ?');
      params.push(rawStatus);
    }

    if (search) {
      const escaped = search.replace(/[\\%_]/g, '\\$&');
      const like = `%${escaped}%`;
      conditions.push(
        '(rp.gateway_order_id LIKE ? OR rp.gateway_trans_id LIKE ? OR rp.rental_id LIKE ? OR rp.customer_id LIKE ? OR c.full_name LIKE ?)'
      );
      params.push(like, like, like, like, like);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit);

    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT rp.*,
              c.full_name AS customer_name,
              c.phone AS customer_phone,
              r.status AS rental_status
       FROM rental_payments rp
       LEFT JOIN customers c ON c.customer_id = rp.customer_id
       LEFT JOIN rentals r ON r.rental_id = rp.rental_id
       ${whereClause}
       ORDER BY rp.created_at DESC, rp.id DESC
       LIMIT ?`,
      params
    );

    const payments = rows.map((row) => ({
      id: Number(row['id']),
      paymentId: Number(row['id']),
      rentalId: String(row['rental_id']),
      rentalStatus: row['rental_status'] ? String(row['rental_status']) : 'RESERVED',
      customerId: String(row['customer_id']),
      customerName: String(row['customer_name'] ?? row['customer_id']),
      customerPhone: String(row['customer_phone'] ?? ''),
      provider: String(row['provider'] ?? 'momo'),
      gatewayOrderId: String(row['gateway_order_id']),
      gatewayRequestId: row['gateway_request_id'] ? String(row['gateway_request_id']) : '',
      gatewayTransId: row['gateway_trans_id'] ? String(row['gateway_trans_id']) : null,
      payUrl: null,
      amountVnd: Number(row['amount_vnd'] ?? 0),
      status: String(row['status']),
      gatewayResultCode: row['gateway_result_code'] ? String(row['gateway_result_code']) : null,
      gatewayMessage: row['gateway_message'] ? String(row['gateway_message']) : null,
      createdAt: new Date(row['created_at']).toISOString(),
      paidAt: row['paid_at'] ? new Date(row['paid_at']).toISOString() : null,
      expiresAt: new Date(row['expires_at']).toISOString(),
    }));

    const summary = {
      totalTransactions: 0,
      totalPaidAmount: 0,
      totalPaidVnd: 0,
      totalPendingVnd: 0,
      paidCount: 0,
      pendingCount: 0,
      failedCount: 0,
      expiredCount: 0,
      cancelledCount: 0,
      expiredOrFailedCount: 0,
    };

    try {
      const [sumRows] = await this.pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total_tx,
                COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount_vnd ELSE 0 END), 0) AS total_paid_vnd,
                COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount_vnd ELSE 0 END), 0) AS total_pending_vnd,
                COALESCE(SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END), 0) AS paid_cnt,
                COALESCE(SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END), 0) AS pending_cnt,
                COALESCE(SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END), 0) AS failed_cnt,
                COALESCE(SUM(CASE WHEN status = 'EXPIRED' THEN 1 ELSE 0 END), 0) AS expired_cnt,
                COALESCE(SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END), 0) AS cancelled_cnt
         FROM rental_payments`
      );
      if (sumRows.length > 0) {
        const s = sumRows[0];
        summary.totalTransactions = Number(s['total_tx'] ?? 0);
        summary.totalPaidAmount = Number(s['total_paid_vnd'] ?? 0);
        summary.totalPaidVnd = summary.totalPaidAmount;
        summary.totalPendingVnd = Number(s['total_pending_vnd'] ?? 0);
        summary.paidCount = Number(s['paid_cnt'] ?? 0);
        summary.pendingCount = Number(s['pending_cnt'] ?? 0);
        summary.failedCount = Number(s['failed_cnt'] ?? 0);
        summary.expiredCount = Number(s['expired_cnt'] ?? 0);
        summary.cancelledCount = Number(s['cancelled_cnt'] ?? 0);
        summary.expiredOrFailedCount =
          summary.failedCount + summary.expiredCount + summary.cancelledCount;
      }
    } catch {
      // ignore
    }

    res.json({
      status: rawStatus,
      search: search || null,
      payments,
      total: payments.length,
      summary,
    });
  }

  private async getStatus(req: Request, res: Response): Promise<void> {
    const rawIds = String(req.query.rentalIds ?? '').trim();
    if (!rawIds) {
      res.json({ payments: {} });
      return;
    }
    const ids = rawIds
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
      .slice(0, 50);

    const auth = req.auth;
    let customerId: string | undefined;
    if (auth?.role === 'customer') {
      if (!auth.customerId) {
        throw new ValidationError('Account is not linked to a customer profile.');
      }
      customerId = auth.customerId;
    }

    if (this.expirePendingOnlinePayments) {
      await this.expirePendingOnlinePayments.execute().catch(() => undefined);
    }

    const payments = await this.rentalPayments.findLatestByRentalIds(ids, customerId);
    res.json({ payments });
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
    const customerId = auth.customerId;

    const rental = await this.getRental.execute({
      rentalId: body.rentalId,
      requestingCustomerId: customerId,
    });

    if (rental.status !== 'RESERVED') {
      throw new ValidationError('Only RESERVED rentals can be paid online.');
    }

    const since = new Date(Date.now() - 60 * 60 * 1000);
    const attempts = await this.rentalPayments.countMomoAttemptsSince(customerId, since);
    if (attempts >= maxMomoAttemptsPerHour()) {
      throw new RateLimitError(
        'PAYMENT_RATE_LIMIT',
        'Too many online payment attempts. Please try again later.'
      );
    }

    await this.rentalPayments.cancelPendingForRental(rental.rentalId);

    const partnerCode = process.env.MOMO_PARTNER_CODE!.trim();
    const accessKey = process.env.MOMO_ACCESS_KEY!.trim();
    const secretKey = process.env.MOMO_SECRET_KEY!.trim();
    const partnerName = process.env.MOMO_PARTNER_NAME?.trim() || 'Rental Shoe';
    const storeId = process.env.MOMO_STORE_ID?.trim() || 'RentalShoeStore';
    const requestType = process.env.MOMO_REQUEST_TYPE?.trim() || 'captureWallet';
    const apiHost = process.env.MOMO_API_HOST?.trim() || 'https://test-payment.momo.vn';
    const apiPath = process.env.MOMO_API_PATH?.trim() || '/v2/gateway/api/create';
    const apiUrl = `${apiHost.replace(/\/$/, '')}${apiPath.startsWith('/') ? '' : '/'}${apiPath}`;

    const reqOrigin = resolveRequestOrigin(req);
    const hasBrowserOriginHeader = Boolean(req.headers.origin || req.headers.referer);
    const frontendEnv = process.env.FRONTEND_ORIGIN?.trim();
    const isLocalBrowserOrigin =
      !process.env.VERCEL &&
      hasBrowserOriginHeader &&
      Boolean(reqOrigin && (reqOrigin.includes('localhost') || reqOrigin.includes('127.0.0.1')));
    const useFrontendEnv =
      !isLocalBrowserOrigin &&
      frontendEnv &&
      !(process.env.VERCEL && frontendEnv.includes('localhost'));
    const frontend = (
      isLocalBrowserOrigin && reqOrigin
        ? reqOrigin
        : useFrontendEnv
          ? frontendEnv
          : reqOrigin || 'http://localhost:5173'
    ).replace(/\/$/, '');
    const redirectUrl = `${frontend}/payment/momo/return`;

    const port = process.env.PORT ?? '3000';
    const apiPublicEnv = process.env.API_PUBLIC_BASE_URL?.trim();
    const useApiPublicEnv =
      apiPublicEnv && !(process.env.VERCEL && apiPublicEnv.includes('localhost'));
    const apiPublic = (useApiPublicEnv ? apiPublicEnv : (reqOrigin || `http://localhost:${port}`)).replace(/\/$/, '');
    const ipnUrl = `${apiPublic}/api/v1/payments/momo/ipn`;

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

    const expiresAt = new Date(Date.now() + paymentPendingMinutes() * 60 * 1000);
    await this.rentalPayments.insertPending({
      rentalId: rental.rentalId,
      customerId,
      provider: 'momo',
      gatewayOrderId: orderId,
      gatewayRequestId: requestId,
      amountVnd,
      expiresAt,
    });

    let finalPayUrl = result.payUrl;
    if (result.payUrl.includes('test-payment.momo.vn')) {
      const sandboxUrl = new URL(
        buildSandboxFallbackPayUrl(
          {
            partnerCode,
            accessKey,
            secretKey,
            orderId,
            requestId,
            orderInfo,
            redirectUrl,
          },
          String(Math.max(0, Math.round(amountVnd)))
        )
      );
      sandboxUrl.searchParams.set('gatewayUrl', result.payUrl);
      finalPayUrl = sandboxUrl.toString();
    }

    res.json({ skipped: false, payUrl: finalPayUrl });
  }

  private async ipn(req: Request, res: Response): Promise<void> {
    const secret = process.env.MOMO_SECRET_KEY?.trim();
    const body = (req.body ?? {}) as Record<string, string | number | undefined>;

    if (!secret) {
      res.status(503).json({ message: 'MoMo IPN is not configured' });
      return;
    }

    const asStrings: Record<string, string | number | undefined> = {};
    for (const [k, v] of Object.entries(body)) {
      asStrings[k] = v;
    }
    if (!verifyMomoIpnSignature(asStrings, secret)) {
      res.status(400).json({ message: 'Invalid MoMo signature' });
      return;
    }

    const orderId = body.orderId != null ? String(body.orderId) : '';
    if (!orderId) {
      res.status(400).json({ message: 'Missing orderId' });
      return;
    }

    const payment = await this.rentalPayments.findByGatewayOrderId(orderId);
    if (!payment) {
      console.warn('[momo ipn] No rental_payment for orderId', orderId);
      res.status(200).json({ resultCode: 0, message: 'Success' });
      return;
    }

    if (payment.status !== 'PENDING') {
      res.status(200).json({ resultCode: 0, message: 'Success' });
      return;
    }

    const amountStr = body.amount != null ? String(body.amount) : '';
    const expectedAmount = String(payment.amountVnd);
    if (amountStr && amountStr !== expectedAmount) {
      console.error('[momo ipn] Amount mismatch', {
        orderId,
        expected: expectedAmount,
        got: amountStr,
      });
      await this.rentalPayments.updateFromIpn(payment.id, {
        status: 'FAILED',
        gatewayResultCode: String(body.resultCode ?? ''),
        gatewayMessage: 'Amount mismatch',
        rawIpnJson: JSON.stringify(body),
      });
      res.status(200).json({ resultCode: 0, message: 'Success' });
      return;
    }

    const rawJson = JSON.stringify(body);
    const ok = body.resultCode === 0 || body.resultCode === '0';

    if (ok) {
      await this.rentalPayments.updateFromIpn(payment.id, {
        status: 'PAID',
        paidAt: new Date(),
        gatewayTransId: body.transId != null ? String(body.transId) : null,
        gatewayResultCode: String(body.resultCode ?? ''),
        gatewayMessage: body.message != null ? String(body.message) : null,
        rawIpnJson: rawJson,
      });
      console.log('[momo ipn] Payment success', {
        orderId,
        transId: body.transId,
        rentalId: payment.rentalId,
      });
    } else {
      await this.rentalPayments.updateFromIpn(payment.id, {
        status: 'FAILED',
        gatewayResultCode: String(body.resultCode ?? ''),
        gatewayMessage: body.message != null ? String(body.message) : null,
        rawIpnJson: rawJson,
      });
      console.log('[momo ipn] Payment failed', {
        resultCode: body.resultCode,
        orderId,
        rentalId: payment.rentalId,
      });
    }

    res.status(200).json({ resultCode: 0, message: 'Success' });
  }
}
