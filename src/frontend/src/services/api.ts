import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use(
  (config) => {
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type']
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
})

api.interceptors.response.use(
  (response) => {
    if (
      response.data &&
      typeof response.data === 'object' &&
      'data' in response.data
    ) {
      response.data = response.data.data
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
