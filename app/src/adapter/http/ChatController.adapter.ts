import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import type { GetRentalUseCase } from '@usecase/GetRentalUseCase.port';
import type { ListRentalsUseCase } from '@usecase/ListRentalsUseCase.port';
import type { ListShoesUseCase } from '@usecase/ListShoesUseCase.port';
import type { GetShoeUseCase } from '@usecase/GetShoeUseCase.port';
import type { RentalAvailabilityChecker } from '@port/RentalAvailabilityChecker.port';
import type { VoucherRepository } from '@port/VoucherRepository.port';
import type { CustomerRepository } from '@port/CustomerRepository.port';
import { getDiscountPercentByRank } from '@domain/CustomerRank.enum';
import { RentalPeriod } from '@domain/RentalPeriod.vo';
import { asyncRoute } from './middleware/routeMiddleware';
import { DomainError } from '@domain/errors/DomainError';
import { geminiChatWithTools } from '@infra/gemini/geminiChat';

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

function detectSecurityViolation(text: string, customerId: string | undefined): string | null {
  const normalized = text.trim();
  if (
    /ignore previous|ignore all instructions|bỏ qua hướng dẫn|system prompt|reveal prompt|select\s+\*\s+from|union\s+select|information_schema|password_hash|jwt_secret|system_users|drop\s+table|delete\s+from|doanh thu admin|báo cáo doanh thu|đơn của khách khác|thông tin khách khác|danh sách khách hàng/i.test(
      normalized
    )
  ) {
    return '🔒 Vì lý do bảo mật (Zero-Trust Read-Only Policy), trợ lý AI chỉ được phép tra cứu thông tin công khai và dữ liệu đơn thuê/hạng thành viên của chính tài khoản bạn đang đăng nhập. Mình không thể truy cập dữ liệu của khách hàng khác, doanh thu Admin, hoặc can thiệp trực tiếp vào cơ sở dữ liệu.';
  }

  const custMatches = normalized.matchAll(/\b(CUST\d{3,})\b/gi);
  for (const m of custMatches) {
    if (m[1].toUpperCase() !== (customerId ?? '').toUpperCase()) {
      return '🔒 Vì lý do bảo mật, bạn chỉ có thể tra cứu dữ liệu thuộc tài khoản của chính mình, không thể xem thông tin của mã khách hàng khác.';
    }
  }

  return null;
}

const BodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      })
    )
    .min(1)
    .max(24),
});

function defaultKnowledgePath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  return join(here, '../../../knowledge/gemini-context.md');
}

function loadKnowledgeText(): string {
  const fromEnv = process.env.GEMINI_KNOWLEDGE_PATH?.trim();
  const path = fromEnv && fromEnv.length > 0 ? fromEnv : defaultKnowledgePath();
  if (!existsSync(path)) {
    return '(Knowledge file not found; answer only from tools and general safe guidance.)';
  }
  return readFileSync(path, 'utf-8');
}

function mergeShoeLists<T extends { shoeId: string }>(lists: T[][]): T[] {
  const map = new Map<string, T>();
  for (const list of lists) {
    for (const s of list) {
      if (!map.has(s.shoeId)) map.set(s.shoeId, s);
    }
  }
  return [...map.values()];
}

export class ChatController {
  private readonly listRentals: ListRentalsUseCase;
  private readonly getRental: GetRentalUseCase;
  private readonly listShoes: ListShoesUseCase;
  private readonly getShoe?: GetShoeUseCase;
  private readonly availabilityChecker?: RentalAvailabilityChecker;
  private readonly voucherRepository?: VoucherRepository;
  private readonly customerRepository?: CustomerRepository;

  constructor(
    listRentals: ListRentalsUseCase,
    getRental: GetRentalUseCase,
    listShoes: ListShoesUseCase,
    getShoe?: GetShoeUseCase,
    availabilityChecker?: RentalAvailabilityChecker,
    voucherRepository?: VoucherRepository,
    customerRepository?: CustomerRepository
  ) {
    this.listRentals = listRentals;
    this.getRental = getRental;
    this.listShoes = listShoes;
    this.getShoe = getShoe;
    this.availabilityChecker = availabilityChecker;
    this.voucherRepository = voucherRepository;
    this.customerRepository = customerRepository;
  }

