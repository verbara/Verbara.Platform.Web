# Web image — adoption-friendly publishing improvements

> **Date:** 2026-05-23
> **Goal:** make `ghcr.io/verbara/platform/web` as frictionless as possible for an SMB operator or self-hoster to consume. Today the image is published + signed + publicly readable, but it's `linux/amd64` only and the customer-facing references in compose files + manuales lag the latest published tag.
> **Non-goal:** changing the build pipeline architecture or moving away from cosign. The current `release.yml` workflow is solid; this plan refines its outputs.
> **Cross-repo dependency:** Image consumers (compose, Helm chart, manuales) live in [`Verbara.Platform`](../../../../Verbara.Platform/). This plan ships Web-side changes; consumer-side references get updated in a sibling Platform-repo follow-up tracked in `Verbara.Platform/docs/research/2026-05-23-image-source-audit.md`.

## 1. Current state (verified 2026-05-23)

| Property                                        | Value                                                                     | Verdict                                              |
| ----------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| Package URL                                     | `ghcr.io/verbara/platform/web`                                            | ✅                                                   |
| Visibility                                      | Public (anonymous pull works, returns HTTP 200 for `v3.1.3-web` manifest) | ✅ — only Verbara image with this property right now |
| Published versions                              | `v3.0.3-web`, `v3.1.0-web`, `v3.1.1-web`, `v3.1.2-web`, `v3.1.3-web`      | ✅ release.yml fires per `v*` tag                    |
| Cosign signatures                               | 5 `.sig` artifacts present (one per release)                              | ✅                                                   |
| Architectures                                   | `linux/amd64` only — single manifest, not a manifest-list                 | 🟡 ARM customers blocked                             |
| Latest-tag alias (`:latest`)                    | Absent                                                                    | 🟡 customers must look up the right tag manually     |
| SBOM / provenance attestation                   | Not produced by release.yml                                               | 🟡 supply-chain bonus, not a blocker                 |
| Reference in `docker-compose.reference-smb.yml` | `v3.0.3-web` (default)                                                    | 🟡 4 versions behind                                 |
| Reference in Platform Helm chart values         | `v3.1.2-web`                                                              | 🟡 1 version behind                                  |
| Reference in customer manuales                  | `v3.0.3-web`                                                              | 🟡 stale                                             |

## 2. Decisions

### D1 — Multi-arch (linux/amd64 + linux/arm64) is mandatory

Mac Mini M-series, ARM-on-AWS-Graviton, Raspberry Pi 5, and ARM-based Hetzner / OVH boxes are all realistic SMB self-host targets. `linux/amd64` only locks them out. The Web image is a static nginx-served bundle (no native code), so multi-arch is essentially free: `docker buildx build --platform linux/amd64,linux/arm64 --push ...`. The build minutes increase ~2x but tag a single manifest-list that delegates per-arch transparently.

**Why now:** every release going forward should be multi-arch. Retroactive: leave existing single-arch tags as-is (signature lineage), build v3.1.3-web going forward as multi-arch (re-issue under the same tag — the digest changes but customers verify by tag-key signature).

### D2 — Adopt a moving `:latest` alias on the registry

A `:latest` tag pointing at the most recent released `v*-web` aids "just-pull-and-go" onboarding while keeping signed tag-pinned references the canonical install. Customer-facing manuales should ALWAYS recommend the pinned tag (`v3.1.3-web` etc.) for reproducibility; `:latest` is for ad-hoc experimentation and never gets signed (cosign refuses to sign mutable tags by design — by extension our reference-smb compose / manuales never reference `:latest`).

**Implementation:** add a workflow step that re-tags the just-built manifest as `:latest` and pushes — no separate build.

### D3 — Skip SBOM / provenance for this round; track separately

SLSA provenance + SBOM publication via `docker/build-push-action`'s `provenance:` + `sbom:` inputs are useful but tangential to "ease of adoption". They go on a future supply-chain hardening plan. Don't bundle here.

### D4 — Document the install/verify flow in this repo's README

