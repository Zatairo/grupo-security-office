import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './hooks/useToast'
import App from './App'
import './index.css'

const Agentation = import.meta.env.DEV
  ? React.lazy(() => import('agentation').then((m) => ({ default: m.Agentation })))
  : null

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        {Agentation && (
          <React.Suspense fallback={null}>
            <Agentation endpoint="http://localhost:4747" />
          </React.Suspense>
        )}
      </ToastProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
