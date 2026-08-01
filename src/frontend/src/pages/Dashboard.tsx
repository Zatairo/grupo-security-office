import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../stores/auth.store'
import { Card } from '../components/ui'
import { fetchTrendingProducts } from '../services/trending.service'
import { CAROUSEL_INTERVAL, TRENDING_PRODUCTS_LIMIT } from '../constants'

interface BannerItem {
  title: string
  subtitle: string
  color: string
  icon: React.ReactNode
}

interface TrendingProduct {
  brand: string
  name: string
  model: string
}

const defaultBanners: BannerItem[] = [
  {
    title: 'Sistema de Videovigilancia',
    subtitle: 'Cámaras IP, CCTV y accesorios',
    color: 'from-security-700 to-security-800',
    icon: (
      <svg className="w-16 h-16 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Control de Acceso',
    subtitle: 'Biométrico, tarjetas y videoporteros',
    color: 'from-security-600 to-security-700',
    icon: (
      <svg className="w-16 h-16 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
  {
    title: 'Alarmas y Smart Home',
    subtitle: 'Intrusión, domótica y sensores',
    color: 'from-security-500 to-security-600',
    icon: (
      <svg className="w-16 h-16 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
]

export default function Dashboard() {
  const user = useAuthStore((state) => state.user)
  const [currentBanner, setCurrentBanner] = useState(0)

  const {
    data: trendingData = [],
    isLoading: trendingLoading,
    error: trendingError,
  } = useQuery({
    queryKey: ['trending-products'],
    queryFn: () => fetchTrendingProducts({ take: TRENDING_PRODUCTS_LIMIT }),
  })

  const trendingProducts: TrendingProduct[] = Array.isArray(trendingData) ? trendingData : []
  const banners = defaultBanners

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length)
    }, CAROUSEL_INTERVAL)
    return () => clearInterval(interval)
  }, [banners.length])

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-security-700 to-security-800 rounded-xl p-6 text-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Bienvenido, {user?.name || 'Usuario'}</h1>
            <p className="text-security-200 mt-1">Panel de administración · Grupo Security</p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-security-100 text-sm">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span>Sistema operativo</span>
          </div>
        </div>
      </div>

      {/* Carousel */}
      <div
        className="relative rounded-xl overflow-hidden shadow-md"
        style={{ height: '12rem' }}
        role="region"
        aria-label="Carrusel de productos tendencia"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') {
            setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)
          }
          if (e.key === 'ArrowRight') {
            setCurrentBanner((prev) => (prev + 1) % banners.length)
          }
        }}
      >
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
              aria-label={`Ir a banner ${index + 1}`}
            />
          ))}
        </div>
        {/* Carousel arrows */}
        <button
          onClick={() => setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length)}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
          aria-label="Banner anterior"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => setCurrentBanner((prev) => (prev + 1) % banners.length)}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center text-white transition-colors"
          aria-label="Banner siguiente"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Trending products */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-security-700">Tendencia en Productos</h2>
          <Link to="/products" className="text-sm text-security-600 hover:text-security-700 font-medium">
            Ver todos →
          </Link>
        </div>
        {trendingError ? (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl">
            <p>Error al cargar productos tendencia. Intente más tarde.</p>
          </div>
        ) : trendingLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                <div className="aspect-square bg-gray-200"></div>
                <div className="p-3 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-full"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {trendingProducts.map((product, index) => (
              <div key={index} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                <div className="aspect-square bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
                  <svg className="w-16 h-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div className="p-3">
                  <p className="text-[10px] font-semibold text-security-600 uppercase">{product.brand}</p>
                  <p className="text-xs text-gray-700 mt-1 line-clamp-2 leading-tight">{product.name}</p>
                  <p className="text-[10px] text-gray-400 font-mono mt-1">{product.model}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/products">
          <Card hover className="flex items-center gap-4 !p-5">
            <div className="w-12 h-12 bg-security-50 rounded-xl flex items-center justify-center text-security-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-security-700">Gestionar Productos</h3>
              <p className="text-sm text-neutral-500">Agregar, editar y publicar productos</p>
            </div>
          </Card>
        </Link>

        <Link to="/prices">
          <Card hover className="flex items-center gap-4 !p-5">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-security-700">Administrar Precios</h3>
              <p className="text-sm text-neutral-500">Listas de precios y valores</p>
            </div>
          </Card>
        </Link>

        <Link to="/audit">
          <Card hover className="flex items-center gap-4 !p-5">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-security-700">Ver Auditoría</h3>
              <p className="text-sm text-neutral-500">Historial de cambios</p>
            </div>
          </Card>
        </Link>
      </div>
    </div>
  )
}