A short "Pull and run" section in `README.md` (or `docs/install.md`) showing:

```bash
# Verify signature (one-time install of cosign)
cosign verify --key https://verbara.io/keys/cosign.pub --insecure-ignore-tlog \
  ghcr.io/verbara/platform/web:v3.1.3-web

# Run (paired with a Platform API instance)
docker run -d --name verbara-web -p 8080:80 \
  ghcr.io/verbara/platform/web:v3.1.3-web
```

Plus a one-line link from `Verbara.Platform`'s SMB manuales pointing here for image-level details. Customers shouldn't have to navigate two repos to learn how to verify the Web image.

### D5 — Move the `cosign.pub` to a permanent verbara.io URL

Today customers fetch the public key via `cosign verify --key docker/cosign.pub` against a repo path that requires cloning. The customer-friendly form is `--key https://verbara.io/keys/cosign.pub`. Cosign supports raw URLs in `--key`. The verbara-website already hosts `/keys/cosign.pub` per the SMB manual edits last session. This plan locks that as the canonical reference in all Web-repo install docs.

## 3. Work breakdown (Web-repo only; consumer-side updates are sibling work)

### 3.1 — Workflow change: multi-arch build (`release.yml`)

Modify [`.github/workflows/release.yml`](../../../.github/workflows/release.yml):

```yaml
# Before (single-arch implied by docker/build-push-action default):
- name: Build and push (signed)
  uses: docker/build-push-action@v7
  with:
    push: true
    tags: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.tag.outputs.release_tag }}
    build-args: |
      VITE_DEFAULT_TENANT_ID=platform

# After (multi-arch):
- name: Build and push (signed, multi-arch)
  uses: docker/build-push-action@v7
  with:
    platforms: linux/amd64,linux/arm64
    push: true
    tags: |
      ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ steps.tag.outputs.release_tag }}
      ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
    build-args: |
      VITE_DEFAULT_TENANT_ID=platform
```

The `docker/setup-buildx-action@v4` step already in the workflow supports cross-arch via QEMU. The `platforms:` input toggles the buildx multi-arch path. Total CI cost: ~2x build time (~6 min → ~12 min for the build job).

`:latest` is signed by cosign too — confirm `cosign sign` accepts the comma-separated tag list OR sign by digest (preferred — single signature applies to all tag-references that resolve to the same manifest digest, which is how cosign signs by default since v2.0).

### 3.2 — Local test before merging the workflow change

1. Maintainer runs `docker buildx build --platform linux/amd64,linux/arm64 -t test-multi:dev .` locally on amd64 host (QEMU emulates arm64).
2. Confirms `docker buildx imagetools inspect test-multi:dev` shows both platforms in the manifest list.
3. Spot-check the arm64 binary by `docker run --rm --platform linux/arm64 test-multi:dev nginx -v` (qemu-static needed; document the prereq).

### 3.3 — README + docs/install.md (or equivalent) update

Add a top-of-README install snippet pointing at the public verify+pull flow. Cross-link to the Platform repo's SMB manuales for full deployment context.

### 3.4 — Cut a fresh v3.1.4-web release tag

First release after the multi-arch + :latest workflow change. No app-code changes — purely a publish-pipeline validation cut. Tag → workflow runs → registry holds:

- `ghcr.io/verbara/platform/web:v3.1.4-web` (multi-arch manifest-list, signed)
- `ghcr.io/verbara/platform/web:latest` (alias, multi-arch, signed by digest)

### 3.5 — Sibling Platform-repo PR (out of scope, tracked separately)

Once v3.1.4-web is live:

- `Verbara.Platform/docker/docker-compose.reference-smb.yml`: bump `PLATFORM_WEB_TAG:-v3.0.3-web` → `v3.1.4-web`
- `Verbara.Platform/infra/k8s/helm/platform/values.yaml`: bump `web.image.tag: "v3.1.2-web"` → `"v3.1.4-web"`
- `Verbara.Platform/docs/manuales/smb/02-arranque-stack.md` + `00-vision-general.md` + `07-validacion-e2e.md` + `checklist-validacion-cliente.md`: bump v3.0.3-web references → v3.1.4-web
- `Verbara.Platform/docs/manuales/smb/`: replace inline `docker/cosign.pub` cosign-verify examples with `--key https://verbara.io/keys/cosign.pub` to match D5.

