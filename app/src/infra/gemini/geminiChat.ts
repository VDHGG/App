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
      'List rental order IDs and basic info for the currently logged-in customer. Requires customer login.',
  },
  {
    name: 'get_rental_detail',
    description: 'Get status and dates for one rental by rental id. Requires customer login.',
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
    name: 'search_shoes',
    description:
      'Search shoes by maximum price per day in USD (storefront catalog). Does not require login.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        max_price_usd: {
          type: SchemaType.NUMBER,
          description: 'Maximum price per day in USD (e.g. 20 for under $20/day)',
        },
      },
      required: ['max_price_usd'],
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
