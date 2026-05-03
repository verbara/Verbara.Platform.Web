# Sentry Error Tracking Integration

**Date:** 2026-05-03
**Parent track:** v1.14.x Operational Foundation — Track 1E
**Scope:** Platform.Web only. Adds production error visibility. Zero backend changes.

## Context

Verificación del repo confirma cero error tracking: ningún import de `@sentry/*`, `bugsnag`, `rollbar`, `@datadog/browser-rum`. Errores en producción solo se observan vía `console.error` en el navegador del usuario — operadores quedan ciegos hasta que un cliente abre ticket.

Esto bloquea madurez enterprise: SOC 2, GDPR audits, customer SLAs todos requieren visibilidad operacional. Sin ella, post-mortems son imposibles, regresiones se detectan tarde, y el feedback loop entre prod y dev es manual.

[ADR-0003](../decisions/0003-operational-foundation-priority.md) prioriza esta integración antes de features customer-facing en `v1.14.x`. Este spec define la integración.

## Approved approach

**Decisión: Sentry** (vs Bugsnag, Datadog RUM, Rollbar). Justificación:

- React SDK maduro (`@sentry/react` con Error Boundary integration nativa)
- Source maps + breadcrumbs estándar de la industria
- Free tier 5k events/mes — suficiente para validar antes de subir
- Self-hosted opcional (Sentry on-prem) si compliance enterprise lo requiere
- Backend Platform puede agregar Sentry .NET en paralelo y correlacionar via `trace_id`

### Integration points

1. **Init en `src/main.tsx`** — antes del primer `createRoot().render()`. Gated por `import.meta.env.VITE_SENTRY_DSN`: si vacío → init no se ejecuta (no-op completo, sin overhead). Esto permite ambiente dev sin DSN sin código condicional en cada feature.

2. **React error boundary** — `Sentry.init({ integrations: [Sentry.reactRouterV7BrowserTracingIntegration({ ... })] })`. Los `RouteErrorBoundary` y `AreaErrorBoundary` ya existen ([ADR-0002](../decisions/0002-area-error-boundary-pattern.md)); en lugar de wrappear con `Sentry.ErrorBoundary` adicional, modificarlos para llamar `Sentry.captureException(error)` en `componentDidCatch` cuando DSN está presente.

3. **Sample rates conservadoras al inicio:**
   - `tracesSampleRate: 0.1` (10% de transactions)
   - `replaysSessionSampleRate: 0.0` (off — privacy concerns)
   - `replaysOnErrorSampleRate: 0.1` (10% de sesiones con error)
   - Ajustar según volumen real después de 30 días en producción.

### PII filtering — crítico

Esta es la decisión más importante del spec. Mal filtrado expone email/JWT/tenant data a un servicio third-party.

**`beforeSend` hook** (síncrono, inspecciona cada event):

```ts
beforeSend(event, hint) {
  // 1. Strip Authorization headers de breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(b => {
      if (b.data?.headers?.Authorization) {
        b.data.headers.Authorization = '[redacted]';
      }
      if (b.data?.headers?.['X-Tenant-Id']) {
        b.data.headers['X-Tenant-Id'] = '[hashed:' + sha256(b.data.headers['X-Tenant-Id']).slice(0,8) + ']';
      }
      return b;
    });
  }
  // 2. Strip request.data en URLs sensibles (auth, password reset)
  if (event.request?.url?.match(/\/auth\/(login|reset|mfa|recovery)/)) {
    delete event.request.data;
  }
  // 3. Strip emails de strings (regex match)
  // 4. Hash user.id antes de enviar (no raw email)
  return event;
}
```

**`denyUrls`:** los breadcrumbs no capturan llamadas a `/api/v1/auth/*` (contienen credentials) ni a `/api/v1/users/*/preferences` (PII).

**`sendDefaultPii: false`** — explícito.

### Source maps

