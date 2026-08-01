# DevOps Phase 1 — Stabilization

## Estado actual del pipeline

### Local (validado)

| Paso | Comando | Estado |
|------|---------|--------|
| Base de datos | PostgreSQL local (puerto 5432) | ✅ Corriendo |
| Migrations | `npx prisma migrate deploy` | ✅ Sin pendientes |
| Seed | `npm run db:seed` | ✅ Datos creados (roles, permisos, admin, categorías, marcas, listas de precio) |
| Build backend | `npm run build` (`nest build`) | ✅ Compila sin errores |
| Test backend | `npm test` (jest) | ✅ 116/116 tests pasan — 0 fallos |
| Build frontend | `npm run build` (`tsc -b && vite build`) | ✅ Compila sin errores |

### CI (workflow `.github/workflows/ci.yml`)

| Paso | Incluido en CI | Estado |
|------|---------------|--------|
| Install dependencies (npm ci) | ✅ Sí | Funciona |
| Prisma generate | ✅ Sí | Requiere `DATABASE_URL_CI` |
| Lint (backend) | ✅ Sí | — |
| Typecheck (backend) | ✅ Sí (`tsc --noEmit`) | — |
| Build backend | ✅ Sí | — |
| Prisma validate | ✅ Sí | Requiere `DATABASE_URL_CI` |
| **Test backend** | ❌ **No incluido** | **Crítico — pipeline pasa aunque tests fallen** |
| Build frontend (lint + typecheck + build) | ✅ Sí | — |

## Secretos requeridos

### CI (ci.yml)

| Secreto | Dónde se usa | Obligatorio |
|---------|-------------|-------------|
| `DATABASE_URL_CI` | `prisma generate` (line 47) y `prisma validate` (line 61) | ✅ Sí |

### CD (cd.yml)

| Secreto/Variable | Dónde se usa | Obligatorio |
|-----------------|-------------|-------------|
| `GITHUB_TOKEN` | Login a GHCR (built-in, se provee automáticamente) | ✅ Sí |
| `DEPLOY_HOST` | SSH action (line 101) | ✅ Sí |
| `DEPLOY_USER` | SSH action (line 102) | ✅ Sí |
| `DEPLOY_SSH_KEY` | SSH action (line 103) | ✅ Sí |
| `DEPLOY_PORT` | SSH action (line 104, default 22) | ❌ Opcional |
| `DISCORD_WEBHOOK_URL` | Notificación Discord (line 135, como `vars`) | ❌ Opcional |

### Resumen de secretos faltantes para configurar
1. `DATABASE_URL_CI` — string de conexión a PostgreSQL para CI
2. `DEPLOY_HOST` — IP/host del servidor de deploy
3. `DEPLOY_USER` — usuario SSH
4. `DEPLOY_SSH_KEY` — clave privada SSH
5. `DEPLOY_PORT` — puerto SSH (default 22)

## Pipeline mínimo recomendado para Fase 1

```yaml
# Orden sugerido para CI
1. Install dependencies (npm ci)
2. Lint (npm run lint)
3. Typecheck (npx tsc --noEmit)
4. Prisma generate (npx prisma generate)
5. Build backend (npm run build)
6. Test backend (npm test)          # ← FALTANTE: agregar al workflow
7. Prisma validate (npx prisma validate)
8. Build frontend (npm run build)
```

### Notas sobre CI
- **Agregar tests**: El workflow actual no ejecuta `npm test`. Debería agregarse tras el build backend para garantizar que el código no solo compila, sino que pasa las pruebas.
- **Prisma generate vs validate**: `generate` necesita `DATABASE_URL_CI` para conectar con la base de datos (aunque no sea necesaria para generar el client, Prisma la valida). `validate` también la requiere.
- **Tests actualizados**: Se corrigieron los mocks incompletos y aserciones desactualizadas. Ahora 116/116 tests pasan.

### Notas sobre CD
- El CD está diseñado para ejecutarse solo en push a `dev` (staging) o `main` (producción).
- **No activar CD hasta que CI pase consistentemente** en la rama correspondiente.
- Se recomienda:
  1. Primero estabilizar CI (agregar tests, corregir tests rotos)
  2. Configurar los secretos de deploy
  3. Recién entonces habilitar el trigger del CD

### Docker local
- `docker compose up -d db` funciona con Docker Desktop (PostgreSQL 16 Alpine), pero en esta validación se usó PostgreSQL local instalado como servicio de Windows.
- El contenedor `api` y `frontend` en docker-compose son para hot-reload en desarrollo, no para producción.

## Pipeline Local — Verificación Post-Fix (ITERACIÓN ACTUAL)

