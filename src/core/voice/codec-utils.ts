import { CODEC_CATALOG } from './codec-catalog';

export function parseCodecs(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export function serializeCodecs(tokens: readonly string[]): string {
  return tokens.join(',');
}

export interface CodecGuardrail {
  readonly kind: 'empty' | 'no-g711' | 'duplicate' | 'not-installed';
  readonly token?: string;
}

export function computeGuardrails(
  selected: readonly string[],
  installed: readonly string[] | null,
): CodecGuardrail[] {
  if (selected.length === 0) return [{ kind: 'empty' }];

  const out: CodecGuardrail[] = [];
  if (!selected.includes('ulaw') && !selected.includes('alaw')) out.push({ kind: 'no-g711' });

  const seen = new Set<string>();
  for (const token of selected) {
    if (seen.has(token)) out.push({ kind: 'duplicate', token });
    seen.add(token);
  }

  if (installed) {
    const installedSet = new Set(installed);
    for (const token of selected) {
      if (!installedSet.has(token)) out.push({ kind: 'not-installed', token });
    }
  }

  return out;
}

export interface CatalogEntry {
  readonly token: string;
  /** True when the token exists in CODEC_CATALOG (so it has a friendly name + badges). */
  readonly known: boolean;
  /** True when the server reports it installed, or when there is no server data. */
  readonly installed: boolean;
}

/**
 * Codecs offered in the "add" panel: curated catalog (or full catalog when showAll),
 * unioned with any installed-but-unknown server tokens, minus already-selected.
 * When the server list is known, catalog codecs the server lacks are hidden in the default
 * view and shown (disabled) only under showAll.
 */
export function availableToAdd(
  selected: readonly string[],
  installed: readonly string[] | null,
  showAll: boolean,
): CatalogEntry[] {
  const selectedSet = new Set(selected);
  const installedSet = installed ? new Set(installed) : null;

  const tokens = new Set<string>();
  for (const meta of Object.values(CODEC_CATALOG)) {
    if (showAll || meta.curated) tokens.add(meta.token);
  }
  if (installed) for (const token of installed) tokens.add(token);

  const entries: CatalogEntry[] = [];
  for (const token of tokens) {
    if (selectedSet.has(token)) continue;
    const isInstalled = installedSet ? installedSet.has(token) : true;
    if (!showAll && installedSet && !isInstalled) continue; // hide server-lacking catalog codecs in default view
    entries.push({ token, known: token in CODEC_CATALOG, installed: isInstalled });
  }
  return entries;
}
