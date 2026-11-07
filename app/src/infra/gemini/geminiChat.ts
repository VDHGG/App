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
      'Search shoes by maximum price per day in VND (storefront catalog, typically 180,000 to 550,000 VND/day). Does not require login.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
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
      },
    },
  },
  {
    name: 'check_shoe_availability',
    description:
      'Check variant availability for a shoe_id between start_date (YYYY-MM-DD) and end_date (YYYY-MM-DD). Does not require login.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        shoe_id: {
          type: SchemaType.STRING,
          description: 'Shoe id, e.g. SHOE001',
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
      required: ['shoe_id', 'start_date', 'end_date'],
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
