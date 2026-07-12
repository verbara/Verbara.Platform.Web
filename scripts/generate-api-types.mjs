#!/usr/bin/env node
/**
 * Generates `src/core/api/generated/openapi.d.ts` from Platform's exported
 * OpenAPI document via `openapi-typescript` (change: openapi-typed-client).
 *
 * Source resolution (first match wins):
 *   1. First CLI arg — an explicit path or URL to the OpenAPI document.
 *   2. `OPENAPI_DOCUMENT_URL` / `OPENAPI_DOCUMENT_PATH` env var — for CI, where
 *      the Platform host child publishes the document as a build artifact
 *      (`openapi-document-${{ github.sha }}`).
 *   3. Local dev default — the running Platform host's `/openapi/v1.json`,
 *      matching `vite.config.ts`'s dev proxy target.
 *
 * This is a committed-generated-file workflow (design.md decision): the output
 * is checked into the repo and refreshed on demand, not fetched at CI build
 * time. `npm run build`'s `tsc -b` gates the committed file against its
 * consumers; this script only regenerates it.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import openapiTS, { astToString } from 'openapi-typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, '..', 'src', 'core', 'api', 'generated', 'openapi.d.ts');
const DEFAULT_DEV_SOURCE = 'http://localhost:5000/openapi/v1.json';

const HEADER = `/**
 * GENERATED FILE — do not hand-edit.
 *
 * Produced by \`npm run generate:api-types\` (openapi-typescript) from
 * Platform's exported OpenAPI document. Regenerate after any Platform API
 * change; see openspec/changes/openapi-typed-client/ for the mechanism and
 * design.md for the committed-file-not-CI-fetch decision.
 */
`;

async function main() {
  const source =
    process.argv[2] ??
    process.env.OPENAPI_DOCUMENT_URL ??
    process.env.OPENAPI_DOCUMENT_PATH ??
    DEFAULT_DEV_SOURCE;

  console.log(`Generating API types from: ${source}`);

  const ast = await openapiTS(
    source.startsWith('http://') || source.startsWith('https://')
      ? new URL(source)
      : new URL(source, `file://${process.cwd()}/`),
  );
  const contents = astToString(ast);

  const { writeFile, mkdir } = await import('node:fs/promises');
  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, HEADER + contents, 'utf-8');

  console.log(`Wrote ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('Failed to generate API types:', err);
  process.exitCode = 1;
});
