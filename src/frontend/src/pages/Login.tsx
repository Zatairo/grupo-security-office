import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../stores/auth.store'
import api from '../services/api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/auth/login', { email, password })
      const { user } = response.data
      login(user)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-syscom-700 flex flex-col">
      {/* Top bar */}
      <div className="bg-syscom-800 text-white text-xs">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-8">
          <div className="flex items-center gap-4">
            <span>📞 Contacto: soporte@gruposecurity.com</span>
            <span className="hidden sm:inline">🚚 Envíos a toda Colombia</span>
          </div>
          <div className="flex items-center gap-4">
            <span>TRM: $3,238.19</span>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-syscom-700 py-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-accent-500 rounded-lg flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-white font-bold text-2xl">Grupo Security</h1>
              <p className="text-syscom-200 text-sm">Panel de Administración</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden">
            {/* Form header */}
            <div className="bg-syscom-600 px-6 py-4">
              <h2 className="text-white text-lg font-semibold">Iniciar Sesión</h2>
              <p className="text-syscom-200 text-sm">Accede a tu panel de administración</p>
            </div>

            {/* Form body */}
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Correo electrónico</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-syscom-500 focus:border-transparent"
                    placeholder="admin@grupo-security.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-syscom-500 focus:border-transparent"
                    placeholder="••••••••"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 bg-accent-500 text-white rounded-lg font-semibold hover:bg-accent-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Ingresando...
                    </>
                  ) : (
                    'Ingresar'
                  )}
                </button>
              </form>

              {/* Test credentials */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs font-semibold text-gray-600 mb-2">Credenciales de prueba:</p>
                <p className="text-xs text-gray-500 font-mono">admin@grupo-security.com</p>
                <p className="text-xs text-gray-500 font-mono">admin123</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-xs text-syscom-200 mt-6">
            © 2026 Grupo Security. Todos los derechos reservados.
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-syscom-800 text-syscom-300 text-xs py-4">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p>© 2026 Grupo Security - Seguridad Electrónica · CCTV · Alarmas · Control de Acceso · Smart Home</p>
        </div>
      </footer>
    </div>
  )
}
