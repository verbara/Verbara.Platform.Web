## 1. Phase A — Migrate Agent-module hook files (swap-the-T, per file)

Each task: replace the file's hand-written request/response interface(s) with the generated
`components['schemas']['<SchemaName>']` type (aliased locally), grep the repo for every usage of
each removed interface name and update imports, then delete the hand-written declaration. `tsc -b`
must stay green after each. Counts in parens = hand-written declarations in the file today (22
total).

> **Outcome (2026-07-23): partial migration — the same Admin-child bound.** Per-hook analysis
> (8 parallel analyzers) against the committed `openapi.d.ts` found **5 of 22 declarations cleanly
> migratable**; the rest stay hand-written with a per-declaration `@`-comment naming the blocker.
> The Agent surface is dominated by raw-ENTITY response schemas (`Conversation`, `Message`,
> `Contact`) that differ from the view-models the UI reads, `content?: never` endpoints, and
> string-literal-union widening — none swap cleanly. `tsc -b` verified every migrate call (no
> over-reach). Both request-body aliases + the two voice-result aliases are type-only; the one
> coercion (UnreadCount) uses the `use-teams`/CSAT `Number()`-boundary idiom.

- [x] 1.1 `use-contacts.ts` (3) — **0 migrated.** `Contact` (raw entity: no `id`, `addresses`
      optional+nullable, `preferredChannel` as `ChannelType` enum — consumers read `.id`, index
      `addresses`, bind a plain-string form field), `ContactConversation` (endpoint returns
      `PagedResultOfConversation` over the raw `Conversation`, lacking `id`/`queueName`/`disposition`/
      `durationSeconds`), `PagedResult<T>` (local generic; generated pagers are monomorphized).
- [x] 1.2 `use-conversations.ts` (5) — **2 migrated (aliases).** MIGRATED: `VoiceTransferResult` →
      `VoiceTransferResponse`, `VoiceDialResult` → `VoiceDialResponse` (structural matches; the
      required-nullable `error`/`correlationId` are a safe read-widening, consumers compatible).
      KEPT: `Conversation` + `Message` (raw ENTITIES vs inbox/thread view-models), `PagedResult<T>`
      (generic wrapper).
- [x] 1.3 `use-media.ts` (1) — **0 migrated.** `MediaUploadResult`: `POST /media/upload` is
      `content?: never` (no response schema) and the hook uses a raw multipart `fetch().json()`.
- [x] 1.4 `use-me.ts` (2) — **0 migrated.** `Me` + nested `MfaPolicy`: `GET /users/me` is
      `content?: never` (no `MeDto`/`CurrentUserDto` emitted).
- [x] 1.5 `use-mfa-enroll.ts` (3) — **1 migrated (alias).** MIGRATED: `MfaEnrollVerifyRequest` →
      the same-named generated request schema (exact `{ secret, totpCode }`). KEPT:
      `MfaEnrollInitResponse` + `MfaEnrollVerifyResponse` (both POST 200s are `content?: never`).
- [x] 1.6 `use-notifications.ts` (5) — **1 migrated (coercion).** MIGRATED: `useUnreadCount` wire →
      `UnreadCountDto` + `normalizeUnreadCount` (`count` is the AOT `number | string` union; consumers
      do `count > 0` / `previousCount.count - 1`). KEPT: `Notification` (matches `NotificationDto`
      except the DTO widens `category`/`severity` to bare `string` while consumers need the literal
      unions), `NotificationCategory` + `NotificationSeverity` (literal unions, no generated match),
      `NotificationListParams` (query params, not a body/response).
- [x] 1.7 `use-recovery-codes.ts` (2) — **1 migrated (alias).** MIGRATED:
      `RegenerateRecoveryCodesRequest` → `ProfileRegenerateRecoveryCodesRequest` (exact `{ totpCode }`;
      the PROFILE-scoped schema, NOT the legacy `/auth`-path `RegenerateRecoveryCodesRequest`). KEPT:
      `RecoveryCodesPayload` (POST 200 is `content?: never`).
- [x] 1.8 `use-user-sessions.ts` (1) — **0 migrated.** `UserSessionDto`: `GET /profile/security/
    sessions` is `content?: never`; the nearby `ActiveSession`/`ActiveSessionDto` are unrelated
      shapes lacking `device`/`location`/`isCurrentSession`.

## 2. Phase B — Coercion sites (report to the Admin child's tally)

- [x] 2.1 One genuine `number | string` AOT-wire-union coercion site surfaced by this child, reported
      to the shared tally in `openapi-typed-client-admin`: `use-notifications.ts` —
      `normalizeUnreadCount` normalizes `UnreadCountDto.count`. Uses the `Number()`-at-the-boundary
      idiom (the `use-teams`/CSAT precedent), not the shared helper (still deferred to ≥3 genuine
      active sites). `ai-credits-readout.tsx`'s `as number` casts excluded (retro run 4).

## 3. Phase C — Validation (batch)

- [x] 3.1 `npm run build` — `tsc -b && vite build` clean (`✓ built`; the drift-catching CI gate).
- [x] 3.2 `npx vitest run` — 1460 unit tests passed (185 files); added one `useUnreadCount`
      string-coercion test.
- [x] 3.3 `npm run lint` — eslint clean (0 errors), `i18n:check` green, and `lint:generated-types`
      ratchet OK (floor 43 → **39**; baseline trimmed of use-conversations + use-mfa-enroll +
      use-notifications + use-recovery-codes).
- [x] 3.4 No hand-written interface remains for a migrated shape (the 2 voice results + 2 request
      bodies are now aliases; `UnreadCount` consumes `UnreadCountDto` at the wire).
- [x] 3.5 No `npx playwright test` run — swap-the-T is compile-time-only; no user-facing flow altered.

## 4. Follow-up (cross-repo, for the archive record)

Same Platform-side response-schema gap as the Operations child. To un-block the remaining Agent
shapes, Platform should emit named view-model response DTOs (instead of the raw `Conversation`/
`Message`/`Contact` entities) for the conversation/inbox/contact endpoints; response DTOs for the
`content?: never` self-service endpoints (`/users/me`, `/media/upload`, the MFA-enroll init/verify
and recovery-codes responses, `/profile/security/sessions`); and either literal-enum `category`/
`severity` on `NotificationDto` or accept the string-widening. Recorded here; not actionable from
this repo.
