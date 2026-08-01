import { useState } from 'react'
import { useAuthStore } from '../../stores/auth.store'
import { useNavigate, NavLink } from 'react-router-dom'
import api from '../../services/api'
import { hasRole, hasPermission } from '../../lib/rbac'

export default function Header() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery)}`)
    }
  }

  return (
    <header className="bg-security-700 sticky top-0 z-50">
      {/* Top bar - información corporativa */}
      <div className="bg-security-800 text-security-200 text-xs">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-8">
          <span>Panel Administrativo Interno — Grupo Security</span>
          <div className="flex items-center gap-4">
            <a
              href="mailto:soporte@gruposecurity.com"
              className="hover:text-white transition-colors"
            >
              soporte@gruposecurity.com
            </a>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between min-h-[64px] lg:min-h-[96px] h-auto py-2 gap-4">
          {/* Logo */}
          <div className="flex-shrink-0 mr-8">
            <button onClick={() => navigate('/')} className="flex items-center">
              <img
                src="/logo-grupo-security.png"
                alt="Grupo Security"
                className="h-14 sm:h-16 lg:h-20 w-auto"
              />
            </button>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar productos, categorías, marcas..."
                aria-label="Buscar productos, categorías, marcas"
                className="w-full px-4 py-2.5 pr-12 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary bg-security-600/40 text-white placeholder-security-200 border border-security-500/50"
              />
              <button
                type="submit"
                className="absolute right-0 top-0 h-full px-4 bg-security-500 text-white rounded-r-lg hover:bg-security-600 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* User menu */}
            <div className="hidden md:flex items-center gap-2 text-white text-sm">
              <div className="w-8 h-8 bg-security-600 rounded-full flex items-center justify-center">
                <span className="text-xs font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium leading-tight">{user?.name}</p>
                <p className="text-[10px] text-security-200 leading-tight">{user?.roles?.[0] || 'Usuario'}</p>
              </div>
            </div>

            <button
              onClick={async () => {
                try { await api.post('/auth/logout') } catch {}
                logout()
                navigate('/login', { replace: true })
              }}
              className="p-2 text-security-200 hover:text-white hover:bg-security-600 rounded-lg transition-colors"
              title="Cerrar sesión"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Category navigation */}
      <nav className="bg-security-600 border-t border-security-500">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin py-1">
            <NavItem to="/" label="Dashboard" />
            <NavItem to="/products" label="Productos" />
            <NavItem to="/categories" label="Categorías" />
            <NavItem to="/brands" label="Marcas" />
            <NavItem to="/prices" label="Precios" />
            {(hasRole('Admin') || hasPermission('users:read')) && (
              <NavItem to="/users" label="Usuarios" />
            )}
            {(hasRole('Admin') || hasPermission('audit:read')) && (
              <NavItem to="/audit" label="Auditoría" />
            )}
          </div>
        </div>
      </nav>
    </header>
  )
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 text-sm font-condensed font-semibold whitespace-nowrap rounded transition-colors tracking-wider ${
          isActive
            ? 'bg-security-700 text-white'
            : 'text-security-100 hover:bg-security-500 hover:text-white'
        }`
      }
    >
      {label}
    </NavLink>
  )
}