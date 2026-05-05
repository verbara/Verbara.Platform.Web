# Plan: Cerrar los 4 fails E2E reales restantes (bots/queues/wallboard)

## Context

Tras la sesión de auth-sessions (commit `8b8dc68` en `main`), el último full-run dejó **4 fails reales en chromium** (no 7 — audit pasó esta vuelta, lo que CLAUDE.md decía estaba desactualizado):

```
[chromium] platform-admin/bots.spec.ts:14    › should create a bot
[chromium] platform-admin/bots.spec.ts:31    › should delete a bot with 3s confirmation
[chromium] platform-admin/queues.spec.ts:14  › should show queues in data table
[chromium] operations/wallboard.spec.ts:16   › should show queue cards section
```

Política operativa del usuario: **"sin atajos ni arreglos rápidos — resolver el problema de raíz, algo que de valor real"**. Esto excluye relajar aserciones, esconder elementos detrás de testids genéricos, o saltar tests con `test.skip`. Cada fail debe traducirse en mejora real del producto o del demo.

### Diagnóstico por fail (evidencia in-tree)

#### A. Bots (`should create a bot` + `should delete a bot with 3s confirmation`)

**El módulo de bots está medio implementado end-to-end. Cuatro defectos del backend convergen:**

1. **`IBotConfigStore` no tiene `ListAsync` ni `DeleteAsync`** — `src/Asterisk.Platform.Bot/IBotConfigStore.cs:8-18` solo expone `GetByIdAsync`/`GetDefaultAsync`/`SaveAsync`. El propio handler `ListBots` lo admite con un comentario:

   ```csharp
   // [FromServices] IBotConfigStore does not expose a ListAsync method.
   var bot = await store.GetDefaultAsync(tenantId, ct);
   return Results.Ok(bot is null ? [] : new[] { bot });
   ```

   `GetDefaultAsync` retorna **el primer bot activo**; el handler de DELETE hace soft-delete via `IsActive=false`, así la lista queda vacía después del primer borrado y nunca contiene >1 bot.

2. **`BotEndpoints.CreateBot` retorna el aggregate raw `BotConfiguration`** (línea 68: `Results.Created(..., config)`). Eso serializa **`botId`** (PascalCase del aggregate), no `id`. Frontend (`use-bots.ts:6`, `bot-list-page.tsx:85`) y tests E2E (`bots.spec.ts:39`: `getByTestId(\`delete-bot-${created.id}\`)`) esperan **`id`** → `created.id === undefined` → fallo.

3. **Mismatch de field names en el wire**: el aggregate expone `MaxTurnsBeforeHandoff`; el frontend lee `bot.maxTurns` (`use-bots.ts:11`). Aún si la lista poblara, la celda de `maxTurns` quedaría vacía.

4. **`CreateBotRequest.DefaultFlowId` es `string` no-nullable** (línea 162-163), pero el formulario permite mandar `undefined` cuando el usuario elige "ningún flow" (`bot-form.tsx:101`). El POST se rechaza con 400; el bot no se crea; `getByText(name)` no encuentra nada en la tabla.

**Causa raíz unificada:** la feature "bots" se expuso como UI completa, pero el backend nunca migró del modelo single-default-bot al modelo multi-bot. Es **dead-feature parcial** — pero a diferencia de Agent Assist (que se difirió), bots aparece en sidebar y CLAUDE.md afirma que el demo seedea uno. El producto promete bots; hay que cumplirlo.

#### B. `queues.should show queues in data table`

**`docker/demo/demo-reset.sh:215-219` envía POST con `queueId` en el payload:**

```bash
curl -sf -X POST "$API_BASE/api/v1/admin/queues" -H "$CT" -H "$AUTH" -H "$TENANT" \
    -d '{"queueId":"demo-queue-sales","name":"Sales","isActive":true}' > /dev/null 2>&1 || true
```

Después del Plan 29A morning session que introdujo `QueueDto` y eliminó campos fantasma del request, el handler `POST /admin/queues` ya no acepta `queueId` (los IDs se autogeneran). Como `curl -sf` silencia errores HTTP y `|| true` swallowea el exit code, **el seed falla en silencio**: 0 colas creadas → `queues-page` renderiza `EmptyState` (no `data-table`) → test falla.

