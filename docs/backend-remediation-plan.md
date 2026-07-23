# Plan de Remediación Técnica — Backend Grupo Security Office

> **Versión:** 1.0  
> **Basado en:** `backend-architecture.md` hallazgos v1.0  
> **Audiencia:** Equipo de desarrollo senior  
> **Propósito:** Convertir hallazgos arquitectónicos en un plan ejecutable, priorizado por fases.

---

## Tabla de Contenidos

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Priorización por Criticidad](#2-priorización-por-criticidad)
3. [Fase 1 — Quick Wins (Seguridad Crítica)](#3-fase-1--quick-wins-seguridad-crítica)
4. [Fase 2 — Consistencia API y Calidad](#4-fase-2--consistencia-api-y-calidad)
5. [Fase 3 — Estructurales y Debt Técnico](#5-fase-3--estructurales-y-debt-técnico)
6. [Dependencias entre Tareas](#6-dependencias-entre-tareas)
7. [Riesgo de Regresión por Cambio](#7-riesgo-de-regresión-por-cambio)
8. [Checklist Final de Validación](#8-checklist-final-de-validación)
9. [Apéndice: Resumen de Archivos a Intervenir](#9-apéndice-resumen-de-archivos-a-intervenir)

---

## 1. Resumen Ejecutivo

Se identificaron **10 hallazgos técnicos** en el backend NestJS actual. Este plan los clasifica en **3 fases** de ejecución:

| Fase | Tipo | Esfuerzo | Impacto | # Items |
|------|------|----------|---------|---------|
| **Fase 1** | Quick Wins — Seguridad | 2-4 horas | Alto | 4 |
| **Fase 2** | Consistencia API | 4-8 horas | Medio | 3 |
| **Fase 3** | Estructural / Debt | 8-16 horas | Medio | 3 |

**Total estimado:** 14-28 horas de desarrollo + 4-8 horas de testing.

**Orden de implementación:** Fase 1 → Fase 2 → Fase 3 (estricto, salvo excepciones documentadas).

---

## 2. Priorización por Criticidad

| # | Hallazgo | Criticidad | Fase | Depende de | Impide |
|---|----------|-----------|------|-----------|--------|
| H1 | Sin rate limiting en login | 🔴 **Crítica** | 1 | — | — |
| H2 | JWT secret con fallback hardcodeado | 🔴 **Crítica** | 1 | — | — |
| H3 | `@MinLength(6)` en LoginDto (inconsistente) | 🔴 **Crítica** | 1 | — | — |
| H4 | Contraseña mínimo en LoginDto vs CreateUserDto | 🟡 **Alta** | 1 | — | — |
| H5 | HttpExceptionFilter no registrado globalmente | 🟡 **Alta** | 2 | — | H6 |
| H6 | TransformInterceptor no registrado globalmente | 🟡 **Alta** | 2 | H5 | — |
| H7 | Parseo manual de query params (3 controladores) | 🟢 **Media** | 2 | H6 | — |
| H8 | Duplicación de guards (modules/auth vs common) | 🟢 **Media** | 3 | — | — |
| H9 | `process.env` directo sin ConfigService | 🟢 **Media** | 3 | H2 | — |
| H10 | Sin tests (unitarios ni e2e) | 🟢 **Media** | 3 | H1-H9 | — |

### Leyenda de criticidad

| Criticidad | Criterio |
|-----------|----------|
| 🔴 **Crítica** | Vulnerabilidad de seguridad explotable o breach de política |
| 🟡 **Alta** | Inconsistencia funcional que afecta experiencia o produce errores |
| 🟢 **Media** | Deuda técnica que afecta mantenibilidad a mediano plazo |
| 🔵 **Baja** | Mejora deseable sin impacto inmediato (no listada aquí) |

---

## 3. Fase 1 — Quick Wins (Seguridad Crítica)

> **Esfuerzo estimado:** 2-4 horas  
> **Riesgo de regresión:** Bajo  
> **Validación:** `npm run build` + prueba manual de login

---

### H1 — Rate limiting en login

| Atributo | Detalle |
|----------|---------|
| **Criticidad** | 🔴 Crítica |
| **Impacto** | Permite fuerza bruta sobre endpoint de autenticación |
| **Tipo** | Quick win (nueva dependencia + config) |

#### Cambio propuesto

**1. Instalar dependencia:**
```bash
npm install @nestjs/throttler
```

**2. Crear/actualizar archivos:**

**Archivo:** `src/backend/src/modules/auth/auth.module.ts`

```typescript
// Antes (línea 10-16):
imports: [
  PrismaModule,
  PassportModule,
  JwtModule.register({...}),
],

// Después:
imports: [
  PrismaModule,
  PassportModule,
  JwtModule.register({...}),
  ThrottlerModule.forRoot([{
    ttl: 60000,     // 1 minuto
    limit: 5,       // 5 intentos
  }]),
],
providers: [AuthService, JwtStrategy, APP_GUARD, RolesGuard],
```

**3. Agregar guard en login endpoint:**

**Archivo:** `src/backend/src/modules/auth/auth.controller.ts`

```typescript
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

// En la clase:
@UseGuards(ThrottlerGuard)
@Public()
@Post('login')
@Throttle({ default: { limit: 5, ttl: 60000 } })
async login(...) { ... }
```

#### Criterio de aceptación
- [ ] 6 intentos de login fallido en 1 minuto desde misma IP = `429 Too Many Requests`
- [ ] Login exitoso resetea el contador
- [ ] Los demás endpoints no tienen throttling (solo login)

#### Riesgo de regresión
- Bajo. Afecta exclusivamente `POST /api/auth/login`.

---

### H2 — JWT secret con fallback hardcodeado

| Atributo | Detalle |
|----------|---------|
| **Criticidad** | 🔴 Crítica |
| **Impacto** | Si `JWT_SECRET` no está definido en producción, cualquiera puede firmar tokens válidos |
| **Tipo** | Quick win (cambio de 2 líneas) |

#### Cambio propuesto

**Archivo:** `src/backend/src/modules/auth/auth.module.ts` (línea 14)

```typescript
// Antes:
secret: process.env.JWT_SECRET || 'grupo-security-secret-key-change-in-production',

// Después — validación en registro del módulo:
import { ConfigService } from '@nestjs/config';
// ...
JwtModule.registerAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    secret: config.get<string>('JWT_SECRET'),
    signOptions: { expiresIn: '8h' },
  }),
}),
```

**Archivo:** `src/backend/src/modules/auth/jwt.strategy.ts` (línea 23)

```typescript
// Antes:
secretOrKey: process.env.JWT_SECRET || 'grupo-security-secret-key-change-in-production',

// Después:
constructor(
  private prisma: PrismaService,
  @Inject(ConfigService) private config: ConfigService,
) {
  super({
    // ...
    secretOrKey: config.get<string>('JWT_SECRET'),
  });
}
```

> **Alternativa más simple (si no quiero refactorizar a `registerAsync`):**
> Mantener `register()` pero validar que la variable exista:

```typescript
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('FATAL: JWT_SECRET no está definido en el entorno');
}
JwtModule.register({
  secret: jwtSecret,
  signOptions: { expiresIn: '8h' },
}),
```

#### Criterio de aceptación
- [ ] Si `JWT_SECRET` no existe en entorno, el servidor **no arranca** (error fatal)
- [ ] Si `JWT_SECRET` existe, login y validación funcionan normalmente
- [ ] `.env.example` debe incluir `JWT_SECRET=` con instrucción de generar uno

#### Riesgo de regresión
- Medio. Si alguien dependía del fallback hardcodeado, el server dejará de arrancar. Es el comportamiento deseado.

---

### H3/H4 — Contraseña mínimo 8 caracteres (inconsistencia)

| Atributo | Detalle |
|----------|---------|
| **Criticidad** | 🔴 Crítica |
| **Impacto** | `LoginDto` permite contraseñas de 6 caracteres; `CreateUserDto` exige 8 |
| **Tipo** | Quick win (cambio de 1 línea) |

#### Cambio propuesto

**Archivo:** `src/backend/src/modules/auth/dto/login.dto.ts` (línea 11)

```typescript
// Antes:
@MinLength(6)

// Después:
@MinLength(8)
```

**Archivo:** `src/backend/src/modules/users/dto/create-user.dto.ts` (línea 16)

```typescript
// Ya tiene @MinLength(8) — verificar, no cambiar.
// Solo actualizar si usa otro valor.
```

#### Criterio de aceptación
- [ ] Login con contraseña de 6 caracteres → `400 Bad Request`
- [ ] Login con contraseña de 8+ caracteres → funciona si es válida
- [ ] Creación de usuario con contraseña de 7 caracteres → `400 Bad Request`

#### Riesgo de regresión
- Bajo. Solo afecta requests con contraseñas entre 6 y 7 caracteres (que es el comportamiento inseguro que queremos eliminar).

---

## 4. Fase 2 — Consistencia API y Calidad

> **Esfuerzo estimado:** 4-8 horas  
> **Riesgo de regresión:** Medio  
> **Validación:** `npm run build` + batería de requests a cada endpoint listado

---

### H5 — HttpExceptionFilter no registrado globalmente

| Atributo | Detalle |
|----------|---------|
| **Criticidad** | 🟡 Alta |
| **Impacto** | Errores no capturados por el filtro devuelven el formato por defecto de NestJS (inconsistente) |
| **Dependencia** | Ninguna |

#### Cambio propuesto

**Archivo:** `src/backend/src/main.ts` — agregar línea 24:

```typescript
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
// ...
app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

// AGREGAR:
app.useGlobalFilters(new HttpExceptionFilter());
```

> Alternativa: usar `APP_FILTER` en `app.module.ts`:

```typescript
// En app.module.ts providers:
providers: [
  { provide: APP_GUARD, useClass: JwtAuthGuard },
  { provide: APP_FILTER, useClass: HttpExceptionFilter },  // AGREGAR
],
```

Ambas opciones son válidas. La de `main.ts` es más explícita y visible. Recomiendo `main.ts` por simplicidad y porque el filter no requiere DI adicional.

#### Criterio de aceptación
- [ ] Lanzar `NotFoundException` en un endpoint → respuesta con formato `{ statusCode, timestamp, path, message }`
- [ ] Lanzar `BadRequestException` → mismo formato
- [ ] Error de validación (class-validator) → `400` con mensaje de validación
- [ ] Error 500 no manejado → `500 Internal Server Error`

#### Riesgo de regresión
- Medio. Si algún frontend dependía del formato de error por defecto de NestJS, dejará de funcionar. El formato nuevo es el aprobado en `backend-architecture.md`.

---

### H6 — TransformInterceptor no registrado globalmente

| Atributo | Detalle |
|----------|---------|
| **Criticidad** | 🟡 Alta |
| **Impacto** | Algunos endpoints devuelven `{ data }`, otros devuelven objeto plano. Inconsistencia que el frontend debe manejar caso por caso. |
| **Dependencia** | H5 (se recomienda registrar ambos al mismo tiempo) |

#### Decisión arquitectónica requerida antes de implementar

Existen **2 opciones**:

| Opción | Descripción | Impacto en frontend | Riesgo |
|--------|-------------|-------------------|--------|
| **A: Registrar interceptor global** | Todo endpoint envuelve en `{ data }` | El frontend ya espera `{ data }` en listas, pero los endpoints individuales NO están envueltos. Habría que ajustar consumo. | Medio |
| **B: NO registrar, estandarizar manualmente** | Cada controlador decide el formato. Se auditan todos y se unifica criterio. | No cambia nada hoy. Se estandariza manualmente. | Bajo |

**Recomendación: Opción A (registrar global).** Es la intención original del interceptor, y el frontend ya está preparado: en `useProducts.ts` lee `res.data.data`. Los endpoints individuales pasarían de devolver `{ id, name }` a `{ data: { id, name } }`.

#### Cambio propuesto

**Archivo:** `src/backend/src/main.ts`:

```typescript
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
// ...
app.useGlobalFilters(new HttpExceptionFilter());
app.useGlobalInterceptors(new TransformInterceptor());  // AGREGAR
```

**Impacto en frontend:** Los endpoints que devuelven objetos individuales ahora recibirán `{ data: { ... } }` en lugar del objeto plano. Revisar:

- `GET /api/auth/profile` → `useAuthStore` recibe `data.user` o `user`?
- `GET /api/products/:id` → se consume directamente o vía hook?

> **Nota:** Verificar consumo en frontend antes de implementar. Si el frontend ya espera `{ data }`, no hay cambio. Si espera objeto plano, toca ajustar.

Si se opta por **Opción B**, el plan es:

1. Auditar todos los controladores (8 módulos)
2. Unificar todos los returns de servicios a un formato consistente
3. Documentar la decisión en `backend-architecture.md`

#### Criterio de aceptación
- [ ] Todos los endpoints devuelven `{ data: ... }` (o se audita y documenta explícitamente)
- [ ] Los endpoints paginados devuelven `{ data: [...], meta: {...} }`
- [ ] Frontend consume sin errores

#### Riesgo de regresión
- Medio-Alto (Opción A). Afecta todos los endpoints. Requiere coordinación con frontend.

---

### H7 — Parseo manual de query params

| Atributo | Detalle |
|----------|---------|
| **Criticidad** | 🟢 Media |
| **Impacto** | 3 controladores hacen `parseInt()` manual. Código verboso, propenso a errores, dificulta mantenimiento. |
| **Dependencia** | H6 (ideal, para no mezclar cambios de formato) |

#### Cambio propuesto

Crear **DTOs de query** con `@Type(() => Number)` de class-transformer.

**Nuevo archivo:** `src/backend/src/modules/products/dto/find-all-products.query.dto.ts`

```typescript
import { IsOptional, IsString, IsBoolean, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class FindAllProductsQueryDto {
  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  skip?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  take?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isVisible?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}
```

**Archivo:** `src/backend/src/modules/products/products.controller.ts` — refactorizar método `findAll`:

```typescript
// Antes:
@Get()
findAll(
  @Query('skip') skip?: string,
  @Query('take') take?: string,
  @Query('search') search?: string,
  @Query('categoryId') categoryId?: string,
  @Query('brandId') brandId?: string,
  @Query('isVisible') isVisible?: string,
  @Query('isActive') isActive?: string,
) {
  return this.productsService.findAll({
    skip: skip ? parseInt(skip) : 0,
    take: take ? parseInt(take) : 50,
    // ...
  });
}

// Después:
@Get()
findAll(@Query() query: FindAllProductsQueryDto) {
  return this.productsService.findAll({
    skip: query.skip ?? 0,
    take: query.take ?? 50,
    search: query.search,
    categoryId: query.categoryId,
    brandId: query.brandId,
    isVisible: query.isVisible,
    isActive: query.isActive,
  });
}
```

**Repetir para:**

| Controlador | Parámetros a tipar | Archivo DTO nuevo |
|-------------|-------------------|-------------------|
| `UsersController.findAll` | `skip`, `take`, `search` | `modules/users/dto/find-all-users.query.dto.ts` |
| `AuditController.findAll` | `skip`, `take`, `entity`, `entityId`, `userId`, `action` | `modules/audit/dto/find-all-audit.query.dto.ts` |

#### Criterio de aceptación
- [ ] `GET /api/products?skip=0&take=10` funciona con tipado correcto
- [ ] `GET /api/products?skip=abc` → `400 Bad Request` (no es número válido)
- [ ] `GET /api/products?unknownParam=1` → `400` (forbidNonWhitelisted)
- [ ] Swagger muestra los parámetros correctamente documentados

#### Riesgo de regresión
- Bajo-Medio. `ValidationPipe` con `transform: true` ya existe globalmente. El cambio es puramente estructural. Posible riesgo si algún valor booleano se interpreta distinto (`'true'` vs `true`).

---

## 5. Fase 3 — Estructurales y Debt Técnico

> **Esfuerzo estimado:** 8-16 horas  
> **Riesgo de regresión:** Medio-Alto  
> **Validación:** `npm run build` + `npm run test` (después de implementar tests) + prueba de integración completa

---

### H8 — Duplicación de guards

| Atributo | Detalle |
|----------|---------|
| **Criticidad** | 🟢 Media |
| **Impacto** | `modules/auth/roles.guard.ts` y `common/guards/roles.guard.ts` son idénticos. Ídem para permissions.guard. Los controladores ya importan desde `common/guards/`. |
| **Dependencia** | Ninguna |

#### Cambio propuesto

**Eliminar archivos duplicados:**

```bash
rm src/backend/src/modules/auth/roles.guard.ts
rm src/backend/src/modules/auth/permissions.guard.ts
```

**Verificar imports** — ya todos los controladores importan desde `../../common/guards/roles.guard`. Confirmar:

- `users.controller.ts` → `../../common/guards/roles.guard` ✅
- `products.controller.ts` → `../../common/guards/roles.guard` ✅
- `categories.controller.ts` → `../../common/guards/roles.guard` ✅
- `brands.controller.ts` → `../../common/guards/roles.guard` ✅
- `prices.controller.ts` → `../../common/guards/roles.guard` ✅
- `audit.controller.ts` → `../../common/guards/roles.guard` ✅
- `roles.controller.ts` → `../../common/guards/roles.guard` ✅

Ningún controlador importa desde `modules/auth/`. Los archivos están huérfanos.

#### Criterio de aceptación
- [ ] `npm run build` exitoso
- [ ] Todos los endpoints protegidos funcionan igual que antes
- [ ] No hay imports rotos

#### Riesgo de regresión
- Bajo. Los archivos no se referencian desde ningún controlador. Solo existe el archivo físico.

---

### H9 — `process.env` directo sin ConfigService

| Atributo | Detalle |
|----------|---------|
| **Criticidad** | 🟢 Media |
| **Impacto** | Dificulta testing, viola principio de inversión de dependencias, mezcla configuración con lógica. |
| **Dependencia** | H2 (parcial — el JWT secret migra a ConfigService como parte de H2) |

#### Cambio propuesto

**Auditar todo `process.env` en el código:**

```bash
grep -r "process\.env" src/backend/src/ --include="*.ts"
```

**Archivos esperados:**

| Archivo | Variable | Acción |
|---------|----------|--------|
| `auth.module.ts` | `JWT_SECRET` | ✅ Migrado en H2 |
| `jwt.strategy.ts` | `JWT_SECRET` | ✅ Migrado en H2 |
| `main.ts` | `CORS_ORIGIN`, `NODE_ENV`, `API_PORT` | Migrar a `ConfigService` |
| `auth.controller.ts` | `NODE_ENV` (cookie secure) | Migrar a `ConfigService` |

**Refactorizar `main.ts`:**

```typescript
// Antes:
const port = process.env.API_PORT || 3000;
app.enableCors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
});

// Después:
import { ConfigService } from '@nestjs/config';
// ...
const configService = app.get(ConfigService);
const port = configService.get('API_PORT', 3000);
app.enableCors({
  origin: configService.get('CORS_ORIGIN', 'http://localhost:5173'),
  credentials: true,
});
```

**Refactorizar `auth.controller.ts`:**

```typescript
// Antes:
secure: process.env.NODE_ENV === 'production',

// Después (inyectar ConfigService en controller):
secure: this.config.get('NODE_ENV') === 'production',
```

#### Criterio de aceptación
- [ ] `npm run build` exitoso
- [ ] `process.env` no aparece en ningún archivo `src/` (solo en `main.ts` bootstrap si no se refactoriza)
- [ ] Tests unitarios pueden mockear `ConfigService`

#### Riesgo de regresión
- Medio. Cambia el punto de acceso a variables de entorno. Si alguna variable no está registrada en `ConfigModule`, fallará silenciosamente con el valor default.

---

### H10 — Sin tests (unitarios ni e2e)

| Atributo | Detalle |
|----------|---------|
| **Criticidad** | 🟢 Media (pero bloqueante para producción) |
| **Impacto** | Cero cobertura de tests. Cualquier refactor es riesgoso. |
| **Dependencia** | H1-H9 (ideal: tests después de remediación, antes de producción) |

#### Cambio propuesto

**Fase 3a — Configuración de testing (30 min):**

Verificar que `jest` esté configurado correctamente en `package.json` y exista `jest.config.ts` o configuración en `package.json`.

```json
// En package.json, verificar que exista:
{
  "jest": {
    "moduleFileExtensions": ["js", "json", "ts"],
    "rootDir": "src",
    "testRegex": ".*\\.spec\\.ts$",
    "transform": {
      "^.+\\.(t|j)s$": "ts-jest"
    },
    "collectCoverageFrom": ["**/*.(t|j)s"],
    "coverageDirectory": "../coverage",
    "testEnvironment": "node"
  }
}
```

**Fase 3b — Tests unitarios críticos (4-6 horas):**

| Prioridad | Módulo | Casos de prueba |
|-----------|--------|-----------------|
| 1 | **AuthService** | `validateUser` — email no existe, password incorrecto, usuario inactivo, éxito con roles/permisos<br>`login` — genera token con payload correcto<br>`getProfile` — usuario existe, no existe |
| 2 | **ProductsService** | `findAll` — paginación, filtros, search<br>`findOne` — existe, no existe<br>`create` — SKU duplicado (Conflict), categoría no existe, éxito<br>`toggleVisibility` — toggle correcto |
| 3 | **UsersService** | `create` — email duplicado<br>`update` — auto-asignación de roles bloqueada |

**Estructura de test (ejemplo):**

```typescript
// modules/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('fake-jwt-token'),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
  });

  describe('validateUser', () => {
    it('should throw UnauthorizedException when user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.validateUser('test@test.com', 'pass'))
        .rejects.toThrow(UnauthorizedException);
    });

    it('should return user data on success', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: '1', email: 'test@test.com', name: 'Test',
        password: '$2b$10$...', isActive: true,
        roles: [{ role: { name: 'Admin', permissions: [{ permission: 'products:*' }] } }],
      });
      const result = await service.validateUser('test@test.com', 'Admin123');
      expect(result).toHaveProperty('id');
      expect(result.roles).toContain('Admin');
    });
  });
});
```

**Fase 3c — Test e2e de auth (2-4 horas):**

```typescript
// test/auth.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  it('POST /api/auth/login - success', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'admin@grupo-security.com', password: 'admin123' })
      .expect(200)
      .expect(res => {
        expect(res.body.user).toBeDefined();
        expect(res.body.user.email).toBe('admin@grupo-security.com');
      });
  });

  it('POST /api/auth/login - invalid credentials', () => {
    return request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'wrong@email.com', password: 'wrong' })
      .expect(401);
  });

  afterAll(async () => {
    await app.close();
  });
});
```

#### Criterio de aceptación
- [ ] `npm test` ejecuta y pasa todos los tests
- [ ] Cobertura mínima: >60% en servicios core (Auth, Products, Users)
- [ ] Test e2e de login exitoso + login fallido pasa
- [ ] `npm run test -- --coverage` reporta cobertura

#### Riesgo de regresión
- Bajo. Los tests no modifican código productivo, solo añaden archivos `.spec.ts`. Riesgo solo si el seed cambia y los tests dependen de datos específicos.

---

## 6. Dependencias entre Tareas

### Diagrama de dependencias

```
Fase 1 (Quick Wins)
├── H1: Rate limiting        [sin dependencias]
├── H2: JWT secret           [sin dependencias]
├── H3: @MinLength(8)        [sin dependencias]
└── H4: inconsistencia DTOs  [sin dependencias]
        │
        ▼
Fase 2 (Consistencia API)
├── H5: HttpExceptionFilter  [sin dependencias]
│       │
│       ▼
├── H6: TransformInterceptor [depende de H5 → mismo archivo main.ts]
│       │
│       ▼
└── H7: Query DTOs            [ideal después de H6 para no mezclar cambios]
        │
        ▼
Fase 3 (Estructural)
├── H8: Eliminar guards dup   [sin dependencias]
├── H9: ConfigService         [depende parcialmente de H2]
└── H10: Tests                [depende de H1-H9 para testear código ya corregido]
```

### Orden recomendado de implementación

| Paso | Tarea | Archivos a modificar | Tiempo estimado |
|------|-------|---------------------|-----------------|
| 1 | H3 — `@MinLength(8)` | 1 archivo | 5 min |
| 2 | H1 — Rate limiting | 2 archivos + npm install | 30 min |
| 3 | H2 — JWT sin fallback | 2 archivos | 30 min |
| 4 | H5 — HttpExceptionFilter global | 1 archivo | 5 min |
| 5 | H7 — Query DTOs | 3-6 archivos nuevos + 3 controladores | 2-3 h |
| 6 | H6 — TransformInterceptor global | 1 archivo + verificar frontend | 1-2 h |
| 7 | H8 — Eliminar guards duplicados | 2 archivos eliminados | 5 min |
| 8 | H9 — Migrar a ConfigService | 3-4 archivos | 1-2 h |
| 9 | H10 — Tests | 5-10 archivos nuevos | 6-10 h |

---

## 7. Riesgo de Regresión por Cambio

| Tarea | Riesgo | Mitigación |
|-------|--------|-----------|
| **H1** Rate limiting | Bajo — solo login | Probar con 6 requests rápidas |
| **H2** JWT secret | Medio — server no arranca sin secret | Validar en staging primero |
| **H3** @MinLength(8) | Bajo — afecta contraseñas 6-7 chars | Comunicar a usuarios existentes |
| **H5** ExceptionFilter | Medio — cambia formato de error | Verificar frontend no dependa del formato viejo |
| **H6** TransformInterceptor | **Alto** — cambia estructura de respuesta de TODOS los endpoints | Coordinar con frontend. Hacer en ventana de mantenimiento |
| **H7** Query DTOs | Bajo-Medio — booleans como string | Probar filtros `isVisible=true` |
| **H8** Guards duplicados | Bajo — archivos no referenciados | Confirmar con grep antes de eliminar |
| **H9** ConfigService | Medio — valores default | Verificar `.env` en staging y producción |
| **H10** Tests | Bajo — código nuevo, no modifica productivo | — |

### 🚨 Estrategia de rollback

Cada tarea debe ser **commiteada individualmente** (un commit porhallazgo, no un mega-commit). Si una tarea falla en producción:

```bash
git revert <commit-hash> -m "revert: H6 - TransformInterceptor global"
```

---

## 8. Checklist Final de Validación

### 8.1 Previo a implementación

- [ ] Lectura completa de este plan por al menos 2 desarrolladores
- [ ] Ambiente de staging disponible con copia de DB real
- [ ] Frontend notificado de cambios en formato de respuesta (H6)
- [ ] `.env` de producción verificado que tiene `JWT_SECRET` (H2)
- [ ] Branch feature creada: `fix/backend-remediation-phase-1`

### 8.2 Por cada tarea

- [ ] `npm run build` sin errores
- [ ] Prueba manual del endpoint modificado
- [ ] Commit individual con mensaje semántico (`fix: agregar rate limiting en login`)
- [ ] PR con descripción del cambio y riesgo de regresión

### 8.3 Post-implementación (pre-producción)

- [ ] `npm run test` pasa con cobertura >60%
- [ ] Prueba de humo: login → listar productos → crear producto → ver auditoría
- [ ] Swagger `/api/docs` funcional con todos los endpoints documentados
- [ ] Verificar que `NODE_ENV=production` arranca sin warnings
- [ ] Rate limiting: 5 intentos fallidos rápidos → 429

### 8.4 Post-producción

- [ ] Monitoreo de errores 24h (especialmente 400/401/429)
- [ ] Revisión de logs de auditoría para confirmar funcionamiento
- [ ] Actualizar `security-checklist-v1.md` marcando controles como completados

---

## 9. Apéndice: Resumen de Archivos a Intervenir

### Archivos a modificar

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `src/backend/src/modules/auth/dto/login.dto.ts` | `@MinLength(6)` → `@MinLength(8)` |
| 2 | `src/backend/src/modules/auth/auth.module.ts` | Agregar `ThrottlerModule`, JWT con ConfigService |
| 3 | `src/backend/src/modules/auth/auth.controller.ts` | Agregar `@UseGuards(ThrottlerGuard)` en login |
| 4 | `src/backend/src/modules/auth/jwt.strategy.ts` | Usar ConfigService en lugar de `process.env.JWT_SECRET` |
| 5 | `src/backend/src/main.ts` | Agregar `useGlobalFilters`, `useGlobalInterceptors`, ConfigService |
| 6 | `src/backend/src/modules/products/products.controller.ts` | Refactorizar `findAll` con DTO de query |
| 7 | `src/backend/src/modules/users/users.controller.ts` | Refactorizar `findAll` con DTO de query |
| 8 | `src/backend/src/modules/audit/audit.controller.ts` | Refactorizar `findAll` con DTO de query |
| 9 | `src/backend/src/modules/auth/roles.guard.ts` | **Eliminar** (duplicado) |
| 10 | `src/backend/src/modules/auth/permissions.guard.ts` | **Eliminar** (duplicado) |
| 11 | `src/backend/src/modules/auth/auth.controller.ts` | `NODE_ENV` → `ConfigService` |

### Archivos a crear

| # | Archivo | Propósito |
|---|---------|-----------|
| 1 | `src/backend/src/modules/products/dto/find-all-products.query.dto.ts` | DTO tipado para query params de listado |
| 2 | `src/backend/src/modules/users/dto/find-all-users.query.dto.ts` | DTO tipado para query params de listado |
| 3 | `src/backend/src/modules/audit/dto/find-all-audit.query.dto.ts` | DTO tipado para query params de listado |
| 4 | `src/backend/src/modules/auth/auth.service.spec.ts` | Tests unitarios de AuthService |
| 5 | `src/backend/src/modules/products/products.service.spec.ts` | Tests unitarios de ProductsService |
| 6 | `src/backend/src/modules/users/users.service.spec.ts` | Tests unitarios de UsersService |
| 7 | `src/backend/test/auth.e2e-spec.ts` | Test e2e de autenticación |

### Dependencias npm a agregar

```bash
npm install @nestjs/throttler
npm install --save-dev @types/jest ts-jest  # si no existen
```

---

## Resumen Visual del Plan

```
FASE 1 (Quick Wins — Seguridad)         DURACIÓN: 2-4h
┌──────────────────────────────────────────────────┐
│ H3  ████▌ @MinLength(8)         [5 min]  🔴     │
│ H1  ██████████ Rate limiting      [30 min] 🔴     │
│ H2  ██████████ JWT sin fallback   [30 min] 🔴     │
│ H4  ████▌ Consistencia DTOs      [5 min]  🟡     │
└──────────────────────────────────────────────────┘
                       │
                       ▼
FASE 2 (Consistencia API)               DURACIÓN: 4-8h
┌──────────────────────────────────────────────────┐
│ H5  ████▌ ExceptionFilter global   [5 min]  🟡     │
│ H7  ████████████████ Query DTOs    [2-3h]  🟢     │
│ H6  ██████████ Interceptor global  [1-2h]  🟡     │
└──────────────────────────────────────────────────┘
                       │
                       ▼
FASE 3 (Estructural / Debt)            DURACIÓN: 8-16h
┌──────────────────────────────────────────────────┐
│ H8  ████▌ Eliminar guards dup     [5 min]  🟢     │
│ H9  ██████████ ConfigService       [1-2h]  🟢     │
│ H10 ██████████████████████████████ [6-10h] 🟢     │
└──────────────────────────────────────────────────┘
```

---

> **Documento mantenido por:** Equipo de Desarrollo Grupo Security  
> **Última actualización:** 2026-07-23  
> **Próxima revisión:** Al completar Fase 1 y antes de iniciar Fase 2
