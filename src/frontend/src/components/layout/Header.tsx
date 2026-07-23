import { useState } from 'react'
import { useAuthStore } from '../../stores/auth.store'
import { useNavigate, NavLink } from 'react-router-dom'

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
    <header className="bg-syscom-700 sticky top-0 z-50">
      {/* Top bar */}
      <div className="bg-syscom-800 text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-8">
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">📞 Contacto: soporte@gruposecurity.com</span>
            <span className="hidden md:inline">🚚 Envíos a toda Colombia</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline">TRM: $3,238.19</span>
            <button className="hover:text-syscom-200 transition-colors">Soporte Técnico</button>
          </div>
        </div>
      </div>

      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            <button onClick={() => navigate('/')} className="flex items-center gap-2">
              <div className="w-10 h-10 bg-accent-500 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="hidden sm:block">
                <span className="text-white font-bold text-lg leading-tight">Grupo Security</span>
                <span className="text-syscom-200 text-xs block leading-tight">Panel Administrativo</span>
              </div>
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
                className="w-full px-4 py-2.5 pr-12 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-accent-500"
              />
              <button
                type="submit"
                className="absolute right-0 top-0 h-full px-4 bg-accent-500 text-white rounded-r-lg hover:bg-accent-600 transition-colors"
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
              <div className="w-8 h-8 bg-syscom-600 rounded-full flex items-center justify-center">
                <span className="text-xs font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium leading-tight">{user?.name}</p>
                <p className="text-[10px] text-syscom-200 leading-tight">{user?.roles?.[0] || 'Usuario'}</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-2 text-syscom-200 hover:text-white hover:bg-syscom-600 rounded-lg transition-colors"
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
      <nav className="bg-syscom-600 border-t border-syscom-500">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin py-1">
            <NavItem to="/" label="Dashboard" />
            <NavItem to="/products" label="Productos" />
            <NavItem to="/categories" label="Categorías" />
            <NavItem to="/brands" label="Marcas" />
            <NavItem to="/prices" label="Precios" />
            <NavItem to="/users" label="Usuarios" />
            <NavItem to="/audit" label="Auditoría" />
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
        `px-4 py-2 text-sm font-medium whitespace-nowrap rounded transition-colors ${
          isActive
            ? 'bg-syscom-700 text-white'
            : 'text-syscom-100 hover:bg-syscom-500 hover:text-white'
        }`
      }
    >
      {label}
    </NavLink>
  )
}
