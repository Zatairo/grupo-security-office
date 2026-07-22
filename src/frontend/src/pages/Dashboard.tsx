import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuthStore } from '../stores/auth.store'

const banners = [
  {
    title: 'Sistema de Videovigilancia',
    subtitle: 'Cámaras IP, CCTV y accesorios',
    color: 'from-syscom-700 to-syscom-800',
    icon: (
      <svg className="w-16 h-16 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Control de Acceso',
    subtitle: 'Biométrico, tarjetas y videoporteros',
    color: 'from-syscom-600 to-syscom-700',
    icon: (
      <svg className="w-16 h-16 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: 'Alarmas y Smart Home',
    subtitle: 'Intrusión, domótica y sensores',
    color: 'from-syscom-500 to-syscom-600',
    icon: (
      <svg className="w-16 h-16 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
]

const trendingProducts = [
  { brand: 'HIKVISION', name: 'Bala IP 4MP / 40m IR / PoE / WDR 120dB', model: 'DS-2CD2043G2-I' },
  { brand: 'HIKVISION', name: 'Domo IP 2MP / 30m IR / IK10 / PoE', model: 'DS-2CD1123G0E-I' },
  { brand: 'DAHUA', name: 'Bala IP 2MP / 30m IR / IP67 / PoE', model: 'IPC-HFW1230E' },
  { brand: 'HIKVISION', name: 'NVR 16CH / 8MP / H.265+ / PoE', model: 'DS-7616NI-K2/16P' },
  { brand: 'HONEYWELL', name: 'Lector Biométrico / 3000 Huellas', model: 'AC-G1' },
  { brand: 'SUPREMA', name: 'Lector Biométrico / IP / PoE', model: 'BioLite N2' },
]

export default function Dashboard() {
  const user = useAuthStore((state) => state.user)
  const [currentBanner, setCurrentBanner] = useState(0)

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

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center gap-3 text-syscom-600">
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
    <div className="space-y-6">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-syscom-700 to-syscom-800 rounded-xl p-6 text-white">
        <h1 className="text-2xl font-bold">Bienvenido, {user?.name}</h1>
        <p className="text-syscom-200 mt-1">Panel de administración · Grupo Security</p>
      </div>

      {/* Carousel */}
      <div className="relative rounded-xl overflow-hidden h-48 md:h-64">
        {banners.map((banner, index) => (
          <div
            key={index}
            className={`absolute inset-0 bg-gradient-to-r ${banner.color} transition-opacity duration-500 ${
              index === currentBanner ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <div className="flex items-center justify-between h-full px-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">{banner.title}</h2>
                <p className="text-white/80 mt-2">{banner.subtitle}</p>
              </div>
              {banner.icon}
            </div>
          </div>
        ))}
        {/* Carousel indicators */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {banners.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentBanner(index)}
              className={`w-2 h-2 rounded-full transition-colors ${
                index === currentBanner ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </div>
        {/* Carousel arrows */}
        <button
          onClick={() => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => setCurrentBanner((prev) => (prev + 1) % banners.length)}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/products" className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg hover:border-syscom-300 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-syscom-50 rounded-xl flex items-center justify-center text-syscom-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Productos</p>
              <p className="text-2xl font-bold text-syscom-700">{stats?.products || 0}</p>
            </div>
          </div>
        </Link>

        <Link to="/categories" className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg hover:border-syscom-300 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Categorías</p>
              <p className="text-2xl font-bold text-syscom-700">{stats?.categories || 0}</p>
            </div>
          </div>
        </Link>

        <Link to="/brands" className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg hover:border-syscom-300 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Marcas</p>
              <p className="text-2xl font-bold text-syscom-700">{stats?.brands || 0}</p>
            </div>
          </div>
        </Link>

        <Link to="/users" className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg hover:border-syscom-300 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500">Usuarios</p>
              <p className="text-2xl font-bold text-syscom-700">{stats?.users || 0}</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Trending products */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-syscom-700">Tendencia en Productos</h2>
          <Link to="/products" className="text-sm text-syscom-600 hover:text-syscom-700 font-medium">
            Ver todos →
          </Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {trendingProducts.map((product, index) => (
            <div key={index} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
                <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div className="p-3">
                <p className="text-[10px] font-semibold text-syscom-600 uppercase">{product.brand}</p>
                <p className="text-xs text-gray-700 mt-1 line-clamp-2 leading-tight">{product.name}</p>
                <p className="text-[10px] text-gray-400 font-mono mt-1">{product.model}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/products" className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg hover:border-syscom-300 transition-all flex items-center gap-4">
          <div className="w-12 h-12 bg-syscom-50 rounded-xl flex items-center justify-center text-syscom-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-syscom-700">Gestionar Productos</h3>
            <p className="text-sm text-gray-500">Agregar, editar y publicar productos</p>
          </div>
        </Link>

        <Link to="/prices" className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg hover:border-syscom-300 transition-all flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-syscom-700">Administrar Precios</h3>
            <p className="text-sm text-gray-500">Listas de precios y valores</p>
          </div>
        </Link>

        <Link to="/audit" className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-lg hover:border-syscom-300 transition-all flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-syscom-700">Ver Auditoría</h3>
            <p className="text-sm text-gray-500">Historial de cambios</p>
          </div>
        </Link>
      </div>
    </div>
  )
}
