# Track 3B — typescript-strict-2

> Eliminate all unsafe type casts (`as any`, `as unknown as`) from production and test code.

## Goal

Reduce TypeScript escape hatches to the minimum necessary (only `as Resolver<T>` for z.coerce schemas, documented in Track 3A). Ship as `v1.16.1`.

## Scope

| Category                                      | Count  | Fix Strategy                                |
| --------------------------------------------- | ------ | ------------------------------------------- |
| `User` interface missing fields               | 3      | Extend interface                            |
| `zodResolver(schema as any)` — dynamic schema | 1      | Type schema as `z.ZodType<unknown>`         |
| `'' as unknown as number` — z.coerce default  | 2      | Use `undefined` (RHF DeepPartial allows it) |
| `ColumnDef` array type mismatch               | 3      | Remove `useMemo` generic, let TS infer      |
| Sentry headers cast                           | 1      | Type guard already in scope                 |
| i18n `SUPPORTED_LANGUAGES` cast               | 1      | Spread to mutable array `[...X]`            |
| Test mock pattern                             | 23     | `asMock()` typed helper                     |
| **Total**                                     | **34** |                                             |

## Excluded (legitimate)

- 10× `as Resolver<T>` — Track 3A documented these as necessary for `z.coerce` schemas
- `as const` assertions — these are safe narrowing, not escape hatches

## Fixes Detail

### 1. `src/core/api/hooks/use-users.ts` — Extend User interface

Add `mfaEnabled?: boolean`, `lastLoginAt?: string`, `authProvider?: string` to the `User` interface. These fields exist in the API response but were missing from the type.

### 2. `src/admin/campaigns/campaign-wizard.tsx` — Dynamic schema typing

Change `stepSchemas` type from `Partial<Record<StepKey, z.ZodType>>` to use explicit `z.ZodType<unknown>`:

```typescript
const stepSchemas: Partial<Record<StepKey, z.ZodType<unknown>>> = { ... };
```

Then `zodResolver(currentSchema)` accepts it without cast. If TS still complains, use `as Resolver<CampaignFormValues>` (same Track 3A pattern — legitimate for partial validators).

### 3. `src/admin/routes/route-form.tsx` — Use `undefined` for unset numeric selects

Replace `'' as unknown as number` with `undefined`. RHF's `DefaultValues<T>` maps every field to `T[K] | undefined`. The Select already handles falsy: `value={field.value ? String(field.value) : ''}`.

### 4. `src/admin/security/audit/audit-viewer-page.tsx` + `impersonation-admin-page.tsx` — ColumnDef inference

Remove the explicit generic from `useMemo<ColumnDef<T>[]>()`. When TS infers the return type from `createColumnHelper<T>()` methods, the array types unify correctly. The variable annotation provides the needed type:

```typescript
const columns: ColumnDef<AuditEventDto>[] = useMemo(() => [...], [deps]);
```

If inference alone doesn't solve it, use `satisfies ColumnDef<T>[]` on the array literal.

### 5. `src/core/observability/sentry.ts` — Remove double cast

`event.request.headers` is typed as `Record<string, string> | undefined` in Sentry types. Our `redactHeaders` accepts `Record<string, unknown> | undefined`. Fix: widen `redactHeaders` parameter or use direct assignment since `Record<string, string>` extends `Record<string, unknown>`.

### 6. `src/core/i18n/i18n.ts` — Spread readonly tuple

```typescript
supportedLngs: [...SUPPORTED_LANGUAGES],
```

`[...X]` converts `readonly ['a','b','c']` to `string[]` (mutable), satisfying i18next's `string[]` parameter.

### 7. Test files — `asMock()` utility

Create `src/tests/utils/as-mock.ts`:

```typescript
import type { Mock } from 'vitest';

export function asMock<T extends (...args: never[]) => unknown>(
  fn: T,
): Mock<Parameters<T>, ReturnType<T>> {
  return fn as unknown as Mock<Parameters<T>, ReturnType<T>>;
}
```

Replace all 23 instances of `useHook as unknown as ReturnType<typeof vi.fn>` with `asMock(useHook)`.

## Acceptance Criteria

- `npm run build` passes (tsc -b + vite build)
- `npm run lint` passes (0 errors, 0 warnings)
- `npm run test` passes (800/800)
- `grep -rn "as any\|as unknown as" src/ | grep -v .test. | grep -v "as Resolver"` → 0 results
- `grep -rn "as unknown as ReturnType" src/` → 0 results (tests use asMock)
- No `@ts-ignore` directives anywhere in src/
