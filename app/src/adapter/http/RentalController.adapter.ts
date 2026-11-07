import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import type { CreateRentalUseCase } from '@usecase/CreateRentalUseCase.port';
import type { ActivateRentalUseCase } from '@usecase/ActivateRentalUseCase.port';
import type { GetRentalUseCase } from '@usecase/GetRentalUseCase.port';
import type { ListRentalsUseCase } from '@usecase/ListRentalsUseCase.port';
import type { ReturnRentalUseCase } from '@usecase/ReturnRentalUseCase.port';
import type { CancelRentalUseCase } from '@usecase/CancelRentalUseCase.port';
import type { DeleteRentalAdminUseCase } from '@usecase/DeleteRentalAdminUseCase.port';
import type { ExtendRentalService } from '@usecase/ExtendRental.service';
import type { ExpirePendingOnlinePaymentsService } from '@usecase/ExpirePendingOnlinePayments.service';
import type { TransactionManager } from '@port/TransactionManager.port';
import type { VoucherRepository } from '@port/VoucherRepository.port';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import {
  CreateRentalSchema,
  ReturnRentalSchema,
  CancelRentalSchema,
  ExtendRentalSchema,
  ListRentalsQuerySchema,
  ListMyRentalsQuerySchema,
} from './rental.schema';
import { asyncRoute, transactionalRoute } from './middleware/routeMiddleware';
import { ValidationError } from '@domain/errors/ValidationError';
import { resolveVoucher } from '@domain/Voucher.vo';

function getVietnamTodayYmd(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? String(now.getFullYear());
  const m = parts.find((p) => p.type === 'month')?.value ?? String(now.getMonth() + 1).padStart(2, '0');
  const d = parts.find((p) => p.type === 'day')?.value ?? String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toRentalYmd(val: Date | string): string {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return getVietnamTodayYmd(parsed);
    }
    return trimmed.slice(0, 10);
  }
  return getVietnamTodayYmd(val);
}

function addDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function formatDdMm(ymd: string): string {
  const [, m, d] = ymd.split('-');
  return `${d}/${m}`;
}

function formatMmYyyy(ym: string): string {
  const [y, m] = ym.split('-');
  return `${m}/${y}`;
}

export type RouteGuards = {
  admin?: RequestHandler[];
  createRental?: RequestHandler[];
  customer?: RequestHandler[];
};

export class RentalController {
  private readonly createRental: CreateRentalUseCase;
  private readonly activateRental: ActivateRentalUseCase;
  private readonly returnRental: ReturnRentalUseCase;
  private readonly cancelRental: CancelRentalUseCase;
  private readonly listRentals: ListRentalsUseCase;
  private readonly getRental: GetRentalUseCase;
  private readonly deleteRentalAdmin: DeleteRentalAdminUseCase;
  private readonly extendRental?: ExtendRentalService;
  private readonly voucherRepository?: VoucherRepository;
  private readonly pool?: Pool;
  private readonly expirePendingOnlinePayments?: ExpirePendingOnlinePaymentsService;

  constructor(
    createRental: CreateRentalUseCase,
    activateRental: ActivateRentalUseCase,
    returnRental: ReturnRentalUseCase,
    cancelRental: CancelRentalUseCase,
    listRentals: ListRentalsUseCase,
    getRental: GetRentalUseCase,
    deleteRentalAdmin: DeleteRentalAdminUseCase,
    extendRental?: ExtendRentalService,
    voucherRepository?: VoucherRepository,
    pool?: Pool,
    expirePendingOnlinePayments?: ExpirePendingOnlinePaymentsService
  ) {
    this.createRental = createRental;
    this.activateRental = activateRental;
    this.returnRental = returnRental;
    this.cancelRental = cancelRental;
    this.listRentals = listRentals;
    this.getRental = getRental;
    this.deleteRentalAdmin = deleteRentalAdmin;
    this.extendRental = extendRental;
    this.voucherRepository = voucherRepository;
    this.pool = pool;
    this.expirePendingOnlinePayments = expirePendingOnlinePayments;
  }

