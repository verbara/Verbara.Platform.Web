// Allure adapter — Fase 0 minimal implementation.
//
// allure-playwright writes one `<uuid>-result.json` file per test execution
// to `allure-results/`. Each file describes the test's steps, status, and
// any attachments. For Fase 0 the renderer only needs to know "did this
// test pass, and what steps did it execute?" so we extract a tiny surface.
//
// Why we use Allure at all if our screenshots are written by hand to a
// deterministic path: because Allure is the stable contract layer between
// "Playwright captured X" and "renderer knows X exists". When Fase 1
// introduces real journeys, we can rely on Allure step status to decide
// whether a journey should be rendered at all (failed tests don't produce
// manuals). The screenshot capture path stays deterministic for simplicity;
// only the discovery + validation lives in Allure.

import * as fs from 'node:fs';
import * as path from 'node:path';

export interface AllureStep {
  name: string;
  status: 'passed' | 'failed' | 'broken' | 'skipped' | 'unknown';
}

export interface AllureTestResult {
  uuid: string;
  fullName: string;
  status: AllureStep['status'];
  steps: AllureStep[];
}

interface RawAllureStep {
  name?: string;
  status?: string;
}

interface RawAllureResult {
  uuid?: string;
  fullName?: string;
  status?: string;
  steps?: RawAllureStep[];
}

function normalizeStatus(raw: string | undefined): AllureStep['status'] {
  switch (raw) {
    case 'passed':
    case 'failed':
    case 'broken':
    case 'skipped':
      return raw;
    default:
      return 'unknown';
  }
}

export function loadAllureResults(allureDir: string): AllureTestResult[] {
  if (!fs.existsSync(allureDir)) {
    return [];
  }
  const files = fs.readdirSync(allureDir).filter((f) => f.endsWith('-result.json'));

  return files.map((file) => {
    const raw: RawAllureResult = JSON.parse(fs.readFileSync(path.join(allureDir, file), 'utf8'));
    return {
      uuid: raw.uuid ?? '',
      fullName: raw.fullName ?? '',
      status: normalizeStatus(raw.status),
      steps: (raw.steps ?? []).map((s) => ({
        name: s.name ?? '',
        status: normalizeStatus(s.status),
      })),
    };
  });
}
