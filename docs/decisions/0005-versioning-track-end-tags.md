# ADR-0005: Track-end versioning — patches without tags, only track closure tagged

- **Status:** Accepted
- **Date:** 2026-05-03
- **Deciders:** Platform.Web maintainer
- **Related:** v1.13.x i18n closure (commits `da625ed`..`ad0cd93`, single tag `v1.13.37-web`)

## Context

The Web repo follows semver-like versioning with a `-web` suffix on tags (e.g. `v1.13.0-web`). The historical pattern was: tag every minor (`v1.10.0-web`, `v1.11.0-web`, `v1.12.0-web`, `v1.13.0-web`), with patch versions left untagged.

The v1.13.x i18n track shipped 37 patches over ~5 days (1.13.1 through 1.13.37). Tagging every patch (37 tags + 37 GitHub releases) would have been overhead with little value — patches inside a single track represent one coherent piece of work whose narrative is in the track plan, not in individual tags. Tagging only the final patch (`v1.13.37-web`) gave one release that summarized the whole track.

Without an explicit policy, future tracks risk inconsistency: some maintainers might tag every patch, others none, others only the minor. The policy needs to be written down.

## Decision

**Tag only at track closure.** Specifically:

- Patches inside a track ship as commits + version bump in `package.json`, but **without** git tags or GitHub releases.
- The **final patch** of a track receives:
  1. An annotated git tag (`git tag -a v<version>-web -m "<track summary>"`)
  2. A GitHub release (`gh release create v<version>-web --title "..." --notes "..."`) with notes summarizing all patches in the track.
- Minors (`v1.X.0-web`) typically coincide with the start of a new track, so they receive the same treatment as any other patch — taggable only when the track containing them closes.

The track plan in `docs/plans/active/` is the source of truth for "what was the track." When the track closes:
1. The plan moves to `docs/plans/completed/` via `git mv`.
2. The closure commit gets the version bump.
3. The annotated tag references the plan file in its message body.
4. The GitHub release notes summarize the ships in the track.

If a track is abandoned mid-flight (rare), the patches remain in history without a tag, and the plan moves to `docs/plans/archived/`.

## Consequences

**Positive:**
- Tags and releases align with conceptual milestones (a track's worth of work), not arbitrary bumps.
- Release notes can summarize a coherent narrative (5 phases of i18n closure) instead of 37 single-bullet notes.
- No tag-pollution: `git tag --list` stays readable.
- Customer-facing release notes are higher signal — each release answers "what changed and why."

**Negative:**
- A patch shipped mid-track is harder to reference externally (no tag; only the SHA). Mitigation: track plan + commit message provide context; SHA is referenceable forever.
- If a critical hotfix is shipped between track patches, it gets no immediate tag. Mitigation: emergency hotfixes can break the rule and tag immediately — document the exception in the release notes.

**Trade-off:**
- This favors readability of release history over fine-grained traceability. Customers and SREs reading releases get a clearer story; engineers debugging an exact patch may need to read commit history. Acceptable.

## Alternatives considered

- **Tag every patch.** Rejected. 37 tags for one i18n track would dilute signal. Release notes would be repetitive ("Phase 4M-2a", "Phase 4M-2b", ...). External readers would not benefit.
- **Tag every minor only (the previous default).** Rejected after v1.13.x. The i18n track was internally a "minor's worth" of work but conceptually a closed unit, and the version bumped from 1.13.32 to 1.13.37 — staying in a patch range. Strict "minors only" policy would have meant **zero tags for ~5 days of work**. The track-end policy gets us a tag for the milestone without forcing artificial minor bumps.
- **Tag every commit on main** (continuous-delivery pattern). Out of scope. The repo does not have automatic deploy; tags are for human navigation, not deploy triggers.
