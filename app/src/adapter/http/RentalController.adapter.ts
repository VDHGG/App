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
    router.delete('/:id', ...admin, asyncRoute(this.deleteAdmin.bind(this)));
    return router;
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
    const body = CancelRentalSchema.parse(req.body);
    const result = await this.cancelRental.execute({
      rentalId: req.params['id'] as string,
      cancelledAt: body.cancelledAt,
      note: body.note,
      requestingCustomerId: auth.customerId,
    });
    res.json(result);
  }

  private async list(req: Request, res: Response): Promise<void> {
    const query = ListRentalsQuerySchema.parse(req.query);
    const amountBucket =
      query.amountBucket === undefined || query.amountBucket === 'all' ? undefined : query.amountBucket;

    const result = await this.listRentals.execute({
      ...(query.status ? { status: query.status } : {}),
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
    const body = ReturnRentalSchema.parse(req.body);
    const result = await this.returnRental.execute({ rentalId: req.params['id'] as string, ...body });
    res.json(result);
  }

  private async cancel(req: Request, res: Response): Promise<void> {
    const body = CancelRentalSchema.parse(req.body);
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

    if (this.pool) {
      try {
        const [paymentRows] = await this.pool.query<RowDataPacket[]>(
          `SELECT COUNT(*) AS cnt, COALESCE(SUM(amount_vnd), 0) AS total_vnd FROM rental_payments WHERE status = 'PAID'`
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
        const [shoeRows] = await this.pool.query<RowDataPacket[]>(
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
      revenueSeries,
    });
  }
}