  routes(optionalAuth: RequestHandler[]): Router {
    const router = Router();
    router.post('/chat', ...optionalAuth, asyncRoute(this.postChat.bind(this)));
    return router;
  }

  private async postChat(req: Request, res: Response): Promise<void> {
    const body = BodySchema.parse(req.body);
    const auth = req.auth;
    const customerId = auth?.role === 'customer' ? auth.customerId ?? undefined : undefined;

    const lastUserMsg = [...body.messages].reverse().find((m) => m.role === 'user');
    const lastUserText = lastUserMsg?.content ?? '';

    for (const msg of body.messages) {
      if (msg.role === 'user') {
        const violation = detectSecurityViolation(msg.content, customerId);
        if (violation) {
          res.json({ reply: violation, mode: 'security_guard' });
          return;
        }
      }
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      const reply = await this.buildFallbackReply(lastUserText, customerId);
      res.json({ reply, mode: 'fallback' });
      return;
    }

    const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
    const pendingMin = process.env.PAYMENT_PENDING_MINUTES?.trim() || '15';

    const systemText = [
      'You are the storefront assistant for a shoe rental web app.',
      'Follow GuildChatBot rules: no hallucinated data; use tool results for real data.',
      'Strict Zero-Trust Policy: 100% read-only; never expose other customers, PII (email/phone), voucher usedCount/maxUses, or Admin revenue.',
      `Static policy: unpaid MoMo checkout window is typically ~${pendingMin} minutes (then order may auto-cancel).`,
      '--- Allowed knowledge (markdown) ---',
      loadKnowledgeText(),
    ].join('\n\n');

    try {
      const lastAssistant = await geminiChatWithTools({
        apiKey,
        model,
        systemInstruction: systemText,
        turns: body.messages.slice(-20),
        executeTool: (name, args) => this.runTool(name, args, customerId),
      });

      res.json({ reply: lastAssistant || 'Xin lỗi, mình chưa trả lời được. Thử lại sau nhé.' });
    } catch (e: unknown) {
      if (e instanceof DomainError) {
        throw e;
      }
      const reply = await this.buildFallbackReply(lastUserText, customerId);
      res.json({ reply, mode: 'fallback' });
    }
  }

