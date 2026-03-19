import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { HomePage } from './pages/HomePage'
import { StorefrontPage } from './pages/StorefrontPage'
import { ProductDetailPage } from './pages/ProductDetailPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/shoes" element={<StorefrontPage />} />
          <Route path="/shoes/:id" element={<ProductDetailPage />} />
          {/* Phase 3+ */}
          {/* <Route path="/admin" element={<AdminDashboardPage />} /> */}
          {/* <Route path="/pos" element={<WalkInOrderPage />} /> */}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
