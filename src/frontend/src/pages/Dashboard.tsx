import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuthStore } from '../stores/auth.store'

const stats = [
  {
    label: 'Productos',
    key: 'products',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    color: 'bg-blue-500',
    bgLight: 'bg-blue-50',
    textColor: 'text-blue-600',
    link: '/products',
  },
  {
    label: 'Categorías',
    key: 'categories',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    color: 'bg-emerald-500',
    bgLight: 'bg-emerald-50',
    textColor: 'text-emerald-600',
    link: '/categories',
  },
  {
    label: 'Marcas',
    key: 'brands',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    color: 'bg-violet-500',
    bgLight: 'bg-violet-50',
    textColor: 'text-violet-600',
    link: '/brands',
  },
  {
    label: 'Usuarios',
    key: 'users',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    color: 'bg-amber-500',
    bgLight: 'bg-amber-50',
    textColor: 'text-amber-600',
    link: '/users',
  },
]

const modules = [
  {
    title: 'Catálogo de Productos',
    description: 'Gestiona tu catálogo completo de productos de seguridad electrónica',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    link: '/products',
    color: 'text-blue-600',
    bgLight: 'bg-blue-50',
  },
  {
    title: 'Gestión de Precios',
    description: 'Administra listas de precios y asigna valores por producto',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    link: '/prices',
    color: 'text-emerald-600',
    bgLight: 'bg-emerald-50',
  },
  {
    title: 'Categorías y Marcas',
    description: 'Organiza tu catálogo por categorías jerárquicas y marcas',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
    ),
    link: '/categories',
    color: 'text-violet-600',
    bgLight: 'bg-violet-50',
  },
  {
    title: 'Gestión de Usuarios',
    description: 'Administra usuarios internos y controla accesos por rol',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    link: '/users',
    color: 'text-amber-600',
    bgLight: 'bg-amber-50',
  },
  {
    title: 'Auditoría',
    description: 'Revisa el historial de cambios y actividad del sistema',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    link: '/audit',
    color: 'text-rose-600',
    bgLight: 'bg-rose-50',
  },
]

export default function Dashboard() {
  const user = useAuthStore((state) => state.user)

  const { data: statsData, isLoading } = useQuery({
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
        <div className="flex items-center gap-3 text-navy-500">
          <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-sm font-medium">Cargando panel...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Welcome section */}
      <div className="bg-gradient-to-r from-navy-900 to-navy-800 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">Bienvenido, {user?.name}</h1>
        <p className="text-navy-300 mt-1">Panel de administración · Grupo Security</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Link
            key={stat.key}
            to={stat.link}
            className="bg-white rounded-xl p-5 border border-navy-100 hover:shadow-lg hover:border-navy-200 transition-all group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-navy-500">{stat.label}</p>
                <p className="text-3xl font-bold text-navy-900 mt-1">
                  {statsData?.[stat.key as keyof typeof statsData] || 0}
                </p>
              </div>
              <div className={`w-12 h-12 ${stat.bgLight} rounded-xl flex items-center justify-center ${stat.textColor} group-hover:scale-110 transition-transform`}>
                {stat.icon}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Modules grid */}
      <div>
        <h2 className="text-lg font-bold text-navy-900 mb-4">Módulos Disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((module) => (
            <Link
              key={module.link}
              to={module.link}
              className="bg-white rounded-xl p-5 border border-navy-100 hover:shadow-lg hover:border-navy-200 transition-all group"
            >
              <div className={`w-12 h-12 ${module.bgLight} rounded-xl flex items-center justify-center ${module.color} mb-4 group-hover:scale-110 transition-transform`}>
                {module.icon}
              </div>
              <h3 className="text-base font-semibold text-navy-900">{module.title}</h3>
              <p className="text-sm text-navy-500 mt-1">{module.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