  public async buildFallbackReply(
    lastUserText: string,
    customerId: string | undefined
  ): Promise<string> {
    const violation = detectSecurityViolation(lastUserText, customerId);
    if (violation) {
      return violation;
    }

    const q = lastUserText.toLowerCase();

    if (/hủy đơn giúp|xóa đơn giúp|tạo đơn giúp|đặt thuê giúp|tự động hủy|tự động tạo|cancel order for me/i.test(q)) {
      return '🛡️ Trợ lý AI hoạt động ở chế độ **100% Read-Only (Chỉ đọc)** để bảo vệ an toàn tài khoản của bạn. Mình không trực tiếp tạo, sửa, gia hạn hoặc hủy đơn qua khung chat. Bạn vui lòng thao tác trực tiếp tại trang `/checkout` (đặt đơn) hoặc `/account` (gia hạn / hủy đơn `RESERVED`) nhé!';
    }

    const availMatch = lastUserText.match(/\b(SHOE\d{3,})\b.*?\b(\d{4}-\d{2}-\d{2})\b.*?\b(\d{4}-\d{2}-\d{2})\b/i);
    if (availMatch) {
      const availRes = (await this.runTool(
        'check_shoe_availability',
        {
          shoe_id: availMatch[1].toUpperCase(),
          start_date: availMatch[2],
          end_date: availMatch[3],
        },
        customerId
      )) as {
        ok: boolean;
        name?: string;
        variants?: Array<{ size: number; color: string; availableQuantity: number }>;
        error?: string;
      };
      if (availRes.ok && availRes.variants) {
        const lines = availRes.variants.map(
          (v) => `• Size EU ${v.size} (${v.color}): còn **${v.availableQuantity}** đôi trống`
        );
        return [
          `📅 **Tồn kho khả dụng cho ${availRes.name} (${availMatch[2]} → ${availMatch[3]}):**`,
          ...lines,
        ].join('\n');
      }
    }

    if (/voucher|mã giảm|khuyến mãi|ưu đãi/.test(q)) {
      const vRes = (await this.runTool('list_active_vouchers', {}, customerId)) as {
        ok: boolean;
        vouchers?: Array<{
          code: string;
          discountPercent: number;
          description: string;
          expiresAt: string | null;
        }>;
      };
      const vouchers = vRes.vouchers ?? [];
      if (vouchers.length === 0) {
        return 'Hiện tại chưa có mã voucher khuyến mãi nào đang mở. Tuy nhiên bạn vẫn được giảm tự động theo hạng thành viên (SILVER -5%, GOLD -10%, DIAMOND -15%) khi thuê giày nhé!';
      }
      const lines = vouchers.map(
        (v) =>
          `• **${v.code}** (-${v.discountPercent}%): ${v.description}${v.expiresAt ? ` (HSD: ${v.expiresAt})` : ''}`
      );
      return [
        '🎁 **Các mã giảm giá (Voucher) đang hoạt động:**',
        ...lines,
        '💡 *Lưu ý: Mã giảm giá được cộng dồn với ưu đãi hạng thành viên (tối đa 50%) tại trang `/checkout`.*',
      ].join('\n');
    }

    if (/hạng|rank|thành viên|đơn thuê|đơn của tôi|đơn hàng|quá hạn|trễ hạn/.test(q)) {
      if (!customerId) {
        return '🔑 Bạn cần **đăng nhập tài khoản khách hàng** để mình tra cứu hạng thành viên, mức ưu đãi và danh sách đơn thuê của bạn nhé!';
      }
      const rankRes = (await this.runTool('get_my_membership_rank', {}, customerId)) as {
        ok: boolean;
        rank?: string;
        rankDiscountPercent?: number;
      };
      const rentalsRes = (await this.runTool('list_my_rentals', {}, customerId)) as {
        ok: boolean;
        rentals?: Array<{
          rentalId: string;
          status: string;
          totalAmount: number;
          depositAmount: number;
          isOverdue: boolean;
          overdueDays: number;
          estimatedLateFee: number;
        }>;
      };

      const parts: string[] = [];
      if (rankRes.ok && rankRes.rank) {
        parts.push(
          `🏅 **Hạng thành viên của bạn:** **${rankRes.rank}** (Ưu đãi tự động **-${rankRes.rankDiscountPercent ?? 0}%** trên mọi đơn thuê).`
        );
      }
      const list = rentalsRes.rentals ?? [];
      if (list.length === 0) {
        parts.push('📦 Bạn hiện chưa có đơn thuê nào. Hãy ghé `/shoes` để chọn mẫu giày yêu thích nhé!');
      } else {
        const top = list.slice(0, 5).map((r) => {
          const overdueTag = r.isOverdue
            ? ` ⚠️ Quá hạn ${r.overdueDays} ngày (phí phạt dự kiến +${r.estimatedLateFee.toLocaleString('vi-VN')}₫)`
            : '';
          return `• Đơn **#${r.rentalId}** [${r.status}] — Tiền thuê: ${r.totalAmount.toLocaleString('vi-VN')}₫ | Cọc: ${r.depositAmount.toLocaleString('vi-VN')}₫${overdueTag}`;
        });
        parts.push(`📦 **Đơn thuê gần đây (${list.length} đơn):**\n${top.join('\n')}`);
        parts.push(
          '👉 Bạn có thể xem hóa đơn, tự gia hạn hoặc hủy đơn `RESERVED` trực tiếp tại trang `/account`.'
        );
      }
      return parts.join('\n\n');
    }

    if (/giày|shoe|giá|tìm|mẫu|size|nike|adidas/.test(q)) {
      const shoesRes = (await this.runTool(
        'search_shoes',
        { max_price_vnd: 550000 },
        customerId
      )) as {
        ok: boolean;
        shoes?: Array<{ shoeId: string; name: string; brand: string; pricePerDay: number; inStock: boolean }>;
      };
      const shoes = (shoesRes.shoes ?? []).slice(0, 5);
      if (shoes.length > 0) {
        const lines = shoes.map(
          (s) =>
            `• **${s.name}** (${s.brand}) — **${s.pricePerDay.toLocaleString('vi-VN')}₫/ngày** ${s.inStock ? '✅ Còn hàng' : '❌ Hết hàng'}`
        );
        return [
          '👟 **Gợi ý các mẫu giày nổi bật tại cửa hàng:**',
          ...lines,
          '💡 *Tiền đặt cọc bảo đảm: **500.000₫/đôi** (hoàn trả 100% khi trả giày nguyên vẹn).*',
        ].join('\n');
      }
    }

    return [
      '👋 **Chào bạn! Mình là trợ lý Rental Shoes (Zero-Trust Read-Only Assistant).**',
      '• **Giá thuê giày:** 180.000₫ – 550.000₫/ngày (Tiền cọc bảo đảm: **500.000₫/đôi**, hoàn lại khi trả giày nguyên vẹn).',
      '• **Ưu đãi hạng thành viên:** SILVER (-5%), GOLD (-10%), DIAMOND (-15%) cộng dồn cùng Voucher tối đa **50%**.',
      '• **Gia hạn & Quản lý đơn:** Bạn có thể tự gia hạn đơn `RESERVED`/`ACTIVE` hoặc in biên lai tại trang `/account`.',
      'Hãy hỏi mình về **mã giảm giá**, **tìm giày**, hoặc **đơn thuê của tôi** nhé!',
    ].join('\n');
  }

