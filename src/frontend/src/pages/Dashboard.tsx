import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuthStore } from '../stores/auth.store'

export default function Dashboard() {
  const user = useAuthStore((state) => state.user)

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [productsRes, categoriesRes, brandsRes, usersRes] = await Promise.all([
        api.get('/products?take=1'),
        api.get('/categories'),
        api.get('/brands'),
        api.get('/users?take=1').catch(() => ({ data: { meta: { total: 0 } } })),
      ])
      return {
        products: productsRes.data.meta?.total || 0,
        categories: categoriesRes.data.data?.length || 0,
        brands: brandsRes.data.data?.length || 0,
        users: usersRes.data.meta?.total || 0,
      }
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Bienvenido, {user?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Link to="/products" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
          <h3 className="text-sm font-medium text-gray-500">Productos</h3>
          <p className="text-3xl font-bold text-blue-600">{stats?.products || 0}</p>
        </Link>

        <Link to="/categories" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
          <h3 className="text-sm font-medium text-gray-500">Categorías</h3>
          <p className="text-3xl font-bold text-green-600">{stats?.categories || 0}</p>
        </Link>

        <Link to="/brands" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
          <h3 className="text-sm font-medium text-gray-500">Marcas</h3>
          <p className="text-3xl font-bold text-purple-600">{stats?.brands || 0}</p>
        </Link>

        <Link to="/users" className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow">
          <h3 className="text-sm font-medium text-gray-500">Usuarios</h3>
          <p className="text-3xl font-bold text-orange-600">{stats?.users || 0}</p>
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Módulos Disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/products" className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <h3 className="font-medium">Productos</h3>
            <p className="text-sm text-gray-500">Gestionar catálogo de productos</p>
          </Link>
          <Link to="/categories" className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <h3 className="font-medium">Categorías</h3>
            <p className="text-sm text-gray-500">Organizar productos por categoría</p>
          </Link>
          <Link to="/brands" className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <h3 className="font-medium">Marcas</h3>
            <p className="text-sm text-gray-500">Gestionar marcas de productos</p>
          </Link>
          <Link to="/prices" className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <h3 className="font-medium">Precios</h3>
            <p className="text-sm text-gray-500">Administrar listas y precios</p>
          </Link>
          <Link to="/users" className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <h3 className="font-medium">Usuarios</h3>
            <p className="text-sm text-gray-500">Gestionar usuarios y roles</p>
          </Link>
          <Link to="/audit" className="p-4 border rounded-lg hover:bg-gray-50 transition-colors">
            <h3 className="font-medium">Auditoría</h3>
            <p className="text-sm text-gray-500">Revisar logs de actividad</p>
          </Link>
        </div>
      </div>
    </div>
  )
}
