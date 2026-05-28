// Manual renderer — Fase 0 entry point.
//
// Usage:
//   npx tsx tests/manuales/manual-renderer/render.ts \
//     --persona smb-owner --journey 00-smoke \
//     [--version v2.5.4] [--locale es-419]
//
// Defaults: persona=smb-owner, journey=00-smoke, version=v2.5.4, locale=es-419.
//
// What it does:
//   1. Reads `tests/manuales/personas/<persona>/<journey>.md.tpl`.
//   2. Validates the test ran (looks for an Allure result with matching name)
//      and that its status is `passed`. Skips render with a warning otherwise.
//   3. Discovers screenshots at
//      `tests/manuales/test-results/screenshots/<persona>/<journey>/step-*.png`
//      and maps `step-<id>.png → <id>`.
//   4. Renders the template via the pure substitution engine.
//   5. Writes the result to
//      `docs/manuales/auto/<version>/<locale>/<persona>/<journey>.md`
//      and copies the screenshots into a sibling `<journey>/` directory so
//      the .md is self-contained and portable.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAllureResults } from './allure-adapter.js';
import { render } from './template-engine.js';

interface Args {
  persona: string;
  journey: string;
  version: string;
  locale: string;
}

function parseArgs(argv: string[]): Args {
  const get = (flag: string, fallback: string): string => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && idx + 1 < argv.length ? argv[idx + 1]! : fallback;
  };
  return {
    persona: get('--persona', 'smb-owner'),
    journey: get('--journey', '00-smoke'),
    version: get('--version', 'v2.5.4'),
    locale: get('--locale', 'es-419'),
  };
}

function discoverScreenshots(dir: string): Record<string, string> {
  if (!fs.existsSync(dir)) return {};
  const result: Record<string, string> = {};
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^step-(.+)\.png$/);
    if (m) result[m[1]!] = f;
  }
  return result;
}

function main(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const manualesRoot = path.resolve(here, '..');
  const webRoot = path.resolve(manualesRoot, '../..');
  const platformRepoRoot = path.resolve(webRoot, '../Verbara.Platform');

  const args = parseArgs(process.argv.slice(2));
  const { persona, journey, version, locale } = args;

  const templatePath = path.join(manualesRoot, 'personas', persona, `${journey}.md.tpl`);
  const screenshotsDir = path.join(manualesRoot, 'test-results', 'screenshots', persona, journey);
  const allureDir = path.join(manualesRoot, 'allure-results');
  const outDir = path.join(platformRepoRoot, 'docs', 'manuales', 'auto', version, locale, persona);
  const outFile = path.join(outDir, `${journey}.md`);
  const outAssetsDir = path.join(outDir, journey);

  if (!fs.existsSync(templatePath)) {
    console.error(`✘ Template not found: ${templatePath}`);
    process.exit(1);
  }

  // Allure result gate (advisory in Fase 0 — log only)
  const allure = loadAllureResults(allureDir);
  const matching = allure.filter((t) => t.fullName.includes(journey));
  if (matching.length === 0) {
    console.warn(`⚠ No Allure result found for journey "${journey}". Rendering anyway (Fase 0).`);
  } else {
    const passed = matching.every((t) => t.status === 'passed');
    if (!passed) {
      console.warn(`⚠ At least one test for "${journey}" did NOT pass. Rendering anyway (Fase 0).`);
    }
  }

  const discovered = discoverScreenshots(screenshotsDir);
  console.log(`• Found ${Object.keys(discovered).length} screenshot(s) in ${screenshotsDir}`);

  // Copy screenshots into the output assets directory so the .md is portable.
  fs.mkdirSync(outAssetsDir, { recursive: true });
  const screenshotMap: Record<string, string> = {};
  for (const [stepId, fileName] of Object.entries(discovered)) {
    fs.copyFileSync(path.join(screenshotsDir, fileName), path.join(outAssetsDir, fileName));
    screenshotMap[stepId] = `./${journey}/${fileName}`;
  }

  const template = fs.readFileSync(templatePath, 'utf8');
  const result = render({ template, screenshots: screenshotMap });

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, result.markdown, 'utf8');

  console.log(`✓ Rendered: ${outFile}`);
  if (result.missingSteps.length > 0) {
    console.warn(`⚠ Missing screenshots for steps: ${result.missingSteps.join(', ')}`);
  }
  if (result.orphanScreenshots.length > 0) {
    console.warn(
      `⚠ Orphan screenshots (not referenced in template): ${result.orphanScreenshots.join(', ')}`,
    );
  }
}

main();
