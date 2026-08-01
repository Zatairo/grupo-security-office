# Instrucciones globales

## Idioma
- Responde siempre en español.
- Nunca respondas en inglés, salvo que yo lo pida explícitamente.
- Si analizas código, explica en español claro, técnico y directo.
- Usa terminología de ingeniería de software, pero evita relleno.

## Estilo de respuesta
- Sé breve, preciso y accionable.
- Cuando describas un archivo, usa esta estructura:
  1. propósito
  2. dependencias
  3. flujo de datos
  4. riesgos
  5. mejoras recomendadas
- Si vas a modificar archivos, explica primero el plan en español y luego aplica cambios.

## Historial de Cambios

### Dashboard.tsx Mejoras (2026-07-31)

#### Propósito
Mejorar el dashboard principal de Grupo Security Office para mostrar productos tendencia dinámicamente desde la API, mejorando la experiencia de usuario, accesibilidad y mantenibilidad.

#### Dependencias
- Frontend: React, TanStack React Query, React Router DOM, Tailwind CSS
- Backend: NestJS, Prisma, PostgreSQL

#### Flujo de datos
1. **Backend**: Endpoint `/api/products/trending` (GET) devuelve productos visibles/activos de los últimos 30 días con caché de 5 minutos
2. **Frontend**: Servicio `trending.service.ts` consume el endpoint mediante `fetchTrendingProducts`
3. **Componente**: `Dashboard.tsx` usa `useQuery` para obtener y mostrar productos tendencia en un carrusel accesible

#### Cambios realizados

**Backend (`src/backend/src/modules/products/`):**
- **products.service.ts**: Agregado método `findTrending` con caché de 5 minutos
- **products.controller.ts**: Agregado endpoint `/trending` con decorador `@Public()`

**Frontend (`src/frontend/src/`):**
- **services/trending.service.ts**: Servicio para consumir `/api/products/trending`
- **constants.ts**: Definidas constantes (`CAROUSEL_INTERVAL`, `TRENDING_PRODUCTS_LIMIT`)
- **pages/Dashboard.tsx**: Reescrito completamente con:
  - Consumo dinámico de productos tendencia vía API
  - Carrusel con rotación automática y navegación por teclado
  - Estados de loading y error con skeletons y mensajes amigables
  - Accesibilidad mejorada (ARIA labels, tabindex, keyboard navigation)
  - Indicadores de carrusel accesibles
- **src/frontend/src/components/ui/Card.tsx**: Rediseñado para incluir:
  - Sistema de variantes (primary, secondary, success, warning, error, info)
  - Estados hover y elevación mejorados
  - Uso de CSS variables para consistencia de diseño
- **src/frontend/src/index.css**: Rediseñado con:
  - Sistema completo de diseño CSS variables (colores, tipografía, espaciado)
  - Importación corregida de Google Fonts
  - Estilos base mejorados para accesibilidad y consistencia

#### Mejores prácticas aplicadas
- **Caché**: Backend cachea resultados por 5 minutos para reducir carga de BD
- **Tipado**: Interfaces TypeScript para productos tendencia y banners
- **Accesibilidad**: ARIA labels, soporte de teclado, roles apropiados
- **Experiencia de usuario**: Skeleton loading, manejo de errores amigable
- **Mantenibilidad**: Constantes centralizadas, separación de preocupaciones, componentes reutilizables
- **Rendimiento**: Limitación de productos mostrados (5 por defecto), petición optimizada
- **Accesibilidad visual**: Contraste WCAG AA, foco visible, estados de error y loading

#### Próximos pasos
1. Documentar endpoint en especificación de API abierta (Swagger/OpenAPI)
2. Añadir pruebas unitarias para servicio trending
3. Monitorear métricas de rendimiento del endpoint
4. Considerar filtros avanzados (por categoría, rango de precios, etc.)
5. Implementar pruebas de accesibilidad automatizadas