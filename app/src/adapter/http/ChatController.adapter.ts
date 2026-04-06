import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import type { Request, Response, RequestHandler } from 'express';
import { z } from 'zod';
import type { GetRentalUseCase } from '@usecase/GetRentalUseCase.port';
import type { ListRentalsUseCase } from '@usecase/ListRentalsUseCase.port';
import type { ListShoesUseCase } from '@usecase/ListShoesUseCase.port';
import { asyncRoute } from './middleware/routeMiddleware';
import { DomainError } from '@domain/errors/DomainError';
import { geminiChatWithTools } from '@infra/gemini/geminiChat';

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

  constructor(
    listRentals: ListRentalsUseCase,
    getRental: GetRentalUseCase,
    listShoes: ListShoesUseCase
  ) {
    this.listRentals = listRentals;
    this.getRental = getRental;
    this.listShoes = listShoes;
  }

  routes(optionalAuth: RequestHandler[]): Router {
    const router = Router();
    router.post('/chat', ...optionalAuth, asyncRoute(this.postChat.bind(this)));
    return router;
  }

  private async postChat(req: Request, res: Response): Promise<void> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({
        error: 'CHAT_DISABLED',
        message: 'Chat is not configured (missing GEMINI_API_KEY).',
      });
      return;
    }

    const body = BodySchema.parse(req.body);
    const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
    const pendingMin = process.env.PAYMENT_PENDING_MINUTES?.trim() || '15';

    const systemText = [
      'You are the storefront assistant for a shoe rental web app.',
      'Follow GuildChatBot rules: no hallucinated data; use tool results for real data.',
      `Static policy: unpaid MoMo checkout window is typically ~${pendingMin} minutes (then order may auto-cancel).`,
      '--- Allowed knowledge (markdown) ---',
      loadKnowledgeText(),
    ].join('\n\n');

    const auth = req.auth;
    const customerId = auth?.role === 'customer' ? auth.customerId ?? undefined : undefined;

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
      const msg =
        e instanceof Error ? e.message : 'Không gọi được dịch vụ Gemini. Kiểm tra GEMINI_API_KEY và mạng.';
      res.status(502).json({
        error: 'CHAT_UPSTREAM_ERROR',
        message: msg,
      });
    }
  }

  private async runTool(
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
          totalAmount: r.totalAmount,
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
          totalAmount: r.totalAmount,
          note: r.note,
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Not found';
        return { ok: false, error: msg };
      }
    }

    if (name === 'search_shoes') {
      const maxUsd = Number(args['max_price_usd']);
      if (!Number.isFinite(maxUsd) || maxUsd <= 0) {
        return { ok: false, error: 'Invalid max_price_usd' };
      }
      const shoes = await this.searchShoesByMaxPriceUsd(maxUsd);
      return {
        ok: true,
        max_price_usd: maxUsd,
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

    return { ok: false, error: 'Unknown tool' };
  }

  private async searchShoesByMaxPriceUsd(maxUsd: number) {
    const cap = 25;
    if (maxUsd <= 10) {
      const r = await this.listShoes.execute({
        priceBucket: 'lt10',
        page: 1,
        pageSize: cap,
      });
      return r.shoes;
    }
    if (maxUsd <= 20) {
      const a = await this.listShoes.execute({ priceBucket: 'lt10', page: 1, pageSize: cap });
      const b = await this.listShoes.execute({ priceBucket: '10to20', page: 1, pageSize: cap });
      return mergeShoeLists([a.shoes, b.shoes]).slice(0, cap);
    }
    if (maxUsd <= 50) {
      const a = await this.listShoes.execute({ priceBucket: 'lt10', page: 1, pageSize: 20 });
      const b = await this.listShoes.execute({ priceBucket: '10to20', page: 1, pageSize: 20 });
      const c = await this.listShoes.execute({ priceBucket: '20to50', page: 1, pageSize: 20 });
      return mergeShoeLists([a.shoes, b.shoes, c.shoes]).slice(0, cap);
    }
    const r = await this.listShoes.execute({ priceBucket: 'gt50', page: 1, pageSize: cap });
    return r.shoes;
  }
}
