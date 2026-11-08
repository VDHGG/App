import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import type { Pool, RowDataPacket } from 'mysql2/promise';
import type { GetRentalUseCase } from '@usecase/GetRentalUseCase.port';
import type { ListRentalsUseCase } from '@usecase/ListRentalsUseCase.port';
import type { ListShoesUseCase } from '@usecase/ListShoesUseCase.port';
import type { ShoeSummary } from '@usecase/ListShoesResponse.dto';
import type { GetShoeUseCase } from '@usecase/GetShoeUseCase.port';
import type { RentalAvailabilityChecker } from '@port/RentalAvailabilityChecker.port';
import type { VoucherRepository } from '@port/VoucherRepository.port';
import type { CustomerRepository } from '@port/CustomerRepository.port';
import { getDiscountPercentByRank } from '@domain/CustomerRank.enum';
import { RentalPeriod } from '@domain/RentalPeriod.vo';
import { resolveVoucher } from '@domain/Voucher.vo';
import { asyncRoute } from './middleware/routeMiddleware';
import { DomainError } from '@domain/errors/DomainError';
import { geminiChatWithTools } from '@infra/gemini/geminiChat';

export type ChatShoeCardDto = {
  shoeId: string;
  name: string;
  brand: string;
  category: string;
  pricePerDay: number;
  availableSizes: number[];
  availableColors: string[];
  inStock: boolean;
  availableUnits?: number;
  averageRating?: number;
  actionUrl: string;
};

export type ChatQuoteCardDto = {
  shoeId: string;
  shoeName: string;
  brand: string;
  pricePerDay: number;
  days: number;
  quantity: number;
  startDate?: string;
  endDate?: string;
  rawBasePrice: number;
  rank: string;
  rankDiscountPercent: number;
  voucherCode?: string | null;
  voucherDiscountPercent: number;
  effectiveDiscountPercent: number;
  finalRentalPrice: number;
  depositAmount: number;
  grandTotal: number;
  actionUrl: string;
};

export type ChatSmartPayload = {
  reply: string;
  cards?: ChatShoeCardDto[];
  quote?: ChatQuoteCardDto;
  suggestions: string[];
};

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

function addDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
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
  context: z
    .object({
      currentPath: z.string().max(300).optional(),
      currentShoeId: z.string().max(50).optional(),
    })
    .optional(),
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

const COLOR_SYNONYMS: Record<string, string[]> = {
  white: ['white', 'trắng', 'trang', 'ivory', 'sail'],
  black: ['black', 'đen', 'den', 'dark'],
  red: ['red', 'đỏ', 'do', 'crimson', 'chicago'],
  blue: ['blue', 'xanh', 'navy', 'cobalt', 'unc'],
  grey: ['grey', 'gray', 'xám', 'xam', 'silver', 'bạc'],
  yellow: ['yellow', 'vàng', 'vang', 'gold'],
  pink: ['pink', 'hồng', 'hong', 'rose'],
  brown: ['brown', 'nâu', 'nau', 'mocha'],
  cream: ['cream', 'kem', 'beige', 'sand'],
  green: ['green', 'xanh lá', 'olive', 'mint'],
};

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  running: ['running', 'chạy bộ', 'chay bo', 'marathon', 'jogging'],
  basketball: ['basketball', 'bóng rổ', 'bong ro', 'jordan', 'hoop'],
  sneaker: ['sneaker', 'thể thao', 'the thao', 'casual', 'streetwear'],
  lifestyle: ['lifestyle', 'đi chơi', 'di choi', 'hằng ngày', 'daily', 'classic'],
  skate: ['skate', 'trượt ván', 'truot van', 'vans', 'sb'],
};

function normalizeColorQuery(raw: string): string[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  for (const [, variants] of Object.entries(COLOR_SYNONYMS)) {
    if (variants.some((v) => q.includes(v))) {
      return variants;
    }
  }
  return [q];
}

function normalizeCategoryQuery(raw: string): string[] {
  const q = raw.trim().toLowerCase();
  if (!q) return [];
  for (const [, variants] of Object.entries(CATEGORY_SYNONYMS)) {
    if (variants.some((v) => q.includes(v))) {
      return variants;
    }
  }
  return [q];
}

function toShoeCard(shoe: ShoeSummary, averageRating?: number): ChatShoeCardDto {
  const variants = shoe.variants ?? [];
  const inStockVariants = variants.filter((v) => (v.availableQuantity ?? v.totalQuantity) > 0);
  const availableSizes = Array.from(new Set(inStockVariants.map((v) => v.size))).sort((a, b) => a - b);
  const availableColors = Array.from(new Set(inStockVariants.map((v) => v.color)));
  const availableUnits =
    shoe.availableUnitsInRange !== undefined
      ? shoe.availableUnitsInRange
      : shoe.unitsInStock;

  return {
    shoeId: shoe.shoeId,
    name: shoe.name,
    brand: shoe.brand,
    category: shoe.category,
    pricePerDay: shoe.pricePerDay,
    availableSizes,
    availableColors,
    inStock: availableUnits > 0,
    availableUnits,
    ...(averageRating !== undefined ? { averageRating } : {}),
    actionUrl: `/shoes/${shoe.shoeId}`,
  };
}

export class ChatController {
  private readonly listRentals: ListRentalsUseCase;
  private readonly getRental: GetRentalUseCase;
  private readonly listShoes: ListShoesUseCase;
  private readonly getShoe?: GetShoeUseCase;
  private readonly availabilityChecker?: RentalAvailabilityChecker;
  private readonly voucherRepository?: VoucherRepository;
  private readonly customerRepository?: CustomerRepository;
  private readonly pool?: Pool;

