import { useState } from 'react'

const FALLBACK_SHOE_IMAGE_SRC = '/images/default_shoe.webp'

type ShoeImageProps = {
  src: string | null | undefined
  alt: string
  wrapperClassName?: string
  imgClassName?: string
  compact?: boolean
}

function Placeholder({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300 dark:from-slate-800 dark:via-slate-800 dark:to-slate-900 ${className ?? ''}`}
      aria-hidden
    >
      <span
        className={`material-symbols-outlined text-slate-400/90 dark:text-slate-500/90 select-none ${compact ? 'text-2xl' : 'text-[clamp(3rem,18vw,5rem)]'}`}
        style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}
      >
        ice_skating
      </span>
      {!compact && (
        <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500/80 dark:text-slate-400/80">
          Photo coming soon
        </span>
      )}
    </div>
  )
}

export function ShoeImage({
  src,
  alt,
  wrapperClassName = '',
  imgClassName = '',
  compact = false,
}: ShoeImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  const primarySrc = src?.trim() || FALLBACK_SHOE_IMAGE_SRC
  const activeSrc =
    failedSrc === primarySrc && primarySrc !== FALLBACK_SHOE_IMAGE_SRC
      ? FALLBACK_SHOE_IMAGE_SRC
      : primarySrc
  const showPlaceholder =
    fallbackFailed ||
    (failedSrc === FALLBACK_SHOE_IMAGE_SRC && primarySrc === FALLBACK_SHOE_IMAGE_SRC)

  return (
    <div className={`relative w-full h-full min-h-0 ${wrapperClassName}`}>
      {!showPlaceholder ? (
        <img
          src={activeSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          className={imgClassName}
          onError={() => {
            if (activeSrc === FALLBACK_SHOE_IMAGE_SRC) {
              setFallbackFailed(true)
            } else {
              setFailedSrc(primarySrc)
            }
          }}
        />
      ) : (
        <Placeholder compact={compact} />
      )}
    </div>
  )
}
