import { useState, useRef, useEffect } from 'react'
import { sendChatMessage, type ChatTurn } from '../lib/chat.api'
import { getApiErrorMessage } from '../lib/api'
import { humanizeGeminiUpstreamError } from '../lib/geminiUserErrors'

export function ChatbotWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      role: 'assistant',
      content:
        'Chào bạn! Mình là trợ lý thuê giày — hỏi về cách thuê, MoMo/COD, hoặc gợi ý giày theo giá nhé. Nếu cần xem đơn của bạn, hãy đăng nhập trước.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const nextUser: ChatTurn = { role: 'user', content: text }
    setInput('')
    setError(null)
    setLoading(true)
    setMessages((m) => [...m, nextUser])

    try {
      const history = [...messages, nextUser]
      const reply = await sendChatMessage(history)
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
    } catch (err: unknown) {
      const raw = getApiErrorMessage(err)
      const { assistantMessage, technicalDetail } = humanizeGeminiUpstreamError(raw)
      setError(technicalDetail ?? null)
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: assistantMessage,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2 pointer-events-none">
      {open && (
        <div className="pointer-events-auto w-[min(100vw-2rem,22rem)] max-h-[min(70vh,28rem)] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-primary/10">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-2xl">smart_toy</span>
              <span className="font-bold text-sm text-slate-900 dark:text-white">Trợ lý thuê giày</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-500"
              aria-label="Đóng chat"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 text-sm">
            {messages.map((m, i) => (
              <div
                key={i}
                className={
                  m.role === 'user'
                    ? 'ml-6 rounded-xl rounded-br-sm bg-primary/15 dark:bg-primary/20 px-3 py-2 text-slate-900 dark:text-slate-100'
                    : 'mr-4 rounded-xl rounded-bl-sm bg-slate-100 dark:bg-slate-800 px-3 py-2 text-slate-800 dark:text-slate-200 whitespace-pre-wrap'
                }
              >
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="mr-4 text-xs text-slate-500 flex items-center gap-2">
                <span className="inline-block size-2 rounded-full bg-primary animate-pulse" />
                Đang trả lời…
              </div>
            )}
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 px-1">{error}</p>
            )}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={handleSend} className="p-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Nhập câu hỏi…"
              maxLength={4000}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 px-3 py-2 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
            >
              Gửi
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="pointer-events-auto flex items-center justify-center size-14 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-colors"
        aria-expanded={open}
        aria-label={open ? 'Thu gọn chat' : 'Mở chat'}
      >
        <span className="material-symbols-outlined text-3xl">
          {open ? 'expand_more' : 'chat'}
        </span>
      </button>
    </div>
  )
}
