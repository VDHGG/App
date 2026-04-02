import type { ReactNode } from 'react'

type ContentPageShellProps = {
  title: string
  intro?: string
  children: ReactNode
  /** Tailwind max-width class for the content column (default `max-w-3xl`). */
  maxWidthClassName?: string
}

export function ContentPageShell({
  title,
  intro,
  children,
  maxWidthClassName = 'max-w-3xl',
}: ContentPageShellProps) {
  return (
    <div className={`${maxWidthClassName} mx-auto px-4 sm:px-6 py-10 lg:py-14`}>
      <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">{title}</h1>
      {intro && (
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-10 leading-relaxed border-b border-slate-200 dark:border-slate-800 pb-8">
          {intro}
        </p>
      )}
      <div className="space-y-8 text-slate-600 dark:text-slate-300 leading-relaxed text-[15px]">
        {children}
      </div>
    </div>
  )
}

export function ContentH2({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xl font-bold text-slate-900 dark:text-white pt-2">{children}</h2>
  )
}

export function ContentList({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-2 marker:text-primary">{children}</ul>
}