**Causa raíz:** demo-reset desincronizado con el contrato actual del endpoint, agravado por seed que no falla ruidoso.

#### C. `wallboard.should show queue cards section`

**`wallboard-page.tsx:33` siempre renderiza el div con testid pero sin contenido cuando `sortedQueues.length === 0`:**

```tsx
<div className="grid grid-cols-1 gap-4 ..." data-testid="wallboard-queue-cards">
  {sortedQueues.map((q) => (
    <QueueCard key={q.queueId} queue={q} />
  ))}
</div>
```

Un `<div className="grid">` vacío colapsa a height=0px. Playwright `toBeVisible()` requiere bounding-box > 0 → falla. El demo no puede seedear `useQueueMetrics()` (depende de `Pro.Analytics` con call-activity real). Aún si lo hiciera, el patrón actual es un bug de UX legítimo: tenant nuevo abre wallboard sin métricas, no ve nada y no entiende por qué.

**Causa raíz:** falta empty-state inline dentro del contenedor de cards.

---

## Decisiones de diseño

### Bots (mayor de los cuatro)

**Convertir bots en feature multi-bot real.** Es la única forma sin atajos.

Alternativas descartadas:

- (X) Eliminar bots de la sidebar y aceptar que es Agent-Assist-style dead code → contradice CLAUDE.md y el rol de bots como audiencia en Notification Center.
- (X) Solo arreglar el response shape (renombrar `botId`→`id`) sin agregar `ListAsync`/`DeleteAsync` → el test "delete a bot" seguiría fallando porque el soft-delete deja el bot visible y `GetDefaultAsync` solo trae uno.
- (✓) **Completar el backend**: `ListAsync` real, `DeleteAsync` hard-delete, `BotDto` que matchea el frontend, alinear `MaxTurns` ↔ `MaxTurnsBeforeHandoff`, `DefaultFlowId` opcional.

### Queues

**Re-sincronizar `demo-reset.sh` con el contrato `POST /admin/queues` actual** + endurecer el seed para que falle ruidosamente (no `|| true` para errores 4xx/5xx). Convención que evitará re-incidencia de este patrón.

### Wallboard

**Empty-state inline** dentro del contenedor `wallboard-queue-cards`. Cumple UX y testid simultáneamente; mismo patrón usado en `bot-list-page.tsx` (`EmptyState`).

---

## Fixes

### Fix 1 — Bot store: ListAsync + DeleteAsync (interface + 2 impls)

**Archivos:**

- `src/Asterisk.Platform.Bot/IBotConfigStore.cs` — agregar:
  ```csharp
  Task<IReadOnlyList<BotConfiguration>> ListAsync(TenantId tenantId, CancellationToken ct);
  Task<bool> DeleteAsync(TenantId tenantId, EntityId botId, CancellationToken ct);
  ```
- `src/Asterisk.Platform.Storage.InMemory/InMemoryBotConfigStore.cs` — implementar (filtro por `TenantId`; `Delete` retorna `true` si existía y se removió).
- `src/Asterisk.Platform.Storage.Postgres/Stores/PostgresBotConfigStore.cs` — `SELECT ... WHERE tenant_id=@t ORDER BY created_at` y `DELETE ... WHERE tenant_id=@t AND bot_id=@id` con `cmd.ExecuteAsync()` retornando `affected > 0`. Verificar/convertir row type a class-based `{get;init;}` por convención Npgsql 9 + Dapper.

### Fix 2 — Bot DTO + endpoint rewrite

**Archivo:** `src/Asterisk.Platform.Api/Endpoints/BotEndpoints.cs`

```csharp
internal sealed record BotDto(
    string Id,
    string Name,
    string? DefaultFlowId,
    string? FallbackQueueId,
    double ConfidenceThreshold,
    int MaxTurns,           // alineado con frontend; mapeado desde MaxTurnsBeforeHandoff
    bool IsActive,
    DateTimeOffset CreatedAt);

private static BotDto ToDto(BotConfiguration c) => new(
    c.BotId.Value, c.Name,
    c.DefaultFlowId?.Value, c.FallbackQueueId?.Value,
    c.ConfidenceThreshold, c.MaxTurnsBeforeHandoff,
    c.IsActive, c.CreatedAt);
```

