import { Outlet } from 'react-router-dom'
import { WishlistProvider } from '../wishlist/WishlistContext'
import { RentalCartProvider } from '../cart/RentalCartContext'
import { Header } from './Header.tsx'
import { Footer } from './Footer.tsx'

export function Layout() {
  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden">
      <WishlistProvider>
        <RentalCartProvider>
          <Header />
          <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
            <Outlet />
          </main>
          <Footer />
        </RentalCartProvider>
      </WishlistProvider>
    </div>
  )
}
