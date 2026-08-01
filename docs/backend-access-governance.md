# Backend Access Governance — Fase 1

## Modelo de Acceso

### Autenticación
- **Método:** JWT en cookie HttpOnly
- **Endpoint:** POST /api/auth/login
- **Rate limit:** 5 intentos por minuto
- **Expiración:** 8 horas

### Autorización (RBAC)
- **Guard global:** JwtAuthGuard (requiere token válido)
- **Guard de roles:** RolesGuard (verifica roles del usuario)
- **Decorador:** @Roles('Admin', 'Gerente', ...) en endpoints

## Endpoints y Permisos

### Auth (público)
| Endpoint | Método | Permiso |
|----------|--------|---------|
| POST /api/auth/login | POST | Público (rate limited) |
| GET /api/auth/profile | GET | Autenticado |
| POST /api/auth/logout | POST | Autenticado |

### Users (protegido)
| Endpoint | Método | Permiso |
|----------|--------|---------|
| GET /api/users | GET | Admin, Gerente |
| GET /api/users/:id | GET | Admin, Gerente |
| POST /api/users | POST | **Admin only** |
| PUT /api/users/:id | PUT | **Admin only** |
| DELETE /api/users/:id | DELETE | **Admin only** |

### Roles (protegido)
| Endpoint | Método | Permiso |
|----------|--------|---------|
| GET /api/roles | GET | Admin, Gerente |
| GET /api/roles/:id | GET | Admin, Gerente |
| POST /api/roles | POST | **Admin only** |
| PUT /api/roles/:id | PUT | **Admin only** |
| DELETE /api/roles/:id | DELETE | **Admin only** |

## Reglas de Seguridad

1. **Login:** Solo usuarios existentes y activos en BD
2. **Contraseña:** Mínimo 8 caracteres, hasheada con bcrypt (10 rounds)
3. **Creación de usuarios:** Solo Admin puede crear cuentas
4. **Asignación de roles:** Solo Admin puede asignar/quitar roles
5. **Activación/desactivación:** Solo Admin puede activar/desactivar usuarios
6. **No hay registro público:** No existe endpoint de registro
7. **No hay modo demo:** No hay credenciales hardcodeadas en código

## Seed de Desarrollo

Para entorno local, el seed crea:
- **Usuario Admin:** admin@grupo-security.com
- **Contraseña:** (definida en prisma/seed.ts, no exponer en frontend)
- **Roles:** Admin, Gerente, Operator, Viewer con permisos predefinidos

## Respuesta del Backend

El backend NUNCA revela:
- Si un email existe o no (mismo mensaje para email inexistente y contraseña incorrecta)
- Contraseñas hasheadas
- Tokens JWT

Mensajes de error genéricos:
- "Credenciales inválidas" (login fallido)
- "Usuario no encontrado o inactivo" (token inválido)
