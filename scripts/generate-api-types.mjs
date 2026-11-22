#!/usr/bin/env node
/**
 * Generates `src/core/api/generated/openapi.d.ts` from Platform's exported
 * OpenAPI document via `openapi-typescript` (change: openapi-typed-client).
 *
 * Source resolution (first match wins):
 *   1. First positional CLI arg — an explicit path or URL to the OpenAPI document.
 *   2. `OPENAPI_DOCUMENT_URL` / `OPENAPI_DOCUMENT_PATH` env var — for CI, where
 *      the Platform host child publishes the document as a build artifact
 *      (`openapi-document-${{ github.sha }}`).
 *   3. Local dev default — the running Platform host's `/openapi/v1.json`,
 *      matching `vite.config.ts`'s dev proxy target.
 *
 * Output: the committed path below, or `--out <path>` (the freshness check writes
 * to a temp directory and never into `src/`). Either way the output is formatted
 * with this repo's prettier configuration, resolved from the repository and never
 * from the output location, so the script alone produces the committed bytes
 * (change: generated-types-follow-platform-main).
 *
 * This is a committed-generated-file workflow (design.md decision): the output
 * is checked into the repo and refreshed on demand, not fetched at CI build
 * time. `npm run build`'s `tsc -b` gates the committed file against its
 * consumers; this script only regenerates it.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import openapiTS, { astToString } from 'openapi-typescript';
import * as prettier from 'prettier';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'src', 'core', 'api', 'generated', 'openapi.d.ts');
const DEFAULT_DEV_SOURCE = 'http://localhost:5000/openapi/v1.json';

const HEADER = `/**
 * GENERATED FILE — do not hand-edit.
 *
 * Produced by \`npm run generate:api-types\` (openapi-typescript) from
 * Platform's exported OpenAPI document. Regenerate after any Platform API
 * change. The file is committed on purpose (not fetched in CI) so builds are
 * reproducible from the repository alone.
 */
`;

/** Splits argv into the positional source and the optional `--out <path>`. */
function parseArgs(argv) {
  let source;
  let out;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--out') {
      out = argv[++i];
      if (!out) throw new Error('--out needs a path');
    } else if (arg.startsWith('--out=')) {
      out = arg.slice('--out='.length);
    } else if (source === undefined) {
      source = arg;
    } else {
      throw new Error(`unexpected argument: ${arg}`);
    }
  }
  return { source, out };
}

async function format(contents) {
  // Resolve from the committed path, inside the checkout: prettier searches from the
  // given file's directory, so resolving from a temp `--out` would find no config and
  // silently format with prettier's defaults.
  const options = await prettier.resolveConfig(OUTPUT_PATH, { editorconfig: true });
  if (options === null) {
    throw new Error(`no prettier configuration found for ${OUTPUT_PATH}`);
  }
  return prettier.format(contents, { ...options, filepath: OUTPUT_PATH });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const source =
    args.source ??
    process.env.OPENAPI_DOCUMENT_URL ??
    process.env.OPENAPI_DOCUMENT_PATH ??
    DEFAULT_DEV_SOURCE;
  const outputPath = args.out ? resolve(process.cwd(), args.out) : OUTPUT_PATH;

  console.log(`Generating API types from: ${source}`);

  const ast = await openapiTS(
    source.startsWith('http://') || source.startsWith('https://')
      ? new URL(source)
      : new URL(source, `file://${process.cwd()}/`),
  );
  const contents = await format(HEADER + astToString(ast));

  const { writeFile, mkdir } = await import('node:fs/promises');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, contents, 'utf-8');

  console.log(`Wrote ${outputPath}`);
}

main().catch((err) => {
  console.error('Failed to generate API types:', err);
  process.exitCode = 1;
});
