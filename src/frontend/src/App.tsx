import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth.store'
import AdminLayout from './components/layout/AdminLayout'
import CommercialLayout from './components/layout/CommercialLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ProductsPage from './pages/ProductsPage'
import CategoriesPage from './pages/CategoriesPage'
import BrandsPage from './pages/BrandsPage'
import PricesPage from './pages/PricesPage'
import CatalogsPage from './pages/CatalogsPage'
import CatalogDetailPage from './pages/CatalogDetailPage'
import AssignmentsPage from './pages/AssignmentsPage'
import CommercialSettingsPage from './pages/CommercialSettingsPage'
import UsersPage from './pages/UsersPage'
import AuditPage from './pages/AuditPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="commercial" element={<CommercialLayout />}>
          <Route index element={<Navigate to="/commercial/products" replace />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="brands" element={<BrandsPage />} />
          <Route path="price-lists" element={<PricesPage />} />
          <Route path="catalogs" element={<CatalogsPage />} />
          <Route path="catalogs/:catalogId" element={<CatalogDetailPage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="settings" element={<CommercialSettingsPage />} />
        </Route>
        <Route path="products" element={<Navigate to="/commercial/products" replace />} />
        <Route path="categories" element={<Navigate to="/commercial/categories" replace />} />
        <Route path="brands" element={<Navigate to="/commercial/brands" replace />} />
        <Route path="prices" element={<Navigate to="/commercial/price-lists" replace />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
