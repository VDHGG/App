import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

function parseResultCode(raw: string | null): number | null {
  if (raw === null || raw === '') return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

export function MomoReturnPage() {
  const [searchParams] = useSearchParams()

  const resultCode = useMemo(() => {
    return parseResultCode(searchParams.get('resultCode'))
  }, [searchParams])

  const message = searchParams.get('message') ?? ''
  const orderId = searchParams.get('orderId') ?? ''
  const transId = searchParams.get('transId') ?? ''

  const success = resultCode === 0

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-8 text-center">
        <div
          className={`inline-flex items-center justify-center size-16 rounded-full mb-6 ${
            success
              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
          }`}
        >
          <span className="material-symbols-outlined text-4xl">
            {success ? 'check_circle' : 'info'}
          </span>
        </div>
        <h1 className="text-xl font-black text-slate-900 dark:text-white mb-2">
          {success ? 'Payment completed' : 'Payment status'}
        </h1>
        {success ? (
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
            Thank you. MoMo has processed your payment. Your rental remains reserved — you can review
            details under My rentals.
          </p>
        ) : (
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
            {message || 'The payment could not be completed or was cancelled.'}
            {resultCode !== null && (
              <span className="block mt-2 text-xs text-slate-500">Code: {resultCode}</span>
            )}
          </p>
        )}
        {(orderId || transId) && (
          <p className="text-xs text-slate-500 font-mono mb-6 break-all">
            {orderId && <>Order: {orderId}</>}
            {orderId && transId && <br />}
            {transId && <>Trans: {transId}</>}
          </p>
        )}
        <Link
          to="/"
          className="inline-flex items-center justify-center w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-xl transition-opacity"
        >
          Back to home
        </Link>
        <p className="mt-6 text-xs text-slate-500">
          <Link to="/account" className="text-primary font-semibold hover:underline">
            My rentals
          </Link>
        </p>
      </div>
    </div>
  )
}
