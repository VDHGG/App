import { api } from './api'

export type ChatTurn = { role: 'user' | 'assistant'; content: string }

export async function sendChatMessage(messages: ChatTurn[]): Promise<string> {
  const { data } = await api.post<{ reply: string }>('/chat', { messages })
  if (data == null || typeof data.reply !== 'string') {
    throw new Error('Phản hồi chat không hợp lệ từ server.')
  }
  return data.reply
}
