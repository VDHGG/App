import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { AdminLayout } from './components/admin/AdminLayout'
import { LoginPage } from './pages/LoginPage'
import { SignUpPage } from './pages/SignUpPage'
import { StorefrontPage } from './pages/StorefrontPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { RentalsListPage } from './pages/admin/RentalsListPage'
import { RentalDetailPage } from './pages/admin/RentalDetailPage'
import { CustomersListPage } from './pages/admin/CustomersListPage'
import { AdminShoesPage } from './pages/admin/AdminShoesPage'
import { ShoeEditorPage } from './pages/admin/ShoeEditorPage'
import { WalkInRentalPage } from './pages/admin/WalkInRentalPage'
import { AdminBrandsPage } from './pages/admin/AdminBrandsPage'
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage'
import { AdminSystemUsersPage } from './pages/admin/AdminSystemUsersPage'
import { AdminSystemUserEditorPage } from './pages/admin/AdminSystemUserEditorPage'
import { HowItWorksPage } from './pages/HowItWorksPage'
import { FaqPage } from './pages/FaqPage'
import { PoliciesPage } from './pages/PoliciesPage'
import { ContactPage } from './pages/ContactPage'
import { AccountPage } from './pages/AccountPage'
import { WishlistPage } from './pages/WishlistPage'
import { DiscoveryTrendsPage } from './pages/DiscoveryTrendsPage'
import { MomoReturnPage } from './pages/MomoReturnPage'

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/payment/momo/return" element={<MomoReturnPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route
            path="/admin/login"
            element={<Navigate to="/login" replace state={{ from: { pathname: '/admin' } }} />}
          />

          <Route element={<RequireAuth />}>
            <Route element={<Layout />}>
              <Route path="/" element={<StorefrontPage />} />
              <Route path="/discovery" element={<DiscoveryTrendsPage />} />
              <Route path="/shoes" element={<StorefrontPage />} />
              <Route path="/shoes/:id" element={<ProductDetailPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/faq" element={<FaqPage />} />
              <Route path="/policies" element={<PoliciesPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/wishlist" element={<WishlistPage />} />
            </Route>

            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="rentals" element={<RentalsListPage />} />
              <Route path="rentals/new" element={<WalkInRentalPage />} />
              <Route path="rentals/:id" element={<RentalDetailPage />} />
              <Route path="customers" element={<CustomersListPage />} />
              <Route path="system-users" element={<AdminSystemUsersPage />} />
              <Route path="system-users/:userId" element={<AdminSystemUserEditorPage />} />
              <Route path="shoes" element={<AdminShoesPage />} />
              <Route path="shoes/new" element={<ShoeEditorPage />} />
              <Route path="shoes/:shoeId/edit" element={<ShoeEditorPage />} />
              <Route path="catalog/brands" element={<AdminBrandsPage />} />
              <Route path="catalog/categories" element={<AdminCategoriesPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