### Estado del Pipeline

| Paso | Comando | Estado | Detalle |
|------|---------|--------|---------|
| DB Generate | `npm run db:generate` | ✅ | Prisma Client v5.22.0 generado en 157ms |
| Build | `npm run build` | ✅ | `nest build` compila sin errores |
| Tests | `npm test` | ✅ | **116/116 tests pasan** (10 suites) |
| Start | `node dist/src/main` | ✅ | Servidor arranca en puerto 3000 |
| Health | `GET /api/health` | ✅ | `{"status":"ok","database":"connected"}` |

### Fix de Auth Aplicado

| Archivo | Cambio |
|---------|--------|
| `jwt-auth.guard.ts` | Error genérico → `UnauthorizedException` con mensaje descriptivo |
| `jwt.strategy.ts` | Parsing manual de cookie (`req.cookies` → regex fallback → Bearer header) |
| `package.json` | Scripts de start corregidos a `dist/src/main` (antes apuntaban a ruta incorrecta) |

### Verificación End-to-End

| Test | Método | Resultado |
|------|--------|-----------|
| Login con credenciales admin | `POST /api/auth/login` | ✅ 200 — Cookie `access_token` (httpOnly) + user data |
| Profile con Cookie | `GET /api/auth/profile` (Cookie header) | ✅ 200 — Perfil completo con roles y permisos |
| Profile con Bearer | `GET /api/auth/profile` (Authorization header) | ✅ 200 — Misma respuesta |
| Logout | `POST /api/auth/logout` | ✅ 200 — Cookie eliminada (`Set-Cookie: access_token=; Max-Age=0`) |
| Re-login | `POST /api/auth/login` | ✅ 200 — Nueva sesión creada con nuevo token |
| Profile post re-login | `GET /api/auth/profile` | ✅ 200 — Sesión activa verificada |

### Observaciones

- **JWT es stateless**: Logout limpia la cookie del lado del cliente (Set-Cookie clear), pero el token JWT sigue válido hasta expirar. Esto es comportamiento esperado. Para invalidación server-side se requiere un blocklist/allowlist (Fase 2+).
- **Cookie vs Bearer**: Ambos mecanismos funcionan correctamente. El frontend puede usar cualquiera de los dos.
- **Tests mejorados**: Se pasaron de 106/113 a 116/116 (todos los tests pasan).

## Pipeline - Iteración Credenciales + RBAC

### Estado del Pipeline

| Componente | Build | Tests | Estado |
|------------|-------|-------|--------|
| Backend | ✅ | ✅ (116/116) | OK |
| Frontend | ✅ | N/A (no test runner) | OK |

### Cambios Verificados
- Backend: Auth contract documentado, tests actualizados
- Frontend: Credenciales limpiadas, RBAC visual implementado
- No nuevos secrets hardcodeados
- Pipeline completo funciona sin errores

### Notas
- Frontend no tiene test runner configurado (solo build)
- RBAC es visual, no de rutas (pendiente para futuro)

## Acceso Real — Sin Demo Credentials

### Seed de Desarrollo
El seed (`prisma/seed.ts`) crea:
- **Usuario Admin:** admin@grupo-security.com
- **Contraseña:** definida en seed.ts (no exponer en frontend)
- **Roles:** Admin, Gerente, Operator, Viewer
- **Permisos:** Asignados por rol según matriz de RBAC

### Pipeline (validado 2026-07-24)

| Paso | Estado |
|------|--------|
| Backend build | ✅ `nest build` compila sin errores |
| Backend tests (126+) | ✅ 126/126 tests pasan (10 suites) |
| Frontend build | ✅ `tsc -b && vite build` compila sin errores (154 módulos) |

### Seguridad
- [x] No hay credenciales hardcodeadas en frontend
- [x] Seed solo se ejecuta en desarrollo
- [x] Contraseña del admin no visible en UI
- [x] Backend rechaza usuarios inactivos
- [x] Backend previene escalación de privilegios

### Documentación Generada
- `docs/backend-access-governance.md` — Matriz de permisos y reglas
- `docs/frontend-phase1-stabilization.md` — RBAC visual y gestión de usuarios

### Secrets Audit (2026-07-24)
- **Backend `admin123`:** Solo aparece como ejemplo Swagger en `login.dto.ts` (no es credencial real)
- **Backend `password`:** Todas las referencias son hashes bcrypt, DTOs, y lógica de servicio — sin exposición
- **Frontend `admin123`:** Sin resultados — limpio
- **Frontend `admin@grupo-security`:** Sin resultados — limpio
- **Frontend `password`:** Solo campos `type="password"` en formularios — limpio