  routes(transactionManager: TransactionManager, guards?: RouteGuards): Router {
    const router = Router();
    const admin = guards?.admin ?? [];
    const createRental = guards?.createRental ?? [];
    const customer = guards?.customer ?? [];
    router.get('/vouchers/validate', ...createRental, asyncRoute(this.validateVoucher.bind(this)));
    router.get('/vouchers/active', ...createRental, asyncRoute(this.listActiveVouchers.bind(this)));
    router.get('/notifications', ...createRental, asyncRoute(this.getNotifications.bind(this)));
    router.get('/stats/overview', ...admin, asyncRoute(this.getStatsOverview.bind(this)));
    router.get('/activity-feed', ...admin, asyncRoute(this.getActivityFeed.bind(this)));
    router.post('/sweep-expired-momo', ...admin, asyncRoute(this.sweepExpiredMomo.bind(this)));
    router.get('/me', ...customer, asyncRoute(this.listMine.bind(this)));
    router.get('/me/:id', ...customer, asyncRoute(this.getMine.bind(this)));
    router.patch(
      '/me/:id/cancel',
      ...customer,
      transactionalRoute(transactionManager, this.cancelMine.bind(this))
    );
    router.patch(
      '/me/:id/extend',
      ...customer,
      transactionalRoute(transactionManager, this.extendMine.bind(this))
    );
    router.get('/', ...admin, asyncRoute(this.list.bind(this)));
    router.get('/:id', ...admin, asyncRoute(this.getById.bind(this)));
    router.post(
      '/',
      ...createRental,
      transactionalRoute(transactionManager, this.create.bind(this))
    );
    router.patch(
      '/:id/activate',
      ...admin,
      transactionalRoute(transactionManager, this.activate.bind(this))
    );
    router.patch(
      '/:id/return',
      ...admin,
      transactionalRoute(transactionManager, this.return.bind(this))
    );
    router.patch(
      '/:id/cancel',
      ...admin,
      transactionalRoute(transactionManager, this.cancel.bind(this))
    );
    router.patch(
      '/:id/extend',
      ...admin,
      transactionalRoute(transactionManager, this.extendAdmin.bind(this))
    );
    router.delete(
      '/:id',
      ...admin,
      transactionalRoute(transactionManager, this.deleteAdmin.bind(this))
    );
    return router;
  }

  private async lazySweepExpiredMomo(): Promise<void> {
    if (this.expirePendingOnlinePayments) {
      await this.expirePendingOnlinePayments.execute().catch(() => undefined);
    }
  }

