# Changelog

All notable changes to **Asterisk.Platform.Web** are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) ·
Versioning: [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

_No unreleased changes._

---

## [1.13.1] — 2026-04-28 — Language Switcher + i18n Persistence

**First user-facing i18n feature.** Brings the existing translation
infrastructure (15 JSON bundles, 131 components already wired with
`useTranslation`) within reach of end users, who previously had no way
to change away from the default `es-419`.

### Added

- `i18next-browser-languagedetector` integrated into the i18n init
  (`src/core/i18n/i18n.ts`). Detection order: `localStorage` →
  `navigator` → `htmlTag`. Persisted in `localStorage` under the key
  `asterisk.lang`.
- `LanguageSwitcher` component (`src/core/i18n/language-switcher.tsx`)
  with two variants:
  - `icon` — globe icon button (used in unauthenticated screens).
  - `inline` — short-code chip with globe icon (default).
- Login page (`src/core/auth/login-page.tsx`) — language switcher
  pinned to top-right corner so users can pick their language before
  authenticating.
- User menu (`src/shell/user-menu.tsx`) — language sub-menu added next
  to the existing theme sub-menu, with check-mark indicating the active
  language.
- Translation keys for the switcher in all three locales (`common.json`):
  `language.label`, `language.es-419`, `language.en-US`,
  `language.pt-BR`, plus `theme.label` for symmetry with the new sub-menu.
- 6 Vitest unit tests covering: inline/icon variants, default variant,
  unknown-language fallback, prefix-match resolution, and click-to-switch.

### Exported

- `SUPPORTED_LANGUAGES` and `SupportedLanguage` type from
  `@/core/i18n/i18n` so the user menu (and any future consumer) can
  iterate the canonical list without duplication.
- `LANGUAGE_STORAGE_KEY` (`asterisk.lang`) for tooling that needs to
  read or clear the persisted choice.

### Tests

- 199/199 Vitest (was 193/193) · 0 TS errors · 42 test files (was 41).

### Known coverage gap

136 of 267 `.tsx` files (≈51 %) still hold hardcoded strings (default
`es-419`). That gap is now visible — switching to English or Portuguese
will only translate the ≈49 % of components already wired. A follow-up
plan (`docs/research/i18n-coverage-gap-2026-04-28.md`) catalogues the
gap by domain so subsequent work can extract strings incrementally
without blocking this slice.

---

## [1.13.0] — 2026-04-27 — Track Platform 1.14.0 "AHH Auth Hotpath Hardening"

**Cosmetic version bump only — no source change.** Coordinated with the
Platform-side AHH (Auth Hotpath Hardening) train shipped 2026-04-27 as
`Asterisk.Platform 1.14.0`. AHH lifts the `POST /auth/login` knee from
~75 req/s → ~220 req/s single-replica (~880 req/s 4-replica aggregate
projected) via:

1. Hot-read caching (`CachedTenantAuthConfigStore` + `CachedUserStore`)
   with cross-replica Redis pubsub invalidation.
2. Write-path deferral via `AuthWriteQueue` (`LastLoginAt`, lockout
   reset, success-path `AuthEvent` move off the request critical path;
   failure-path audit logging stays synchronous).
3. JWT rotation pool wire-up + RS256-aware `JwtKeyEntry` schema +
   `RedisJwtKeyStore` CAS upsert + multi-replica startup gate.
4. Argon2id password migration (OWASP-2025 floor m=19 MiB, t=2, p=1)
   with on-login transparent rehash from legacy BCrypt12.
5. Horizontal scaling baseline + operations runbook + 5 ADRs (0010-0014).

The login API contract is unchanged — token shape, refresh-token
semantics, MFA challenge flow, lockout responses all preserve verbatim
behavior. The Web UI is byte-identical to 1.12.0 builds; only `package.json`
moves to keep the version-track convention with the Platform release.

### Changed

- **Bump to track Platform 1.14.0:** `package.json` version 1.12.0 → 1.13.0.

### Tests

- 193/193 Vitest unchanged · 0 TS errors · 41 test files.

---

## [1.12.0] — 2026-04-26 — R5.4 "Production Validation"

**Final release of the R5 Production Readiness Release Train.** Coordinated
ship with **Pro 1.15.0-pro** + **Platform 1.13.0**. No frontend feature
changes — Web 1.12.0 bump is exclusively to track the Platform 1.13.0
contract (Pro NU1902 fix + JWT rotation infrastructure + suspend reason
payload + IAgentTenantResolver required-by-default).

### Changed

- **Bump to track Platform 1.13.0:** `package.json` version 1.11.0 → 1.12.0.

### Tests

- 193/193 Vitest unchanged · 0 TS errors · 41 test files.

### R5 train acceptance

R5.1 (1.9.0) + R5.2 (1.10.0) + R5.3 (1.11.0) + R5.4 (1.12.0) — **R5 Production
Readiness Release Train COMPLETE**. R4 Track A previously declared COMPLETE
in R5.3.
