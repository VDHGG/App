import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  sendChatMessageRich,
  type ChatTurn,
  type ChatShoeCard,
  type ChatQuoteCard,
} from '../lib/chat.api'
import { getApiErrorMessage } from '../lib/api'
import { humanizeGeminiUpstreamError } from '../lib/geminiUserErrors'
import { formatCurrency } from '../lib/format'

const STORAGE_KEY = 'rs_smart_chat_v2'

const DEFAULT_SUGGESTIONS = [
  'Shop đang có mã giảm giá nào?',
  'Hạng thành viên & đơn thuê của tôi',
  'Tìm giày dưới 200.000₫/ngày',
  'Quy định đặt cọc & phí trễ hạn',
]

type RichChatMessage = ChatTurn & {
  cards?: ChatShoeCard[]
  quote?: ChatQuoteCard
}

const INITIAL_MESSAGE: RichChatMessage = {
  role: 'assistant',
  content:
    'Chào bạn! Mình là **Trợ lý AI Thuê Giày Thông Minh** — bạn có thể tìm giày theo size/màu/giá, kiểm tra lịch trống, nhận **phiếu báo giá tạm tính** (gồm ưu đãi hạng + voucher + cọc), hoặc tra cứu đơn thuê & hạng thành viên nhé!',
}

function loadStoredMessages(): RichChatMessage[] {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return [INITIAL_MESSAGE]
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as RichChatMessage[]
    }
  } catch {
    // ignore storage errors
  }
  return [INITIAL_MESSAGE]
}

function renderFormattedText(
  text: string,
  onNavigate: (path: string) => void
): ReactNode {
  const lines = text.split('\n')
  return lines.map((line, lineIdx) => {
    // Tokenize bold (**...**) and internal routes (/shoes/SHOE001, /shoes, /checkout, /account)
    const pattern = /(\*\*[^*]+\*\*|\/shoes\/[A-Za-z0-9_-]+|\/shoes|\/checkout|\/account)/g
    const parts = line.split(pattern)
    return (
      <span key={lineIdx} className="block leading-relaxed">
        {parts.map((part, idx) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return (
              <strong
                key={idx}
                className="font-bold text-slate-900 dark:text-white"
              >
                {part.slice(2, -2)}
              </strong>
            )
          }
          if (
            part.startsWith('/shoes') ||
            part === '/checkout' ||
            part === '/account'
          ) {
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onNavigate(part)}
                className="inline-flex items-center gap-0.5 font-bold text-primary hover:underline mx-0.5"
              >
                {part}
              </button>
            )
          }
          return <span key={idx}>{part}</span>
        })}
      </span>
    )
  })
}