  public async runTool(
    name: string,
    args: Record<string, unknown>,
    customerId: string | undefined
  ): Promise<unknown> {
    if (name === 'list_my_rentals') {
      if (!customerId) {
        return {
          ok: false,
          hint: 'Bạn cần đăng nhập tài khoản khách (customer) để xem đơn thuê.',
        };
      }
      const result = await this.listRentals.execute({
        customerId,
        page: 1,
        pageSize: 30,
      });
      return {
        ok: true,
        rentals: result.rentals.map((r) => ({
          rentalId: r.rentalId,
          status: r.status,
          startDate: r.startDate,
          endDate: r.endDate,
          totalItems: r.totalItems,
          basePrice: r.basePrice,
          depositAmount: r.depositAmount,
          totalAmount: r.totalAmount,
          isOverdue: r.isOverdue,
          overdueDays: r.overdueDays,
          estimatedLateFee: r.estimatedLateFee,
        })),
        total: result.total,
      };
    }

    if (name === 'get_rental_detail') {
      if (!customerId) {
        return { ok: false, hint: 'Cần đăng nhập để xem chi tiết đơn.' };
      }
      const rentalId = String(args['rental_id'] ?? '').trim();
      if (!rentalId) {
        return { ok: false, error: 'Missing rental_id' };
      }
      try {
        const r = await this.getRental.execute({
          rentalId,
          requestingCustomerId: customerId,
        });
        return {
          ok: true,
          rentalId: r.rentalId,
          status: r.status,
          startDate: r.startDate,
          endDate: r.endDate,
          totalItems: r.totalItems,
          basePrice: r.basePrice,
          depositAmount: r.depositAmount,
          lateFee: r.lateFee,
          totalAmount: r.totalAmount,
          isOverdue: r.isOverdue,
          overdueDays: r.overdueDays,
          estimatedLateFee: r.estimatedLateFee,
          items: r.items,
          note: r.note,
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Not found';
        return { ok: false, error: msg };
      }
    }

    if (name === 'get_my_membership_rank') {
      if (!customerId) {
        return {
          ok: false,
          hint: 'Bạn cần đăng nhập tài khoản khách hàng để xem hạng thành viên.',
        };
      }
      if (!this.customerRepository) {
        return { ok: false, error: 'Customer repository is not configured.' };
      }
      const c = await this.customerRepository.findById(customerId);
      if (!c) {
        return { ok: false, error: 'Customer profile not found.' };
      }
      return {
        ok: true,
        rank: c.rank,
        rankDiscountPercent: getDiscountPercentByRank(c.rank),
      };
    }

    if (name === 'list_active_vouchers') {
      const todayStr = getVietnamTodayYmd();
      const list = this.voucherRepository ? await this.voucherRepository.listActive(todayStr) : [];
      return {
        ok: true,
        vouchers: list.map((v) => ({
          code: v.code,
          discountPercent: v.discountPercent,
          description: v.description,
          expiresAt: v.expiresAt,
        })),
        count: list.length,
      };
    }

    if (name === 'search_shoes') {
      const maxInput = Number(args['max_price_vnd'] ?? args['max_price_usd'] ?? 550000);
      if (!Number.isFinite(maxInput) || maxInput <= 0) {
        return { ok: false, error: 'Invalid max_price_usd' };
      }
      const shoes = await this.searchShoesByMaxPriceUsd(maxInput);
      return {
        ok: true,
        max_price_usd: maxInput,
        shoes: shoes.map((s) => ({
          shoeId: s.shoeId,
          name: s.name,
          pricePerDay: s.pricePerDay,
          brand: s.brand,
          inStock: s.unitsInStock > 0,
        })),
        count: shoes.length,
      };
    }

    if (name === 'check_shoe_availability') {
      const shoeId = String(args['shoe_id'] ?? '').trim();
      const startDateStr = String(args['start_date'] ?? '').trim();
      const endDateStr = String(args['end_date'] ?? '').trim();
      if (!shoeId || !startDateStr || !endDateStr) {
        return { ok: false, error: 'Missing shoe_id, start_date, or end_date' };
      }
      if (!this.getShoe) {
        return { ok: false, error: 'Shoe service unavailable' };
      }
      try {
        const shoe = await this.getShoe.execute({ shoeId });
        const period = new RentalPeriod(new Date(startDateStr), new Date(endDateStr));
        const variants = await Promise.all(
          shoe.variants.map(async (v) => {
            const booked = this.availabilityChecker
              ? await this.availabilityChecker.getReservedQuantityForVariant(v.variantId, period)
              : v.totalQuantity - v.availableQuantity;
            const availableQuantity = Math.max(0, v.totalQuantity - booked);
            return {
              variantId: v.variantId,
              size: v.size,
              color: v.color,
              availableQuantity,
              inStockForDates: availableQuantity > 0,
            };
          })
        );
        return {
          ok: true,
          shoeId: shoe.shoeId,
          name: shoe.name,
          pricePerDay: shoe.pricePerDay,
          startDate: startDateStr,
          endDate: endDateStr,
          variants,
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unable to check availability';
        return { ok: false, error: msg };
      }
    }

    return { ok: false, error: 'Unknown tool' };
  }

  private async searchShoesByMaxPriceUsd(maxInput: number) {
    const normalizedMaxVnd = maxInput > 0 && maxInput < 1000 ? maxInput * 1000 : maxInput;
    const cap = 25;
    let shoes: Array<{
      shoeId: string;
      name: string;
      brand: string;
      category: string;
      pricePerDay: number;
      unitsInStock: number;
    }>;

    if (normalizedMaxVnd <= 250000) {
      const r = await this.listShoes.execute({
        priceBucket: 'lt10',
        page: 1,
        pageSize: cap,
      });
      shoes = r.shoes;
    } else if (normalizedMaxVnd <= 350000) {
      const a = await this.listShoes.execute({ priceBucket: 'lt10', page: 1, pageSize: cap });
      const b = await this.listShoes.execute({ priceBucket: '10to20', page: 1, pageSize: cap });
      shoes = mergeShoeLists([a.shoes, b.shoes]).slice(0, cap);
    } else if (normalizedMaxVnd <= 450000) {
      const a = await this.listShoes.execute({ priceBucket: 'lt10', page: 1, pageSize: 20 });
      const b = await this.listShoes.execute({ priceBucket: '10to20', page: 1, pageSize: 20 });
      const c = await this.listShoes.execute({ priceBucket: '20to50', page: 1, pageSize: 20 });
      shoes = mergeShoeLists([a.shoes, b.shoes, c.shoes]).slice(0, cap);
    } else {
      const r = await this.listShoes.execute({ priceBucket: 'all', page: 1, pageSize: cap });
      shoes = r.shoes;
    }

    return shoes.filter((s) => s.pricePerDay <= normalizedMaxVnd);
  }
}