- Vite config: `build.sourcemap: 'hidden'` (genera maps pero no las referencia en bundles, evitando que cualquiera con DevTools las descargue)
- Upload via `@sentry/vite-plugin` durante CI build (Track 1C ya tendrá CI)
- Auth via `SENTRY_AUTH_TOKEN` secret en GitHub Actions
- NO checked-in source maps al repo (`.gitignore` los excluye)

### Breadcrumbs

Default integration: `BrowserTracing`, `Console` (warn+error solo, no log/info para no inundar), `Dom` (clicks), `Fetch`, `History`.

Custom breadcrumbs específicos del producto:

```ts
// En tenant-store al cambiar tenant
Sentry.addBreadcrumb({ category: 'tenant', message: `switch to tenant=${hashed(id)}`, level: 'info' });
// En i18n al cambiar lang
Sentry.addBreadcrumb({ category: 'i18n', message: `language → ${code}`, level: 'info' });
// En auth-store en login/logout
Sentry.addBreadcrumb({ category: 'auth', message: 'login_success', level: 'info' });
```

### Tags + context

```ts
Sentry.setContext('app', { version: import.meta.env.VITE_APP_VERSION });
Sentry.setTag('area', 'admin' | 'agent' | 'analytics' | 'operations');  // viene del AreaErrorBoundary
Sentry.setTag('route', currentRoutePath);
Sentry.setUser({ id: hashedUserId, segment: userRole });   // role hashed, no raw
```

### Cost guardrails

- `maxBreadcrumbs: 50`
- `transport.fetchOptions: { keepalive: true }` (entrega en page-unload)
- Considerar self-hosted si volumen sobrepasa 100k events/mes
- Alertas: configurar en Sentry UI para spike (> 10x baseline) con notificación a maintainer

### Testing

- **Dev mode:** `Sentry.init({ debug: true, dsn: VITE_SENTRY_DEV_DSN })` con DSN dedicado dev. Forzar error con `throw new Error('test')` y verificar arrival.
- **Playwright spec:** en `tests/e2e/tests/observability/sentry-arrival.spec.ts`, mock del `/envelope/` endpoint de Sentry. Forzar crash en una ruta y verificar que el envelope se intentó enviar con campos esperados (sin PII).
- **PII review check:** spec que fuerza un error con email + JWT en el contexto y verifica que el envelope NO contiene esas strings.

## Implementation outline

1. `npm i @sentry/react @sentry/vite-plugin`
2. Crear `src/core/observability/sentry.ts` con init + helpers (`captureWithArea`, `breadcrumb`)
3. Wire en `src/main.tsx` antes de `createRoot`
4. Modificar `RouteErrorBoundary` y `AreaErrorBoundary` para llamar `Sentry.captureException` cuando DSN presente
5. Vite plugin en `vite.config.ts` con upload condicional (`SENTRY_AUTH_TOKEN` set → upload)
6. CI workflow (Track 1C ya existe): agregar step `Build with source map upload`
7. Documentar `VITE_SENTRY_DSN` y `VITE_SENTRY_DEV_DSN` en `.env.example` (creado en Track 1A)

## Out of scope

- **Sentry Performance Profiling** — feature paga, defer hasta justificación
- **Session Replay** — privacy concerns con conversations agent, defer hasta anonymization spec
- **Feedback widget** — UX cosmético, defer
- **Backend correlation** — coordinar con Platform team cuando ellos integren Sentry .NET

## Open questions

1. **Sentry SaaS vs self-hosted?** — empezar en SaaS (free tier), evaluar self-hosted si compliance customer lo exige.
2. **Trace correlation backend↔frontend?** — requiere `sentry-trace` header propagation. Negociar con Platform team en su Track de observability.
3. **Severity levels para `console.warn`?** — capturar como `warning` o filtrar? Empezar capturando, ajustar si genera ruido.
4. **¿Un DSN compartido entre repos del ecosistema, o uno por repo?** — uno por repo (Web, Platform, SDK Pro) para aislar quotas y permisos.
