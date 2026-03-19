import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
        Rental Shoe
      </h1>
      <p className="text-lg text-slate-600 dark:text-slate-400">
        Step into Style, Rent Your Confidence.
      </p>
      <Link
        to="/shoes"
        className="bg-primary hover:bg-primary/90 text-white font-bold py-3 px-8 rounded-lg transition-all"
      >
        Browse Collection
      </Link>
    </div>
  )
}
