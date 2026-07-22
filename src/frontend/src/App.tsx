import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './stores/auth.store'
import AdminLayout from './components/layout/AdminLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ProductsPage from './pages/ProductsPage'
import CategoriesPage from './pages/CategoriesPage'
import BrandsPage from './pages/BrandsPage'
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
        <Route path="products" element={<ProductsPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="brands" element={<BrandsPage />} />
        <Route path="prices" element={<div className="p-6"><h1 className="text-2xl font-bold">Precios</h1><p className="text-gray-500">Módulo en desarrollo...</p></div>} />
        <Route path="users" element={<UsersPage />} />
        <Route path="audit" element={<AuditPage />} />
      </Route>
    </Routes>
  )
}

export default App
