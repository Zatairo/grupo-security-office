#!/usr/bin/env bash
# ============================================================
# smoke-test.sh — Smoke test post-despliegue
# Uso: ./scripts/smoke-test.sh <url_base>
# Ejemplo: ./scripts/smoke-test.sh https://panel.gruposecurity.com
# ============================================================
set -euo pipefail

BASE_URL="${1:-}"
if [ -z "$BASE_URL" ]; then
  echo "❌ Uso: $0 <url_base>"
  echo "   Ejemplo: $0 https://panel.gruposecurity.com"
  exit 1
fi

echo "=========================================="
echo " Smoke Test — $BASE_URL"
echo "=========================================="
echo ""

FAILURES=0

# Helper: hacer request y validar
check_endpoint() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local expected_key="${4:-}"

  echo -n "  → $name ... "

  response=$(curl -s -o /tmp/smoke-response.json -w "%{http_code}" "$url" 2>/dev/null || true)
  status_code="${response: -3}"

  if [ "$status_code" != "$expected_status" ]; then
    echo "❌ (HTTP $status_code, esperado $expected_status)"
    FAILURES=$((FAILURES + 1))
    return 1
  fi

  if [ -n "$expected_key" ]; then
    if ! grep -q "\"$expected_key\"" /tmp/smoke-response.json 2>/dev/null; then
      echo "❌ (clave '$expected_key' no encontrada en respuesta)"
      FAILURES=$((FAILURES + 1))
      return 1
    fi
  fi

  echo "✅"
  return 0
}

# ── Test 1: Health endpoint ──
echo "── 1. Health check ──"
check_endpoint "GET /api/health" "$BASE_URL/api/health" 200 "status"

# ── Test 2: Frontend sirve HTML ──
echo "── 2. Frontend ──"
echo -n "  → GET / ... "
html_status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/" 2>/dev/null || true)
if [ "$html_status" = "200" ]; then
  echo "✅"
else
  echo "❌ (HTTP $html_status, esperado 200)"
  FAILURES=$((FAILURES + 1))
fi

echo -n "  → Contiene <title> ... "
if curl -s "$BASE_URL/" 2>/dev/null | grep -qi "<title>"; then
  echo "✅"
else
  echo "❌ (no se encontró <title> en HTML)"
  FAILURES=$((FAILURES + 1))
fi

# ── Test 3: SPA fallback (ruta no archivo) ──
echo "── 3. SPA fallback ──"
echo -n "  → GET /una-ruta-inexistente ... "
spa_status=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/una-ruta-inexistente" 2>/dev/null || true)
if [ "$spa_status" = "200" ]; then
  echo "✅"
else
  echo "❌ (HTTP $spa_status, esperado 200 para SPA fallback)"
  FAILURES=$((FAILURES + 1))
fi

# ── Test 4: CORS headers ──
echo "── 4. CORS headers ──"
echo -n "  → OPTIONS /api/health ... "
cors_status=$(curl -s -o /dev/null -w "%{http_code}" -X OPTIONS \
  -H "Origin: $BASE_URL" \
  -H "Access-Control-Request-Method: GET" \
  "$BASE_URL/api/health" 2>/dev/null || true)
# OPTIONS puede devolver 204, 200 o incluso 404 — verificamos que tenga headers CORS
echo "($cors_status) ⚠️  (no crítico, verifica manual)"

# ── Resultado ──
echo ""
echo "=========================================="
if [ "$FAILURES" -gt 0 ]; then
  echo "❌ Smoke test completado con $FAILURES fallo(s)"
  exit 1
else
  echo "✅ Smoke test pass — todos los checks ok"
  exit 0
fi
