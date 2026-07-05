# Security baseline — Verbara Web (Track 1B, v1.14.1)

**TL;DR:** Pre-Track-1B state was 9 npm vulnerabilities (3 HIGH, 6 moderate). After running `npm audit fix` (zero `--force`, no major-version bumps), all 9 were resolved. CI baseline now: `npm audit --audit-level=high` returns 0 HIGH and 0 CRITICAL. Dependabot configured for weekly automated updates with grouping. This doc snapshots the baseline as the **before/after** record for the v1.14.x Operational Foundation track.

---

## 1. Pre-fix state (2026-05-03 morning)

`npm audit` reported **9 vulnerabilities** in transitive dependencies:

### High severity (3)

| Package              | Affected versions       | Vulnerability                                                                                                                        | Source                                                                                                                                                                                                                       |
| -------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`vite`**           | 8.0.0 – 8.0.4           | Path traversal in optimized deps `.map` handling, `server.fs.deny` bypass with queries, arbitrary file read via dev-server WebSocket | [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9), [GHSA-v2wj-q39q-566r](https://github.com/advisories/GHSA-v2wj-q39q-566r), [GHSA-p9ff-h696-f583](https://github.com/advisories/GHSA-p9ff-h696-f583) |
| **`picomatch`**      | ≤2.3.1, 4.0.0 – 4.0.3   | Method injection in POSIX character classes (incorrect glob matching), ReDoS via extglob quantifiers                                 | [GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p), [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj)                                                                           |
| **`path-to-regexp`** | (transitive via router) | (advisory pending detailed enumeration)                                                                                              | (npm audit reported as HIGH)                                                                                                                                                                                                 |

### Moderate severity (6)

| Package                                                                        | Affected versions      | Vulnerability                                                          | Source                                                                   |
| ------------------------------------------------------------------------------ | ---------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **`@hono/node-server`**                                                        | <1.19.13               | Middleware bypass via repeated slashes in `serveStatic`                | [GHSA-92pp-h63x-v22m](https://github.com/advisories/GHSA-92pp-h63x-v22m) |
| **`brace-expansion`**                                                          | <1.1.13, 4.0.0 – 5.0.4 | DoS via zero-step sequence (process hang + memory exhaustion)          | [GHSA-f886-m6hf-6m8v](https://github.com/advisories/GHSA-f886-m6hf-6m8v) |
| **`dompurify`**                                                                | ≤3.3.3                 | `ADD_TAGS` form bypasses `FORBID_TAGS` due to short-circuit evaluation | [GHSA-39q2-94rc-95cp](https://github.com/advisories/GHSA-39q2-94rc-95cp) |
| **`postcss`**                                                                  | <8.5.10                | XSS via unescaped `</style>` in CSS Stringify output                   | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) |
| (2 additional moderate not enumerated above — full list in `npm audit` output) |                        |                                                                        |                                                                          |

### Direct vs transitive

- **`dompurify`** was a direct dependency (declared in `package.json` for HTML sanitization).
- All other vulnerabilities were **transitive** (introduced via Vite, ESLint toolchain, AG Grid, etc.).

### Risk assessment (pre-fix)

| Vulnerability                             | Production exposure                                                             | Dev exposure                                                           | Notes                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------- |
| Vite path traversal / fs.deny / WebSocket | None (Vite is build-time only; the production output is static HTML/JS)         | **Yes** — anyone running `npm run dev` exposed a vulnerable dev server | High priority for fix because devs run vite locally daily |
| Picomatch ReDoS / POSIX injection         | None (used by tooling, not runtime)                                             | Yes                                                                    | Build/lint hot path                                       |
| `dompurify` ADD_TAGS bypass               | **Yes** — used for sanitizing user-submitted HTML (e.g., agent message content) | Yes                                                                    | Direct prod risk                                          |
| postcss XSS in CSS stringify              | None (build-time tool)                                                          | Yes                                                                    | Build-time                                                |
| Other moderate                            | Mostly build/lint tools                                                         | Yes                                                                    | Lower priority                                            |

The `dompurify` direct prod exposure was the most user-visible — agent inbox renders sanitized message HTML, and a sanitization bypass could enable XSS. Fix priority: HIGH for that one specifically (regardless of npm severity tag).

---

## 2. Post-fix state (2026-05-03)

Action: `npm audit fix` (no `--force`, no manual major bumps required).

```sh
$ npm audit fix
removed 1 package, changed 22 packages, and audited 712 packages in 2s
found 0 vulnerabilities

$ npm audit --audit-level=high
found 0 vulnerabilities
```

### Verification

| Check                              | Result                                                          |
| ---------------------------------- | --------------------------------------------------------------- |
| `npm audit --audit-level=high`     | 0 vulnerabilities ✅                                            |
| `npm audit --audit-level=critical` | 0 vulnerabilities ✅                                            |
| `npm run build`                    | Successful, 473 ms ✅                                           |
| `npm run test -- --run`            | 205 / 205 passing ✅                                            |
| `npm run lint`                     | 111 pre-existing lint errors (deferred to Track 3A — unchanged) |

22 transitive packages updated. No direct-dependency major-version bumps. No breaking changes observed across the test suite. The fix was clean.

---

## 3. Continuous monitoring — Dependabot

Configured at [`.github/dependabot.yml`](../../.github/dependabot.yml). Strategy:

| Aspect                    | Configuration                                                                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Schedule**              | Weekly, Monday 06:00 America/Mexico_City                                                                                                                                   |
| **Ecosystems**            | npm + github-actions                                                                                                                                                       |
| **PR limits**             | 10 npm + 5 actions                                                                                                                                                         |
| **Grouping**              | 9 logical groups (react-ecosystem, tanstack, vite-toolchain, eslint-toolchain, i18n, base-ui-radix, tailwind, forms, playwright) — each batched into a single PR per cycle |
| **Major versions**        | **Ignored** (`version-update:semver-major`) — handled manually in Track 3C (npm-deps-majors) to allow coordinated regression testing                                       |
| **Auto-merge**            | Not yet configured. Will be added in Track 1C with the CI/CD pipeline (auto-merge requires green CI checks, which don't exist yet)                                         |
| **Commit message prefix** | `chore(deps):` for runtime, `chore(deps-dev):` for dev, `chore(ci):` for actions                                                                                           |

**Rationale for ignoring majors:**

Major version bumps in this stack frequently introduce breaking changes (e.g., Vite 7 → 8 changed the dev-server SSL behavior; ESLint 8 → 9 required flat-config migration; React Router 6 → 7 changed routing primitives). Dependabot opening 30+ major-bump PRs would dilute signal and require manual review on each. Track 3C ([roadmap](../plans/completed/2026-05-03-v1.14.x-operational-foundation-roadmap.md)) is the dedicated track for coordinated major upgrades — when CI exists (Track 1C) and coverage tracking exists (Track 2A), majors can be evaluated systematically.

---

## 4. Pinned baseline — what's installed (post-fix)

Top-level direct dependencies that were transitively affected by the fix and now sit at known-clean versions (sample, not exhaustive):

| Direct dep  | Was   | Now (post-fix)                            |
| ----------- | ----- | ----------------------------------------- |
| `vite`      | 8.0.x | 8.0.5+ (vulnerable range was 8.0.0-8.0.4) |
| `dompurify` | 3.x.y | 3.3.4+ (advisory affects ≤3.3.3)          |

Full lockfile snapshot is in `package-lock.json` (committed to repo).

---

## 5. Process & follow-up

### What "Security baseline established" means

- 0 HIGH or CRITICAL npm vulnerabilities at all times (regression caught by CI in Track 1C).
- Weekly Dependabot PRs for ongoing patch + minor coverage.
- Major version upgrades coordinated via Track 3C (deps-majors).
- Security disclosure channel published: `security@verbara.io` (in [`README.md`](../../README.md), [`CONTRIBUTING.md`](../../CONTRIBUTING.md), [`NOTICE`](../../NOTICE)).

### Outstanding items (deferred to other tracks)

1. **`SECURITY.md`** with [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) `security.txt` mention — defer to Track 1E (Sentry / production error tracking) or earlier if `security@verbara.io` traffic justifies. Issue: Web is a static site; a `/.well-known/security.txt` file requires deployment-time configuration.
2. **Snyk / Socket / npm provenance** integration — defer to Track 1C (CI/CD pipeline) so the SCA scan runs on every PR.
3. **SBOM (Software Bill of Materials) generation** — defer; useful for enterprise customers (SaaS Enterprise tier) but premature for v1.14.x.
4. **CVE/CVSS triage policy** documenting which severities block release vs. warning — defer to Track 1C (where the CI gate enforces the policy).

### What is NOT covered by this baseline

- Backend (`Verbara.Platform`) vulnerabilities — separate track in the Platform repo (NuGet `dotnet list package --vulnerable`).
- Pro overlays — closed-source, separate process.
- Container image vulnerabilities (Docker base image scans) — defer to Track 1C if/when we publish public images.
- Source-code SAST (CodeQL, Semgrep) — defer to Track 1C.
- Runtime DAST — defer beyond v1.14.x.

---

## 6. Sources

- [GitHub Advisory Database](https://github.com/advisories) (queried 2026-05-03)
- [npm audit documentation](https://docs.npmjs.com/cli/v10/commands/npm-audit)
- [Dependabot documentation](https://docs.github.com/en/code-security/dependabot)
- Pre-fix audit report: `npm audit --json` snapshot (full JSON in commit history)

---

## 7. Acceptance criteria (Track 1B)

| Criterion                                                              | Status                                                   |
| ---------------------------------------------------------------------- | -------------------------------------------------------- |
| `npm audit --audit-level=high` returns 0 vulnerabilities               | ✅                                                       |
| `npm audit --audit-level=critical` returns 0 vulnerabilities           | ✅                                                       |
| Direct vulnerable dependencies (`dompurify`) upgraded to clean version | ✅                                                       |
| `.github/dependabot.yml` configured with weekly schedule + grouping    | ✅                                                       |
| Build + tests verde post-upgrade                                       | ✅ (build OK, 205/205 tests)                             |
| Security disclosure channel published                                  | ✅ (`security@verbara.io` in README/CONTRIBUTING/NOTICE) |
| Baseline doc captures before/after state                               | ✅ (this document)                                       |

**Track 1B closed 2026-05-03 → version `1.14.1`.** Per [ADR-0005](../decisions/0005-versioning-track-end-tags.md), no tag yet — tag at end of Operational Foundation level (`v1.14.5-web`).
