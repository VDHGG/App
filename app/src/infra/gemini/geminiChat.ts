import {
  GoogleGenerativeAI,
  SchemaType,
  FunctionCallingMode,
  type Content,
  type EnhancedGenerateContentResponse,
  type FunctionDeclaration,
} from '@google/generative-ai';

export const SHOE_RENTAL_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'list_my_rentals',
    description:
      'List rental order IDs, overdue status, and basic info for the currently logged-in customer. Requires customer login.',
  },
  {
    name: 'get_rental_detail',
    description: 'Get status, dates, deposit, and items for one rental by rental id. Requires customer login.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        rental_id: {
          type: SchemaType.STRING,
          description: 'Rental id, e.g. Rxxxxxxxx',
        },
      },
      required: ['rental_id'],
    },
  },
  {
    name: 'get_my_membership_rank',
    description:
      'Get current membership rank (BRONZE, SILVER, GOLD, DIAMOND) and automatic discount percent for the logged-in customer. Requires customer login.',
  },
  {
    name: 'list_active_vouchers',
    description:
      'List currently active promotional vouchers (code, discountPercent, description, expiresAt). Does not require login.',
  },
  {
    name: 'search_shoes',
    description:
      'Search shoes in the storefront catalog by keyword, brand, category, EU size, color, maximum price per day in VND (180,000 to 550,000 VND/day), or date-range availability. Does not require login.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        keyword: {
          type: SchemaType.STRING,
          description: 'Search keyword matching shoe name, brand, or category (e.g. "Jordan", "Air Force", "Chuck 70", "chạy bộ")',
        },
        brand: {
          type: SchemaType.STRING,
          description: 'Filter by brand name (e.g. "Nike", "Adidas", "Converse", "Vans", "New Balance", "Puma")',
        },
        category: {
          type: SchemaType.STRING,
          description: 'Filter by category (e.g. "Sneaker", "Running", "Basketball", "Lifestyle", "Skate")',
        },
        size: {
          type: SchemaType.NUMBER,
          description: 'Filter shoes that have an available variant in EU size (e.g. 40, 41, 42)',
        },
        color: {
          type: SchemaType.STRING,
          description: 'Filter shoes that have a variant matching color (e.g. "White"/"trắng", "Black"/"đen", "Red"/"đỏ", "Blue"/"xanh")',
        },
        max_price_vnd: {
          type: SchemaType.NUMBER,
          description:
            'Maximum price per day in VND (e.g. pass 300000 for 300,000 VND/day)',
        },
        max_price_usd: {
          type: SchemaType.NUMBER,
          description:
            'Maximum price per day in VND (legacy alias, e.g. pass 300000 for 300,000 VND/day)',
        },
        start_date: {
          type: SchemaType.STRING,
          description: 'Optional YYYY-MM-DD start date to filter by date-range availability',
        },
        end_date: {
          type: SchemaType.STRING,
          description: 'Optional YYYY-MM-DD end date to filter by date-range availability',
        },
      },
    },
  },
  {
    name: 'check_shoe_availability',
    description:
      'Check variant availability for a shoe (by shoe_id or shoe_name) between start_date (YYYY-MM-DD) and end_date (YYYY-MM-DD). Does not require login.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        shoe_id: {
          type: SchemaType.STRING,
          description: 'Shoe id, e.g. SHOE001',
        },
        shoe_name: {
          type: SchemaType.STRING,
          description: 'Shoe name or keyword (e.g. "Jordan 1", "Air Force 1") if shoe_id is not known',
        },
        start_date: {
          type: SchemaType.STRING,
          description: 'Rental start date in YYYY-MM-DD format',
        },
        end_date: {
          type: SchemaType.STRING,
          description: 'Rental end date in YYYY-MM-DD format',
        },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'estimate_rental_quote',
    description:
      'Calculate exact rental cost quote, membership rank discount, voucher discount (capped at 50%), security deposit (500,000 VND/pair), and grand total for a shoe. Does not require login.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        shoe_id: {
          type: SchemaType.STRING,
          description: 'Shoe id, e.g. SHOE001',
        },
        shoe_name: {
          type: SchemaType.STRING,
          description: 'Shoe name or keyword if shoe_id is not provided',
        },
        days: {
          type: SchemaType.NUMBER,
          description: 'Number of rental days (default 3 if neither days nor start_date/end_date is provided)',
        },
        start_date: {
          type: SchemaType.STRING,
          description: 'Optional start date in YYYY-MM-DD format',
        },
        end_date: {
          type: SchemaType.STRING,
          description: 'Optional end date in YYYY-MM-DD format',
        },
        quantity: {
          type: SchemaType.NUMBER,
          description: 'Number of pairs to rent (default 1)',
        },
        voucher_code: {
          type: SchemaType.STRING,
          description: 'Optional promotional voucher code (e.g. WELCOME10)',
        },
      },
    },
  },
  {
    name: 'get_shoe_reviews_summary',
    description:
      'Get customer ratings and review comments for a specific shoe or list top-rated shoes in the store. Does not require login.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        shoe_id: {
          type: SchemaType.STRING,
          description: 'Optional shoe id, e.g. SHOE001',
        },
        shoe_name: {
          type: SchemaType.STRING,
          description: 'Optional shoe name or keyword',
        },
      },
    },
  },
  {
    name: 'compare_shoes',
    description:
      'Compare 2 or 3 shoes side-by-side by their IDs or names (price per day, brand, category, available sizes, colors, stock). Does not require login.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        queries: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description: 'List of 2 to 3 shoe IDs or shoe names to compare',
        },
      },
      required: ['queries'],
    },
  },
];