These are mechanical sed-style edits + a single commit in the Platform repo. The plan there lives in `docs/research/2026-05-23-image-source-audit.md` follow-up item 5.

## 4. Acceptance criteria

- [ ] `release.yml` builds multi-arch (linux/amd64 + linux/arm64) for the next tag push.
- [ ] `release.yml` pushes both `:v*-web` and `:latest` tag references.
- [ ] cosign signature applies to the digest, verifiable for both architecture-specific image manifests via tag.
- [ ] v3.1.4-web (or whatever next tag the maintainer chooses) shipped via the new workflow.
- [ ] `docker buildx imagetools inspect ghcr.io/verbara/platform/web:v3.1.4-web` returns a manifest list with `linux/amd64` AND `linux/arm64` entries.
- [ ] `docker pull --platform linux/arm64 ghcr.io/verbara/platform/web:v3.1.4-web` succeeds anonymously on an ARM host (or via qemu emulation on amd64).
- [ ] README has the verify + pull snippet referencing `https://verbara.io/keys/cosign.pub`.
- [ ] Sibling Platform-repo PR opened (linking back to this plan) bumping all v3.0.3-web / v3.1.2-web references to v3.1.4-web.

## 5. Risks

| Risk                                                                                                                 | Mitigation                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QEMU emulation in GitHub runner adds 6+ min to release CI                                                            | Acceptable cost — release workflow runs only on `v*` tag pushes (1-2x/month). If it becomes painful, switch to native `linux/arm64` runner via GitHub's matrix runners (paid tier required for some accounts). |
| ARM64 nginx:alpine base image lags amd64 nginx:alpine                                                                | nginx maintains both archs in lockstep; no historical gap. Pin the base image (`nginx:1.27-alpine`) instead of moving `:alpine` if drift becomes a concern.                                                    |
| Customers verifying with the old (single-arch) sig might be confused by a manifest-list returning a different digest | The old tags stay frozen at their single-arch digests — only NEW tags (v3.1.4-web onward) get manifest-list digests. Document the cutover in CHANGELOG.                                                        |
| `:latest` mutable tag invites unintentional drift in customer deploys                                                | Manuales + reference-smb compose continue to pin specific tags. README explicitly labels `:latest` as ad-hoc / experimentation only.                                                                           |
| Multi-arch image size doubles on the registry (one layer per arch)                                                   | Web image is small (~50 MB single-arch); ~100 MB multi-arch is a non-issue at SMB customer counts.                                                                                                             |

## 6. Out of scope / tracked separately

- **SBOM / SLSA provenance attestations.** Future plan when supply-chain hardening rises in priority.
- **`api/realtime/renderer/mail` images.** Their visibility flip to public and any multi-arch decision live in the Platform repo (audit document item 1). Web going multi-arch sets the precedent; the API path likely follows but is complicated by Native AOT (a Native AOT build is per-arch by construction — each arch produces a different ELF binary; multi-arch publishing means two AOT-publish jobs).
- **NPM package publishing.** Different artifact (the React component library) — different plan. Was earlier noted in roadmap as "Future work tracked separately".
- **CDN-served standalone Web bundle.** Customers who don't want to run nginx — also different plan.

## 7. Decision points for the maintainer

1. Run the v3.1.4-web release as the first multi-arch validation tag, OR push v3.1.4-web as a tag-only patch (CHANGELOG mention of multi-arch) and let the next regular release be the first one customers consume multi-arch?
2. Adopt `:latest` mutable alias now, or wait until customer feedback indicates it's needed?
3. Move the SMB manuales' `--key docker/cosign.pub` examples to `--key https://verbara.io/keys/cosign.pub` in lockstep with this Web plan, or as a separate Platform-repo PR?