  private async listMine(req: Request, res: Response): Promise<void> {
    const auth = req.auth;
    if (!auth?.customerId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Account is not linked to a customer profile.',
      });
      return;
    }
    await this.lazySweepExpiredMomo();
    const query = ListMyRentalsQuerySchema.parse(req.query);
    const result = await this.listRentals.execute({
      customerId: auth.customerId,
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
    });
    res.json(result);
  }

  private async getMine(req: Request, res: Response): Promise<void> {
    const auth = req.auth;
    if (!auth?.customerId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Account is not linked to a customer profile.',
      });
      return;
    }
    await this.lazySweepExpiredMomo();
    const result = await this.getRental.execute({
      rentalId: req.params['id'] as string,
      requestingCustomerId: auth.customerId,
    });
    res.json(result);
  }

  private async cancelMine(req: Request, res: Response): Promise<void> {
    const auth = req.auth;
    if (!auth?.customerId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Account is not linked to a customer profile.',
      });
      return;
    }
    const body = CancelRentalSchema.parse(req.body ?? {});
    const result = await this.cancelRental.execute({
      rentalId: req.params['id'] as string,
      cancelledAt: body.cancelledAt,
      note: body.note,
      requestingCustomerId: auth.customerId,
    });
    res.json(result);
  }

  private async list(req: Request, res: Response): Promise<void> {
    await this.lazySweepExpiredMomo();
    const query = ListRentalsQuerySchema.parse(req.query);
    const amountBucket =
      query.amountBucket === undefined || query.amountBucket === 'all' ? undefined : query.amountBucket;

    const result = await this.listRentals.execute({
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(query.startDateFrom ? { startDateFrom: query.startDateFrom } : {}),
      ...(query.startDateTo ? { startDateTo: query.startDateTo } : {}),
      ...(amountBucket ? { amountBucket } : {}),
      ...(query.search !== undefined && query.search.trim() !== '' ? { search: query.search.trim() } : {}),
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
    });
    res.json(result);
  }

  private async getById(req: Request, res: Response): Promise<void> {
    await this.lazySweepExpiredMomo();
    const result = await this.getRental.execute({ rentalId: req.params['id'] as string });
    res.json(result);
  }

  private async create(req: Request, res: Response): Promise<void> {
    const body = CreateRentalSchema.parse(req.body);
    const auth = req.auth;
    if (!auth) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required.' });
      return;
    }

    let customerId = body.customerId;
    if (auth.role === 'customer') {
      if (!auth.customerId) {
        throw new ValidationError('Account is not linked to a customer profile.');
      }
      customerId = auth.customerId;
    }

    const result = await this.createRental.execute({ ...body, customerId });
    res.status(201).json(result);
  }

  private async activate(req: Request, res: Response): Promise<void> {
    const result = await this.activateRental.execute({ rentalId: req.params['id'] as string });
    res.json(result);
  }

  private async return(req: Request, res: Response): Promise<void> {
    const body = ReturnRentalSchema.parse(req.body ?? {});
    const result = await this.returnRental.execute({ rentalId: req.params['id'] as string, ...body });
    res.json(result);
  }

  private async cancel(req: Request, res: Response): Promise<void> {
    const body = CancelRentalSchema.parse(req.body ?? {});
    const result = await this.cancelRental.execute({ rentalId: req.params['id'] as string, ...body });
    res.json(result);
  }

  private async deleteAdmin(req: Request, res: Response): Promise<void> {
    await this.deleteRentalAdmin.execute({ rentalId: req.params['id'] as string });
    res.status(204).end();
  }

  private async extendMine(req: Request, res: Response): Promise<void> {
    const auth = req.auth;
    if (!auth?.customerId) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Account is not linked to a customer profile.',
      });
      return;
    }
    if (!this.extendRental) {
      throw new ValidationError('Extend rental service is not configured.');
    }
    const body = ExtendRentalSchema.parse(req.body);
    const result = await this.extendRental.execute({
      rentalId: req.params['id'] as string,
      newEndDate: body.newEndDate,
      note: body.note,
      requestingCustomerId: auth.customerId,
    });
    res.json(result);
  }

  private async extendAdmin(req: Request, res: Response): Promise<void> {
    if (!this.extendRental) {
      throw new ValidationError('Extend rental service is not configured.');
    }
    const body = ExtendRentalSchema.parse(req.body);
    const result = await this.extendRental.execute({
      rentalId: req.params['id'] as string,
      newEndDate: body.newEndDate,
      note: body.note,
    });
    res.json(result);
  }

  private async validateVoucher(req: Request, res: Response): Promise<void> {
    const code = String(req.query['code'] ?? '').trim();
    if (!code) {
      throw new ValidationError('Voucher code is required.');
    }

    if (this.voucherRepository) {
      const normalized = code.toUpperCase();
      const v = await this.voucherRepository.findByCode(normalized);
      const todayStr = getVietnamTodayYmd();
      const isValid =
        v &&
        v.isActive &&
        (!v.expiresAt || todayStr <= v.expiresAt) &&
        (v.maxUses === null || v.usedCount < v.maxUses);

      if (!isValid) {
        throw new ValidationError('Mã giảm giá không hợp lệ hoặc đã hết hạn.');
      }
      res.json({
        valid: true,
        code: v.code,
        discountPercent: v.discountPercent,
        description: v.description,
      });
      return;
    }

    const voucher = resolveVoucher(code);
    if (!voucher) {
      throw new ValidationError('Mã giảm giá không hợp lệ hoặc đã hết hạn.');
    }
    res.json({
      valid: true,
      code: voucher.code,
      discountPercent: voucher.discountPercent,
      description: voucher.description,
    });
  }

  private async listActiveVouchers(_req: Request, res: Response): Promise<void> {
    const todayStr = getVietnamTodayYmd();
    const vouchers = this.voucherRepository ? await this.voucherRepository.listActive(todayStr) : [];
    res.json({ vouchers });
  }

  private async getNotifications(req: Request, res: Response): Promise<void> {
    const auth = req.auth;
    const todayStr = getVietnamTodayYmd();
    const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
    const nowIso = new Date().toISOString();

    type NotificationItem = {
      id: string;
      type: 'OVERDUE' | 'DUE_SOON' | 'RANK_INFO' | 'VOUCHER' | 'ADMIN_ALERT';
      severity: 'danger' | 'warning' | 'success' | 'info';
      title: string;
      message: string;
      link: string;
      createdAt: string;
    };

    const notifications: NotificationItem[] = [];

    if (auth?.role === 'customer' && auth.customerId) {
      const myRentals = await this.listRentals.execute({
        customerId: auth.customerId,
        page: 1,
        pageSize: 30,
      });

      for (const r of myRentals.rentals) {
        if (r.isOverdue) {
          notifications.push({
            id: `overdue-${r.rentalId}`,
            type: 'OVERDUE',
            severity: 'danger',
            title: 'Đơn thuê quá hạn',
            message: `Đơn #${r.rentalId} đang quá hạn ${r.overdueDays} ngày (phí phạt dự kiến +${r.estimatedLateFee.toLocaleString('vi-VN')}₫).`,
            link: '/account',
            createdAt: nowIso,
          });
        } else if (r.status === 'ACTIVE' || r.status === 'RESERVED') {
          const endYmd = getVietnamTodayYmd(new Date(r.endDate));
          const endMs = new Date(`${endYmd}T00:00:00Z`).getTime();
          const diffDays = Math.round((endMs - todayMs) / 86400000);
          if (diffDays >= 0 && diffDays <= 2) {
            notifications.push({
              id: `due-soon-${r.rentalId}`,
              type: 'DUE_SOON',
              severity: 'warning',
              title: 'Sắp đến hạn trả giày',
              message: `Đơn #${r.rentalId} sắp đến hạn trả vào ngày ${endYmd}.`,
              link: '/account',
              createdAt: nowIso,
            });
          }
        }
      }

      const vouchers = this.voucherRepository ? await this.voucherRepository.listActive(todayStr) : [];
      if (vouchers.length > 0) {
        notifications.push({
          id: `vouchers-${todayStr}`,
          type: 'VOUCHER',
          severity: 'success',
          title: 'Mã giảm giá đang mở',
          message: `Ưu đãi đang mở: ${vouchers
            .slice(0, 3)
            .map((v) => `${v.code} (-${v.discountPercent}%)`)
            .join(', ')}.`,
          link: '/shoes',
          createdAt: nowIso,
        });
      }
    } else if (auth?.role === 'admin') {
      const all = await this.listRentals.execute();
      const overdueCount = all.rentals.filter((r) => r.isOverdue).length;
      const reservedCount = all.rentals.filter((r) => r.status === 'RESERVED').length;
      const activeCount = all.rentals.filter((r) => r.status === 'ACTIVE').length;

      if (overdueCount > 0) {
        notifications.push({
          id: 'admin-overdue',
          type: 'OVERDUE',
          severity: 'danger',
          title: 'Cảnh báo đơn quá hạn',
          message: `Có ${overdueCount} đơn thuê đang quá hạn chưa trả cần xử lý.`,
          link: '/admin/rentals',
          createdAt: nowIso,
        });
      }

      if (reservedCount > 0) {
        notifications.push({
          id: 'admin-reserved',
          type: 'ADMIN_ALERT',
          severity: 'warning',
          title: 'Đơn chờ giao giày',
          message: `Có ${reservedCount} đơn RESERVED đang chờ kích hoạt giao giày.`,
          link: '/admin/rentals',
          createdAt: nowIso,
        });
      }

      notifications.push({
        id: 'admin-active',
        type: 'ADMIN_ALERT',
        severity: 'info',
        title: 'Tình trạng vận hành',
        message: `Hệ thống đang có ${activeCount} đơn ACTIVE đang thuê.`,
        link: '/admin',
        createdAt: nowIso,
      });
    }

    res.json({
      notifications,
      unreadCount: notifications.length,
    });
  }

  private async sweepExpiredMomo(_req: Request, res: Response): Promise<void> {
    if (!this.expirePendingOnlinePayments) {
      res.json({ sweptCount: 0, cancelledRentalIds: [], errors: 0 });
      return;
    }
    const result = await this.expirePendingOnlinePayments.execute();
    res.json({
      sweptCount: result.expired,
      cancelledRentalIds: result.cancelledRentalIds,
      errors: result.errors,
    });
  }

  private async getStatsOverview(req: Request, res: Response): Promise<void> {
    await this.lazySweepExpiredMomo();
    const rawPeriod = String(req.query['period'] ?? 'all').trim();
    const period: '7d' | '30d' | '6m' | 'all' =
      rawPeriod === '7d' || rawPeriod === '30d' || rawPeriod === '6m' ? rawPeriod : 'all';

    const todayStr = getVietnamTodayYmd();
    const [ty, tm] = todayStr.split('-').map(Number);
    const sixMonthsStartDt = new Date(Date.UTC(ty, tm - 1 - 5, 1));
    const cutoff6m = `${sixMonthsStartDt.getUTCFullYear()}-${String(sixMonthsStartDt.getUTCMonth() + 1).padStart(2, '0')}-01`;

    let cutoffYmd: string | null = null;
    if (period === '7d') {
      cutoffYmd = addDaysYmd(todayStr, -6);
    } else if (period === '30d') {
      cutoffYmd = addDaysYmd(todayStr, -29);
    } else if (period === '6m') {
      cutoffYmd = cutoff6m;
    }

    const all = await this.listRentals.execute();
    const rentals =
      cutoffYmd !== null
        ? all.rentals.filter((r) => toRentalYmd(r.startDate) >= cutoffYmd)
        : all.rentals;

    const totalRentals = cutoffYmd !== null ? rentals.length : (all.total ?? rentals.length);
    const statusCounts = {
      RESERVED: 0,
      ACTIVE: 0,
      RETURNED: 0,
      CANCELLED: 0,
    };
    for (const r of rentals) {
      if (r.status in statusCounts) {
        statusCounts[r.status as keyof typeof statusCounts] += 1;
      }
    }

    const overdueCount = rentals.filter((r) => r.isOverdue).length;
    const totalRevenueReturned = rentals
      .filter((r) => r.status === 'RETURNED')
      .reduce((sum, r) => sum + r.totalAmount, 0);
    const activeExpectedRevenue = rentals
      .filter((r) => r.status === 'ACTIVE' || r.status === 'RESERVED')
      .reduce((sum, r) => sum + r.totalAmount, 0);
    const totalLateFeesCollected = rentals
      .filter((r) => r.status === 'RETURNED')
      .reduce((sum, r) => sum + Math.max(0, r.totalAmount - r.basePrice), 0);

    type RevenueBucket = {
      label: string;
      returnedRevenue: number;
      activeRevenue: number;
      totalRevenue: number;
      rentalCount: number;
    };

    const buildBucket = (label: string, matched: typeof rentals): RevenueBucket => {
      const returnedRevenue = matched
        .filter((r) => r.status === 'RETURNED')
        .reduce((sum, r) => sum + r.totalAmount, 0);
      const activeRevenue = matched
        .filter((r) => r.status === 'ACTIVE' || r.status === 'RESERVED')
        .reduce((sum, r) => sum + r.totalAmount, 0);
      const rentalCount = matched.filter((r) => r.status !== 'CANCELLED').length;
      return {
        label,
        returnedRevenue,
        activeRevenue,
        totalRevenue: returnedRevenue + activeRevenue,
        rentalCount,
      };
    };

    let revenueSeries: RevenueBucket[] = [];
    if (period === '7d') {
      for (let i = 6; i >= 0; i--) {
        const dayYmd = addDaysYmd(todayStr, -i);
        const matched = rentals.filter((r) => toRentalYmd(r.startDate) === dayYmd);
        revenueSeries.push(buildBucket(formatDdMm(dayYmd), matched));
      }
    } else if (period === '30d') {
      for (let b = 0; b < 10; b++) {
        const startOffset = -29 + b * 3;
        const endOffset = startOffset + 2;
        const startYmd = addDaysYmd(todayStr, startOffset);
        const endYmd = addDaysYmd(todayStr, endOffset);
        const matched = rentals.filter((r) => {
          const ymd = toRentalYmd(r.startDate);
          return ymd >= startYmd && ymd <= endYmd;
        });
        revenueSeries.push(buildBucket(formatDdMm(endYmd), matched));
      }
    } else {
      const monthKeys: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const dt = new Date(Date.UTC(ty, tm - 1 - i, 1));
        const ym = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
        monthKeys.push(ym);
      }
      revenueSeries = monthKeys.map((ym) => {
        const matched = rentals.filter((r) => toRentalYmd(r.startDate).slice(0, 7) === ym);
        return buildBucket(formatMmYyyy(ym), matched);
      });

      if (
        period === 'all' &&
        revenueSeries.every((b) => b.rentalCount === 0) &&
        rentals.length > 0
      ) {
        const distinctYms = Array.from(
          new Set(rentals.map((r) => toRentalYmd(r.startDate).slice(0, 7)))
        )
          .sort()
          .slice(-6);
        revenueSeries = distinctYms.map((ym) => {
          const matched = rentals.filter((r) => toRentalYmd(r.startDate).slice(0, 7) === ym);
          return buildBucket(formatMmYyyy(ym), matched);
        });
      }
    }

    let momoPaidCount = 0;
    let momoPaidAmountVnd = 0;
    let totalCustomers = 0;
    let topShoes: Array<{
      shoeId: string;
      shoeName: string;
      totalRentalsCount: number;
      totalUnitsRented: number;
      averageRating: number | null;
    }> = [];
    let lowStockVariants: Array<{
      variantId: string;
      shoeId: string;
      shoeName: string;
      size: number;
      color: string;
      totalQuantity: number;
      reservedToday: number;
      availableToday: number;
    }> = [];

    if (this.pool) {
      try {
        const [paymentRows] =
          cutoffYmd !== null
            ? await this.pool.query<RowDataPacket[]>(
                `SELECT COUNT(*) AS cnt, COALESCE(SUM(rp.amount_vnd), 0) AS total_vnd
                 FROM rental_payments rp
                 INNER JOIN rentals r ON r.rental_id = rp.rental_id
                 WHERE rp.status = 'PAID' AND r.start_date >= ?`,
                [cutoffYmd]
              )
            : await this.pool.query<RowDataPacket[]>(
                `SELECT COUNT(*) AS cnt, COALESCE(SUM(amount_vnd), 0) AS total_vnd
                 FROM rental_payments WHERE status = 'PAID'`
              );
        if (paymentRows.length > 0) {
          momoPaidCount = Number(paymentRows[0]['cnt'] || 0);
          momoPaidAmountVnd = Number(paymentRows[0]['total_vnd'] || 0);
        }
      } catch {
        // ignore
      }

      try {
        const [custRows] = await this.pool.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt FROM customers WHERE is_active = 1`
        );
        if (custRows.length > 0) {
          totalCustomers = Number(custRows[0]['cnt'] || 0);
        }
      } catch {
        // ignore
      }

      try {
        const [shoeRows] =
          cutoffYmd !== null
            ? await this.pool.query<RowDataPacket[]>(
                `SELECT
                   ri.shoe_id AS shoeId,
                   MAX(ri.shoe_name) AS shoeName,
                   COUNT(DISTINCT ri.rental_id) AS totalRentalsCount,
                   COALESCE(SUM(ri.quantity), 0) AS totalUnitsRented,
                   (SELECT ROUND(AVG(sr.rating), 1) FROM shoe_reviews sr WHERE sr.shoe_id = ri.shoe_id) AS averageRating
                 FROM rental_items ri
                 INNER JOIN rentals r ON r.rental_id = ri.rental_id
                 WHERE r.status IN ('RESERVED', 'ACTIVE', 'RETURNED') AND r.start_date >= ?
                 GROUP BY ri.shoe_id
                 ORDER BY totalUnitsRented DESC, totalRentalsCount DESC
                 LIMIT 5`,
                [cutoffYmd]
              )
            : await this.pool.query<RowDataPacket[]>(
                `SELECT
                   ri.shoe_id AS shoeId,
                   MAX(ri.shoe_name) AS shoeName,
                   COUNT(DISTINCT ri.rental_id) AS totalRentalsCount,
                   COALESCE(SUM(ri.quantity), 0) AS totalUnitsRented,
                   (SELECT ROUND(AVG(sr.rating), 1) FROM shoe_reviews sr WHERE sr.shoe_id = ri.shoe_id) AS averageRating
                 FROM rental_items ri
                 INNER JOIN rentals r ON r.rental_id = ri.rental_id
                 WHERE r.status IN ('RESERVED', 'ACTIVE', 'RETURNED')
                 GROUP BY ri.shoe_id
                 ORDER BY totalUnitsRented DESC, totalRentalsCount DESC
                 LIMIT 5`
              );
        topShoes = shoeRows.map((row) => ({
          shoeId: String(row['shoeId']),
          shoeName: String(row['shoeName']),
          totalRentalsCount: Number(row['totalRentalsCount'] || 0),
          totalUnitsRented: Number(row['totalUnitsRented'] || 0),
          averageRating: row['averageRating'] !== null ? Number(row['averageRating']) : null,
        }));
      } catch {
        // ignore
      }

      try {
        const [lowStockRows] = await this.pool.query<RowDataPacket[]>(
          `SELECT
             sv.variant_id AS variantId,
             sv.shoe_id AS shoeId,
             s.name AS shoeName,
             sv.size AS size,
             c.name AS color,
             sv.on_hand_quantity AS totalQuantity,
             COALESCE(SUM(CASE WHEN r.rental_id IS NOT NULL THEN ri.quantity ELSE 0 END), 0) AS reservedToday
           FROM shoe_variants sv
           INNER JOIN shoes s ON s.shoe_id = sv.shoe_id
           INNER JOIN colors c ON c.id = sv.color_id
           LEFT JOIN rental_items ri ON ri.variant_id = sv.variant_id
           LEFT JOIN rentals r ON r.rental_id = ri.rental_id
             AND (
               (r.status = 'RESERVED' AND r.start_date <= ? AND r.expected_return_date >= ?)
               OR (r.status = 'ACTIVE' AND r.start_date <= ?)
             )
           WHERE s.is_active = 1
           GROUP BY sv.variant_id, sv.shoe_id, s.name, sv.size, c.name, sv.on_hand_quantity
           HAVING sv.on_hand_quantity <= 2
              OR (sv.on_hand_quantity - COALESCE(SUM(CASE WHEN r.rental_id IS NOT NULL THEN ri.quantity ELSE 0 END), 0)) <= 1
           ORDER BY (sv.on_hand_quantity - COALESCE(SUM(CASE WHEN r.rental_id IS NOT NULL THEN ri.quantity ELSE 0 END), 0)) ASC,
                    sv.on_hand_quantity ASC,
                    s.name ASC
           LIMIT 12`,
          [todayStr, todayStr, todayStr]
        );
        lowStockVariants = lowStockRows.map((row) => {
          const totalQuantity = Number(row['totalQuantity'] || 0);
          const reservedToday = Number(row['reservedToday'] || 0);
          return {
            variantId: String(row['variantId']),
            shoeId: String(row['shoeId']),
            shoeName: String(row['shoeName']),
            size: Number(row['size'] || 0),
            color: String(row['color']),
            totalQuantity,
            reservedToday,
            availableToday: Math.max(0, totalQuantity - reservedToday),
          };
        });
      } catch {
        // ignore
      }
    }

    res.json({
      period,
      totalRentals,
      statusCounts,
      overdueCount,
      totalRevenueReturned,
      activeExpectedRevenue,
      totalLateFeesCollected,
      momoPaidCount,
      momoPaidAmountVnd,
      totalCustomers,
      topShoes,
      lowStockVariants,
      revenueSeries,
    });
  }

  private async getActivityFeed(req: Request, res: Response): Promise<void> {
    await this.lazySweepExpiredMomo();
    const rawTypeInput = String(req.query['type'] ?? 'ALL').trim().toUpperCase();
    const allowedTypes = new Set([
      'ALL',
      'RESERVED',
      'MOMO',
      'MOMO_PAID',
      'MOMO_EXPIRED',
      'ACTIVE',
      'RETURNED',
      'CANCELLED',
      'REVIEW',
    ]);
    const rawType = allowedTypes.has(rawTypeInput) ? rawTypeInput : 'ALL';
    const parsedLimit = Number(req.query['limit'] ?? 20);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(50, Math.max(1, Math.trunc(parsedLimit)))
      : 20;

    type ActivityFeedEvent = {
      id: string;
      type:
        | 'RESERVED'
        | 'MOMO_PAID'
        | 'MOMO_EXPIRED'
        | 'ACTIVE'
        | 'RETURNED'
        | 'CANCELLED'
        | 'REVIEW';
      title: string;
      subtitle: string;
      amountVnd: number | null;
      rating: number | null;
      link: string;
      timestamp: string;
    };

    const events: ActivityFeedEvent[] = [];
    const nowIso = new Date().toISOString();
    const toIso = (val: unknown, fallbackIso: string): string => {
      if (val instanceof Date && !Number.isNaN(val.getTime())) {
        return val.toISOString();
      }
      if (typeof val === 'string' && val.trim() !== '') {
        const d = new Date(val);
        if (!Number.isNaN(d.getTime())) {
          return d.toISOString();
        }
      }
      return fallbackIso;
    };

    const recentList = await this.listRentals.execute();
    const summaryById = new Map(recentList.rentals.map((r) => [r.rentalId, r]));

    if (this.pool) {
      try {
        const [rentalRows] = await this.pool.query<RowDataPacket[]>(
          `SELECT r.*, c.full_name AS customer_name
           FROM rentals r
           LEFT JOIN customers c ON c.customer_id = r.customer_id
           ORDER BY COALESCE(r.updated_at, r.cancelled_at, r.activated_at, r.created_at) DESC
           LIMIT 40`
        );
        for (const row of rentalRows) {
          const rentalId = String(row['rental_id']);
          const summary = summaryById.get(rentalId);
          const customerName = String(
            row['customer_name'] ?? summary?.customerId ?? row['customer_id'] ?? 'Khách hàng'
          );
          const totalItems = summary?.totalItems ?? 1;
          const totalAmount = summary?.totalAmount ?? 0;
          const status = String(row['status'] ?? summary?.status ?? 'RESERVED');
          const createdAtIso = toIso(row['created_at'] ?? row['start_date'], nowIso);

          events.push({
            id: `rental-reserved-${rentalId}`,
            type: 'RESERVED',
            title: `Đơn thuê mới #${rentalId}`,
            subtitle: `${customerName} đặt ${totalItems} đôi giày`,
            amountVnd: totalAmount,
            rating: null,
            link: `/admin/rentals/${rentalId}`,
            timestamp: createdAtIso,
          });

          if (row['activated_at'] !== null && row['activated_at'] !== undefined) {
            events.push({
              id: `rental-active-${rentalId}`,
              type: 'ACTIVE',
              title: `Đã giao giày #${rentalId}`,
              subtitle: `${customerName} đang thuê (${totalItems} đôi)`,
              amountVnd: totalAmount,
              rating: null,
              link: `/admin/rentals/${rentalId}`,
              timestamp: toIso(row['activated_at'], createdAtIso),
            });
          }

          if (status === 'RETURNED') {
            events.push({
              id: `rental-returned-${rentalId}`,
              type: 'RETURNED',
              title: `Đã hoàn trả #${rentalId}`,
              subtitle: `${customerName} hoàn tất trả giày`,
              amountVnd: totalAmount,
              rating: null,
              link: `/admin/rentals/${rentalId}`,
              timestamp: toIso(
                row['updated_at'] ?? row['actual_return_date'] ?? row['created_at'],
                createdAtIso
              ),
            });
          }

          if (status === 'CANCELLED') {
            events.push({
              id: `rental-cancelled-${rentalId}`,
              type: 'CANCELLED',
              title: `Đã hủy đơn #${rentalId}`,
              subtitle: `${customerName} — đơn đã hủy`,
              amountVnd: totalAmount,
              rating: null,
              link: `/admin/rentals/${rentalId}`,
              timestamp: toIso(
                row['cancelled_at'] ?? row['updated_at'] ?? row['created_at'],
                createdAtIso
              ),
            });
          }
        }
      } catch {
        // ignore
      }

      try {
        const [paymentRows] = await this.pool.query<RowDataPacket[]>(
          `SELECT rp.*, c.full_name AS customer_name
           FROM rental_payments rp
           LEFT JOIN customers c ON c.customer_id = rp.customer_id
           WHERE rp.status IN ('PAID', 'EXPIRED')
           ORDER BY COALESCE(rp.paid_at, rp.updated_at, rp.created_at) DESC
           LIMIT 30`
        );
        for (const row of paymentRows) {
          const paymentId = String(row['id'] ?? row['gateway_order_id']);
          const rentalId = String(row['rental_id']);
          const pStatus = String(row['status']);
          const customerName = String(
            row['customer_name'] ?? row['customer_id'] ?? 'Khách hàng'
          );
          const gatewayOrderId = String(row['gateway_order_id'] ?? '');
          const ts = toIso(row['paid_at'] ?? row['updated_at'] ?? row['created_at'], nowIso);
          events.push({
            id: `momo-${paymentId}`,
            type: pStatus === 'PAID' ? 'MOMO_PAID' : 'MOMO_EXPIRED',
            title:
              pStatus === 'PAID'
                ? `Thanh toán MoMo thành công #${rentalId}`
                : `Giao dịch MoMo hết hạn #${rentalId}`,
            subtitle: `${customerName} · Mã GD: ${gatewayOrderId}`,
            amountVnd: Number(row['amount_vnd'] || 0),
            rating: null,
            link: `/admin/rentals/${rentalId}`,
            timestamp: ts,
          });
        }
      } catch {
        // ignore
      }

      try {
        const [reviewRows] = await this.pool.query<RowDataPacket[]>(
          `SELECT sr.*, s.name AS shoe_name
           FROM shoe_reviews sr
           LEFT JOIN shoes s ON s.shoe_id = sr.shoe_id
           ORDER BY sr.created_at DESC
           LIMIT 30`
        );
        for (const row of reviewRows) {
          const reviewId = String(
            row['review_id'] ?? row['id'] ?? `${row['shoe_id']}-${row['customer_id']}`
          );
          const shoeName = String(row['shoe_name'] ?? row['shoe_id'] ?? 'Giày');
          const customerName = String(row['customer_name'] ?? 'Khách hàng');
          const comment = String(row['comment'] ?? '').slice(0, 80);
          const rating = Number(row['rating'] || 5);
          const ts = toIso(row['created_at'], nowIso);
          events.push({
            id: `review-${reviewId}`,
            type: 'REVIEW',
            title: `Đánh giá ${rating}★ cho ${shoeName}`,
            subtitle: `${customerName}: "${comment}"`,
            amountVnd: null,
            rating,
            link: '/admin/reviews',
            timestamp: ts,
          });
        }
      } catch {
        // ignore
      }
    }

    if (!this.pool || events.length === 0) {
      for (const r of recentList.rentals.slice(0, 30)) {
        const createdIso = toIso(r.startDate, nowIso);
        events.push({
          id: `rental-reserved-${r.rentalId}`,
          type: 'RESERVED',
          title: `Đơn thuê mới #${r.rentalId}`,
          subtitle: `${r.customerId} đặt ${r.totalItems} đôi giày`,
          amountVnd: r.totalAmount,
          rating: null,
          link: `/admin/rentals/${r.rentalId}`,
          timestamp: createdIso,
        });
        if (r.status === 'ACTIVE') {
          events.push({
            id: `rental-active-${r.rentalId}`,
            type: 'ACTIVE',
            title: `Đã giao giày #${r.rentalId}`,
            subtitle: `${r.customerId} đang thuê (${r.totalItems} đôi)`,
            amountVnd: r.totalAmount,
            rating: null,
            link: `/admin/rentals/${r.rentalId}`,
            timestamp: createdIso,
          });
        } else if (r.status === 'RETURNED') {
          events.push({
            id: `rental-returned-${r.rentalId}`,
            type: 'RETURNED',
            title: `Đã hoàn trả #${r.rentalId}`,
            subtitle: `${r.customerId} hoàn tất trả giày`,
            amountVnd: r.totalAmount,
            rating: null,
            link: `/admin/rentals/${r.rentalId}`,
            timestamp: toIso(r.endDate, createdIso),
          });
        } else if (r.status === 'CANCELLED') {
          events.push({
            id: `rental-cancelled-${r.rentalId}`,
            type: 'CANCELLED',
            title: `Đã hủy đơn #${r.rentalId}`,
            subtitle: `${r.customerId} — đơn đã hủy`,
            amountVnd: r.totalAmount,
            rating: null,
            link: `/admin/rentals/${r.rentalId}`,
            timestamp: toIso(r.startDate, createdIso),
          });
        }
      }
    }

    const filtered = events.filter((e) => {
      if (rawType === 'ALL') return true;
      if (rawType === 'MOMO') return e.type === 'MOMO_PAID' || e.type === 'MOMO_EXPIRED';
      return e.type === rawType;
    });

    filtered.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const sliced = filtered.slice(0, limit);

    res.json({
      type: rawType,
      events: sliced,
      total: filtered.length,
    });
  }
}