function safeResponseText(response: EnhancedGenerateContentResponse): string {
  try {
    return response.text().trim();
  } catch {
    return '';
  }
}

function stripLeadingAssistantTurns(
  turns: Array<{ role: 'user' | 'assistant'; content: string }>
): Array<{ role: 'user' | 'assistant'; content: string }> {
  let i = 0;
  while (i < turns.length && turns[i].role === 'assistant') {
    i += 1;
  }
  return turns.slice(i);
}

export async function geminiChatWithTools(opts: {
  apiKey: string;
  model: string;
  systemInstruction: string;
  turns: Array<{ role: 'user' | 'assistant'; content: string }>;
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  maxToolRounds?: number;
}): Promise<string> {
  const { apiKey, model, systemInstruction, turns, executeTool, maxToolRounds = 8 } = opts;
  const normalized = stripLeadingAssistantTurns(turns);
  if (normalized.length === 0) {
    throw new Error('Không có tin nhắn để gửi.');
  }
  const last = normalized[normalized.length - 1];
  if (last.role !== 'user') {
    throw new Error('Tin nhắn cuối phải của người dùng.');
  }

  const history: Content[] = [];
  for (let i = 0; i < normalized.length - 1; i++) {
    const m = normalized[i];
    history.push({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    });
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const genModel = genAI.getGenerativeModel({
    model,
    systemInstruction,
    tools: [{ functionDeclarations: [...SHOE_RENTAL_FUNCTION_DECLARATIONS] }],
    toolConfig: {
      functionCallingConfig: { mode: FunctionCallingMode.AUTO },
    },
  });

  const chat = genModel.startChat({ history });

  let result = await chat.sendMessage(last.content);
  let response = result.response;
  let rounds = 0;

  while (rounds < maxToolRounds) {
    rounds += 1;
    const calls = response.functionCalls();
    if (!calls || calls.length === 0) {
      const text = safeResponseText(response);
      if (text) return text;
      break;
    }

    const parts: Array<{ functionResponse: { name: string; response: object } }> = [];
    for (const call of calls) {
      const rawArgs = call.args;
      const args =
        rawArgs && typeof rawArgs === 'object' && !Array.isArray(rawArgs)
          ? (rawArgs as Record<string, unknown>)
          : {};
      const toolResult = await executeTool(call.name, args);
      const asObject =
        toolResult !== null && typeof toolResult === 'object' && !Array.isArray(toolResult)
          ? (toolResult as object)
          : { result: toolResult };
      parts.push({
        functionResponse: {
          name: call.name,
          response: asObject,
        },
      });
    }

    result = await chat.sendMessage(parts);
    response = result.response;
  }

  const fallback = safeResponseText(response);
  return fallback || 'Xin lỗi, mình chưa trả lời được. Thử lại sau nhé.';
}
