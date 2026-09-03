# ADR 0002: Autenticación PWA — Sesión por Cookie Segura

**Fecha**: 2026-09-01
**Estado**: Aprobado
**Decisores**: Usuario, finance-orchestrator, solution-architect, backend-engineer

## Contexto

La PWA requiere autenticación segura para móvil (iOS Safari, Android Chrome). Opciones evaluadas:

1. **JWT en Header Authorization + localStorage** — Estándar SPA, pero vulnerable a XSS (tokens accesibles desde JS)
2. **HttpOnly Cookie + CSRF Token** — Seguro contra XSS, pero complejidad CORS, SameSite issues en mobile PWA
3. **Híbrido: Access Token en memoria (corto) + Refresh Token en HttpOnly Cookie (rotación)** — Mejor balance seguridad/UX

## Decisión

**Sesión mediante cookie segura con:**
- `Secure` en producción (HTTPS obligatorio)
- `HttpOnly` (inaccesible desde JavaScript)
- `SameSite=Lax` (balance seguridad/usabilidad para navegación cross-site legítima)
- Protección CSRF en operaciones que modifican datos (POST/PATCH/PUT/DELETE)
- Rotación de sesión durante login (nueva sesión, invalidar anterior)
- Sesiones revocables almacenadas en PostgreSQL (tabla `sessions` con `user_id`, `expires_at`, `revoked_at`, `user_agent`, `ip`)
- **No guardar tokens de autenticación en localStorage**

La API podrá incorporar posteriormente tokens específicos para integraciones (patrones `Bearer` con scopes), pero no forman parte del MVP.

## Justificación

- **Seguridad**: HttpOnly + Secure previene robo de tokens via XSS. Rotación en login mitiga session fixation. Revocación en BD permite logout real y revocación admin.
- **Mobile PWA**: SameSite=Lax funciona correctamente en iOS Safari y Android Chrome para navegación normal. CSRF token en header personalizado (`X-CSRF-Token`) o cookie `csrf_token` (Double Submit Cookie pattern).
- **UX**: Access token corto (15 min) en memoria (Zustand/React Context) evita persistencia. Refresh automático silencioso via cookie HttpOnly.
- **Escalabilidad**: Sesiones en BD permiten listar sesiones activas, revocar todas, detectar anomalías.

## Consecuencias

- Backend: `src/backend/modules/auth/` con endpoints `/login`, `/refresh`, `/logout`, `/me`
- Middleware de autenticación extrae `session_id` de cookie, valida en BD, adjunta `user` al request
- CSRF: Generar token al login, enviar en cookie `csrf_token` (SameSite=Lax) + requerir header `X-CSRF-Token` en mutaciones
- Frontend: `auth.store.ts` mantiene access token en memoria, intercepta 401 para refresh automático
- Logout: Revoca sesión en BD + limpia cookies (Set-Cookie con `Max-Age=0`)

## Seguimiento

- Implementar `SessionMiddleware` FastAPI
- Tests: login → access token expira → refresh automático → logout revoca
- Tests CSRF: mutación sin token → 403, mutación con token → 200
- Documentar en OpenAPI