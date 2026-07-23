# Estrategia de Despliegue — Grupo Security

## Ambientes

| Ambiente  | Branch  | URL                            | Propósito                     |
|-----------|---------|--------------------------------|-------------------------------|
| local     | -       | `http://localhost:5173`        | Desarrollo con hot-reload     |
| staging   | `dev`   | `https://staging.gruposecurity.com` | QA y validación pre-prod |
| producción| `main`  | `https://panel.gruposecurity.com`   | Producción real           |

## Stack de despliegue

- **Contenedores**: Docker Compose (1 archivo por ambiente)
- **Registry**: GHCR (`ghcr.io/zatairo/grupo-security-office/*`)
- **Orquestación**: Docker Compose en VPS Ubuntu
- **Proxy**: Nginx (SSL termination, reverse proxy)
- **Base de datos**: PostgreSQL 16 (contenedor separado o RDS)
- **Migraciones**: Prisma `migrate deploy` (solo en el entrypoint del backend)

## Pipeline CI/CD

### CI (`ci.yml`) — Se ejecuta en PR y push a `main`/`dev`

1. **Backend**
   - `npm ci`
   - `prisma generate`
   - `npm run lint`
   - `tsc --noEmit` (typecheck)
   - `npm run build`
   - `prisma validate`
2. **Frontend**
   - `npm ci`
   - `npm run lint`
   - `npm run build` (typecheck + vite build)

### CD (`cd.yml`) — Se ejecuta en push a `main` o `dev`

1. **Build & Push**
   - Construye imágenes multi-stage
   - Tagea con: `{sha::8}` + `latest`
   - Push a GHCR (`ghcr.io/zatairo/grupo-security-office/{api,frontend}`)
2. **Deploy**
   - SSH al servidor vía `appleboy/ssh-action`
   - `docker compose pull` + `docker compose up -d`
   - Etiqueta `IMAGE_TAG={sha::8}` controla la versión
3. **Smoke test**
   - Verifica `/api/health` → `status: ok`
   - Verifica frontend sirve HTML
   - Verifica SPA fallback
4. **Notificación** (opcional)
   - Discord webhook con resultado

## Flujo de deploy manual (rollback)

### Deploy normal
```bash
# En el servidor (usando última imagen)
cd /opt/grupo-security
docker compose -f docker-compose.prod.yml pull
IMAGE_TAG=latest docker compose -f docker-compose.prod.yml up -d
```

### Rollback a versión anterior
```bash
# 1. Listar tags disponibles
# (ver GHCR: https://ghcr.io/zatairo/grupo-security-office/api)

# 2. Desplegar tag anterior
cd /opt/grupo-security
IMAGE_TAG=sha-anterior docker compose -f docker-compose.prod.yml up -d

# 3. Verificar health
curl https://panel.gruposecurity.com/api/health

# 4. Si falla, volver a un tag aún más antiguo
```

### Rollback vía GitHub Actions (disparo manual)
```bash
gh workflow run cd.yml --ref main
# O desde GitHub UI: Actions > CD > Run workflow > Branch: main
# Luego editar docker-compose.prod.yml con IMAGE_TAG deseado
```

## Preparación del servidor (primera vez)

```bash
# 1. Instalar Docker + Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 2. Crear estructura
mkdir -p /opt/grupo-security/nginx/ssl
cd /opt/grupo-security

# 3. Clonar repo
git clone https://github.com/Zatairo/grupo-security-office.git .

# 4. Configurar SSL (certbot o copiar certificados)
# Los certificados van en /opt/grupo-security/nginx/ssl/

# 5. Configurar .env
cp .env.example .env
nano .env   # Ajustar DATABASE_URL, JWT_SECRET, POSTGRES_PASSWORD

# 6. Crear red externa (si se usa)
docker network create grupo-security

# 7. Iniciar
IMAGE_TAG=latest docker compose -f docker-compose.prod.yml up -d
```

## Migraciones de base de datos

**Nunca** ejecutar `prisma migrate dev` o `prisma db push` en staging/producción.

Las migraciones se aplican automáticamente al iniciar el backend mediante:

```bash
npx prisma migrate deploy
```

Esto ejecuta dentro del entrypoint del contenedor. Si una migración falla:
- El healthcheck del backend falla
- Nginx detecta que backend no responde
- No se enruta tráfico al backend
- **No hay impacto en datos** — la migración es atómica

Para revertir una migración en producción (manual):
```bash
# 1. Identificar la migración a revertir
npx prisma migrate diff --from-url $DATABASE_URL --to-migrations prisma/migrations/ --script > rollback.sql

# 2. Revisar el SQL generado
cat rollback.sql

# 3. Ejecutar rollback
psql $DATABASE_URL -f rollback.sql

# 4. Eliminar el directorio de migración problemática
rm -rf prisma/migrations/2026XXXXXXX_bad_migration

# 5. Re-desplegar
```

## Secretos requeridos en GitHub

| Secret | Propósito |
|--------|-----------|
| `DATABASE_URL_CI` | URL de BD para CI (puede ser SQLite o BD vacía) |
| `DEPLOY_HOST` | IP o dominio del servidor de producción/staging |
| `DEPLOY_USER` | Usuario SSH (ej: `deploy` o `ubuntu`) |
| `DEPLOY_SSH_KEY` | Clave privada SSH (formato PEM) |
| `DEPLOY_PORT` | Puerto SSH (default 22) |

## Variables requeridas en GitHub

| Variable | Propósito |
|----------|-----------|
| `DEPLOY_URL` | URL pública del entorno (ej: `https://panel.gruposecurity.com`) |
| `DISCORD_WEBHOOK_URL` | Webhook de Discord para notificaciones (opcional) |
| `CORS_ORIGIN` | Origen CORS permitido (ej: `https://panel.gruposecurity.com`) |

## Healthchecks

Cada servicio en producción tiene healthcheck:

| Servicio | Healthcheck | Start period |
|----------|-------------|--------------|
| `db` | `pg_isready` | 0s |
| `api` | `GET /api/health` | 30s |
| `frontend` | `GET /` → 200 | 10s |
| `nginx` | `GET /` → 200 | 10s |

Si backend falla el healthcheck 3 veces seguidas, Docker reinicia el contenedor.

## Trazabilidad

- Cada build se tagea con `{sha::8}` del commit
- El tag `latest` se sobreescribe en cada deploy
- Los logs de Docker están configurados con `json-logging` (por defecto)
- Las migraciones se versionan en `prisma/migrations/` con timestamp

## Monitoreo post-deploy

```bash
# Ver logs del backend
docker logs gs-api --tail 50 -f

# Ver health en vivo
watch -n 5 curl -s https://panel.gruposecurity.com/api/health

# Ver estado de contenedores
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
```
