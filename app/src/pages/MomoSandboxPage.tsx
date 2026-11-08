import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { confirmMomoReturnParams } from '../lib/payments.api'
import { formatCurrency } from '../lib/format'

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds)
  const mins = Math.floor(s / 60)
  const secs = s % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export function MomoSandboxPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [secondsLeft, setSecondsLeft] = useState(15 * 60)
  const [processing, setProcessing] = useState(false)

  const orderId = searchParams.get('orderId') ?? ''
  const amount = Number(searchParams.get('amount') ?? '0')
  const orderInfo = searchParams.get('orderInfo') ?? ''
  const partnerCode = searchParams.get('partnerCode') ?? 'MOMO'
  const requestId = searchParams.get('requestId') ?? ''
  const gatewayUrl = searchParams.get('gatewayUrl') ?? ''

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const handleConfirmPayment = async () => {
    if (processing) return
    setProcessing(true)
    const entries = Object.fromEntries(searchParams.entries())
    delete entries.gatewayUrl
    await confirmMomoReturnParams(entries).catch(() => {})
    const returnParams = new URLSearchParams(entries)
    navigate(`/payment/momo/return?${returnParams.toString()}`, { replace: true })
  }

  const handleCancelPayment = () => {
    if (processing) return
    const cancelParams = new URLSearchParams({
      orderId,
      resultCode: '1006',
      message: 'Giao dịch đã bị hủy bởi người dùng.',
    })
    navigate(`/payment/momo/return?${cancelParams.toString()}`, { replace: true })
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col">
      {/* Top header bar */}
      <header className="bg-[#A50064] text-white shadow-md">
        <div className="max-w-5xl mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-white text-[#A50064] flex items-center justify-center font-black text-lg shadow-sm">
              mo
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight">
                Cổng thanh toán MoMo Sandbox
              </h1>
              <p className="text-xs text-white/80">
                MoMo E-Wallet Test Gateway · Giao thức HMAC-SHA256
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/15 border border-white/25 backdrop-blur-sm">
            Chế độ Kiểm thử Cloud Sandbox
          </span>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-4xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* Left column: Thông tin đơn hàng */}
          <div className="md:col-span-5 bg-slate-50 dark:bg-slate-800/50 p-6 sm:p-8 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                <span className="material-symbols-outlined text-base text-[#A50064]">
                  receipt_long
                </span>
                Thông tin đơn hàng
              </div>

              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Nhà cung cấp</p>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5">
                    Rental Shoe Store ({partnerCode})
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Mã đơn hàng</p>
                  <p className="font-mono font-semibold text-slate-800 dark:text-slate-200 mt-0.5 break-all">
                    {orderId || '—'}
                  </p>
                </div>

                {requestId && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Mã yêu cầu (Request ID)</p>
                    <p className="font-mono text-xs text-slate-600 dark:text-slate-400 mt-0.5 break-all">
                      {requestId}
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Nội dung thanh toán</p>
                  <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 break-words">
                    {orderInfo || 'Thanh toán đơn thuê giày'}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Số tiền thanh toán</p>
                  <p className="text-2xl font-black text-[#A50064] dark:text-pink-400 mt-1">
                    {formatCurrency(amount)}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3.5 text-center">
              <p className="text-xs text-amber-800 dark:text-amber-300 font-semibold">
                Đơn hàng hết hạn sau:{' '}
                <span className="font-mono font-black text-sm text-[#A50064] dark:text-pink-400">
                  {formatCountdown(secondsLeft)}
                </span>
              </p>
            </div>
          </div>

          {/* Right column: Xác nhận thanh toán Ví MoMo Sandbox */}
          <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-5 text-center">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Quét mã QR hoặc Xác nhận Thanh toán Ví MoMo
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Sử dụng tài khoản Ví MoMo Sandbox bên dưới để hoàn tất giao dịch kiểm thử
                </p>
              </div>

              {/* Simulated QR code box */}
              <div className="mx-auto w-48 h-48 rounded-2xl border-2 border-[#A50064]/30 bg-white p-3 shadow-inner flex items-center justify-center relative">
                <svg
                  viewBox="0 0 120 120"
                  className="w-full h-full text-slate-900"
                  aria-label="Mã QR MoMo Sandbox"
                >
                  {/* Top-left finder */}
                  <rect x="6" y="6" width="30" height="30" rx="4" fill="none" stroke="#A50064" strokeWidth="5" />
                  <rect x="14" y="14" width="14" height="14" rx="2" fill="#A50064" />
                  {/* Top-right finder */}
                  <rect x="84" y="6" width="30" height="30" rx="4" fill="none" stroke="#A50064" strokeWidth="5" />
                  <rect x="92" y="14" width="14" height="14" rx="2" fill="#A50064" />
                  {/* Bottom-left finder */}
                  <rect x="6" y="84" width="30" height="30" rx="4" fill="none" stroke="#A50064" strokeWidth="5" />
                  <rect x="14" y="92" width="14" height="14" rx="2" fill="#A50064" />
                  {/* Data modules */}
                  <rect x="44" y="10" width="8" height="8" fill="currentColor" />
                  <rect x="56" y="10" width="8" height="8" fill="currentColor" />
                  <rect x="68" y="18" width="8" height="8" fill="currentColor" />
                  <rect x="44" y="26" width="16" height="8" fill="currentColor" />
                  <rect x="10" y="44" width="8" height="16" fill="currentColor" />
                  <rect x="24" y="48" width="12" height="8" fill="currentColor" />
                  <rect x="44" y="44" width="32" height="32" rx="6" fill="#A50064" />
                  <text
                    x="60"
                    y="64"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="sans-serif"
                  >
                    MoMo
                  </text>
                  <rect x="84" y="46" width="8" height="12" fill="currentColor" />
                  <rect x="98" y="52" width="12" height="8" fill="currentColor" />
                  <rect x="84" y="66" width="16" height="8" fill="currentColor" />
                  <rect x="44" y="84" width="12" height="8" fill="currentColor" />
                  <rect x="62" y="88" width="8" height="16" fill="currentColor" />
                  <rect x="78" y="84" width="14" height="14" fill="currentColor" />
                  <rect x="98" y="96" width="14" height="14" fill="currentColor" />
                </svg>
              </div>

              {/* Test Wallet info box */}
              <div className="rounded-xl bg-pink-50/80 dark:bg-pink-950/25 border border-pink-200 dark:border-pink-900/50 px-4 py-3 text-xs text-slate-700 dark:text-slate-200 flex items-center justify-between gap-2">
                <span className="font-semibold flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-[#A50064]">
                    account_balance_wallet
                  </span>
                  Ví MoMo Test · 090***8899
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  Số dư: 50.000.000 ₫
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                disabled={processing}
                onClick={() => void handleConfirmPayment()}
                className="bg-[#A50064] hover:bg-[#8a0053] disabled:opacity-60 text-white font-bold py-3.5 px-6 rounded-xl w-full transition-colors shadow-lg shadow-[#A50064]/20 flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-xl">verified_user</span>
                {processing ? 'Đang xử lý thanh toán…' : 'Xác nhận Thanh toán MoMo'}
              </button>

              <button
                type="button"
                disabled={processing}
                onClick={handleCancelPayment}
                className="border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-700 dark:text-slate-300 font-semibold py-3 px-6 rounded-xl w-full transition-colors text-sm"
              >
                Hủy giao dịch / Quay lại
              </button>

              {gatewayUrl && (
                <a
                  href={gatewayUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-center text-xs font-semibold text-[#A50064] dark:text-pink-400 hover:underline pt-1"
                >
                  Mở trang QR gốc trên test-payment.momo.vn ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
