# Frontend Phase 1 - Stabilization

## Estado del Frontend

### Stack
- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Zustand (state management)
- Axios (HTTP client)
- React Router (routing)

### Autenticación
- Cookie HttpOnly `access_token` manejada por backend
- Axios configurado con `withCredentials: true`
- Interceptor redirige a `/login` en 401
- Zustand persiste estado de auth en localStorage

### Archivos Clave
| Archivo | Propósito |
|---------|-----------|
| `src/services/api.ts` | Cliente HTTP con interceptor de auth |
| `src/stores/auth.store.ts` | Estado de autenticación (Zustand) |
| `src/pages/Login.tsx` | Formulario de login |
| `src/App.tsx` | Rutas y guards |

### Fix de Auth (ITERACIÓN ACTUAL)
- Backend ahora retorna 401 (no 500) para tokens inválidos
- Cookie auth funciona correctamente
- Bearer auth sigue funcionando

### Verificación
- [x] Build limpio
- [ ] Login funciona
- [ ] Navegación protegida funciona
- [ ] Logout funciona
- [ ] Re-login funciona
- [x] No hay tokens hardcoded
- [x] Interceptor de 401 funciona

## Limpieza de Credenciales

### Antes
- Login.tsx mostraba credenciales de prueba hardcodeadas: admin@grupo-security.com / admin123

### Después
- Credenciales eliminadas completamente del código
- No quedan emails ni passwords en ningún componente

## RBAC Visual Mínimo

### Utilidades
- `src/lib/rbac.ts` — funciones `hasRole()`, `hasPermission()`, `hasAnyRole()`, `hasAnyPermission()`
- Lee del store Zustand (`useAuthStore`) que contiene `roles: string[]` y `permissions: string[]`

### Acciones Condicionadas por Permiso

| Página | Acción | Permiso Requerido |
|--------|--------|-------------------|
| Productos | Importar Excel | `products:write` |
| Productos | Nuevo Producto | `products:write` |
| Productos | Editar Producto | `products:write` |
| Productos | Eliminar Producto | `products:delete` |
| Productos | Cambiar Visibilidad | `products:write` |
| Categorías | Nueva Categoría | `categories:write` |
| Categorías | Eliminar Categoría | `categories:delete` |
| Marcas | Nueva Marca | `brands:write` |
| Marcas | Eliminar Marca | `brands:delete` |
| Precios | Nueva Lista | `prices:write` |
| Precios | Agregar Precio | `prices:write` |
| Precios | Eliminar Precio | `prices:delete` |
| Usuarios | Ver Usuarios | `users:read` o rol `Admin` |
| Auditoría | Ver Auditoría | `audit:read` o rol `Admin` |

### Navegación
- Nav "Usuarios" visible solo con `users:read` o rol `Admin`
- Nav "Auditoría" visible solo con `audit:read` o rol `Admin`

### Nota
- RBAC es solo visual (no de rutas) en esta fase
- Preparado para extender a route guards en el futuro

## Acceso Real — Eliminación de Demo

### Cambios en Login
- Placeholder cambiado de `admin@grupo-security.com` a `tu@email.com`
- No hay credenciales visibles en ningún componente
- Errores manejados: credenciales inválidas, usuario inactivo, error de servidor

### Gestión de Usuarios (Admin)
- **Lista de usuarios** con búsqueda
- **Crear usuario:** nombre, email, contraseña (mín 8 chars), roles, estado activo
- **Editar usuario:** cambiar nombre, email, contraseña (opcional), roles, estado
- **Activar/Desactivar:** toggle rápido desde la tarjeta
- **Eliminar:** con confirmación
- **RBAC:** solo Admin ve acciones de gestión

### RBAC Visual
- Botones de acción visibles solo para Admin
- Usuarios no-Admin ven la lista pero sin opciones de edición
- Roles se muestran como badges en cada tarjeta
