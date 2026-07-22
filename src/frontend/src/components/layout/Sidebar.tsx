import { Link, useLocation } from 'react-router-dom'

const menuItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/products', label: 'Productos', icon: '📦' },
  { path: '/categories', label: 'Categorías', icon: '🏷️' },
  { path: '/brands', label: 'Marcas', icon: '🏢' },
  { path: '/prices', label: 'Precios', icon: '💰' },
  { path: '/users', label: 'Usuarios', icon: '👥' },
]

export default function Sidebar() {
  const location = useLocation()

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">Grupo Security</h1>
        <p className="text-sm text-gray-400">Panel Admin</p>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {menuItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'bg-primary-600'
                    : 'hover:bg-gray-800'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="p-4 border-t border-gray-700">
        <p className="text-xs text-gray-500">v0.1.0 - Fase 1</p>
      </div>
    </aside>
  )
}