- `ListBots` → `await store.ListAsync(tenantId, ct)` → `Results.Ok(items.Select(ToDto).ToArray())`.
- `CreateBot` → `Results.Created($"/admin/bots/{config.BotId}", ToDto(config))`.
- `UpdateBot` → `Results.Ok(ToDto(existing))`.
- `GetBot` → `Results.Ok(ToDto(config))`.
- `DeleteBot` → `await store.DeleteAsync(tenantId, EntityId.From(id), ct)` → `Results.NoContent()` si true, `Results.NotFound()` si false. Quitar el comentario "[FromServices] does not expose DeleteAsync" y la lógica de soft-delete.
- `CreateBotRequest.DefaultFlowId` → `string?` (nullable opcional). Si viene null, omitir asignación al aggregate (revisar contrato; si requiere no-null, ajustar).
- Renombrar `MaxTurnsBeforeHandoff` → `MaxTurns` en `CreateBotRequest`/`UpdateBotRequest`. Mapeo: `MaxTurnsBeforeHandoff = body.MaxTurns ?? 20`.

### Fix 3 — AOT registration

**Archivo:** `src/Asterisk.Platform.Api/Serialization/ApiJsonContext.cs`

- `[JsonSerializable(typeof(BotDto))]`
- `[JsonSerializable(typeof(BotDto[]))]`

### Fix 4 — Tests backend

**Archivo:** `tests/Asterisk.Platform.Api.Tests/Endpoints/BotEndpointsTests.cs` (extender o crear)

- `ListBots_ShouldReturnAllTenantBots_AsBotDto`
- `CreateBot_ShouldReturn201WithBotDto_HavingIdField`
- `CreateBot_ShouldAcceptNullDefaultFlowId`
- `DeleteBot_ShouldHardDelete_AndSubsequentListExcludesIt`
- `DeleteBot_ShouldReturn404_WhenBotDoesNotExist`

Usar `AuthenticatedPlatformApiFactory` con `InMemoryBotConfigStore` real (no NSubstitute) para cubrir el path completo end-to-end del controlador.

### Fix 5 — Demo seed: queues + bots + fail-loud

**Archivo:** `docker/demo/demo-reset.sh:215-219`

- Quitar `queueId` del payload y endurecer el seed:
  ```bash
  curl -fsS -X POST "$API_BASE/api/v1/admin/queues" -H "$CT" -H "$AUTH" -H "$TENANT" \
      -d '{"name":"Sales","isActive":true}' >/dev/null
  curl -fsS -X POST "$API_BASE/api/v1/admin/queues" -H "$CT" -H "$AUTH" -H "$TENANT" \
      -d '{"name":"Support","isActive":true}' >/dev/null
  ```
  `-fsS` (fail on HTTP error, silent progress, show errors al stderr) y **sin** `|| true`. Si el contrato cambia otra vez, el script muere ruidoso y el operador lo ve.
- Agregar **seed de un bot** después del bloque de queues (un bot puede referenciar `fallbackQueue`):
  ```bash
  curl -fsS -X POST "$API_BASE/api/v1/admin/bots" -H "$CT" -H "$AUTH" -H "$TENANT" \
      -d '{"name":"Demo Bot","confidenceThreshold":0.7,"maxTurns":20,"isActive":true}' >/dev/null
  ```
- Actualizar el `echo` final línea ~279 para mencionar "1 bot".

### Fix 6 — Wallboard empty-state

**Archivo:** `src/operations/wallboard/wallboard-page.tsx:33`

```tsx
<div
  className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
  data-testid="wallboard-queue-cards"
>
  {sortedQueues.length === 0 ? (
    <div className="col-span-full rounded-lg border border-dashed p-8 text-center">
      <p className="text-sm text-muted-foreground">
        No queue metrics yet. Cards will appear once calls are routed.
      </p>
    </div>
  ) : (
    sortedQueues.map((q) => <QueueCard key={q.queueId} queue={q} />)
  )}
</div>
```

