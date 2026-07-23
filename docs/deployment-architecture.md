# Arquitectura de Despliegue — Grupo Security Office

> **Versión:** 1.0  
> **Última actualización:** 2026-07-23  
> **Stack:** React + Vite + Tailwind (frontend) / NestJS + Prisma + PostgreSQL (backend)  
> **Infra base:** Docker + docker-compose + Nginx reverse proxy  
> **Documentos relacionados:** `backend-architecture.md`, `auth-architecture.md`, `testing-strategy.md`, `security-checklist-v1.md`

---

## Tabla de Contenidos

1. [Objetivos del Despliegue](#1-objetivos-del-despliegue)
2. [Arquitectura por Ambientes](#2-arquitectura-por-ambientes)
3. [Diagrama de Componentes Desplegados](#3-diagrama-de-componentes-desplegados)
4. [Estrategia de Contenedores](#4-estrategia-de-contenedores)
5. [Configuración de Red, Dominios y Puertos](#5-configuración-de-red-dominios-y-puertos)
6. [Variables de Entorno y Manejo de Secretos](#6-variables-de-entorno-y-manejo-de-secretos)
7. [Pipeline de Build y Release](#7-pipeline-de-build-y-release)
8. [Estrategia de Migraciones Prisma](#8-estrategia-de-migraciones-prisma)
9. [Despliegue del Frontend y Backend](#9-despliegue-del-frontend-y-backend)
10. [PostgreSQL, Backups y Recuperación](#10-postgresql-backups-y-recuperación)
11. [HTTPS, Reverse Proxy, CORS, CSP, HSTS](#11-https-reverse-proxy-cors-csp-hsts)
12. [Observabilidad Mínima](#12-observabilidad-mínima)
13. [Rollback y Plan de Contingencia](#13-rollback-y-plan-de-contingencia)
14. [Checklist Preproducción y Producción](#14-checklist-preproducción-y-producción)

---

## 1. Objetivos del Despliegue

### 1.1 Objetivos primarios

| Objetivo | Descripción | Indicador |
|----------|-------------|-----------|
| **Disponibilidad** | El sistema debe estar operativo en horario laboral (L-V 7:00-19:00, S 8:00-14:00) | Uptime >99.5% en ventana definida |
| **Seguridad** | Todo el tráfico debe ser HTTPS. Credenciales y tokens protegidos. | OWASP A1-A7 cubiertos |
| **Aislamiento** | Los ambientes dev, staging y prod deben estar separados físicamente | Sin cruce de datos entre ambientes |
| **Recuperación** | Ante fallo, restaurar servicio en < 2 horas | RTO < 2h, RPO < 24h |
| **Simplicidad** | Mínima infraestructura posible para el MVP. Sin Kubernetes, sin orchestrators complejos. | 3 contenedores base |

### 1.2 Restricciones

- **MVP:** La infraestructura debe ser mantenible por un equipo pequeño (1-2 personas).
- **Presupuesto:** Soluciones on-premise o VPS de costo moderado. Sin servicios cloud gestionados (RDS, CloudFront, etc.) a menos que ya existan en Grupo Security.
- **Colombia:** Los servidores deben estar preferiblemente en Colombia o región cercana para latencia mínima (ej: AWS São Paulo, o VPS en Bogotá/Medellín).
- **No Kubernetes:** Se descarta K8s para el MVP. Docker Compose es suficiente.

---

## 2. Arquitectura por Ambientes

### 2.1 Definición de ambientes

| Ambiente | Propósito | URL | DB | Datos | Acceso |
|----------|-----------|-----|----|-------|--------|
| **dev** | Desarrollo local | `http://localhost:3000` | Local PostgreSQL | Seed de prueba | Solo desarrollador |
| **staging** | Validación pre-producción | `https://staging.gruposecurity.com` | Servidor PostgreSQL (staging) | Seed + datos anonimizados | Equipo interno |
| **prod** | Producción | `https://admin.gruposecurity.com` | Servidor PostgreSQL (prod) | Datos reales | Usuarios autorizados |

### 2.2 Dev (local)

```
Máquina desarrollador
├── Backend (NestJS)     → localhost:3000  (npm run start:dev)
├── Frontend (Vite)      → localhost:5173  (npm run dev)
├── PostgreSQL           → localhost:5432  (instalación nativa o Docker)
└── Prisma Studio        → localhost:5555  (npm run db:studio)
```

**Características:**
- Sin Docker necesario (pero opcional vía `docker-compose.yml` local)
- Hot-reload en backend y frontend
- Seed ejecutado manualmente con `npm run db:seed`
- Base de datos local, datos efímeros

### 2.3 Staging

```
Servidor VPS 1 (staging.gruposecurity.com)
├── Nginx (reverse proxy)     → puerto 443 HTTPS
├── Backend (NestJS)          → puerto 3000 (interno)
├── Frontend (build estático) → servido por Nginx
├── PostgreSQL                → puerto 5432 (interno)
└── Health checks             → endpoint /health
```

**Características:**
- Misma configuración que producción, excepto:
  - `NODE_ENV=staging`
  - Certificado SSL Let's Encrypt (staging)
  - Datos de prueba + anonimizados
  - Sin acceso a APIs externas reales
- Deploy automático desde branch `staging`

### 2.4 Producción

```
Servidor VPS 2 (admin.gruposecurity.com)
├── Nginx (reverse proxy)     → puerto 443 HTTPS
├── Backend (NestJS)          → puerto 3000 (interno)
├── Frontend (build estático) → servido por Nginx
├── PostgreSQL                → puerto 5432 (interno)
└── Health checks             → endpoint /health
```

**Características:**
- `NODE_ENV=production`
- Certificado SSL Let's Encrypt (wildcard o SAN)
- Datos reales
- Backups automáticos diarios
- Deploy manual desde tag semántico (`v1.0.0`)

### 2.5 Misma máquina física (opción económica)

Para presupuesto ajustado, **staging y producción pueden compartir servidor** siempre que:
- Puerto diferente (ej: staging → 3001, prod → 3000)
- Bases de datos separadas (misma instancia PostgreSQL, DBs diferentes)
- Nginx separa por `server_name`

```nginx
# Misma IP, diferente server_name
server {
    listen 443 ssl;
    server_name staging.gruposecurity.com;
    location / { proxy_pass http://127.0.0.1:3100; }
}

server {
    listen 443 ssl;
    server_name admin.gruposecurity.com;
    location / { proxy_pass http://127.0.0.1:3200; }
}
```

---

## 3. Diagrama de Componentes Desplegados

### 3.1 Arquitectura en producción

```
                               ┌──────────────┐
                               │   Usuario    │
                               │  (Browser)   │
                               └──────┬───────┘
                                      │ HTTPS (443)
                                      │ admin.gruposecurity.com
                                      ▼
                            ┌───────────────────┐
                            │     Nginx         │
                            │  (reverse proxy)  │
                            │                   │
                            │ ● SSL/TLS         │
                            │ ● Static files    │
                            │ ● Proxy pass API  │
                            │ ● Rate limiting   │
                            │ ● Security headers │
                            └────────┬──────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                 │
                    ▼                ▼                 ▼
           ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
           │   Frontend   │  │   Backend    │  │   Swagger    │
           │  (React SPA) │  │  (NestJS)    │  │    /api/docs │
           │              │  │              │  │              │
           │ / → index.html│  │ /api/*       │  │ Documentación│
           │ /assets/*     │  │ :3000        │  │ interactiva  │
           └──────────────┘  └──────┬───────┘  └──────────────┘
                                    │
                                    ▼
                           ┌────────────────┐
                           │   PostgreSQL   │
                           │   :5432        │
                           │                │
                           │ ● users        │
                           │ ● products     │
                           │ ● categories   │
                           │ ● prices       │
                           │ ● audit_logs   │
                           └────────────────┘
```

### 3.2 Mapa de puertos

```
Servidor (IP: x.x.x.x)
┌───────────────────────────────────────────────┐
│                                               │
│  Nginx (públicos)                             │
│  ├── 443/tcp  → HTTPS (admin.gruposecurity.com)│
│  ├── 80/tcp   → HTTP (redirect a 443)         │
│                                               │
│  Backend (internos)                            │
│  ├── 3000/tcp → API NestJS                     │
│                                               │
│  Base de datos (interno)                       │
│  ├── 5432/tcp → PostgreSQL                     │
│                                               │
│  SSH (administración)                          │
│  ├── 22/tcp   → SSH (solo IPs autorizadas)     │
│                                               │
└───────────────────────────────────────────────┘
```

---

## 4. Estrategia de Contenedores

### 4.1 Estructura de contenedores

```
docker-compose.prod.yml
├── service: postgres
│   ├── image: postgres:16-alpine
│   ├── puerto: 5432
│   ├── volumen: pgdata (persistente)
│   └── healthcheck: pg_isready
│
├── service: backend
│   ├── build: ./src/backend/Dockerfile
│   ├── puerto: 3000
│   ├── depende de: postgres (healthy)
│   ├── env: DATABASE_URL, JWT_SECRET, etc.
│   └── healthcheck: /api/health
│
├── service: frontend
│   ├── build: ./src/frontend/Dockerfile
│   ├── puerto: 80 (nginx interno)
│   ├── depende de: backend
│   └── contenido: build estático + nginx.conf
│
└── service: nginx (proxy principal)
    ├── image: nginx:alpine
    ├── puerto: 443, 80
    ├── depende de: frontend, backend
    ├── volúmenes: ./ssl:/etc/nginx/ssl, ./nginx.conf:/etc/nginx/nginx.conf
    └── expone: HTTPS al mundo
```

### 4.2 Dockerfile — Backend

```dockerfile
# src/backend/Dockerfile
# ==============================================
# STAGE 1: Build
# ==============================================
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY prisma/ ./prisma/
RUN npx prisma generate

COPY src/ ./src/
RUN npm run build

# ==============================================
# STAGE 2: Production
# ==============================================
FROM node:20-alpine AS production

WORKDIR /app

# Dependencias de producción únicamente
COPY package*.json ./
RUN npm ci --only=production

# Prisma client generado
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

# Código compilado
COPY --from=builder /app/dist ./dist

# Health check
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

USER node

CMD ["node", "dist/main"]
```

### 4.3 Dockerfile — Frontend

```dockerfile
# src/frontend/Dockerfile
# ==============================================
# STAGE 1: Build
# ==============================================
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY tsconfig*.json vite.config.ts tailwind.config.js postcss.config.js ./
COPY index.html ./
COPY public/ ./public/
COPY src/ ./src/

ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

RUN npm run build

# ==============================================
# STAGE 2: Nginx para static files
# ==============================================
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
```

### 4.4 Nginx — Frontend

```nginx
# nginx.frontend.conf — Sirve el SPA y redirige /api al backend
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    # SPA: todas las rutas al index.html
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, must-revalidate";
    }

    # Assets con caché largo
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy inverso para API
    location /api/ {
        proxy_pass http://backend:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4.5 Nginx — Reverse proxy principal

```nginx
# nginx.conf — Proxy principal con SSL
upstream frontend {
    server frontend:80;
}

upstream backend {
    server backend:3000;
}

server {
    listen 80;
    server_name admin.gruposecurity.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name admin.gruposecurity.com;

    # SSL
    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header Content-Security-Policy "
        default-src 'self';
        script-src 'self';
        style-src 'self' 'unsafe-inline';
        img-src 'self' data:;
        font-src 'self';
        connect-src 'self' https://admin.gruposecurity.com;
        frame-ancestors 'none';
    " always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    # Frontend (SPA)
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Swagger docs
    location /api/docs {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Limitar tamaño de body (import Excel)
    client_max_body_size 10M;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    location /api/auth/login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://backend;
    }
}
```

---

## 5. Configuración de Red, Dominios y Puertos

### 5.1 Dominios

| Dominio | Ambiente | Propósito |
|---------|----------|-----------|
| `admin.gruposecurity.com` | Producción | Panel administrativo |
| `staging.gruposecurity.com` | Staging | Validación pre-producción |
| `api.gruposecurity.com` | (futuro) | API pública para integración ERP |

### 5.2 Red interna (Docker)

```yaml
# docker-compose.prod.yml
networks:
  internal:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

**Comunicación entre servicios (interna: solo dentro de la red Docker):**

| Desde | Hacia | Puerto | Protocolo |
|-------|-------|--------|-----------|
| Nginx → Frontend | frontend:80 | 80 | HTTP |
| Nginx → Backend | backend:3000 | 3000 | HTTP |
| Backend → PostgreSQL | postgres:5432 | 5432 | TCP |
| Frontend → Backend | vía Nginx `/api/` | — | HTTP |

### 5.3 Puertos expuestos al exterior

| Puerto | Servicio | Restricción |
|--------|----------|-------------|
| 443 | HTTPS (Nginx) | Abierto al mundo |
| 80 | HTTP (Nginx) | Abierto al mundo, redirect a 443 |
| 22 | SSH | Solo IPs de la oficina / VPN |

**Puertos NO expuestos al exterior:**
- 3000 (Backend) — solo interno
- 5432 (PostgreSQL) — solo interno
- 5555 (Prisma Studio) — solo desarrollo local

### 5.4 Firewall (iptables / UFW)

```bash
# Política por defecto:
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Puertos permitidos:
sudo ufw allow 22/tcp     # SSH (restringir a IPs oficina post-MVP)
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS

# No habilitar más puertos
sudo ufw enable
```

---

## 6. Variables de Entorno y Manejo de Secretos

### 6.1 Variables de entorno — Backend

```bash
# ==============================================
# Backend — Variables de entorno
# ==============================================

# Base de datos
DATABASE_URL="postgresql://user:password@postgres:5432/grupo_security"

# JWT
JWT_SECRET="<generar-con-openssl-rand-hex-64>"

# API
API_PORT=3000
NODE_ENV=production
CORS_ORIGIN="https://admin.gruposecurity.com"
```

### 6.2 Variables de entorno — Frontend

```bash
# ==============================================
# Frontend — Variables de entorno (build-time)
# ==============================================

VITE_API_URL=/api    # Proxy por Nginx, mismo dominio
```

### 6.3 Estrategia de secretos

| Secreto | Almacenamiento | Rotación | Acceso |
|---------|---------------|----------|--------|
| `JWT_SECRET` | `.env.prod` en servidor + backup offline | Anual o ante breach | Solo DevOps |
| `DATABASE_URL` | `.env.prod` en servidor | Al cambiar credenciales DB | Solo DevOps |
| Cookie `access_token` | Generado en runtime por backend | Cada login | Usuario final |
| Certificados SSL | `/etc/nginx/ssl/` + renovación automática certbot | Cada 90 días | Público |

**Reglas:**
- ❌ No versionar `.env.prod` ni `.env.staging` en Git
- ❌ No compartir secretos por Slack, email o chat
- ✅ Usar archivos `.env` locales en staging/producción (sin vaults externos para MVP)
- ✅ Backup cifrado de `.env.prod` en gestor de contraseñas del equipo

### 6.4 Archivos .env por ambiente

```bash
# Raíz del proyecto (NO versionados):
.env.dev         → Desarrollo local (puede tener defaults)
.env.staging     → Staging
.env.prod        → Producción (máxima seguridad)
```

**Ejemplo `.env.prod`:**

```bash
# Base de datos
DATABASE_URL="postgresql://gs_admin:$(cat /run/secrets/db_password)@localhost:5432/grupo_security_prod"

# JWT
JWT_SECRET="$(cat /run/secrets/jwt_secret)"

# API
API_PORT=3000
NODE_ENV=production
CORS_ORIGIN="https://admin.gruposecurity.com"
```

---

## 7. Pipeline de Build y Release

### 7.1 Estrategia general

Para el MVP, el pipeline puede ser **semiautomático** (build local + manual deploy) o **automático** (GitHub Actions). Se recomienda semiautomático para el MVP y migrar a CI/CD completo post-MVP.

### 7.2 Pipeline semiautomático (MVP)

```bash
# 1. Build de backend
cd src/backend
npm ci
npx prisma generate
npm run build
npm test                              # ← testing-strategy obligatorio
npm run test:e2e                      # ← testing-strategy obligatorio

# 2. Build de frontend
cd ../frontend
npm ci
npm run build                         # → produce dist/

# 3. Copiar builds al servidor
rsync -avz --delete dist/ user@server:/opt/grupo-security/backend/dist/
rsync -avz --delete dist/ user@server:/opt/grupo-security/frontend/dist/
rsync -avz prisma/ user@server:/opt/grupo-security/backend/prisma/

# 4. Ejecutar migraciones (con precaución)
ssh user@server "cd /opt/grupo-security && npm run db:migrate:prod"

# 5. Reiniciar servicios
ssh user@server "pm2 restart grupo-security-backend"
```

### 7.3 Pipeline CI/CD recomendado (post-MVP)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
        working-directory: ./src/backend
      - run: npx prisma generate && npm run test
        working-directory: ./src/backend
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test

  build-and-deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Build backend image
      - name: Build backend image
        run: docker build -t ghcr.io/grupo-security/backend:${{ github.sha }} ./src/backend

      # Build frontend image
      - name: Build frontend image
        run: docker build -t ghcr.io/grupo-security/frontend:${{ github.sha }} ./src/frontend

      # Deploy via SSH
      - name: Deploy to production
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /opt/grupo-security
            docker compose pull
            docker compose up -d --remove-orphans
```

### 7.4 Versionado de releases

```
Release: v<major>.<minor>.<patch>

Ejemplos:
v1.0.0  → Primer release a producción
v1.1.0  → Nueva funcionalidad (añadir módulo X)
v1.1.1  → Bug fix crítico en producción

Tags de Git:
git tag -a v1.0.0 -m "Release v1.0.0 - MVP"
git push origin v1.0.0
```

### 7.5 Estrategia de branches

```
main              → Producción (solo merges de staging o hotfix)
staging           → Pre-producción (merge de feature branches)
develop           → Integración diaria
feature/xxx       → Desarrollo de funcionalidades (desde develop)
hotfix/xxx        → Corrección urgente (desde main, merge a main y develop)
```

---

## 8. Estrategia de Migraciones Prisma

### 8.1 Flujo de migraciones

```
Desarrollo local:
  npm run db:migrate    → prisma migrate dev    → Crea/modifica migration + aplica a DB local

Staging:
  prisma migrate deploy → Aplica migrations pendientes a DB staging

Producción:
  prisma migrate deploy → Aplica migrations pendientes a DB producción
  (SIEMPRE manual, nunca automático en CI/CD)
```

### 8.2 Comandos

```bash
# package.json scripts
{
  "db:migrate": "prisma migrate dev",            # Desarrollo: crear + aplicar
  "db:deploy": "prisma migrate deploy",           # Staging/Prod: solo aplicar pendientes
  "db:generate": "prisma generate",               # Generar Prisma Client
  "db:seed": "ts-node prisma/seed.ts",            # Poblar datos de prueba
  "db:studio": "prisma studio",                   # UI para ver datos
  "db:reset": "prisma migrate reset",             # Resetear DB (solo dev)
  "db:status": "prisma migrate status"            # Ver estado de migrations
}
```

### 8.3 Reglas para producción

| Regla | Descripción |
|-------|-------------|
| **Nunca ejecutar `prisma migrate dev` en producción** | `migrate dev` puede resetear datos. Usar siempre `migrate deploy`. |
| **Siempre hacer backup antes de migrar** | `pg_dump` antes de cualquier cambio en schema. |
| **Migrar en ventana de bajo uso** | Preferible fuera del horario laboral. |
| **Una migración por PR** | No acumular múltiples cambios de schema en un solo deploy. |
| **Prisma Client regenerado en build** | `prisma generate` debe ejecutarse como parte del build, no en runtime. |

### 8.4 Script de deploy con migración

```bash
#!/bin/bash
# scripts/deploy.sh
set -e

echo "=== Iniciando deploy ==="

# 1. Backup de DB
echo "→ Backing up database..."
pg_dump "$DATABASE_URL" > "/backups/pre-deploy-$(date +%Y%m%d_%H%M%S).sql"

# 2. Aplicar migraciones
echo "→ Running migrations..."
npx prisma migrate deploy

# 3. Verificar estado
npx prisma migrate status

# 4. Generar Prisma Client (por si cambió)
npx prisma generate

# 5. Iniciar nueva versión
echo "→ Starting new version..."
pm2 restart grupo-security-backend

echo "=== Deploy completado ==="
```

### 8.5 Migración zero-downtime (post-MVP)

Para el MVP, el backend se reinicia durante el deploy (ventana de ~10-30 segundos sin servicio). Si se requiere zero-downtime en el futuro:

```bash
# Estrategia:
# 1. Migraciones backward-compatible (no renombrar columnas, solo añadir)
# 2. Dos instancias del backend (rolling update)
# 3. Nginx balancea entre instancias
```

---

## 9. Despliegue del Frontend y Backend

### 9.1 Backend — Node.js con PM2 (sin Docker)

SI no se usa Docker (opción más simple para MVP):

```bash
# Instalar PM2 globalmente
npm install -g pm2

# Iniciar aplicación
pm2 start dist/main.js --name "grupo-security-backend" \
  --log /var/log/grupo-security/backend.log \
  --max-memory-restart 500M

# Guardar configuración de PM2
pm2 save
pm2 startup

# Comandos útiles
pm2 status                    # Estado de procesos
pm2 logs grupo-security-backend  # Logs en tiempo real
pm2 reload grupo-security-backend # Reinicio sin downtime
pm2 restart grupo-security-backend # Reinicio completo
```

### 9.2 Backend — Docker

```bash
# Construir imagen
docker build -t grupo-security/backend:latest ./src/backend

# Ejecutar contenedor
docker run -d \
  --name grupo-security-backend \
  --restart unless-stopped \
  --network internal \
  -p 3000:3000 \
  --env-file .env.prod \
  -v prisma-data:/app/prisma \
  grupo-security/backend:latest
```

### 9.3 Frontend — Build estático

```bash
# Build
cd src/frontend
npm ci
VITE_API_URL=/api npm run build

# Output: dist/
# ├── assets/
# │   ├── index-abc123.js
# │   └── index-xyz789.css
# ├── index.html
# └── vite.svg
```

**El frontend se sirve como estático desde Nginx.** No necesita Node.js runtime en producción.

### 9.4 docker-compose.prod.yml completo

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: grupo-security-db
    restart: unless-stopped
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: ${DB_USER:-gs_admin}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME:-grupo_security}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-gs_admin} -d ${DB_NAME:-grupo_security}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - internal

  backend:
    build:
      context: ./src/backend
      dockerfile: Dockerfile
    container_name: grupo-security-api
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    env_file:
      - .env.prod
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 40s
    networks:
      - internal

  frontend:
    build:
      context: ./src/frontend
      dockerfile: Dockerfile
    container_name: grupo-security-ui
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - internal

  nginx:
    image: nginx:alpine
    container_name: grupo-security-proxy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - frontend
      - backend
    networks:
      - internal

volumes:
  pgdata:

networks:
  internal:
    driver: bridge
```

### 9.5 Health check endpoint

```typescript
// src/backend/src/modules/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('api/health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', timestamp: new Date().toISOString(), db: 'connected' };
    } catch (error) {
      return { status: 'error', timestamp: new Date().toISOString(), db: 'disconnected' };
    }
  }
}
```

---

## 10. PostgreSQL, Backups y Recuperación

### 10.1 Configuración de PostgreSQL

```bash
# postgres.conf (ajustes recomendados para VPS de 2-4GB RAM)
shared_buffers = 512MB
effective_cache_size = 1.5GB
work_mem = 16MB
maintenance_work_mem = 64MB
random_page_cost = 1.1      # SSD
effective_io_concurrency = 200
wal_level = replica
max_wal_size = 1GB
min_wal_size = 80MB
```

### 10.2 Estrategia de backups

```bash
# /etc/cron.d/grupo-security-backup
# Backup diario a las 3:00 AM
0 3 * * * root /opt/grupo-security/scripts/backup.sh

# Backup semanal con retención extendida (domingo 4:00 AM)
0 4 * * 0 root /opt/grupo-security/scripts/backup.sh weekly
```

**Script de backup:**

```bash
#!/bin/bash
# scripts/backup.sh
set -e

BACKUP_DIR="/backups/postgres"
RETENTION_DAYS=30
RETENTION_WEEKLY=90
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
TYPE=${1:-daily}

mkdir -p "$BACKUP_DIR/$TYPE"

# Backup
pg_dump \
  --dbname="$DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --file="$BACKUP_DIR/$TYPE/grupo_security_$TIMESTAMP.dump"

# Log
echo "[$(date)] Backup $TYPE completado: grupo_security_$TIMESTAMP.dump" >> /var/log/grupo-security/backup.log

# Rotación diaria
find "$BACKUP_DIR/daily" -type f -mtime +$RETENTION_DAYS -delete

# Rotación semanal
find "$BACKUP_DIR/weekly" -type f -mtime +$RETENTION_WEEKLY -delete
```

### 10.3 Restauración

```bash
#!/bin/bash
# scripts/restore.sh
set -e

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Uso: ./restore.sh <archivo.dump>"
  exit 1
fi

echo "⚠️  ATENCIÓN: Esto SOBREESCRIBIRÁ la base de datos actual"
read -p "¿Continuar? (s/N): " confirm

if [ "$confirm" != "s" ]; then
  echo "Restauración cancelada"
  exit 1
fi

# 1. Detener backend (evitar escrituras concurrentes)
pm2 stop grupo-security-backend

# 2. Restaurar
pg_restore \
  --dbname="$DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  "$BACKUP_FILE"

# 3. Re-iniciar backend
pm2 start grupo-security-backend

echo "Restauración completada desde: $BACKUP_FILE"
```

### 10.4 Política de retención

| Tipo | Frecuencia | Retención | Destino |
|------|-----------|-----------|---------|
| Backup diario | Cada 24h | 30 días | Disco del servidor |
| Backup semanal | Cada domingo | 90 días | Disco + copia externa (S3/rsync) |
| Pre-deploy | Antes de cada deploy | 7 días | Disco del servidor |

---

## 11. HTTPS, Reverse Proxy, CORS, CSP, HSTS

### 11.1 HTTPS con Let's Encrypt

```bash
# Instalar certbot
apt install certbot python3-certbot-nginx

# Obtener certificado
certbot --nginx -d admin.gruposecurity.com --non-interactive --agree-tos -m admin@gruposecurity.com

# Renovación automática (certbot añade cron automáticamente)
certbot renew --dry-run

# Los certificados se almacenan en:
# /etc/letsencrypt/live/admin.gruposecurity.com/
```

### 11.2 Configuración CORS (backend)

```typescript
// main.ts
app.enableCors({
  origin: process.env.CORS_ORIGIN || 'https://admin.gruposecurity.com',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

| Ambiente | CORS_ORIGIN |
|----------|-------------|
| dev | `http://localhost:5173` |
| staging | `https://staging.gruposecurity.com` |
| prod | `https://admin.gruposecurity.com` |

### 11.3 Content-Security-Policy (CSP)

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data:;
font-src 'self';
connect-src 'self' https://admin.gruposecurity.com;
frame-ancestors 'none';
```

**Nota:** `style-src 'unsafe-inline'` es necesario para Tailwind CSS (genera estilos en línea). Si se migra a Tailwind con purga completa, se puede eliminar.

### 11.4 Strict-Transport-Security (HSTS)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

- `max-age=31536000` = 1 año
- `includeSubDomains` = aplica también a subdominios
- Preload: No solicitar preload en MVP (requiere approval de navegadores)

### 11.5 Headers de seguridad implementados

| Header | Valor | Dónde se configura |
|--------|-------|-------------------|
| `X-Content-Type-Options` | `nosniff` | Nginx |
| `X-Frame-Options` | `DENY` | Nginx |
| `X-XSS-Protection` | `1; mode=block` | Nginx |
| `Strict-Transport-Security` | `max-age=31536000` | Nginx |
| `Content-Security-Policy` | (ver 11.3) | Nginx |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Nginx |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Nginx |
| `X-Powered-By` | Eliminado (NestJS no lo envía por defecto) | — |
| `helmet()` | Middleware NestJS (varios headers) | Backend `main.ts` |

---

## 12. Observabilidad Mínima

### 12.1 Health checks

| Endpoint | Método | Propósito | Public |
|----------|--------|-----------|--------|
| `/api/health` | GET | Verificar API + DB | ✅ Sí |

```typescript
// Respuesta de health check
{
  "status": "ok",
  "timestamp": "2026-07-23T10:30:00.000Z",
  "db": "connected",
  "uptime": 3600
}
```

### 12.2 Logs

```bash
# Backend — logs de aplicación
/var/log/grupo-security/backend.log      # Logs generales
/var/log/grupo-security/error.log        # Solo errores
/var/log/grupo-security/auth.log         # Eventos de autenticación

# PostgreSQL — logs
/var/log/postgresql/postgresql-16-main.log

# Nginx — logs
/var/log/nginx/access.log
/var/log/nginx/error.log

# Rotación de logs (logrotate)
# /etc/logrotate.d/grupo-security
/var/log/grupo-security/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

### 12.3 Monitoreo básico (MVP)

Para el MVP, el monitoreo se hace con herramientas mínimas:

```bash
# Verificar estado del servidor diariamente
# Script simple que corre como cron:

#!/bin/bash
# /opt/grupo-security/scripts/health-check.sh

# 1. Verificar que el backend responde
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://admin.gruposecurity.com/api/health)

if [ "$HTTP_CODE" != "200" ]; then
  echo "[ALERTA] Health check falló. Código: $HTTP_CODE" | mail -s "⚠️ Grupo Security - Health Check Falló" admin@gruposecurity.com
fi

# 2. Verificar uso de disco
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 85 ]; then
  echo "[ALERTA] Disco al ${DISK_USAGE}%" | mail -s "⚠️ Grupo Security - Disco casi lleno" admin@gruposecurity.com
fi
```

### 12.4 Dashboard de monitoreo (post-MVP)

| Herramienta | Propósito | Costo |
|-------------|-----------|-------|
| **Uptime Kuma** (self-hosted) | Monitoreo de uptime + alertas | Gratis |
| **Netdata** (self-hosted) | Métricas del servidor (CPU, RAM, disco, red) | Gratis |
| **Better Stack** (cloud) | Alternativa SaaS si hay presupuesto | Desde $0/mes (plan gratuito) |

---

## 13. Rollback y Plan de Contingencia

### 13.1 Rollback de código

```bash
# Si el deploy se hizo con PM2:
pm2 stop grupo-security-backend
git checkout <tag-anterior>
npm ci
npm run build
pm2 start grupo-security-backend

# Si el deploy se hizo con Docker:
docker compose down
docker compose -f docker-compose.prev.yml up -d
```

### 13.2 Rollback de base de datos

```bash
# Si la migración fue backward-compatible (solo añadió columnas/tablas):
# Simplemente se revierte el código, la DB sigue funcionando.

# Si la migración no es backward-compatible (renombró/eliminó columnas):
# 1. Restaurar backup pre-deploy
pg_restore --dbname="$DATABASE_URL" --clean /backups/pre-deploy-20260723_030000.dump

# 2. Revertir código
git checkout <tag-anterior>
pm2 restart grupo-security-backend
```

### 13.3 Plan de contingencia

| Escenario | Impacto | Acción | Tiempo estimado |
|-----------|---------|--------|-----------------|
| **Caída de servidor** | Servicio no disponible | Restaurar desde backup a servidor secundario | 1-2h |
| **Bug crítico en producción** | Funcionalidad rota | Rollback a tag anterior | 15-30 min |
| **Corrupción de DB** | Pérdida de datos | Restaurar último backup válido | 30-60 min |
| **Ataque de seguridad** | Compromiso de datos | Aislar servidor, restaurar desde backup pre-ataque | 2-4h |
| **Pérdida de certificado SSL** | HTTP sin HTTPS | Regenerar con certbot | 10 min |
| **Fallo de disco** | Pérdida de datos + servicio | Migrar a servidor secundario con backup reciente | 2-4h |

### 13.4 Contactos de emergencia

| Rol | Nombre | Teléfono | Email |
|-----|--------|----------|-------|
| DevOps | (por definir) | — | — |
| DBA | (por definir) | — | — |
| Seguridad | (por definir) | — | — |
| Proveedor VPS | (depende del hosting) | — | — |

---

## 14. Checklist Preproducción y Producción

### 14.1 Checklist preproducción (Staging)

- [ ] Backend compila sin errores (`npm run build`)
- [ ] Frontend compila sin errores (`npm run build`)
- [ ] Tests unitarios pasan (`npm test`)
- [ ] Tests e2e de auth pasan (`npm run test:e2e`)
- [ ] Migraciones Prisma aplicadas correctamente (`prisma migrate deploy`)
- [ ] Seed ejecutado con datos de prueba
- [ ] Login funciona en staging (credenciales de prueba)
- [ ] CRUD de productos funciona
- [ ] CRUD de categorías funciona
- [ ] CRUD de marcas funciona
- [ ] CRUD de precios funciona
- [ ] Auditoría registra eventos de auth
- [ ] Swagger `/api/docs` accesible y documentado
- [ ] Health check responde `200 OK`
- [ ] CORS configurado para dominio staging
- [ ] HTTPS funciona con Let's Encrypt
- [ ] Headers de seguridad presentes (verificar con `curl -I`)
- [ ] Logs se escriben correctamente
- [ ] Backups automáticos configurados

### 14.2 Checklist producción

#### Seguridad
- [ ] `JWT_SECRET` generado con `openssl rand -hex 64` (no default, no hardcodeado)
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGIN` apunta a `https://admin.gruposecurity.com`
- [ ] Cookie `secure: true` (solo HTTPS)
- [ ] `helmet()` middleware activo en backend
- [ ] Rate limiting configurado (`5r/min` en login)
- [ ] Firewall UFW activo (solo puertos 22, 80, 443)
- [ ] Puertos PostgreSQL y backend NO expuestos al exterior
- [ ] Headers de seguridad verificados (`securityheaders.com`)
- [ ] SSL renovación automática configurada

#### Base de datos
- [ ] Backup automático diario configurado y probado
- [ ] Backup pre-deploy ejecutado manualmente antes del primer deploy
- [ ] Política de retención configurada (30 días diarios, 90 días semanales)
- [ ] Prueba de restauración ejecutada en staging
- [ ] `DATABASE_URL` usa contraseña fuerte, no default
- [ ] Conexiones SSL a PostgreSQL configuradas (si aplica)

#### Aplicación
- [ ] Tests unitarios pasan en CI
- [ ] Tests e2e de auth pasan en staging
- [ ] Migraciones aplicadas con `prisma migrate deploy` (no `dev`)
- [ ] Seed NO ejecutado en producción (solo staging)
- [ ] Health check responde `200 OK`
- [ ] PM2 o Docker configurado con restart automático
- [ ] Logs con rotación configurada
- [ ] Versión etiquetada con tag Git (`v1.0.0`)

#### Monitoreo
- [ ] Health check endpoint funcionando
- [ ] Alerta de health check configurada (email/Slack)
- [ ] Alerta de disco >85% configurada
- [ ] Logs accesibles para debugging

#### Post-producción (primeras 24h)
- [ ] Monitoreo de errores 500 cada 15 minutos
- [ ] Verificar que audit logs se generan correctamente
- [ ] Verificar que el rate limiting en login funciona
- [ ] Prueba de backup + restauración completa
- [ ] Actualizar `security-checklist-v1.md` marcando controles completados

---

## Apéndice A: Arquivos de Infraestructura a Crear

| Archivo | Propósito |
|---------|-----------|
| `src/backend/Dockerfile` | Build multi-stage del backend |
| `src/frontend/Dockerfile` | Build multi-stage del frontend |
| `src/frontend/nginx.frontend.conf` | Config Nginx para servir SPA + proxy API |
| `docker-compose.prod.yml` | Orquestación de producción |
| `docker-compose.staging.yml` | Orquestación de staging |
| `nginx.conf` | Reverse proxy con SSL, security headers, rate limiting |
| `.env.dev` | Variables de entorno desarrollo |
| `.env.staging` | Variables de entorno staging (no versionar) |
| `.env.prod` | Variables de entorno producción (no versionar) |
| `scripts/deploy.sh` | Script de deploy con backup automático |
| `scripts/backup.sh` | Script de backup diario/semanal |
| `scripts/restore.sh` | Script de restauración |
| `scripts/health-check.sh` | Script de monitoreo básico |
| `.github/workflows/deploy.yml` | Pipeline CI/CD (post-MVP) |

## Apéndice B: Especificaciones Mínimas de Servidor

### VPS para producción

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| **CPU** | 2 vCPU | 4 vCPU |
| **RAM** | 2 GB | 4 GB |
| **Disco** | 40 GB SSD | 80 GB SSD |
| **Ancho de banda** | 1 TB/mes | 2 TB/mes |
| **SO** | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |
| **Costo estimado** | ~$15-25 USD/mes | ~$30-50 USD/mes |

### Proveedores sugeridos (Colombia/Latam)

| Proveedor | Tipo | Latencia Colombia |
|-----------|------|-------------------|
| **AWS São Paulo** | Cloud | 15-30ms |
| **DigitalOcean** | VPS (NYC o SFO) | 60-100ms |
| **Hostinger VPS** | VPS (Brasil) | 20-40ms |
| **Colombia Hosting** | VPS (Bogotá) | 5-15ms |
| **SiteGround** | Cloud (NL) | 100-150ms |

> **Recomendación MVP:** Servidor VPS en Colombia o Brasil. La latencia local es crítica para un panel administrativo de uso diario.

---

## Apéndice C: Comandos Rápidos de Administración

```bash
# === GESTIÓN DEL SERVIDOR ===

# Conectar por SSH
ssh user@admin.gruposecurity.com

# Ver estado de PM2
pm2 status
pm2 logs grupo-security-backend
pm2 monit

# Ver estado de Docker
docker ps
docker compose ps
docker compose logs -f backend

# Ver logs de aplicación
tail -f /var/log/grupo-security/backend.log
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Backup manual
/opt/grupo-security/scripts/backup.sh

# Health check manual
curl -s https://admin.gruposecurity.com/api/health | jq .

# Verificar SSL
openssl s_client -connect admin.gruposecurity.com:443 -servername admin.gruposecurity.com

# Verificar headers de seguridad
curl -sI https://admin.gruposecurity.com | grep -i -E "(x-content|x-frame|x-xss|strict-transport|content-security)"

# Estado de migraciones
npx prisma migrate status

# Uso del servidor
htop
df -h
free -m
```

---

> **Documento mantenido por:** Equipo de Desarrollo Grupo Security  
> **Última actualización:** 2026-07-23  
> **Próxima revisión:** Al implementar CI/CD completo y/o migrar a infraestructura cloud gestionada
