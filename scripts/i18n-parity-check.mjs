#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, '..', 'public', 'locales');

const BASELINE = 'es-419';
const LOCALES = ['es-419', 'en-US', 'pt-BR'];
const NAMESPACES = ['common', 'admin', 'agent', 'analytics', 'operations', 'webchat'];

function flatten(obj, prefix = '') {
  if (obj === null || typeof obj !== 'object') return new Set([prefix]);
  if (Array.isArray(obj)) return new Set([prefix]);
  const keys = new Set();
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    for (const flat of flatten(v, next)) keys.add(flat);
  }
  return keys;
}

function loadNamespace(locale, ns) {
  const path = join(localesDir, locale, `${ns}.json`);
  return JSON.parse(readFileSync(path, 'utf-8'));
}

let totalDrift = 0;
const report = [];

for (const ns of NAMESPACES) {
  const baselineKeys = flatten(loadNamespace(BASELINE, ns));
  for (const locale of LOCALES) {
    if (locale === BASELINE) continue;
    const localeKeys = flatten(loadNamespace(locale, ns));
    const missing = [...baselineKeys].filter((k) => !localeKeys.has(k));
    const extra = [...localeKeys].filter((k) => !baselineKeys.has(k));
    if (missing.length > 0 || extra.length > 0) {
      totalDrift += missing.length + extra.length;
      report.push({ ns, locale, missing, extra });
    }
  }
}

if (totalDrift === 0) {
  console.log(
    `i18n parity OK across ${LOCALES.length} locales × ${NAMESPACES.length} namespaces (baseline: ${BASELINE})`,
  );
  process.exit(0);
}

console.error(`i18n parity FAILED — ${totalDrift} key(s) diverge from baseline ${BASELINE}\n`);
for (const { ns, locale, missing, extra } of report) {
  console.error(`--- ${ns} (${BASELINE} vs ${locale}) ---`);
  if (missing.length > 0) {
    console.error(`  MISSING in ${locale} (${missing.length}):`);
    for (const k of missing.sort()) console.error(`    - ${k}`);
  }
  if (extra.length > 0) {
    console.error(`  EXTRA in ${locale} (${extra.length}):`);
    for (const k of extra.sort()) console.error(`    + ${k}`);
  }
}
process.exit(1);
