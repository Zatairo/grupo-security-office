import { useAuthStore } from '../../stores/auth.store'

export default function Header() {
  const { user, logout } = useAuthStore()

  return (
    <header className="h-16 bg-white border-b border-navy-100 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <div className="hidden lg:block">
          <h2 className="text-sm font-semibold text-navy-900">Panel de Administración</h2>
          <p className="text-xs text-navy-400">Gestión comercial interna</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 text-navy-400 hover:text-navy-600 hover:bg-navy-50 rounded-xl transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent-500 rounded-full"></span>
        </button>

        {/* Divider */}
        <div className="h-8 w-px bg-navy-100"></div>

        {/* User menu */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-navy-900">{user?.name}</p>
            <p className="text-xs text-navy-400">{user?.roles?.[0] || 'Usuario'}</p>
          </div>
          <div className="w-9 h-9 bg-navy-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-semibold text-navy-600">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <button
            onClick={logout}
            className="p-2 text-navy-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
            title="Cerrar sesión"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
