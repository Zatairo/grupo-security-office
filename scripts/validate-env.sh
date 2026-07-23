#!/usr/bin/env bash
# ============================================================
# validate-env.sh — Valida variables de entorno requeridas
# Uso: ./scripts/validate-env.sh [production|staging|development]
# ============================================================
set -euo pipefail

ENV="${1:-development}"
MISSING=0

# ── Variables requeridas por ambiente ──
COMMON_VARS=(
  "DATABASE_URL"
  "JWT_SECRET"
)

PRODUCTION_ONLY=(
  "POSTGRES_USER"
  "POSTGRES_PASSWORD"
  "POSTGRES_DB"
)

DEV_ONLY=(
  "CORS_ORIGIN"
)

echo "🔍 Validando entorno: $ENV"
echo ""

# ── Verificar comunes ──
echo "── Requeridas (todos los entornos) ──"
for var in "${COMMON_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "  ❌ $var — no definida"
    MISSING=1
  else
    echo "  ✅ $var — definida"
  fi
done

# ── Verificar específicas de producción ──
if [ "$ENV" = "production" ]; then
  echo ""
  echo "── Requeridas (solo producción) ──"
  for var in "${PRODUCTION_ONLY[@]}"; do
    if [ -z "${!var:-}" ]; then
      echo "  ❌ $var — no definida"
      MISSING=1
    else
      echo "  ✅ $var — definida"
    fi
  done

  # Validar que JWT_SECRET no sea el default de dev
  if [ "${JWT_SECRET:-}" = "dev-secret-no-usar-en-prod" ]; then
    echo "  ❌ JWT_SECRET — está usando el valor por defecto de desarrollo (inseguro)"
    MISSING=1
  fi

  # Validar formato de DATABASE_URL
  if [[ ! "${DATABASE_URL:-}" =~ ^postgresql:// ]]; then
    echo "  ❌ DATABASE_URL — debe comenzar con postgresql://"
    MISSING=1
  fi
fi

# ── Verificar específicas de desarrollo ──
if [ "$ENV" = "development" ]; then
  echo ""
  echo "── Requeridas (solo desarrollo) ──"
  for var in "${DEV_ONLY[@]}"; do
    if [ -z "${!var:-}" ]; then
      echo "  ⚠️  $var — no definida (se usará valor por defecto)"
    else
      echo "  ✅ $var — definida"
    fi
  done
fi

echo ""
if [ "$MISSING" -eq 1 ]; then
  echo "❌ Validación falló. Corrige las variables faltantes antes de continuar."
  exit 1
else
  echo "✅ Todas las variables requeridas están definidas."
  exit 0
fi