export function ChatbotWidget() {
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<RichChatMessage[]>(() =>
    loadStoredMessages()
  )
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const currentShoeId = useMemo(() => {
    const m = location.pathname.match(/^\/shoes\/([^/]+)$/)
    return m ? decodeURIComponent(m[1]) : undefined
  }, [location.pathname])

  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(messages.slice(-24))
      )
    } catch {
      // ignore storage quota errors
    }
  }, [messages])

  useEffect(() => {
    if (currentShoeId) {
      setSuggestions([
        `Đôi ${currentShoeId} còn size nào trống ngày mai?`,
        `Báo giá thuê đôi ${currentShoeId} 3 ngày`,
        `Đánh giá của khách về đôi ${currentShoeId}`,
        'Shop đang có mã giảm giá nào?',
      ])
    } else if (messages.length <= 1) {
      setSuggestions(DEFAULT_SUGGESTIONS)
    }
  }, [currentShoeId, messages.length])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open, expanded])

  function handleResetChat() {
    setMessages([INITIAL_MESSAGE])
    setError(null)
    setSuggestions(
      currentShoeId
        ? [
            `Đôi ${currentShoeId} còn size nào trống ngày mai?`,
            `Báo giá thuê đôi ${currentShoeId} 3 ngày`,
            `Đánh giá của khách về đôi ${currentShoeId}`,
            'Shop đang có mã giảm giá nào?',
          ]
        : DEFAULT_SUGGESTIONS
    )
    try {
      window.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }

  async function sendPrompt(rawText: string) {
    const text = rawText.trim()
    if (!text || loading) return

    const nextUser: RichChatMessage = { role: 'user', content: text }
    setInput('')
    setError(null)
    setLoading(true)
    setMessages((m) => [...m, nextUser])

    try {
      const history: ChatTurn[] = [...messages, nextUser].map((item) => ({
        role: item.role,
        content: item.content,
      }))
      const res = await sendChatMessageRich(history, {
        currentPath: location.pathname,
        ...(currentShoeId ? { currentShoeId } : {}),
      })
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content: res.reply,
          ...(res.cards && res.cards.length > 0 ? { cards: res.cards } : {}),
          ...(res.quote ? { quote: res.quote } : {}),
        },
      ])
      if (res.suggestions && res.suggestions.length > 0) {
        setSuggestions(res.suggestions)
      }
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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    await sendPrompt(input)
  }

  const panelSizeClass = expanded
    ? 'w-[min(100vw-2rem,32rem)] max-h-[min(84vh,42rem)]'
    : 'w-[min(100vw-2rem,24rem)] max-h-[min(76vh,34rem)]'

  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col items-end gap-2 pointer-events-none">
      {open && (
        <div
          className={`pointer-events-auto ${panelSizeClass} flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden transition-all`}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-primary/10">
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-primary text-2xl shrink-0">
                smart_toy
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                    Trợ lý AI Thuê Giày
                  </span>
                  <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                </div>
                {currentShoeId ? (
                  <p className="text-[11px] font-semibold text-primary truncate">
                    Đang xem: #{currentShoeId}
                  </p>
                ) : (
                  <p className="text-[10px] text-slate-500 truncate">
                    Tư vấn Size · Lịch trống · Báo giá tự động
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleResetChat}
                className="p-1.5 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-500"
                title="Làm mới hội thoại"
                aria-label="Làm mới hội thoại"
              >
                <span className="material-symbols-outlined text-lg leading-none">
                  restart_alt
                </span>
              </button>
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="p-1.5 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-500"
                title={expanded ? 'Thu nhỏ khung chat' : 'Phóng to khung chat'}
                aria-label={expanded ? 'Thu nhỏ khung chat' : 'Phóng to khung chat'}
              >
                <span className="material-symbols-outlined text-lg leading-none">
                  {expanded ? 'close_fullscreen' : 'open_in_full'}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200/80 dark:hover:bg-slate-700 text-slate-500"
                aria-label="Đóng chat"
              >
                <span className="material-symbols-outlined text-lg leading-none">
                  close
                </span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 text-sm">
            {messages.map((m, i) => (
              <div key={i} className="space-y-2">
                <div
                  className={
                    m.role === 'user'
                      ? 'ml-8 rounded-2xl rounded-br-sm bg-primary text-white px-3.5 py-2.5 text-sm shadow-xs'
                      : 'mr-3 rounded-2xl rounded-bl-sm bg-slate-100 dark:bg-slate-800 px-3.5 py-2.5 text-slate-800 dark:text-slate-200 space-y-1'
                  }
                >
                  {m.role === 'user'
                    ? m.content
                    : renderFormattedText(m.content, (path) => navigate(path))}
                </div>

                {/* Rich Shoe Cards */}
                {m.role === 'assistant' && m.cards && m.cards.length > 0 && (
                  <div className="mr-2 space-y-2">
                    {m.cards.map((card) => (
                      <div
                        key={card.shoeId}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-slate-900 dark:text-white truncate">
                              {card.name}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {card.brand} · {card.category}
                              {card.averageRating !== undefined && card.averageRating > 0
                                ? ` · ${card.averageRating.toFixed(1)}★`
                                : ''}
                            </p>
                          </div>
                          <span className="text-xs font-black text-primary shrink-0">
                            {formatCurrency(card.pricePerDay)}/ngày
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold ${
                              card.inStock
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                            }`}
                          >
                            {card.inStock
                              ? `Còn hàng${card.availableUnits !== undefined ? ` (${card.availableUnits} đôi)` : ''}`
                              : 'Hết hàng'}
                          </span>
                          {card.availableSizes.length > 0 && (
                            <span className="text-slate-600 dark:text-slate-400">
                              Size EU: <strong>{card.availableSizes.join(', ')}</strong>
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => navigate(card.actionUrl)}
                            className="flex-1 py-1.5 px-2.5 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 transition-opacity"
                          >
                            Xem &amp; Thuê →
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() =>
                              void sendPrompt(
                                `Báo giá thuê ${card.name} (${card.shoeId}) trong 3 ngày`
                              )
                            }
                            className="py-1.5 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                          >
                            Báo giá 3 ngày
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Rich Rental Quote Card */}
                {m.role === 'assistant' && m.quote && (
                  <div className="mr-2 p-3.5 rounded-xl border-2 border-primary/30 bg-primary/5 dark:bg-slate-900 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                          Phiếu Báo Giá Tạm Tính
                        </span>
                        <p className="font-bold text-slate-900 dark:text-white text-sm">
                          {m.quote.shoeName} ({m.quote.quantity} đôi × {m.quote.days} ngày)
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1 text-slate-600 dark:text-slate-300">
                      <div className="flex justify-between">
                        <span>Giá thuê gốc:</span>
                        <span className="font-semibold">
                          {formatCurrency(m.quote.rawBasePrice)}
                        </span>
                      </div>
                      <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                        <span>
                          Ưu đãi hạng {m.quote.rank} (-{m.quote.rankDiscountPercent}%)
                          {m.quote.voucherCode
                            ? ` + Mã ${m.quote.voucherCode} (-${m.quote.voucherDiscountPercent}%)`
                            : ''}
                          :
                        </span>
                        <span className="font-bold">
                          -{m.quote.effectiveDiscountPercent}%
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold text-slate-900 dark:text-white">
                        <span>Tiền thuê sau giảm:</span>
                        <span>{formatCurrency(m.quote.finalRentalPrice)}</span>
                      </div>
                      <div className="flex justify-between text-amber-700 dark:text-amber-400">
                        <span>Tiền cọc bảo đảm (hoàn lại 100%):</span>
                        <span className="font-semibold">
                          {formatCurrency(m.quote.depositAmount)}
                        </span>
                      </div>
                      <div className="pt-1.5 border-t border-dashed border-slate-300 dark:border-slate-700 flex justify-between text-sm font-black text-slate-900 dark:text-white">
                        <span>Tổng thanh toán tạm tính:</span>
                        <span className="text-primary">
                          {formatCurrency(m.quote.grandTotal)}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(m.quote!.actionUrl)}
                      className="w-full py-2 px-3 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 transition-opacity"
                    >
                      Chọn size &amp; Đặt thuê ngay →
                    </button>
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="mr-4 text-xs text-slate-500 flex items-center gap-2">
                <span className="inline-block size-2 rounded-full bg-primary animate-pulse" />
                Đang phân tích &amp; tra cứu dữ liệu…
              </div>
            )}
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400 px-1">{error}</p>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Dynamic Follow-up Suggestions */}
          <div className="px-3 pt-2 pb-1.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex flex-wrap gap-1.5">
            {suggestions.map((q) => (
              <button
                key={q}
                type="button"
                disabled={loading}
                onClick={() => void sendPrompt(q)}
                className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-primary hover:text-primary transition-colors disabled:opacity-50 text-left"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form
            onSubmit={handleSend}
            className="p-3 border-t border-slate-100 dark:border-slate-800 flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                currentShoeId
                  ? `Hỏi về đôi ${currentShoeId}, size, báo giá…`
                  : 'Hỏi tìm giày, size, lịch trống, báo giá…'
              }
              maxLength={4000}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-sm"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 px-3.5 py-2 rounded-xl bg-primary text-white text-sm font-semibold disabled:opacity-50"
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
