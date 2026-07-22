# Security Checklist v1 - Controles Mínimos Obligatorios

**Proyecto:** Grupo Security - Panel Administrativo Interno (Fase 1)
**Fecha de creación:** 2026-07-22
**Responsable:** Equipo de Desarrollo

---

## Contexto

Panel administrativo interno para **Grupo Security**, empresa colombiana de seguridad electrónica con sedes en Pereira, Armenia, Manizales y Cali. El panel maneja datos sensibles como precios de productos, gestión de usuarios, información comercial y operaciones internas.

Este checklist define los controles mínimos de seguridad obligatorios antes de poner el sistema en uso y los controles de hardening para producción.

**Norma de referencia:** OWASP Top 10 (2021)

---

## Sección 1: Seguridad Mínima Obligatoria (ANTES de poner en uso)

Estos controles **deben** implementarse antes de que cualquier usuario utilice el panel.

### 1.1 Autenticación

- [ ] JWT almacenado en cookies HttpOnly (**NO localStorage**)
- [ ] Cookie con flag `Secure` (producción) y `SameSite=Strict`
- [ ] Hash de contraseñas con bcrypt (salt rounds 12)
- [ ] Mínimo 8 caracteres en contraseñas
- [ ] Rate limiting en endpoint de login (máx 5 intentos por minuto por IP)
- [ ] Bloqueo de cuenta después de 10 intentos fallidos (opcional para MVP)
- [ ] Logout limpia la cookie

### 1.2 Autorización

- [ ] RBAC implementado con Guards de NestJS
- [ ] Cada endpoint tiene decorador `@Roles()`
- [ ] Endpoints solo Admin protegidos
- [ ] Usuarios no pueden modificar sus propios roles
- [ ] Roles por defecto semilla: Admin, Gerente, Operator, Viewer

### 1.3 Validación de Entradas

- [ ] `class-validator` en **TODOS** los DTOs (CreateUserDto, LoginDto, etc.)
- [ ] `@IsEmail()` en campos de email
- [ ] `@MinLength()` en campos de contraseña
- [ ] `@IsString()`, `@IsBoolean()`, `@IsNumber()` en todos los campos
- [ ] Límite de tamaño del body de request (máx 1MB)
- [ ] Protección contra SQL injection garantizada por Prisma ORM

### 1.4 Headers de Seguridad

- [ ] Middleware `helmet()` instalado
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `X-XSS-Protection: 1; mode=block`

### 1.5 CORS

- [ ] CORS configurado para origen específico (URL del frontend únicamente)
- [ ] `credentials: true` (para cookies)

### 1.6 Auditoría

- [ ] Tabla AuditLog creada
- [ ] Operaciones CREATE registradas (entity, entityId, userId, newValues)
- [ ] Operaciones UPDATE registradas (entity, entityId, userId, oldValues, newValues)
- [ ] Operaciones DELETE registradas (entity, entityId, userId, oldValues)
- [ ] Logs de auditoría incluyen timestamp y IP

---

## Sección 2: Controles de Hardening (Post-MVP, antes de producción)

Estos controles deben implementarse después de que el MVP funcione, antes de ponerlo en producción.

### 2.1 HTTPS

