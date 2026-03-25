import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { AdminLayout } from './components/admin/AdminLayout'
import { HomePage } from './pages/HomePage'
import { StorefrontPage } from './pages/StorefrontPage'
import { ProductDetailPage } from './pages/ProductDetailPage'
import { CheckoutPage } from './pages/CheckoutPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { RentalsListPage } from './pages/admin/RentalsListPage'
import { RentalDetailPage } from './pages/admin/RentalDetailPage'
import { CustomersListPage } from './pages/admin/CustomersListPage'
import { AdminLoginPage } from './pages/admin/AdminLoginPage'
import { AdminShoesPage } from './pages/admin/AdminShoesPage'
import { ShoeEditorPage } from './pages/admin/ShoeEditorPage'
import { WalkInRentalPage } from './pages/admin/WalkInRentalPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/shoes" element={<StorefrontPage />} />
          <Route path="/shoes/:id" element={<ProductDetailPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
        </Route>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="rentals" element={<RentalsListPage />} />
          <Route path="rentals/new" element={<WalkInRentalPage />} />
          <Route path="rentals/:id" element={<RentalDetailPage />} />
          <Route path="customers" element={<CustomersListPage />} />
          <Route path="shoes" element={<AdminShoesPage />} />
          <Route path="shoes/new" element={<ShoeEditorPage />} />
          <Route path="shoes/:shoeId/edit" element={<ShoeEditorPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