Mantiene el testid siempre con contenido visible. UX honesto cuando no hay datos.

### Fix 7 — Verificación end-to-end

```bash
# Backend: build + tests
cd /media/Data/Source/Verbara/Asterisk.Platform
dotnet build Asterisk.Platform.slnx                                    # 0 warn
xUnit.MaxParallelThreads=1 dotnet test Asterisk.Platform.slnx -v q     # 1666+ pass

# Demo: aplicar cambios (incluye seed nuevo)
bash docker/demo/demo-reset.sh                                          # debe terminar OK; falla ruidoso si algún seed 4xxs

# E2E focalizados
cd /media/Data/Source/Verbara/Asterisk.Platform.Web
npx playwright test -c tests/e2e/playwright.config.ts \
  tests/e2e/tests/platform-admin/bots.spec.ts \
  tests/e2e/tests/platform-admin/queues.spec.ts \
  tests/e2e/tests/operations/wallboard.spec.ts \
  --reporter=line                                                       # 16/16 pass

# Full E2E (regresión + reporte HTML estándar en playwright-report/)
npx playwright test -c tests/e2e/playwright.config.ts                   # >= 261 pass / 0 fail en estos clusters
```

---

## Archivos a modificar

| Archivo                                                                   | Repo         | Fix |
| ------------------------------------------------------------------------- | ------------ | --- |
| `src/Asterisk.Platform.Bot/IBotConfigStore.cs`                            | Platform     | 1   |
| `src/Asterisk.Platform.Storage.InMemory/InMemoryBotConfigStore.cs`        | Platform     | 1   |
| `src/Asterisk.Platform.Storage.Postgres/Stores/PostgresBotConfigStore.cs` | Platform     | 1   |
| `src/Asterisk.Platform.Api/Endpoints/BotEndpoints.cs`                     | Platform     | 2   |
| `src/Asterisk.Platform.Api/Serialization/ApiJsonContext.cs`               | Platform     | 3   |
| `tests/Asterisk.Platform.Api.Tests/Endpoints/BotEndpointsTests.cs`        | Platform     | 4   |
| `docker/demo/demo-reset.sh`                                               | Platform     | 5   |
| `src/operations/wallboard/wallboard-page.tsx`                             | Platform.Web | 6   |

**Sin migración SQL** — la tabla `bot_configurations` ya existe con todas las columnas necesarias para `ListAsync`/`DeleteAsync`.

---

## Orden de ejecución (Subagent-Driven)

1. **Foundation (batch):** Fix 1 (interface + 2 impls) + Fix 2 (endpoint + DTO) + Fix 3 (AOT) — mismo dominio, cohesivo.
2. **Tests backend (individual):** Fix 4 — depende de 1-3.
3. **Demo (individual):** Fix 5 — independiente del código del backend, pero debe hacerse después para validar el contrato nuevo.
4. **Frontend (individual):** Fix 6 — independiente; pequeño.
5. **Verify (individual):** Fix 7 — dependiente de todo lo demás aplicado y demo reseteada.

Cada fase termina con un commit convencional:

- `feat(bots): list/delete in IBotConfigStore + InMemory + Postgres`
- `feat(api): BotDto + multi-bot endpoints + AOT registration`
- `test(bots): cover list/create/delete contract`
- `fix(demo): align queue/bot seed with current contract; fail loud on HTTP errors`
- `fix(wallboard): empty-state inside queue-cards container`

## Fuera de alcance

- Migrar bot UI a multi-bot picker / default-bot toggle — la UI ya soporta multi-bot (DataTable). Sin trabajo adicional.
- Implementar `useQueueMetrics()` con datos sintéticos para poblar el wallboard — depende de `Pro.Analytics` con tráfico real.
- Eliminar `GetDefaultAsync` del store (usado por `BotOrchestrator` en runtime). Se mantiene.
- Cambios cosméticos en `wallboard-page.tsx` más allá del empty-state mínimo.
- Re-baseline de los 7 fails que CLAUDE.md mencionaba — el último run reveló que solo son 4 (audit pasó). Documentar en MEMORY.md durante el commit final.