- [ ] Certificado SSL/TLS (Let's Encrypt o similar)
- [ ] Redirect HTTP → HTTPS
- [ ] Headers HSTS habilitados

### 2.2 Rate Limiting Avanzado

- [ ] Rate limiting por usuario
- [ ] Rate limiting por endpoint
- [ ] Slow down en intentos de login fallidos repetidos

### 2.3 Seguridad de Tokens

- [ ] Rotación de refresh tokens
- [ ] Expiración: 24h access, 7d refresh
- [ ] Revocación de token en cambio de contraseña

### 2.4 Headers Avanzados

- [ ] `Content-Security-Policy` (CSP)
- [ ] `Referrer-Policy`
- [ ] `Permissions-Policy`

### 2.5 Logging y Monitoreo

- [ ] Logging estructurado (JSON)
- [ ] Rotación de logs
- [ ] Registro de intentos de login fallidos
- [ ] Alertas de actividad sospechosa

### 2.6 Protección de Datos

- [ ] Cifrado de datos sensibles en reposo
- [ ] Backups de base de datos
- [ ] Manejo de datos PII

### 2.7 MFA (Opcional para Fase 1)

- [ ] Endpoint de configuración TOTP reservado
- [ ] Enforzamiento de MFA para usuarios Admin

---

## Tabla Resumen de Controles

| Control | Estado | Prioridad | Notas |
|---------|--------|-----------|-------|
| JWT HttpOnly cookies | Pendiente | Crítica | No usar localStorage |
| Cookie Secure + SameSite | Pendiente | Crítica | Solo producción para Secure |
| bcrypt hash (12 rounds) | Pendiente | Crítica | Nunca guardar texto plano |
| Mínimo 8 caracteres password | Pendiente | Crítica | Validación en DTO |
| Rate limiting login | Pendiente | Crítica | 5 intentos/min/IP |
| Account lockout | Pendiente | Media | Opcional MVP |
| Logout limpia cookie | Pendiente | Alta | Endpoint de logout explícito |
| RBAC con Guards | Pendiente | Crítica | NestJS Guards + @Roles() |
| Decorador @Roles en endpoints | Pendiente | Crítica | Sin decorator = sin acceso |
| Admin-only endpoints | Pendiente | Crítica | Gestión usuarios, config |
| No auto-modificar roles | Pendiente | Alta | Validación en servicio |
| Roles semilla | Pendiente | Alta | Admin, Gerente, Operator, Viewer |
| class-validator en DTOs | Pendiente | Crítica | Todos los DTOs |
| @IsEmail() en emails | Pendiente | Alta | Validación de formato |
| @MinLength() en passwords | Pendiente | Alta | Consistente con política |
| Tipos en todos los campos | Pendiente | Alta | @IsString, @IsBoolean, etc. |
| Body limit 1MB | Pendiente | Alta | Configurar en NestJS |
| Prisma ORM (anti SQL injection) | Pendiente | Crítica | Ya implementado por diseño |
| helmet() middleware | Pendiente | Crítica | Instalar y configurar |
| X-Content-Type-Options | Pendiente | Alta | Parte de helmet |
| X-Frame-Options: DENY | Pendiente | Alta | Prevención clickjacking |
| X-XSS-Protection | Pendiente | Media | Compatibilidad con navegadores viejos |
| CORS origen específico | Pendiente | Crítica | No usar * en producción |
| CORS credentials: true | Pendiente | Crítica | Para cookies cross-origin |
| Tabla AuditLog | Pendiente | Crítica | Modelo en Prisma |
| Logs CREATE | Pendiente | Alta | entity, entityId, userId, newValues |
| Logs UPDATE | Pendiente | Alta | oldValues + newValues |
| Logs DELETE | Pendiente | Alta | entity, entityId, userId, oldValues |
| Timestamp + IP en logs | Pendiente | Alta | Campos obligatorios en AuditLog |
| SSL/TLS certificate | Pendiente | Crítica | Let's Encrypt (gratuito) |
| HTTP → HTTPS redirect | Pendiente | Crítica | Configurar en reverse proxy |
| HSTS headers | Pendiente | Alta | after HTTPS configurado |
| Rate limiting por usuario | Pendiente | Media | Post-MVP |
| Rate limiting por endpoint | Pendiente | Media | Post-MVP |
| Slow down intentos fallidos | Pendiente | Media | Post-MVP |
| Refresh token rotation | Pendiente | Alta | Seguridad de sesiones |
| Token expiration 24h/7d | Pendiente | Alta | Access/Refresh |
| Revocación en cambio password | Pendiente | Alta | Invalidar tokens anteriores |
| Content-Security-Policy | Pendiente | Media | Post-MVP |
| Referrer-Policy | Pendiente | Media | Post-MVP |
| Permissions-Policy | Pendiente | Media | Post-MVP |
| Logging estructurado (JSON) | Pendiente | Media | Post-MVP |
| Rotación de logs | Pendiente | Media | Post-MVP |
| Registro intentos fallidos | Pendiente | Alta | Post-MVP |
| Alertas actividad sospechosa | Pendiente | Media | Post-MVP |
| Cifrado datos en reposo | Pendiente | Media | Post-MVP |
| Backups de BD | Pendiente | Crítica | Definir frecuencia |
| Manejo PII | Pendiente | Media | Post-MVP |
| TOTP endpoint reservado | Pendiente | Media | Solo reservar, no implementar |
| MFA para Admin | Pendiente | Media | Opcional Fase 1 |

---

## Mapeo OWASP Top 10 → Controles

| OWASP | Nombre | Controles que lo Mitigan |
|-------|--------|--------------------------|
| A01 | Broken Access Control | RBAC, Guards, @Roles(), validación de permisos en servicio |
| A02 | Cryptographic Failures | bcrypt (salt rounds 12), cookies HttpOnly/Secure, cifrado en reposo |
| A03 | Injection | Prisma ORM (parameterized queries), class-validator (validación de tipos) |
| A04 | Insecure Design | Revisión de arquitectura, threat modeling en fase de diseño |
| A05 | Security Misconfiguration | helmet(), CORS específico, headers de seguridad, HTTPS |
| A06 | Vulnerable and Outdated Components | `npm audit` periódico, actualización de dependencias |
| A07 | Identification and Authentication Failures | Rate limiting login, JWT HttpOnly, logout, account lockout |
| A08 | Software and Data Integrity Failures | Audit logs, rotación de tokens, validación de integridad |
| A09 | Security Logging and Monitoring Failures | Módulo de auditoría, logs estructurados, monitoreo de actividad |
| A10 | Server-Side Request Forgery (SSRF) | Validación de entradas, sanitización de URLs, restricción de endpoints internos |

---

## Notas de Implementación

- **Orden recomendado:** Implementar Sección 1 completa antes de cualquier testeo con usuarios reales.
- **Dependencias npm necesarias (Sección 1):** `@nestjs/passport`, `passport-jwt`, `bcrypt`, `helmet`, `class-validator`, `class-transformer`.
- **Prisma:** Ya ofrece protección contra SQL injection por diseño (queries parameterized). No usar `prisma.$queryRawUnsafe()` sin sanitización.
- **Auditoría:** Crear un Decorator + Interceptor de NestJS para registrar automáticamente operaciones CRUD.
- **Revisión:** Actualizar este checklist al completar cada control. Marcar como "Completado" con fecha.