  constructor(
    listRentals: ListRentalsUseCase,
    getRental: GetRentalUseCase,
    listShoes: ListShoesUseCase,
    getShoe?: GetShoeUseCase,
    availabilityChecker?: RentalAvailabilityChecker,
    voucherRepository?: VoucherRepository,
    customerRepository?: CustomerRepository,
    pool?: Pool
  ) {
    this.listRentals = listRentals;
    this.getRental = getRental;
    this.listShoes = listShoes;
    this.getShoe = getShoe;
    this.availabilityChecker = availabilityChecker;
    this.voucherRepository = voucherRepository;
    this.customerRepository = customerRepository;
    this.pool = pool;
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
          res.json({
            reply: violation,
            mode: 'security_guard',
            suggestions: [
              'Shop đang có mã giảm giá nào?',
              'Tìm giày Nike dưới 350.000₫',
              'Quy định đặt cọc & phí trễ hạn',
            ],
          });
          return;
        }
      }
    }

    const contextOptions = {
      messages: body.messages,
      currentShoeId: body.context?.currentShoeId,
      currentPath: body.context?.currentPath,
    };

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      const smart = await this.buildSmartReply(lastUserText, customerId, contextOptions);
      res.json({
        reply: smart.reply,
        mode: 'fallback',
        ...(smart.cards && smart.cards.length > 0 ? { cards: smart.cards } : {}),
        ...(smart.quote ? { quote: smart.quote } : {}),
        suggestions: smart.suggestions,
      });
      return;
    }

    const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
    const pendingMin = process.env.PAYMENT_PENDING_MINUTES?.trim() || '15';
    const resolvedContextShoeId = await this.resolveContextualShoeId(lastUserText, contextOptions);
    const todayStr = getVietnamTodayYmd();

    const systemText = [
      'You are the smart storefront shopping concierge for Rental Shoes Vietnam.',
      'Follow GuildChatBot rules: never hallucinate data; always call tools for real catalog, availability, quotes, reviews, vouchers, rank, and rentals.',
      'Strict Zero-Trust Policy: 100% read-only; never expose other customers, PII (email/phone), voucher usedCount/maxUses, or Admin revenue.',
      `Today's date in Vietnam (UTC+7): ${todayStr}.`,
      `Current page shoe context (use if user says "đôi này", "mẫu này", "nó" without naming another shoe): ${resolvedContextShoeId || 'none'}.`,
      `Static policy: unpaid MoMo checkout window is ~${pendingMin} minutes (then order auto-cancels).`,
      '--- Allowed knowledge (markdown) ---',
      loadKnowledgeText(),
    ].join('\n\n');

    const collectedCards: ChatShoeCardDto[] = [];
    let collectedQuote: ChatQuoteCardDto | undefined;

    try {
      const lastAssistant = await geminiChatWithTools({
        apiKey,
        model,
        systemInstruction: systemText,
        turns: body.messages.slice(-20),
        executeTool: async (name, args) => {
          const enrichedArgs = { ...args };
          if (
            (name === 'check_shoe_availability' ||
              name === 'estimate_rental_quote' ||
              name === 'get_shoe_reviews_summary') &&
            !enrichedArgs['shoe_id'] &&
            !enrichedArgs['shoe_name'] &&
            resolvedContextShoeId
          ) {
            enrichedArgs['shoe_id'] = resolvedContextShoeId;
          }
          const toolOut = await this.runTool(name, enrichedArgs, customerId);
          if (toolOut && typeof toolOut === 'object') {
            const obj = toolOut as Record<string, unknown>;
            if (Array.isArray(obj['cards'])) {
              for (const c of obj['cards'] as ChatShoeCardDto[]) {
                if (!collectedCards.some((x) => x.shoeId === c.shoeId)) {
                  collectedCards.push(c);
                }
              }
            }
            if (obj['card'] && typeof obj['card'] === 'object') {
              const c = obj['card'] as ChatShoeCardDto;
              if (!collectedCards.some((x) => x.shoeId === c.shoeId)) {
                collectedCards.push(c);
              }
            }
            if (obj['quote'] && typeof obj['quote'] === 'object') {
              collectedQuote = obj['quote'] as ChatQuoteCardDto;
            }
          }
          return toolOut;
        },
      });

      const defaultSuggestions = this.buildContextualSuggestions(
        lastUserText,
        collectedCards,
        collectedQuote,
        Boolean(customerId)
      );

      res.json({
        reply: lastAssistant || 'Xin lỗi, mình chưa trả lời được. Thử lại sau nhé.',
        mode: 'gemini',
        ...(collectedCards.length > 0 ? { cards: collectedCards.slice(0, 4) } : {}),
        ...(collectedQuote ? { quote: collectedQuote } : {}),
        suggestions: defaultSuggestions,
      });
    } catch (e: unknown) {
      if (e instanceof DomainError) {
        throw e;
      }
      const smart = await this.buildSmartReply(lastUserText, customerId, contextOptions);
      res.json({
        reply: smart.reply,
        mode: 'fallback',
        ...(smart.cards && smart.cards.length > 0 ? { cards: smart.cards } : {}),
        ...(smart.quote ? { quote: smart.quote } : {}),
        suggestions: smart.suggestions,
      });
    }
  }

  public async buildFallbackReply(
    lastUserText: string,
    customerId: string | undefined,
    contextOptions?: {
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      currentShoeId?: string;
      currentPath?: string;
    }
  ): Promise<string> {
    const smart = await this.buildSmartReply(lastUserText, customerId, contextOptions);
    return smart.reply;
  }

  public async buildSmartReply(
    lastUserText: string,
    customerId: string | undefined,
    contextOptions?: {
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      currentShoeId?: string;
      currentPath?: string;
    }
  ): Promise<ChatSmartPayload> {
    const violation = detectSecurityViolation(lastUserText, customerId);
    if (violation) {
      return {
        reply: violation,
        suggestions: [
          'Shop đang có mã giảm giá nào?',
          'Tìm giày Nike dưới 350.000₫',
          'Quy định đặt cọc & phí trễ hạn',
        ],
      };
    }

    const q = lastUserText.toLowerCase();

    if (
      /hủy đơn giúp|xóa đơn giúp|tạo đơn giúp|đặt thuê giúp|tự động hủy|tự động tạo|cancel order for me/i.test(
        q
      )
    ) {
      return {
        reply:
          '🛡️ Trợ lý AI hoạt động ở chế độ **100% Read-Only (Chỉ đọc)** để bảo vệ an toàn tài khoản của bạn. Mình không trực tiếp tạo, sửa, gia hạn hoặc hủy đơn qua khung chat. Bạn vui lòng thao tác trực tiếp tại trang `/checkout` (đặt đơn) hoặc `/account` (gia hạn / hủy đơn `RESERVED`) nhé!',
        suggestions: [
          'Kiểm tra đơn thuê của tôi',
          'Shop đang có mã giảm giá nào?',
          'Tìm giày Nike còn hàng',
        ],
      };
    }

    const contextShoeId = await this.resolveContextualShoeId(lastUserText, contextOptions);

    // 1. Explicit Rental Order Detail Intent (e.g. "chi tiết đơn REN001" or "#R...")
    const rentalIdMatch = lastUserText.match(/\b(REN\d{2,}|R[A-Z0-9]{4,9})\b/i);
    if (rentalIdMatch && /đơn|don|chi tiết|chi tiet|order|rental|trạng thái|trang thai|status|mã đơn|ma don/i.test(q)) {
      if (!customerId) {
        return {
          reply:
            '🔑 Bạn cần **đăng nhập tài khoản khách hàng** để mình tra cứu chi tiết đơn thuê của bạn nhé!',
          suggestions: ['Tìm giày Nike dưới 350.000₫', 'Shop đang có mã giảm giá nào?'],
        };
      }
      const targetRid = rentalIdMatch[1].toUpperCase();
      const detailRes = (await this.runTool(
        'get_rental_detail',
        { rental_id: targetRid },
        customerId
      )) as {
        ok: boolean;
        rentalId?: string;
        status?: string;
        startDate?: string | Date;
        endDate?: string | Date;
        totalItems?: number;
        basePrice?: number;
        depositAmount?: number;
        totalAmount?: number;
        isOverdue?: boolean;
        overdueDays?: number;
        estimatedLateFee?: number;
        items?: Array<{ shoeName: string; size: number; color: string; quantity: number }>;
        error?: string;
      };
      if (detailRes.ok && detailRes.rentalId) {
        const itemsLines = (detailRes.items ?? []).map(
          (i) => `  - **${i.shoeName}** (Size EU ${i.size} · ${i.color}) × ${i.quantity} đôi`
        );
        const overdueNote = detailRes.isOverdue
          ? `\n• ⚠️ **Cảnh báo quá hạn:** Trễ ${detailRes.overdueDays} ngày (phí dự kiến +${(detailRes.estimatedLateFee ?? 0).toLocaleString('vi-VN')}₫)`
          : '';
        return {
          reply: [
            `📋 **Chi tiết đơn thuê #${detailRes.rentalId}** [${detailRes.status}]:`,
            `• **Số lượng:** ${detailRes.totalItems} đôi`,
            ...itemsLines,
            `• **Tiền thuê:** ${(detailRes.totalAmount ?? 0).toLocaleString('vi-VN')}₫ | **Tiền cọc:** ${(detailRes.depositAmount ?? 0).toLocaleString('vi-VN')}₫${overdueNote}`,
            '👉 Bạn có thể gia hạn, in biên nhận hoặc thuê lại đơn này tại trang `/account`.',
          ].join('\n'),
          suggestions: [
            'Xem toàn bộ đơn thuê của tôi',
            'Shop đang có mã giảm giá nào?',
            'Tìm giày thể thao dưới 350.000₫',
          ],
        };
      }
      return {
        reply: `🔒 Không tìm thấy đơn thuê **#${targetRid}** thuộc tài khoản của bạn (hoặc bạn không có quyền truy cập đơn của khách hàng khác). Bạn vui lòng kiểm tra lại danh sách đơn của mình nhé!`,
        suggestions: [
          'Kiểm tra đơn thuê của tôi',
          'Shop đang có mã giảm giá nào?',
          'Tìm giày thể thao dưới 350.000₫',
        ],
      };
    }

    // 2. Compare Shoes Intent ("so sánh ...")
    if (/so sánh|so sanh|khác nhau|khac nhau|compare|chọn đôi nào giữa|chon doi nao giua/i.test(q)) {
      const allShoes = await this.loadAllStoreShoes();
      const matchedShoes: ShoeSummary[] = [];
      for (const s of allShoes) {
        const nameLower = s.name.toLowerCase();
        const idLower = s.shoeId.toLowerCase();
        const shortTokens = nameLower
          .split(/\s+/)
          .filter((t) => t.length >= 3 && !['nike', 'adidas', 'giày', 'shoe'].includes(t));
        if (
          q.includes(idLower) ||
          q.includes(nameLower) ||
          (shortTokens.length > 0 && shortTokens.some((tok) => q.includes(tok)))
        ) {
          if (!matchedShoes.some((m) => m.shoeId === s.shoeId)) {
            matchedShoes.push(s);
          }
        }
      }
      if (matchedShoes.length < 2) {
        for (const s of allShoes) {
          if (q.includes(s.brand.toLowerCase()) && !matchedShoes.some((m) => m.shoeId === s.shoeId)) {
            matchedShoes.push(s);
          }
          if (matchedShoes.length >= 2) break;
        }
      }
      const compareTargets =
        matchedShoes.length >= 2 ? matchedShoes.slice(0, 3) : allShoes.slice(0, 2);

      if (compareTargets.length >= 2) {
        const compRes = (await this.runTool(
          'compare_shoes',
          { queries: compareTargets.map((s) => s.shoeId) },
          customerId
        )) as {
          ok: boolean;
          cards?: ChatShoeCardDto[];
        };
        const cards = compRes.cards ?? compareTargets.map((s) => toShoeCard(s));
        const lines = cards.map(
          (c) =>
            `• **${c.name}** (${c.brand} · ${c.category}): **${c.pricePerDay.toLocaleString('vi-VN')}₫/ngày** — Size trống: ${c.availableSizes.length > 0 ? c.availableSizes.map((sz) => `EU ${sz}`).join(', ') : 'Hết hàng'} (${c.availableColors.join(', ') || 'N/A'})`
        );
        return {
          reply: [
            `⚖️ **So sánh chi tiết ${cards.length} mẫu giày:**`,
            ...lines,
            `💡 *Cả ${cards.length} mẫu đều áp dụng cọc bảo đảm **500.000₫/đôi** (hoàn 100% khi trả giày nguyên vẹn).*`,
          ].join('\n'),
          cards,
          suggestions: [
            `Báo giá thuê ${cards[0].name} 3 ngày`,
            `Kiểm tra lịch trống ${cards[0].name} ngày mai`,
            'Shop đang có mã giảm giá nào?',
          ],
        };
      }
    }

    const dateRange = this.extractDateRangeFromText(lastUserText);
    const daysMatch = q.match(/(\d+)\s*(ngày|ngay|day|hôm|hom)/i);
    const isQuoteIntent =
      /tính tiền|tinh tien|báo giá|bao gia|hết bao nhiêu|het bao nhieu|tổng tiền|tong tien|chi phí|chi phi|ước tính|uoc tinh|quote|tổng cộng bao nhiêu/i.test(
        q
      ) ||
      (Boolean(daysMatch) && /thuê|thue|giá|gia|tiền|tien|cọc|coc|mã|ma|voucher/i.test(q));

    // 3. Rental Quote / Cost Calculation Intent ("báo giá", "tính tiền", "thuê X ngày hết bao nhiêu")
    if (isQuoteIntent) {
      const explicitShoeId = lastUserText.match(/\b(SHOE\d{3,})\b/i)?.[1]?.toUpperCase();
      const matchedShoe = explicitShoeId
        ? await this.resolveShoeByIdOrName(explicitShoeId, undefined)
        : (await this.findBestMatchingShoeInText(lastUserText)) ??
          (contextShoeId ? await this.resolveShoeByIdOrName(contextShoeId, undefined) : null);

      const days = daysMatch ? Math.max(1, Math.min(30, Number(daysMatch[1]))) : 3;
      const qtyMatch = q.match(/(?:(\d+)\s*(?:đôi|doi)|(?:số lượng|so luong|sl)\s*(\d+))/i);
      const rawQty = qtyMatch ? Number(qtyMatch[1] ?? qtyMatch[2]) : 1;
      const quantity = Math.max(1, Math.min(5, rawQty || 1));

      const knownVoucherMatch = lastUserText.match(
        /\b(WELCOME10|SHOE20|GIAM5|SUMMER\d+|VIP\d+|FLASH\d+)\b/i
      );
      const customCodeMatch = lastUserText.match(/(?:áp mã|ap ma|dùng mã|dung ma|mã|ma|voucher|code)\s+([A-Za-z0-9_-]{3,20})/i);
      const ignoredWords = new Set(['GIẢM', 'GIAM', 'KHUYẾN', 'KHUYEN', 'NÀO', 'NAO', 'GÌ', 'GI', 'TỐT', 'TOT', 'CHO', 'CỦA', 'CUA', 'ĐƠN', 'DON']);
      let voucherCode = knownVoucherMatch
        ? knownVoucherMatch[1].toUpperCase()
        : customCodeMatch && !ignoredWords.has(customCodeMatch[1].toUpperCase())
          ? customCodeMatch[1].toUpperCase()
          : undefined;

      if (!voucherCode && /áp mã|ap ma|dùng mã|dung ma|voucher|kèm mã|kem ma/i.test(q) && this.voucherRepository) {
        const activeVouchers = await this.voucherRepository.listActive(getVietnamTodayYmd());
        if (activeVouchers.length > 0) {
          const best = [...activeVouchers].sort((a, b) => b.discountPercent - a.discountPercent)[0];
          voucherCode = best.code;
        }
      }

      const quoteRes = (await this.runTool(
        'estimate_rental_quote',
        {
          shoe_id: matchedShoe?.shoeId ?? explicitShoeId,
          shoe_name: matchedShoe?.name,
          days,
          ...(dateRange ? { start_date: dateRange.startDate, end_date: dateRange.endDate } : {}),
          quantity,
          ...(voucherCode ? { voucher_code: voucherCode } : {}),
        },
        customerId
      )) as {
        ok: boolean;
        quote?: ChatQuoteCardDto;
        invalidVoucherCode?: string;
        error?: string;
      };

      if (quoteRes.ok && quoteRes.quote) {
        const qt = quoteRes.quote;
        const discountNote =
          qt.effectiveDiscountPercent > 0
            ? `Giảm **-${qt.effectiveDiscountPercent}%** (Hạng ${qt.rank} -${qt.rankDiscountPercent}%${qt.voucherCode ? ` + Voucher ${qt.voucherCode} -${qt.voucherDiscountPercent}%` : ''})`
            : `0% (Hạng ${qt.rank})`;
        const invalidNote = quoteRes.invalidVoucherCode
          ? `\n• ⚠️ *Lưu ý: Mã giảm giá "${quoteRes.invalidVoucherCode}" không tồn tại hoặc đã hết hạn nên chưa được áp dụng.*`
          : '';
        return {
          reply: [
            `🧾 **Báo giá dự kiến thuê ${qt.shoeName} (${qt.quantity} đôi × ${qt.days} ngày):**`,
            `• **Đơn giá gốc:** ${qt.pricePerDay.toLocaleString('vi-VN')}₫/ngày → Tạm tính: **${qt.rawBasePrice.toLocaleString('vi-VN')}₫**`,
            `• **Ưu đãi áp dụng:** ${discountNote}${invalidNote}`,
            `• **Tiền thuê sau giảm:** **${qt.finalRentalPrice.toLocaleString('vi-VN')}₫**`,
            `• **Tiền đặt cọc bảo đảm:** **${qt.depositAmount.toLocaleString('vi-VN')}₫** *(hoàn lại 100% khi trả giày nguyên vẹn)*`,
            `👉 **Tổng thanh toán ban đầu:** **${qt.grandTotal.toLocaleString('vi-VN')}₫**`,
          ].join('\n'),
          quote: qt,
          suggestions: [
            `Kiểm tra lịch trống ${qt.shoeName} ngày mai`,
            'Shop đang có mã giảm giá nào?',
            'So sánh với mẫu giày khác',
          ],
        };
      }
    }

    // 4. Availability Check Intent (by Shoe ID, Shoe Name, or Pronoun + Dates / Relative Dates)
    const hasAvailKeywords =
      /trống|trong lich|lịch|available|availability|còn hàng ngày|con hang ngay|thuê từ ngày|kiểm tra ngày|kiem tra ngay|còn size nào trống|con size nao trong/i.test(
        q
      ) ||
      Boolean(
        lastUserText.match(/\b(SHOE\d{3,})\b.*?\b(\d{4}-\d{2}-\d{2})\b.*?\b(\d{4}-\d{2}-\d{2})\b/i)
      );

    if (dateRange && hasAvailKeywords) {
      const explicitShoeId = lastUserText.match(/\b(SHOE\d{3,})\b/i)?.[1]?.toUpperCase();
      const matchedShoe = explicitShoeId
        ? await this.resolveShoeByIdOrName(explicitShoeId, undefined)
        : (await this.findBestMatchingShoeInText(lastUserText)) ??
          (contextShoeId ? await this.resolveShoeByIdOrName(contextShoeId, undefined) : null);

      const targetShoeId = explicitShoeId ?? matchedShoe?.shoeId;
      if (targetShoeId) {
        const availRes = (await this.runTool(
          'check_shoe_availability',
          {
            shoe_id: targetShoeId,
            start_date: dateRange.startDate,
            end_date: dateRange.endDate,
          },
          customerId
        )) as {
          ok: boolean;
          shoeId?: string;
          name?: string;
          variants?: Array<{ size: number; color: string; availableQuantity: number }>;
          card?: ChatShoeCardDto;
        };

        if (availRes.ok && availRes.variants) {
          const lines = availRes.variants.map(
            (v) => `• Size EU ${v.size} (${v.color}): còn **${v.availableQuantity}** đôi trống`
          );
          return {
            reply: [
              `📅 **Tồn kho khả dụng cho ${availRes.name} (${dateRange.startDate} → ${dateRange.endDate}):**`,
              ...lines,
            ].join('\n'),
            ...(availRes.card ? { cards: [availRes.card] } : {}),
            suggestions: [
              `Báo giá thuê ${availRes.name} từ ${dateRange.startDate} đến ${dateRange.endDate}`,
              'Shop đang có mã giảm giá nào?',
              'Tìm thêm các mẫu giày cùng tầm giá',
            ],
          };
        }
      }
    }

    // 5. Reviews / Top-rated Intent ("đánh giá", "review", "được yêu thích nhất")
    if (/đánh giá|danh gia|review|nhận xét|nhan xet|mấy sao|may sao|tốt nhất|tot nhat|yêu thích nhất|yeu thich nhat/i.test(q)) {
      const matchedShoe =
        (await this.findBestMatchingShoeInText(lastUserText)) ??
        (contextShoeId ? await this.resolveShoeByIdOrName(contextShoeId, undefined) : null);

      const revRes = (await this.runTool(
        'get_shoe_reviews_summary',
        {
          ...(matchedShoe ? { shoe_id: matchedShoe.shoeId } : {}),
        },
        customerId
      )) as {
        ok: boolean;
        shoeName?: string;
        averageRating?: number;
        totalReviews?: number;
        reviews?: Array<{ customerName: string; rating: number; comment: string }>;
        topShoes?: Array<{ shoeId: string; name: string; brand: string; averageRating: number; reviewCount: number }>;
        cards?: ChatShoeCardDto[];
      };

      if (revRes.ok) {
        if (revRes.shoeName && revRes.reviews) {
          const revLines =
            revRes.reviews.length > 0
              ? revRes.reviews
                  .slice(0, 3)
                  .map((r) => `• **${r.customerName}** (${r.rating}★): "${r.comment}"`)
              : ['• Hiện mẫu này chưa có bình luận chi tiết, điểm mặc định **5.0★**.'];
          return {
            reply: [
              `⭐ **Đánh giá khách hàng cho ${revRes.shoeName}:** Trung bình **${revRes.averageRating ?? 5}★** (${revRes.totalReviews ?? 0} đánh giá)`,
              ...revLines,
            ].join('\n'),
            ...(revRes.cards ? { cards: revRes.cards } : {}),
            suggestions: [
              `Báo giá thuê ${revRes.shoeName} 3 ngày`,
              `Kiểm tra lịch trống ${revRes.shoeName}`,
              'Tìm các mẫu giày nổi bật khác',
            ],
          };
        }

        if (revRes.topShoes && revRes.topShoes.length > 0) {
          const lines = revRes.topShoes.map(
            (t) => `• **${t.name}** (${t.brand}) — **${t.averageRating}★** (${t.reviewCount} lượt đánh giá)`
          );
          return {
            reply: ['🏆 **Top các mẫu giày được khách hàng đánh giá cao nhất:**', ...lines].join('\n'),
            ...(revRes.cards ? { cards: revRes.cards } : {}),
            suggestions: [
              `Báo giá thuê ${revRes.topShoes[0].name} 3 ngày`,
              'Shop đang có mã giảm giá nào?',
              'Tìm giày dưới 350.000₫',
            ],
          };
        }
      }
    }

    // 6. Active Vouchers Intent
    if (/voucher|mã giảm|ma giam|khuyến mãi|khuyen mai|ưu đãi|uu dai/.test(q)) {
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
        return {
          reply:
            'Hiện tại chưa có mã voucher khuyến mãi nào đang mở. Tuy nhiên bạn vẫn được giảm tự động theo hạng thành viên (SILVER -5%, GOLD -10%, DIAMOND -15%) khi thuê giày nhé!',
          suggestions: [
            'Kiểm tra hạng thành viên của tôi',
            'Tìm giày Nike dưới 350.000₫',
            'Báo giá thuê giày 3 ngày',
          ],
        };
      }
      const lines = vouchers.map(
        (v) =>
          `• **${v.code}** (-${v.discountPercent}%): ${v.description}${v.expiresAt ? ` (HSD: ${v.expiresAt})` : ''}`
      );
      return {
        reply: [
          '🎁 **Các mã giảm giá (Voucher) đang hoạt động:**',
          ...lines,
          '💡 *Lưu ý: Mã giảm giá được cộng dồn với ưu đãi hạng thành viên (tối đa 50%) tại trang `/checkout`.*',
        ].join('\n'),
        suggestions: [
          `Tính tiền thuê giày 3 ngày áp mã ${vouchers[0].code}`,
          'Kiểm tra hạng thành viên của tôi',
          'Tìm giày dưới 350.000₫',
        ],
      };
    }

    // 7. Membership Rank & My Rentals Intent
    if (/hạng|hang thanh vien|rank|thành viên|thanh vien|đơn thuê|don thue|đơn của tôi|don cua toi|đơn hàng|don hang|quá hạn|qua han|trễ hạn|tre han/.test(q)) {
      if (!customerId) {
        return {
          reply:
            '🔑 Bạn cần **đăng nhập tài khoản khách hàng** để mình tra cứu hạng thành viên, mức ưu đãi và danh sách đơn thuê của bạn nhé!',
          suggestions: [
            'Shop đang có mã giảm giá nào?',
            'Tìm giày Nike dưới 350.000₫',
            'Quy định đặt cọc & phí trễ hạn',
          ],
        };
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
      return {
        reply: parts.join('\n\n'),
        suggestions: [
          list.length > 0 ? `Chi tiết đơn ${list[0].rentalId}` : 'Tìm giày Nike dưới 350.000₫',
          'Shop đang có mã giảm giá nào?',
          'Báo giá thuê giày 3 ngày',
        ],
      };
    }

    // 8. Multi-Criteria Shoe Search Intent
    if (
      /giày|giay|shoe|giá|gia|tìm|tim|mẫu|mau|size|cỡ|co|màu|nike|adidas|converse|vans|puma|new balance|jordan|chạy bộ|chay bo|bóng rổ|bong ro|sneaker|lifestyle|dưới|duoi|còn hàng|con hang/i.test(
        q
      )
    ) {
      const filters = this.extractSearchFiltersFromText(lastUserText, dateRange);
      const shoesRes = (await this.runTool('search_shoes', filters, customerId)) as {
        ok: boolean;
        shoes?: Array<{
          shoeId: string;
          name: string;
          brand: string;
          category?: string;
          pricePerDay: number;
          inStock: boolean;
          availableSizes?: number[];
          availableColors?: string[];
        }>;
        cards?: ChatShoeCardDto[];
      };
      const cards = (shoesRes.cards ?? []).slice(0, 4);
      const shoes = (shoesRes.shoes ?? []).slice(0, 5);
      if (shoes.length > 0) {
        const lines = shoes.map((s) => {
          const sizeStr =
            s.availableSizes && s.availableSizes.length > 0
              ? ` · Size: ${s.availableSizes.map((sz) => `EU ${sz}`).join(', ')}`
              : '';
          return `• **${s.name}** (${s.brand}) — **${s.pricePerDay.toLocaleString('vi-VN')}₫/ngày** ${s.inStock ? '✅ Còn hàng' : '❌ Hết hàng'}${sizeStr}`;
        });
        return {
          reply: [
            '👟 **Gợi ý các mẫu giày phù hợp tại cửa hàng:**',
            ...lines,
            '💡 *Tiền đặt cọc bảo đảm: **500.000₫/đôi** (hoàn trả 100% khi trả giày nguyên vẹn).*',
          ].join('\n'),
          cards,
          suggestions: [
            `Báo giá thuê ${shoes[0].name} 3 ngày`,
            shoes.length >= 2
              ? `So sánh ${shoes[0].name} và ${shoes[1].name}`
              : `Kiểm tra lịch trống ${shoes[0].name} ngày mai`,
            'Shop đang có mã giảm giá nào?',
          ],
        };
      }
      return {
        reply:
          '🔍 Hiện mình chưa tìm thấy mẫu giày nào khớp chính xác toàn bộ tiêu chí lọc của bạn. Bạn thử nới rộng mức giá hoặc chọn size/màu khác nhé!',
        suggestions: [
          'Tìm tất cả giày còn hàng dưới 500.000₫',
          'Tìm giày Nike',
          'Shop đang có mã giảm giá nào?',
        ],
      };
    }

    // 9. Policies / Deposit / Late Fee FAQ Intent
    if (/cọc|đặt cọc|dat coc|deposit|phí phạt|phi phat|phạt trễ|phat tre|chính sách|chinh sach|policy|momo|thanh toán|thanh toan/i.test(q)) {
      return {
        reply: [
          '📜 **Chính sách Thuê Giày & Thanh Toán tại Rental Shoes:**',
          '• **Tiền đặt cọc bảo đảm:** **500.000₫ / đôi** (hoàn trả 100% ngay khi trả giày nguyên vẹn).',
          '• **Phí trả trễ hạn:** **50% đơn giá ngày × số ngày trễ**.',
          '• **Thanh toán MoMo:** Giữ chỗ tối đa **15 phút**; nếu quá 15 phút chưa thanh toán, hệ thống tự động hủy đơn để hoàn trả tồn kho.',
          '• **Hủy & Gia hạn:** Đơn `RESERVED` được hủy miễn phí trước ngày nhận ít nhất 1 ngày tại `/account`.',
        ].join('\n'),
        suggestions: [
          'Tìm giày Nike dưới 350.000₫',
          'Shop đang có mã giảm giá nào?',
          'Báo giá thuê giày 3 ngày',
        ],
      };
    }

    return {
      reply: [
        '👋 **Chào bạn! Mình là trợ lý AI thông minh của Rental Shoes (Zero-Trust Read-Only Concierge).**',
        '• **Tìm giày đa tiêu chí:** Theo thương hiệu (Nike, Adidas...), size EU (36–45), màu sắc, tầm giá và lịch trống.',
        '• **Báo giá tự động:** Tính chi tiết tiền thuê, cộng dồn ưu đãi Hạng thành viên + Voucher (tối đa **50%**) và tiền cọc (**500.000₫/đôi**).',
        '• **So sánh & Đánh giá:** So sánh trực tiếp 2–3 mẫu giày hoặc xem đánh giá thực tế từ khách thuê.',
        'Hãy chọn một gợi ý bên dưới hoặc nhập yêu cầu của bạn nhé!',
      ].join('\n'),
      suggestions: [
        'Tìm giày Nike size 42 dưới 400.000₫',
        'Báo giá thuê giày 3 ngày kèm mã giảm giá',
        'Shop đang có mã giảm giá nào?',
        customerId ? 'Kiểm tra đơn thuê & hạng của tôi' : 'Top giày được đánh giá cao nhất',
      ],
    };
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
      const rawMax = args['max_price_vnd'] ?? args['max_price_usd'];
      const maxInput = rawMax !== undefined ? Number(rawMax) : 550000;
      if (!Number.isFinite(maxInput) || maxInput <= 0) {
        return { ok: false, error: 'Invalid max_price_usd' };
      }

      const keyword = String(args['keyword'] ?? '').trim().toLowerCase();
      const brand = String(args['brand'] ?? '').trim().toLowerCase();
      const category = String(args['category'] ?? '').trim().toLowerCase();
      const size = args['size'] !== undefined ? Number(args['size']) : undefined;
      const color = String(args['color'] ?? '').trim().toLowerCase();
      const startDateStr = String(args['start_date'] ?? '').trim();
      const endDateStr = String(args['end_date'] ?? '').trim();

      let shoes = await this.searchShoesByMaxPriceUsd(maxInput);

      if (keyword) {
        const kwTokens = keyword.split(/\s+/).filter(Boolean);
        shoes = shoes.filter((s) => {
          const hay = `${s.shoeId} ${s.name} ${s.brand} ${s.category}`.toLowerCase();
          return kwTokens.every((t) => hay.includes(t));
        });
      }

      if (brand) {
        shoes = shoes.filter((s) => s.brand.toLowerCase().includes(brand));
      }

      if (category) {
        const catVariants = normalizeCategoryQuery(category);
        shoes = shoes.filter((s) =>
          catVariants.some(
            (cv) =>
              s.category.toLowerCase().includes(cv) || s.name.toLowerCase().includes(cv)
          )
        );
      }

      if (size !== undefined && Number.isFinite(size)) {
        shoes = shoes.filter((s) =>
          (s.variants ?? []).some((v) => v.size === size && v.totalQuantity > 0)
        );
      }

      if (color) {
        const colorVariants = normalizeColorQuery(color);
        shoes = shoes.filter((s) =>
          (s.variants ?? []).some(
            (v) =>
              v.totalQuantity > 0 &&
              colorVariants.some((cv) => v.color.toLowerCase().includes(cv))
          )
        );
      }

      if (startDateStr && endDateStr && /^\d{4}-\d{2}-\d{2}$/.test(startDateStr) && /^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
        try {
          const period = new RentalPeriod(new Date(startDateStr), new Date(endDateStr));
          if (this.availabilityChecker) {
            const filteredByDate: ShoeSummary[] = [];
            for (const s of shoes) {
              let availSum = 0;
              const enrichedVars = [];
              for (const v of s.variants ?? []) {
                if (size !== undefined && v.size !== size) continue;
                const reserved = await this.availabilityChecker.getReservedQuantityForVariant(
                  v.variantId,
                  period
                );
                const avail = Math.max(0, v.totalQuantity - reserved);
                availSum += avail;
                enrichedVars.push({ ...v, reservedQuantity: reserved, availableQuantity: avail });
              }
              if (availSum > 0) {
                filteredByDate.push({
                  ...s,
                  availableUnitsInRange: availSum,
                  variants: enrichedVars.length > 0 ? enrichedVars : s.variants,
                });
              }
            }
            shoes = filteredByDate;
          }
        } catch {
          // ignore invalid date range in search filter
        }
      }

      const hasValidSearchDates = Boolean(
        startDateStr &&
          endDateStr &&
          /^\d{4}-\d{2}-\d{2}$/.test(startDateStr) &&
          /^\d{4}-\d{2}-\d{2}$/.test(endDateStr)
      );
      const cards = shoes.map((s) => {
        const card = toShoeCard(s);
        if (hasValidSearchDates) {
          card.actionUrl = `/shoes/${s.shoeId}?startDate=${encodeURIComponent(startDateStr)}&endDate=${encodeURIComponent(endDateStr)}`;
        }
        return card;
      });
      return {
        ok: true,
        max_price_usd: maxInput,
        shoes: cards.map((c) => ({
          shoeId: c.shoeId,
          name: c.name,
          pricePerDay: c.pricePerDay,
          brand: c.brand,
          category: c.category,
          inStock: c.inStock,
          availableUnits: c.availableUnits,
          availableSizes: c.availableSizes,
          availableColors: c.availableColors,
          actionUrl: c.actionUrl,
        })),
        cards,
        count: cards.length,
      };
    }

    if (name === 'check_shoe_availability') {
      const rawShoeId = String(args['shoe_id'] ?? '').trim();
      const rawShoeName = String(args['shoe_name'] ?? '').trim();
      const startDateStr = String(args['start_date'] ?? '').trim();
      const endDateStr = String(args['end_date'] ?? '').trim();

      let resolvedShoeId = rawShoeId;
      if (!resolvedShoeId && rawShoeName) {
        const matched = await this.resolveShoeByIdOrName(undefined, rawShoeName);
        if (matched) resolvedShoeId = matched.shoeId;
      }

      if (!resolvedShoeId || !startDateStr || !endDateStr) {
        return { ok: false, error: 'Missing shoe_id, start_date, or end_date' };
      }
      if (!this.getShoe) {
        return { ok: false, error: 'Shoe service unavailable' };
      }
      try {
        const shoe = await this.getShoe.execute({ shoeId: resolvedShoeId });
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
        const availVariants = variants.filter((v) => v.availableQuantity > 0);
        const totalAvail = variants.reduce((sum, v) => sum + v.availableQuantity, 0);
        const card: ChatShoeCardDto = {
          shoeId: shoe.shoeId,
          name: shoe.name,
          brand: shoe.brand,
          category: shoe.category,
          pricePerDay: shoe.pricePerDay,
          availableSizes: Array.from(new Set(availVariants.map((v) => v.size))).sort((a, b) => a - b),
          availableColors: Array.from(new Set(availVariants.map((v) => v.color))),
          inStock: totalAvail > 0,
          availableUnits: totalAvail,
          actionUrl: `/shoes/${shoe.shoeId}?startDate=${encodeURIComponent(startDateStr)}&endDate=${encodeURIComponent(endDateStr)}`,
        };

        return {
          ok: true,
          shoeId: shoe.shoeId,
          name: shoe.name,
          brand: shoe.brand,
          category: shoe.category,
          pricePerDay: shoe.pricePerDay,
          startDate: startDateStr,
          endDate: endDateStr,
          variants,
          card,
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unable to check availability';
        return { ok: false, error: msg };
      }
    }

    if (name === 'estimate_rental_quote') {
      const rawShoeId = String(args['shoe_id'] ?? '').trim();
      const rawShoeName = String(args['shoe_name'] ?? '').trim();
      const matched = await this.resolveShoeByIdOrName(rawShoeId || undefined, rawShoeName || undefined);
      const allShoes = matched ? [matched] : await this.loadAllStoreShoes();
      const target = matched ?? allShoes[0];
      if (!target) {
        return { ok: false, error: 'Shoe not found for quote estimation' };
      }

      const startDateStr = String(args['start_date'] ?? '').trim();
      const endDateStr = String(args['end_date'] ?? '').trim();
      let days = Math.max(1, Math.min(30, Math.round(Number(args['days'] ?? 3)) || 3));
      if (startDateStr && endDateStr && /^\d{4}-\d{2}-\d{2}$/.test(startDateStr) && /^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
        try {
          const p = new RentalPeriod(new Date(startDateStr), new Date(endDateStr));
          days = p.durationInDays;
        } catch {
          // keep fallback days
        }
      }

      const quantity = Math.max(1, Math.min(5, Math.round(Number(args['quantity'] ?? 1)) || 1));

      let rank = 'BRONZE';
      let rankDiscountPercent = 0;
      if (customerId && this.customerRepository) {
        const cust = await this.customerRepository.findById(customerId);
        if (cust) {
          rank = cust.rank;
          rankDiscountPercent = getDiscountPercentByRank(cust.rank);
        }
      }

      let voucherCode: string | null = null;
      let voucherDiscountPercent = 0;
      let invalidVoucherCode: string | undefined;
      const rawVoucher = String(args['voucher_code'] ?? '').trim().toUpperCase();
      if (rawVoucher) {
        if (this.voucherRepository) {
          const v = await this.voucherRepository.findByCode(rawVoucher);
          const todayStr = getVietnamTodayYmd();
          if (
            v &&
            v.isActive &&
            (!v.expiresAt || todayStr <= v.expiresAt) &&
            (v.maxUses === null || v.usedCount < v.maxUses)
          ) {
            voucherCode = v.code;
            voucherDiscountPercent = v.discountPercent;
          } else {
            invalidVoucherCode = rawVoucher;
          }
        } else {
          try {
            const v = resolveVoucher(rawVoucher);
            if (v) {
              voucherCode = v.code;
              voucherDiscountPercent = v.discountPercent;
            } else {
              invalidVoucherCode = rawVoucher;
            }
          } catch {
            invalidVoucherCode = rawVoucher;
          }
        }
      }

      const effectiveDiscountPercent = Math.min(50, rankDiscountPercent + voucherDiscountPercent);
      const discountedUnitPrice =
        effectiveDiscountPercent > 0
          ? Math.max(
              1,
              Math.round((target.pricePerDay * (100 - effectiveDiscountPercent)) / 100)
            )
          : target.pricePerDay;

      const rawBasePrice = target.pricePerDay * quantity * days;
      const finalRentalPrice = discountedUnitPrice * quantity * days;
      const depositAmount = 500000 * quantity;
      const grandTotal = finalRentalPrice + depositAmount;

      const queryParts: string[] = [];
      if (startDateStr && endDateStr) {
        queryParts.push(`startDate=${encodeURIComponent(startDateStr)}`);
        queryParts.push(`endDate=${encodeURIComponent(endDateStr)}`);
      }
      if (quantity > 1) {
        queryParts.push(`qty=${quantity}`);
      }
      if (voucherCode) {
        queryParts.push(`voucher=${encodeURIComponent(voucherCode)}`);
      }
      const actionUrl =
        queryParts.length > 0
          ? `/shoes/${target.shoeId}?${queryParts.join('&')}`
          : `/shoes/${target.shoeId}`;

      const quote: ChatQuoteCardDto = {
        shoeId: target.shoeId,
        shoeName: target.name,
        brand: target.brand,
        pricePerDay: target.pricePerDay,
        days,
        quantity,
        ...(startDateStr ? { startDate: startDateStr } : {}),
        ...(endDateStr ? { endDate: endDateStr } : {}),
        rawBasePrice,
        rank,
        rankDiscountPercent,
        voucherCode,
        voucherDiscountPercent,
        effectiveDiscountPercent,
        finalRentalPrice,
        depositAmount,
        grandTotal,
        actionUrl,
      };

      return {
        ok: true,
        quote,
        ...(invalidVoucherCode ? { invalidVoucherCode } : {}),
      };
    }

    if (name === 'get_shoe_reviews_summary') {
      const rawShoeId = String(args['shoe_id'] ?? '').trim();
      const rawShoeName = String(args['shoe_name'] ?? '').trim();
      const target =
        rawShoeId || rawShoeName
          ? await this.resolveShoeByIdOrName(rawShoeId || undefined, rawShoeName || undefined)
          : null;

      if (target) {
        let averageRating = 5;
        let totalReviews = 0;
        const reviews: Array<{ customerName: string; rating: number; comment: string }> = [];

        if (this.pool) {
          try {
            const [rows] = await this.pool.query<RowDataPacket[]>(
              `SELECT customer_name, rating, comment
               FROM shoe_reviews
               WHERE shoe_id = ?
               ORDER BY created_at DESC
               LIMIT 5`,
              [target.shoeId]
            );
            for (const r of rows) {
              reviews.push({
                customerName: String(r['customer_name'] ?? 'Khách hàng'),
                rating: Number(r['rating'] ?? 5),
                comment: String(r['comment'] ?? ''),
              });
            }
            const [cntRows] = await this.pool.query<RowDataPacket[]>(
              `SELECT COUNT(*) AS cnt, ROUND(AVG(rating), 1) AS avg_rating
               FROM shoe_reviews WHERE shoe_id = ?`,
              [target.shoeId]
            );
            if (cntRows.length > 0) {
              totalReviews = Number(cntRows[0]['cnt'] ?? 0);
              averageRating =
                cntRows[0]['avg_rating'] !== null ? Number(cntRows[0]['avg_rating']) : 5;
            }
          } catch {
            // ignore
          }
        }

        const card = toShoeCard(target, averageRating);
        return {
          ok: true,
          shoeId: target.shoeId,
          shoeName: target.name,
          averageRating,
          totalReviews,
          reviews,
          cards: [card],
        };
      }

      const allShoes = await this.loadAllStoreShoes();
      const topShoes: Array<{
        shoeId: string;
        name: string;
        brand: string;
        averageRating: number;
        reviewCount: number;
      }> = [];

      if (this.pool) {
        try {
          const [rows] = await this.pool.query<RowDataPacket[]>(
            `SELECT shoe_id, COUNT(*) AS cnt, ROUND(AVG(rating), 1) AS avg_rating
             FROM shoe_reviews
             GROUP BY shoe_id
             ORDER BY avg_rating DESC, cnt DESC
             LIMIT 4`
          );
          for (const r of rows) {
            const sid = String(r['shoe_id']);
            const found = allShoes.find((s) => s.shoeId === sid);
            if (found) {
              topShoes.push({
                shoeId: found.shoeId,
                name: found.name,
                brand: found.brand,
                averageRating: Number(r['avg_rating'] ?? 5),
                reviewCount: Number(r['cnt'] ?? 1),
              });
            }
          }
        } catch {
          // ignore
        }
      }

      if (topShoes.length === 0) {
        for (const s of allShoes.slice(0, 3)) {
          topShoes.push({
            shoeId: s.shoeId,
            name: s.name,
            brand: s.brand,
            averageRating: 5.0,
            reviewCount: 1,
          });
        }
      }

      const cards = topShoes
        .map((t) => {
          const found = allShoes.find((s) => s.shoeId === t.shoeId);
          return found ? toShoeCard(found, t.averageRating) : null;
        })
        .filter((c): c is ChatShoeCardDto => c !== null);

      return {
        ok: true,
        topShoes,
        cards,
      };
    }

    if (name === 'compare_shoes') {
      const rawQueries = Array.isArray(args['queries'])
        ? (args['queries'] as unknown[]).map((x) => String(x).trim()).filter(Boolean)
        : [];
      const matched: ShoeSummary[] = [];
      for (const qStr of rawQueries.slice(0, 3)) {
        const s = await this.resolveShoeByIdOrName(qStr, qStr);
        if (s && !matched.some((m) => m.shoeId === s.shoeId)) {
          matched.push(s);
        }
      }
      if (matched.length < 2) {
        const all = await this.loadAllStoreShoes();
        for (const s of all) {
          if (!matched.some((m) => m.shoeId === s.shoeId)) {
            matched.push(s);
          }
          if (matched.length >= 2) break;
        }
      }
      const cards = matched.slice(0, 3).map((s) => toShoeCard(s));
      return {
        ok: true,
        shoes: cards,
        cards,
        count: cards.length,
      };
    }

    return { ok: false, error: 'Unknown tool' };
  }

  private async loadAllStoreShoes(): Promise<ShoeSummary[]> {
    const r = await this.listShoes.execute({ priceBucket: 'all', page: 1, pageSize: 50 });
    if (r.shoes.length > 0) return r.shoes;
    const a = await this.listShoes.execute({ priceBucket: 'lt10', page: 1, pageSize: 25 });
    const b = await this.listShoes.execute({ priceBucket: '10to20', page: 1, pageSize: 25 });
    const c = await this.listShoes.execute({ priceBucket: '20to50', page: 1, pageSize: 25 });
    const d = await this.listShoes.execute({ priceBucket: 'gt50', page: 1, pageSize: 25 });
    return mergeShoeLists([a.shoes, b.shoes, c.shoes, d.shoes]);
  }

  private async resolveShoeByIdOrName(
    shoeId?: string,
    shoeName?: string
  ): Promise<ShoeSummary | null> {
    const all = await this.loadAllStoreShoes();
    if (shoeId) {
      const idNorm = shoeId.trim().toLowerCase();
      const exact = all.find((s) => s.shoeId.toLowerCase() === idNorm);
      if (exact) return exact;
    }
    const query = (shoeName || shoeId || '').trim().toLowerCase();
    if (!query) return null;

    const bySubstring = all.find(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        query.includes(s.name.toLowerCase()) ||
        s.shoeId.toLowerCase() === query
    );
    if (bySubstring) return bySubstring;

    const tokens = query
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !['giày', 'đôi', 'mẫu', 'thuê', 'shoe'].includes(t));
    if (tokens.length === 0) return null;

    let bestShoe: ShoeSummary | null = null;
    let bestScore = 0;
    for (const s of all) {
      const hay = `${s.name} ${s.brand} ${s.category}`.toLowerCase();
      let score = 0;
      for (const tok of tokens) {
        if (hay.includes(tok)) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        bestShoe = s;
      }
    }
    return bestScore > 0 ? bestShoe : null;
  }

  private async findBestMatchingShoeInText(text: string): Promise<ShoeSummary | null> {
    const all = await this.loadAllStoreShoes();
    const q = text.toLowerCase();
    for (const s of all) {
      if (q.includes(s.shoeId.toLowerCase()) || q.includes(s.name.toLowerCase())) {
        return s;
      }
    }
    for (const s of all) {
      const nameTokens = s.name
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length >= 3 && !['nike', 'adidas', 'converse', 'vans', 'puma', 'new'].includes(t));
      if (nameTokens.length > 0 && nameTokens.some((tok) => q.includes(tok))) {
        return s;
      }
    }
    return null;
  }

  private async resolveContextualShoeId(
    lastUserText: string,
    contextOptions?: {
      messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
      currentShoeId?: string;
      currentPath?: string;
    }
  ): Promise<string | undefined> {
    if (contextOptions?.currentShoeId) {
      return contextOptions.currentShoeId;
    }
    if (contextOptions?.currentPath) {
      const pathMatch = contextOptions.currentPath.match(/\/shoes\/([A-Za-z0-9_-]+)/);
      if (pathMatch) return pathMatch[1];
    }

    const history = contextOptions?.messages ?? [];
    for (let i = history.length - 1; i >= 0; i--) {
      const content = history[i].content;
      const idMatch = content.match(/\b(SHOE\d{3,}|S\d{3,})\b/i);
      if (idMatch) {
        return idMatch[1].toUpperCase();
      }
      const matchedShoe = await this.findBestMatchingShoeInText(content);
      if (matchedShoe) {
        return matchedShoe.shoeId;
      }
    }
    const inCurrent = await this.findBestMatchingShoeInText(lastUserText);
    return inCurrent?.shoeId;
  }

  private extractDateRangeFromText(text: string): { startDate: string; endDate: string } | null {
    const explicitDates = [...text.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map((m) => m[1]);
    if (explicitDates.length >= 2) {
      return { startDate: explicitDates[0], endDate: explicitDates[1] };
    }
    if (explicitDates.length === 1) {
      return { startDate: explicitDates[0], endDate: addDaysYmd(explicitDates[0], 2) };
    }

    const q = text.toLowerCase();
    const today = getVietnamTodayYmd();
    if (/ngày mai|mai thuê/i.test(q)) {
      const start = addDaysYmd(today, 1);
      return { startDate: start, endDate: addDaysYmd(start, 2) };
    }
    if (/hôm nay/i.test(q)) {
      return { startDate: today, endDate: addDaysYmd(today, 2) };
    }
    if (/cuối tuần/i.test(q)) {
      const start = addDaysYmd(today, 2);
      return { startDate: start, endDate: addDaysYmd(start, 2) };
    }
    return null;
  }

  private extractSearchFiltersFromText(
    text: string,
    dateRange: { startDate: string; endDate: string } | null
  ): Record<string, unknown> {
    const q = text.toLowerCase();
    const filters: Record<string, unknown> = { max_price_vnd: 550000 };

    // Price extraction: e.g. "dưới 350k", "dưới 350.000", "300000"
    const kMatch = q.match(/(?:dưới|tầm|khoảng|<=?|max)\s*(\d{2,3})\s*(?:k|nghìn|ngàn)/i);
    const vndMatch = q.match(/(?:dưới|tầm|khoảng|<=?|max)?\s*(\d{3})[.,]?(\d{3})\s*(?:₫|đ|vnd|đồng)?/i);
    if (kMatch) {
      filters['max_price_vnd'] = Number(kMatch[1]) * 1000;
    } else if (vndMatch) {
      filters['max_price_vnd'] = Number(`${vndMatch[1]}${vndMatch[2]}`);
    }

    // Size extraction: "size 42", "cỡ 41"
    const sizeMatch = q.match(/(?:size|cỡ|sz)\s*(?:eu\s*)?(\d{2})/i);
    if (sizeMatch) {
      const sz = Number(sizeMatch[1]);
      if (sz >= 35 && sz <= 48) {
        filters['size'] = sz;
      }
    }

    // Brand extraction
    const brands = ['nike', 'adidas', 'converse', 'vans', 'new balance', 'puma', 'asics', 'reebok'];
    for (const b of brands) {
      if (q.includes(b)) {
        filters['brand'] = b;
        break;
      }
    }

    // Category extraction
    for (const [catKey, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
      if (synonyms.some((syn) => q.includes(syn))) {
        filters['category'] = catKey;
        break;
      }
    }

    // Color extraction
    const colorTrigger = q.match(/màu\s+(trắng|đen|đỏ|xanh|xám|vàng|hồng|nâu|kem|white|black|red|blue|grey)/i);
    if (colorTrigger) {
      filters['color'] = colorTrigger[1];
    }

    // Specific model keyword extraction
    const modelKeywords = ['jordan', 'air force', 'air max', 'pegasus', 'ultraboost', 'stan smith', 'chuck 70', 'old skool'];
    for (const mk of modelKeywords) {
      if (q.includes(mk)) {
        filters['keyword'] = mk;
        break;
      }
    }

    if (dateRange) {
      filters['start_date'] = dateRange.startDate;
      filters['end_date'] = dateRange.endDate;
    }

    return filters;
  }

  private buildContextualSuggestions(
    lastUserText: string,
    cards: ChatShoeCardDto[],
    quote: ChatQuoteCardDto | undefined,
    isLoggedIn: boolean
  ): string[] {
    if (quote) {
      return [
        `Kiểm tra lịch trống ${quote.shoeName} ngày mai`,
        'Shop đang có mã giảm giá nào?',
        'Tìm thêm giày dưới 350.000₫',
      ];
    }
    if (cards.length >= 2) {
      return [
        `So sánh ${cards[0].name} và ${cards[1].name}`,
        `Báo giá thuê ${cards[0].name} 3 ngày`,
        'Shop đang có mã giảm giá nào?',
      ];
    }
    if (cards.length === 1) {
      return [
        `Báo giá thuê ${cards[0].name} 3 ngày`,
        `Kiểm tra lịch trống ${cards[0].name} ngày mai`,
        `Đánh giá khách hàng cho ${cards[0].name}`,
      ];
    }
    if (/voucher|mã giảm/i.test(lastUserText)) {
      return [
        'Báo giá thuê giày 3 ngày áp mã WELCOME10',
        'Tìm giày Nike dưới 350.000₫',
        isLoggedIn ? 'Kiểm tra hạng thành viên của tôi' : 'Quy định đặt cọc & phí trễ hạn',
      ];
    }
    return [
      'Tìm giày Nike size 42 dưới 400.000₫',
      'Shop đang có mã giảm giá nào?',
      'Báo giá thuê giày 3 ngày',
      isLoggedIn ? 'Kiểm tra đơn thuê của tôi' : 'Top giày được đánh giá cao nhất',
    ];
  }

  private async searchShoesByMaxPriceUsd(maxInput: number): Promise<ShoeSummary[]> {
    const normalizedMaxVnd = maxInput > 0 && maxInput < 1000 ? maxInput * 1000 : maxInput;
    const cap = 50;
    let shoes: ShoeSummary[];

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
      const a = await this.listShoes.execute({ priceBucket: 'lt10', page: 1, pageSize: 25 });
      const b = await this.listShoes.execute({ priceBucket: '10to20', page: 1, pageSize: 25 });
      const c = await this.listShoes.execute({ priceBucket: '20to50', page: 1, pageSize: 25 });
      shoes = mergeShoeLists([a.shoes, b.shoes, c.shoes]).slice(0, cap);
    } else {
      shoes = await this.loadAllStoreShoes();
    }

    return shoes.filter((s) => s.pricePerDay <= normalizedMaxVnd);
  }
}
