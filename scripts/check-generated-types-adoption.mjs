#!/usr/bin/env node
/**
 * ADR-0012 Ola 2 gate #5 — generated-types adoption ratchet (verbara-meta).
 *
 * The swap-the-T recipe (Platform/ADR-0035) generates typed OpenAPI DTOs into
 * src/core/api/generated/openapi.d.ts. A hand-written interface that duplicates a
 * schema the generated types already capture can silently drift from the server
 * contract. This gate stops the drift from GROWING: every API hook must import the
 * generated types (`@/core/api/generated`); the not-yet-migrated hooks are frozen
 * as a baseline that can only SHRINK.
 *
 * Adoption is proxied by "does the hook import the generated module" — coarser than
 * per-interface matching but deterministic and non-fragile, and it is exactly the
 * "track the 45 unmigrated hooks as the floor" the ADR calls for. Gaming it with an
 * unused `import type { components }` fails the ESLint no-unused-vars gate, so the
 * two gates compose.
 *
 * Three hard-fail conditions, all keeping the baseline an honest, monotonically
 * shrinking floor:
 *   1. a hook is unadopted AND not in the baseline  -> a NEW hand-maintained DTO;
 *   2. a baselined hook now imports the generated types -> ratchet DOWN, trim it;
 *   3. a baselined path no longer exists (renamed/deleted) -> stale, fix it.
 *
 * Exit 0 = pass, 1 = at least one violation. Run from the repo root:
 *   node scripts/check-generated-types-adoption.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const HOOKS_DIR = 'src/core/api/hooks';
const GENERATED_IMPORT = '@/core/api/generated';
const BASELINE_FILE = 'generated-types-adoption-baseline.json';

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const toPosix = (p) => p.split(sep).join('/');
const isHookFile = (rel) => /\.(ts|tsx)$/.test(rel) && !/\.test\.(ts|tsx)$/.test(rel);
const fail = (msg) => console.error(`::error::generated-types-adoption: ${msg}`);

const baselineDoc = JSON.parse(readFileSync(join(ROOT, BASELINE_FILE), 'utf8'));
const baseline = new Set(baselineDoc.unadopted_hooks);

const hookFiles = walk(join(ROOT, HOOKS_DIR))
  .map((f) => toPosix(relative(ROOT, f)))
  .filter(isHookFile)
  .sort();

const unadopted = new Set(
  hookFiles.filter((rel) => !readFileSync(join(ROOT, rel), 'utf8').includes(GENERATED_IMPORT)),
);

let failed = false;

// 1) New unmigrated hooks: unadopted AND not baselined.
const newUnadopted = [...unadopted].filter((h) => !baseline.has(h));
if (newUnadopted.length) {
  failed = true;
  fail(
    `${newUnadopted.length} new hook(s) hand-maintain DTOs without importing the ` +
      `generated OpenAPI types (${GENERATED_IMPORT}). Use the generated 'components' ` +
      `schema instead of hand-writing the interface:`,
  );
  for (const h of newUnadopted) console.error(`  ${h}`);
}

// 2) Baselined hooks that now adopt the generated types: ratchet DOWN, trim baseline.
const nowAdopted = [...baseline].filter((h) => hookFiles.includes(h) && !unadopted.has(h));
if (nowAdopted.length) {
  failed = true;
  fail(
    `${nowAdopted.length} hook(s) now import the generated types but are still listed ` +
      `in ${BASELINE_FILE}. Remove them (ratchet the floor DOWN):`,
  );
  for (const h of nowAdopted) console.error(`  ${h}`);
}

// 3) Stale baseline entries: file no longer exists.
const stale = [...baseline].filter((h) => !existsSync(join(ROOT, h)));
if (stale.length) {
  failed = true;
  fail(
    `${stale.length} baseline entr(y/ies) reference a file that no longer exists ` +
      `(renamed/deleted). Update ${BASELINE_FILE}:`,
  );
  for (const h of stale) console.error(`  ${h}`);
}

const adopted = hookFiles.length - unadopted.size;
console.log(
  `Generated-types adoption: ${adopted}/${hookFiles.length} hooks adopted, ` +
    `${unadopted.size} unadopted (floor ${baseline.size}).`,
);
if (!failed) console.log('Generated-types adoption ratchet OK.');
process.exit(failed ? 1 : 0);
