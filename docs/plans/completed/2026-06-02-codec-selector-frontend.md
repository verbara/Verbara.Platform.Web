# Codec Selector — Frontend Implementation Plan (`Verbara.Platform.Web`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Repo for ALL tasks below:** `/media/Data/Source/Verbara/Verbara.Platform.Web`. This is the frontend half of the cross-cutting codec-selector track; the backend half (the `/admin/voice/codecs` endpoint) is in `2026-06-02-codec-selector-backend.md`. **This half can be built and tested before the backend ships** — `useVoiceCodecs()` degrades to a fallback automatically, so all component tests mock the hook.

**Goal:** Replace the three free-text codec inputs (trunk wizard, trunk edit form, realtime endpoint profile) with one reusable `<CodecSelector>` — presets + drag/keyboard-orderable selected list + friendly labels & badges + grouped searchable add-catalog + progressive disclosure + custom-token escape hatch + guardrails — fed by the server-driven codec catalog.

**Architecture:** Pure data/logic (`codec-catalog.ts`, `codec-utils.ts`) is split from the React component (`codec-selector.tsx`) so the logic is unit-tested in isolation. The component is fully controlled: it reads a comma-separated `string`, derives an ordered `string[]`, and emits a new comma string on every change — so the existing API contract (`codecs: string`) is untouched and the three forms only swap one field. The installed-codec list comes from `useVoiceCodecs()`; when unavailable the component degrades to the curated catalog.

**Tech Stack:** React 19, TypeScript 6 strict, TanStack Query 5, `@base-ui/react` (render-prop, NOT Radix), `@dnd-kit` core 6.3 / sortable 10.0, i18next 26 (3 locales, CI parity gate), Vitest 4, Lucide icons.

**Spec:** [`docs/specs/2026-06-02-codec-selector-server-driven-design.md`](../../specs/2026-06-02-codec-selector-server-driven-design.md).

**Reference patterns (read first):**

- `src/admin/routes/routes-page.tsx` — the established `@dnd-kit` sortable-list pattern (`DndContext` + `SortableContext` + `useSortable` + `arrayMove` + grip handle).
- `src/core/api/hooks/use-trunks.ts` — hook + `customFetch` pattern.
- `src/core/ui/select.tsx`, `button.tsx`, `input.tsx`, `badge.tsx`, `label.tsx` — base-ui primitives (Combobox and Collapsible do NOT exist — build search with `Input` + filtered list, and "advanced" with `useState`).
- `src/admin/trunks/trunk-form.test.tsx` — the Vitest pattern (mock hooks + i18n before import; `data-testid` selectors).

---

## Task 1: `codec-catalog.ts` — presentation metadata + presets

**Files:**

- Create: `src/core/voice/codec-catalog.ts`
- Test: `src/core/voice/codec-catalog.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/voice/codec-catalog.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CODEC_CATALOG, CODEC_TIERS, CODEC_PRESETS } from './codec-catalog';

describe('codec-catalog', () => {
  it('CODEC_CATALOG_ShouldKeyEachEntryByItsOwnToken', () => {
    for (const [key, meta] of Object.entries(CODEC_CATALOG)) {
      expect(meta.token).toBe(key);
    }
  });

  it('CODEC_CATALOG_ShouldMarkCommonCodecsCurated', () => {
    for (const token of ['ulaw', 'alaw', 'g722', 'opus', 'g729', 'gsm', 'ilbc', 'vp8', 'h264']) {
      expect(CODEC_CATALOG[token]?.curated).toBe(true);
    }
  });

  it('CODEC_CATALOG_ShouldFlagBadges', () => {
    expect(CODEC_CATALOG.opus?.webrtc).toBe(true);
    expect(CODEC_CATALOG.opus?.needsModule).toBe(true);
    expect(CODEC_CATALOG.g729?.needsLicense).toBe(true);
  });

  it('CODEC_PRESETS_ShouldOnlyReferenceCatalogTokens', () => {
    for (const tokens of Object.values(CODEC_PRESETS)) {
      for (const token of tokens) expect(CODEC_CATALOG[token]).toBeDefined();
    }
  });

  it('CODEC_TIERS_ShouldCoverEveryCatalogTier', () => {
    for (const meta of Object.values(CODEC_CATALOG)) {
      expect(CODEC_TIERS).toContain(meta.tier);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/core/voice/codec-catalog.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/core/voice/codec-catalog.ts`:

```ts
export type CodecTier = 'standard' | 'hd' | 'lowband' | 'legacy' | 'video';

export interface CodecMeta {
  /** Exact PJSIP allow= token — load-bearing, never translated. */
  readonly token: string;
  /** i18n key (namespace 'common') for the friendly name, under voice.codecs.names.*. */
  readonly nameKey: string;
  readonly tier: CodecTier;
  /** Shown in the default picker; non-curated codecs live behind "show all". */
  readonly curated: boolean;
  readonly webrtc?: boolean;
  readonly needsLicense?: boolean;
  readonly needsModule?: boolean;
}

export const CODEC_TIERS: readonly CodecTier[] = ['standard', 'hd', 'lowband', 'legacy', 'video'];

export const CODEC_CATALOG: Readonly<Record<string, CodecMeta>> = {
  ulaw: { token: 'ulaw', nameKey: 'voice.codecs.names.ulaw', tier: 'standard', curated: true },
  alaw: { token: 'alaw', nameKey: 'voice.codecs.names.alaw', tier: 'standard', curated: true },
  g722: { token: 'g722', nameKey: 'voice.codecs.names.g722', tier: 'hd', curated: true },
  opus: {
    token: 'opus',
    nameKey: 'voice.codecs.names.opus',
    tier: 'hd',
    curated: true,
    webrtc: true,
    needsModule: true,
  },
  g729: {
    token: 'g729',
    nameKey: 'voice.codecs.names.g729',
    tier: 'lowband',
    curated: true,
    needsLicense: true,
  },
  gsm: { token: 'gsm', nameKey: 'voice.codecs.names.gsm', tier: 'lowband', curated: true },
  ilbc: { token: 'ilbc', nameKey: 'voice.codecs.names.ilbc', tier: 'lowband', curated: true },
  g726: { token: 'g726', nameKey: 'voice.codecs.names.g726', tier: 'lowband', curated: false },
  g726aal2: {
    token: 'g726aal2',
    nameKey: 'voice.codecs.names.g726aal2',
    tier: 'lowband',
    curated: false,
  },
  adpcm: { token: 'adpcm', nameKey: 'voice.codecs.names.adpcm', tier: 'legacy', curated: false },
  speex: { token: 'speex', nameKey: 'voice.codecs.names.speex', tier: 'lowband', curated: false },
  speex16: { token: 'speex16', nameKey: 'voice.codecs.names.speex16', tier: 'hd', curated: false },
  siren7: { token: 'siren7', nameKey: 'voice.codecs.names.siren7', tier: 'hd', curated: false },
  siren14: { token: 'siren14', nameKey: 'voice.codecs.names.siren14', tier: 'hd', curated: false },
  g719: { token: 'g719', nameKey: 'voice.codecs.names.g719', tier: 'hd', curated: false },
  g723: { token: 'g723', nameKey: 'voice.codecs.names.g723', tier: 'lowband', curated: false },
  lpc10: { token: 'lpc10', nameKey: 'voice.codecs.names.lpc10', tier: 'legacy', curated: false },
  silk: {
    token: 'silk',
    nameKey: 'voice.codecs.names.silk',
    tier: 'hd',
    curated: false,
    needsModule: true,
  },
  vp8: {
    token: 'vp8',
    nameKey: 'voice.codecs.names.vp8',
    tier: 'video',
    curated: true,
    webrtc: true,
  },
  vp9: {
    token: 'vp9',
    nameKey: 'voice.codecs.names.vp9',
    tier: 'video',
    curated: false,
    webrtc: true,
  },
  h264: {
    token: 'h264',
    nameKey: 'voice.codecs.names.h264',
    tier: 'video',
    curated: true,
    webrtc: true,
  },
  h263p: { token: 'h263p', nameKey: 'voice.codecs.names.h263p', tier: 'video', curated: false },
  h263: { token: 'h263', nameKey: 'voice.codecs.names.h263', tier: 'video', curated: false },
  h261: { token: 'h261', nameKey: 'voice.codecs.names.h261', tier: 'video', curated: false },
  mpeg4: { token: 'mpeg4', nameKey: 'voice.codecs.names.mpeg4', tier: 'video', curated: false },
};

/** Preset key → ordered token list (order = negotiation preference). 'custom' = no preset applied. */
export const CODEC_PRESETS: Readonly<Record<string, readonly string[]>> = {
  recommended: ['ulaw', 'alaw', 'g722'],
  hd: ['opus', 'g722', 'ulaw', 'alaw'],
  lowband: ['g729', 'ulaw', 'alaw'],
  webrtc: ['opus', 'ulaw', 'alaw', 'vp8', 'h264'],
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/core/voice/codec-catalog.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/voice/codec-catalog.ts src/core/voice/codec-catalog.test.ts
git commit -m "feat(voice): add codec catalog metadata + presets"
```

---

## Task 2: `codec-utils.ts` — parse/serialize/reconcile/guardrails (pure logic)

**Files:**

- Create: `src/core/voice/codec-utils.ts`
- Test: `src/core/voice/codec-utils.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/voice/codec-utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseCodecs, serializeCodecs, computeGuardrails, availableToAdd } from './codec-utils';

describe('codec-utils', () => {
  it('parseCodecs_ShouldSplitTrimLowercase', () => {
    expect(parseCodecs(' ULAW , Alaw ,g722 ')).toEqual(['ulaw', 'alaw', 'g722']);
  });

  it('parseCodecs_ShouldReturnEmpty_WhenNullOrBlank', () => {
    expect(parseCodecs(null)).toEqual([]);
    expect(parseCodecs('')).toEqual([]);
  });

  it('serializeCodecs_ShouldJoinWithCommas', () => {
    expect(serializeCodecs(['opus', 'ulaw'])).toBe('opus,ulaw');
  });

  it('computeGuardrails_ShouldFlagEmpty', () => {
    expect(computeGuardrails([], ['ulaw'])).toEqual([{ kind: 'empty' }]);
  });

  it('computeGuardrails_ShouldFlagMissingG711', () => {
    expect(computeGuardrails(['opus'], null)).toContainEqual({ kind: 'no-g711' });
  });

  it('computeGuardrails_ShouldNotFlagG711_WhenUlawPresent', () => {
    expect(computeGuardrails(['ulaw', 'opus'], null)).not.toContainEqual({ kind: 'no-g711' });
  });

  it('computeGuardrails_ShouldFlagDuplicate', () => {
    expect(computeGuardrails(['ulaw', 'ulaw'], null)).toContainEqual({
      kind: 'duplicate',
      token: 'ulaw',
    });
  });

  it('computeGuardrails_ShouldFlagNotInstalled_WhenServerListPresent', () => {
    expect(computeGuardrails(['ulaw', 'opus'], ['ulaw'])).toContainEqual({
      kind: 'not-installed',
      token: 'opus',
    });
  });

  it('availableToAdd_ShouldExcludeSelected', () => {
    const entries = availableToAdd(['ulaw'], null, false);
    expect(entries.find((e) => e.token === 'ulaw')).toBeUndefined();
    expect(entries.find((e) => e.token === 'alaw')).toBeDefined();
  });

  it('availableToAdd_ShouldHideNonCuratedUntilShowAll', () => {
    expect(availableToAdd([], null, false).find((e) => e.token === 'speex')).toBeUndefined();
    expect(availableToAdd([], null, true).find((e) => e.token === 'speex')).toBeDefined();
  });

  it('availableToAdd_ShouldHideCatalogCodecServerLacks_WhenNotShowAll', () => {
    // installed list given, g722 NOT installed → hidden in default view
    expect(
      availableToAdd([], ['ulaw', 'alaw'], false).find((e) => e.token === 'g722'),
    ).toBeUndefined();
  });

  it('availableToAdd_ShouldOfferInstalledUnknownToken', () => {
    const entries = availableToAdd([], ['ulaw', 'weirdcodec'], false);
    const weird = entries.find((e) => e.token === 'weirdcodec');
    expect(weird).toEqual({ token: 'weirdcodec', known: false, installed: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/core/voice/codec-utils.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/core/voice/codec-utils.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/core/voice/codec-utils.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/voice/codec-utils.ts src/core/voice/codec-utils.test.ts
git commit -m "feat(voice): add codec parse/serialize/guardrail/catalog utilities"
```

---

## Task 3: `useVoiceCodecs()` hook

**Files:**

- Create: `src/core/api/hooks/use-voice-codecs.ts`
- Test: `src/core/api/hooks/use-voice-codecs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/core/api/hooks/use-voice-codecs.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const fetchMock = vi.fn();
vi.mock('@/core/api/client', () => ({ customFetch: (cfg: unknown) => fetchMock(cfg) }));

import { useVoiceCodecs } from './use-voice-codecs';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('useVoiceCodecs', () => {
  beforeEach(() => vi.clearAllMocks());

  it('useVoiceCodecs_ShouldGetCodecsEndpoint', async () => {
    fetchMock.mockResolvedValue({ source: 'asterisk', codecs: ['ulaw', 'alaw'] });
    const { result } = renderHook(() => useVoiceCodecs(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchMock).toHaveBeenCalledWith({ url: '/api/v1/admin/voice/codecs', method: 'GET' });
    expect(result.current.data?.codecs).toEqual(['ulaw', 'alaw']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/core/api/hooks/use-voice-codecs.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/core/api/hooks/use-voice-codecs.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { customFetch } from '@/core/api/client';

export interface VoiceCodecsResponse {
  source: 'asterisk' | 'fallback';
  codecs: string[];
}

/** Server-driven codec catalog. Long staleTime — the installed codec set rarely changes. */
export function useVoiceCodecs() {
  return useQuery({
    queryKey: ['voice-codecs'],
    queryFn: () =>
      customFetch<VoiceCodecsResponse>({ url: '/api/v1/admin/voice/codecs', method: 'GET' }),
    staleTime: 60 * 60 * 1000,
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/core/api/hooks/use-voice-codecs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/api/hooks/use-voice-codecs.ts src/core/api/hooks/use-voice-codecs.test.ts
git commit -m "feat(voice): add useVoiceCodecs query hook"
```

---

## Task 4: `<CodecSelector>` component

**Files:**

- Create: `src/core/voice/codec-selector.tsx`
- Test: `src/core/voice/codec-selector.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/core/voice/codec-selector.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, d?: string) => d ?? k,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock('@/core/api/hooks/use-voice-codecs', () => ({
  useVoiceCodecs: () => ({
    // gsm + ilbc are curated AND installed → visible by default.
    // speex is non-curated AND NOT installed → hidden by default, shown disabled under "show all".
    data: {
      source: 'asterisk',
      codecs: ['ulaw', 'alaw', 'g722', 'opus', 'g729', 'gsm', 'ilbc', 'vp8', 'h264'],
    },
  }),
}));

import { CodecSelector } from './codec-selector';

describe('CodecSelector', () => {
  beforeEach(() => vi.clearAllMocks());

  it('CodecSelector_ShouldRenderSelectedRows_FromValue', () => {
    render(<CodecSelector value="ulaw,alaw" onChange={() => {}} testId="cs" />);
    expect(screen.getByTestId('cs-selected-ulaw')).toBeInTheDocument();
    expect(screen.getByTestId('cs-selected-alaw')).toBeInTheDocument();
  });

  it('CodecSelector_ShouldAppendCodec_WhenAddClicked', () => {
    const onChange = vi.fn();
    render(<CodecSelector value="ulaw" onChange={onChange} testId="cs" />);
    fireEvent.click(screen.getByTestId('cs-add-alaw'));
    expect(onChange).toHaveBeenCalledWith('ulaw,alaw');
  });

  it('CodecSelector_ShouldRemoveCodec_WhenRemoveClicked', () => {
    const onChange = vi.fn();
    render(<CodecSelector value="ulaw,alaw" onChange={onChange} testId="cs" />);
    fireEvent.click(screen.getByTestId('cs-remove-0'));
    expect(onChange).toHaveBeenCalledWith('alaw');
  });

  it('CodecSelector_ShouldMoveCodecUp_WhenUpClicked', () => {
    const onChange = vi.fn();
    render(<CodecSelector value="ulaw,alaw" onChange={onChange} testId="cs" />);
    fireEvent.click(screen.getByTestId('cs-up-1'));
    expect(onChange).toHaveBeenCalledWith('alaw,ulaw');
  });

  it('CodecSelector_ShouldWarnMissingG711_WhenOnlyOpus', () => {
    render(<CodecSelector value="opus" onChange={() => {}} testId="cs" />);
    expect(screen.getByTestId('cs-guardrail-no-g711')).toBeInTheDocument();
  });

  it('CodecSelector_ShouldRevealNonCuratedCodecs_WhenShowAllClicked', () => {
    render(<CodecSelector value="ulaw" onChange={() => {}} testId="cs" />);
    expect(screen.queryByTestId('cs-add-gsm')).not.toBeNull(); // gsm is curated + installed → visible
    expect(screen.queryByTestId('cs-add-speex')).toBeNull(); // speex non-curated → hidden by default
    fireEvent.click(screen.getByTestId('cs-show-all'));
    // speex non-curated but NOT in installed list → shown disabled under showAll
    expect(screen.getByTestId('cs-add-speex')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/core/voice/codec-selector.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the component**

Create `src/core/voice/codec-selector.tsx`:

```tsx
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronDown, ChevronUp, GripVertical, Plus, X } from 'lucide-react';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';
import { Badge } from '@/core/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/core/ui/select';
import { useVoiceCodecs } from '@/core/api/hooks/use-voice-codecs';
import { CODEC_CATALOG, CODEC_PRESETS, CODEC_TIERS, type CodecTier } from './codec-catalog';
import { availableToAdd, computeGuardrails, parseCodecs, serializeCodecs } from './codec-utils';

interface CodecSelectorProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly testId?: string;
}

const CUSTOM_TOKEN_RE = /^[a-z0-9]+$/;

export function CodecSelector({ value, onChange, testId = 'codec' }: Readonly<CodecSelectorProps>) {
  const { t } = useTranslation('common');
  const { data } = useVoiceCodecs();
  const installed = data?.codecs ?? null;
  const isFallback = data?.source === 'fallback';

  const selected = useMemo(() => parseCodecs(value), [value]);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [customToken, setCustomToken] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const presetValue = useMemo(() => {
    const joined = serializeCodecs(selected);
    const match = Object.entries(CODEC_PRESETS).find(
      ([, tokens]) => serializeCodecs(tokens) === joined,
    );
    return match ? match[0] : 'custom';
  }, [selected]);

  const codecName = useCallback(
    (token: string): string => {
      const meta = CODEC_CATALOG[token];
      return meta ? `${t(meta.nameKey, token)} (${token})` : token;
    },
    [t],
  );

  const setTokens = (tokens: string[]) => onChange(serializeCodecs(tokens));

  const applyPreset = (key: string) => {
    if (key === 'custom') return;
    const preset = CODEC_PRESETS[key];
    if (preset) setTokens([...preset]);
  };

  const addToken = (token: string) => {
    if (selected.includes(token)) return;
    setTokens([...selected, token]);
  };

  const removeAt = (index: number) => setTokens(selected.filter((_, i) => i !== index));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= selected.length) return;
    setTokens(arrayMove(selected, index, target));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setTokens(arrayMove(selected, Number(active.id), Number(over.id)));
  };

  const addCustom = () => {
    const token = customToken.trim().toLowerCase();
    if (!CUSTOM_TOKEN_RE.test(token) || selected.includes(token)) return;
    setTokens([...selected, token]);
    setCustomToken('');
  };

  const addable = useMemo(
    () => availableToAdd(selected, installed, showAll),
    [selected, installed, showAll],
  );
  const filteredAddable = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return addable;
    return addable.filter(
      (e) => e.token.includes(q) || codecName(e.token).toLowerCase().includes(q),
    );
  }, [addable, search, codecName]);

  const guardrails = useMemo(() => computeGuardrails(selected, installed), [selected, installed]);

  return (
    <div className="space-y-3" data-testid={testId}>
      {/* Preset */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{t('voice.codecs.preset', 'Preset')}</span>
        <Select value={presetValue} onValueChange={applyPreset}>
          <SelectTrigger size="sm" className="w-56" data-testid={`${testId}-preset`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recommended">
              {t('voice.codecs.presets.recommended', 'Recommended (compatibility)')}
            </SelectItem>
            <SelectItem value="hd">{t('voice.codecs.presets.hd', 'High quality (HD)')}</SelectItem>
            <SelectItem value="lowband">
              {t('voice.codecs.presets.lowband', 'Low bandwidth')}
            </SelectItem>
            <SelectItem value="webrtc">
              {t('voice.codecs.presets.webrtc', 'WebRTC / Browser')}
            </SelectItem>
            <SelectItem value="custom">{t('voice.codecs.presets.custom', 'Custom')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Selected (orderable) */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={selected.map((_, i) => i)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1">
            {selected.map((token, index) => (
              <SelectedCodecRow
                key={`${token}-${index}`}
                id={index}
                index={index}
                total={selected.length}
                label={codecName(token)}
                badges={<CodecBadges token={token} installed={installed} t={t} />}
                onRemove={() => removeAt(index)}
                onUp={() => move(index, -1)}
                onDown={() => move(index, 1)}
                testId={`${testId}-${token}`}
                rowTestId={`${testId}-selected-${token}`}
                upTestId={`${testId}-up-${index}`}
                downTestId={`${testId}-down-${index}`}
                removeTestId={`${testId}-remove-${index}`}
                dragLabel={t('voice.codecs.dragHandle', 'Drag to reorder')}
                upLabel={t('voice.codecs.moveUp', 'Move up')}
                downLabel={t('voice.codecs.moveDown', 'Move down')}
                removeLabel={t('voice.codecs.remove', 'Remove')}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {/* Add catalog */}
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t('voice.codecs.search', 'Search codec…')}
        data-testid={`${testId}-search`}
        aria-label={t('voice.codecs.search', 'Search codec…')}
      />
      <div className="space-y-2">
        {CODEC_TIERS.map((tier) => {
          const items = filteredAddable.filter(
            (e) => e.known && CODEC_CATALOG[e.token]?.tier === tier,
          );
          if (items.length === 0) return null;
          return (
            <CodecAddGroup
              key={tier}
              label={t(`voice.codecs.tiers.${tier}`, tier)}
              items={items}
              testId={testId}
              codecName={codecName}
              installedLabel={t('voice.codecs.badges.notInstalled', 'not installed')}
              onAdd={addToken}
            />
          );
        })}
        {(() => {
          const others = filteredAddable.filter((e) => !e.known);
          if (others.length === 0) return null;
          return (
            <CodecAddGroup
              key="others"
              label={t('voice.codecs.tiers.others', 'Others (installed)')}
              items={others}
              testId={testId}
              codecName={codecName}
              installedLabel={t('voice.codecs.badges.notInstalled', 'not installed')}
              onAdd={addToken}
            />
          );
        })()}
      </div>

      {/* Progressive disclosure */}
      <button
        type="button"
        className="text-xs text-muted-foreground underline-offset-2 hover:underline"
        onClick={() => setShowAll((v) => !v)}
        data-testid={`${testId}-show-all`}
      >
        {showAll
          ? t('voice.codecs.showLess', 'Show fewer codecs')
          : t('voice.codecs.showAll', 'Show all codecs')}
      </button>

      {showAll && (
        <div className="flex items-center gap-2">
          <Input
            value={customToken}
            onChange={(e) => setCustomToken(e.target.value)}
            placeholder={t('voice.codecs.addCustomPlaceholder', 'e.g. speex')}
            data-testid={`${testId}-custom-input`}
            aria-label={t('voice.codecs.addCustom', 'Add custom codec')}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustom}
            data-testid={`${testId}-custom-add`}
          >
            {t('voice.codecs.add', 'Add')}
          </Button>
        </div>
      )}

      {/* Guardrails */}
      {guardrails.map((g) => (
        <p
          key={`${g.kind}-${g.token ?? ''}`}
          className="text-xs text-amber-600 dark:text-amber-500"
          data-testid={`${testId}-guardrail-${g.kind}`}
        >
          {t(`voice.codecs.guardrails.${g.kind}`, g.kind, { token: g.token })}
        </p>
      ))}

      {isFallback && (
        <p className="text-xs text-muted-foreground" data-testid={`${testId}-fallback-note`}>
          {t(
            'voice.codecs.fallbackNote',
            "Couldn't verify against the server; showing the standard catalog.",
          )}
        </p>
      )}
    </div>
  );
}

interface CodecBadgesProps {
  readonly token: string;
  readonly installed: readonly string[] | null;
  readonly t: (key: string, def?: string) => string;
}

function CodecBadges({ token, installed, t }: Readonly<CodecBadgesProps>) {
  const meta = CODEC_CATALOG[token];
  const notInstalled = installed !== null && !installed.includes(token);
  return (
    <span className="inline-flex flex-wrap gap-1">
      {!meta && (
        <Badge variant="outline">
          {t('voice.codecs.badges.outsideCatalog', 'outside catalog')}
        </Badge>
      )}
      {meta?.tier === 'hd' && (
        <Badge variant="secondary">{t('voice.codecs.badges.hd', 'HD')}</Badge>
      )}
      {meta?.webrtc && (
        <Badge variant="secondary">{t('voice.codecs.badges.webrtc', 'WebRTC')}</Badge>
      )}
      {meta?.needsLicense && (
        <Badge variant="outline">{t('voice.codecs.badges.license', 'license')}</Badge>
      )}
      {meta?.needsModule && (
        <Badge variant="outline">{t('voice.codecs.badges.module', 'module')}</Badge>
      )}
      {notInstalled && (
        <Badge variant="destructive">
          {t('voice.codecs.badges.notInstalled', 'not installed')}
        </Badge>
      )}
    </span>
  );
}

interface SelectedCodecRowProps {
  readonly id: number;
  readonly index: number;
  readonly total: number;
  readonly label: string;
  readonly badges: ReactNode;
  readonly onRemove: () => void;
  readonly onUp: () => void;
  readonly onDown: () => void;
  readonly testId: string;
  readonly rowTestId: string;
  readonly upTestId: string;
  readonly downTestId: string;
  readonly removeTestId: string;
  readonly dragLabel: string;
  readonly upLabel: string;
  readonly downLabel: string;
  readonly removeLabel: string;
}

function SelectedCodecRow(props: Readonly<SelectedCodecRowProps>) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: props.id,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <li
      ref={setNodeRef}
      style={style}
      data-testid={props.rowTestId}
      className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
    >
      <button
        type="button"
        aria-label={props.dragLabel}
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-sm text-muted-foreground tabular-nums">{props.index + 1}.</span>
      <span className="flex-1 text-sm">{props.label}</span>
      {props.badges}
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={props.upLabel}
        disabled={props.index === 0}
        onClick={props.onUp}
        data-testid={props.upTestId}
      >
        <ChevronUp className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={props.downLabel}
        disabled={props.index === props.total - 1}
        onClick={props.onDown}
        data-testid={props.downTestId}
      >
        <ChevronDown className="h-4 w-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={props.removeLabel}
        onClick={props.onRemove}
        data-testid={props.removeTestId}
      >
        <X className="h-4 w-4" />
      </Button>
    </li>
  );
}

interface CodecAddGroupProps {
  readonly label: string;
  readonly items: ReadonlyArray<{ token: string; known: boolean; installed: boolean }>;
  readonly testId: string;
  readonly codecName: (token: string) => string;
  readonly installedLabel: string;
  readonly onAdd: (token: string) => void;
}

function CodecAddGroup({
  label,
  items,
  testId,
  codecName,
  installedLabel,
  onAdd,
}: Readonly<CodecAddGroupProps>) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((entry) => (
          <Button
            key={entry.token}
            type="button"
            variant="outline"
            size="sm"
            disabled={!entry.installed}
            onClick={() => onAdd(entry.token)}
            data-testid={`${testId}-add-${entry.token}`}
          >
            <Plus className="mr-1 h-3 w-3" />
            {codecName(entry.token)}
            {!entry.installed && (
              <span className="ml-1 text-xs text-muted-foreground">({installedLabel})</span>
            )}
          </Button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/core/voice/codec-selector.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 5: Lint + type-check the new files**

Run: `npx eslint src/core/voice && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/core/voice/codec-selector.tsx src/core/voice/codec-selector.test.tsx
git commit -m "feat(voice): add CodecSelector component (presets, orderable list, catalog, guardrails)"
```

---

## Task 5: Integrate `<CodecSelector>` into the trunk wizard

**Files:**

- Modify: `src/admin/trunks/trunk-wizard.tsx` (MediaStep, ~lines 365-374)
- Test: `src/admin/trunks/trunk-wizard.test.tsx` (add a codec test if the file exists; otherwise rely on the E2E in Task 9)

- [ ] **Step 1: Replace the codecs `<Input>` in MediaStep**

The current block (~365-374) is:

```tsx
<div className="space-y-1.5">
  <Label htmlFor="trunk-wizard-codecs">{t('trunks.codecs')}</Label>
  <Input
    id="trunk-wizard-codecs"
    placeholder={t('trunks.form.codecs_placeholder')}
    data-testid="trunk-wizard-codecs"
    {...register('codecs')}
  />
  <p className="text-xs text-muted-foreground">{t('trunks.wizard.media.codecsHint')}</p>
</div>
```

Replace it with a `Controller`-wrapped `CodecSelector`. MediaStep currently receives `register`; thread the form's `control` into MediaStep the same way (add `control` to its props and pass it from the parent where `<MediaStep ... />` is rendered):

```tsx
<div className="space-y-1.5">
  <Label htmlFor="trunk-wizard-codecs">{t('trunks.codecs')}</Label>
  <Controller
    name="codecs"
    control={control}
    render={({ field }) => (
      <CodecSelector
        value={field.value ?? ''}
        onChange={field.onChange}
        testId="trunk-wizard-codecs"
      />
    )}
  />
</div>
```

- [ ] **Step 2: Add imports**

At the top of `trunk-wizard.tsx`:

```tsx
import { Controller } from 'react-hook-form';
import { CodecSelector } from '@/core/voice/codec-selector';
```

(Remove the now-unused `Input` import only if no other field in the file uses it.)

- [ ] **Step 3: Verify the wizard still builds and submits a string**

The submit mapping at ~line 844 (`codecs: trim(v.codecs)`) keeps working because `field.value` is still a comma-separated string. Run:

Run: `npx vitest run src/admin/trunks` (existing wizard tests must stay green) and `npx tsc --noEmit`
Expected: PASS / 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/admin/trunks/trunk-wizard.tsx
git commit -m "feat(trunks): use CodecSelector in the trunk wizard media step"
```

---

## Task 6: Integrate `<CodecSelector>` into the trunk edit form + clarify Transport text

**Files:**

- Modify: `src/admin/trunks/trunk-form.tsx` (codecs field ~389-396)
- Test: `src/admin/trunks/trunk-form.test.tsx` (update the existing codec tests — they currently use `getByTestId('trunk-form-codecs')` as an `<input>`)

- [ ] **Step 1: Replace the codecs `<Input>`**

Current (~389-396):

```tsx
<div className="space-y-1.5">
  <Label htmlFor="trunk-codecs">{t('trunks.codecs')}</Label>
  <Input
    id="trunk-codecs"
    placeholder={t('trunks.form.codecs_placeholder')}
    data-testid="trunk-form-codecs"
    {...register('codecs')}
  />
</div>
```

Replace with:

```tsx
<div className="space-y-1.5">
  <Label htmlFor="trunk-codecs">{t('trunks.codecs')}</Label>
  <Controller
    name="codecs"
    control={control}
    render={({ field }) => (
      <CodecSelector
        value={field.value ?? ''}
        onChange={field.onChange}
        testId="trunk-form-codecs"
      />
    )}
  />
</div>
```

- [ ] **Step 2: Add imports**

```tsx
import { Controller } from 'react-hook-form';
import { CodecSelector } from '@/core/voice/codec-selector';
```

(`control` is already returned by this form's `useForm`; if it isn't destructured yet, add it to the destructure.)

- [ ] **Step 3: Update the existing codec tests in `trunk-form.test.tsx`**

The current tests treat `trunk-form-codecs` as an `<input>` (`fireEvent.change(... value: 'ulaw,alaw')` and read `.value`). Replace those with `CodecSelector`-driven assertions. Add a mock for `useVoiceCodecs` at the top (before importing `TrunkForm`):

```tsx
vi.mock('@/core/api/hooks/use-voice-codecs', () => ({
  useVoiceCodecs: () => ({
    data: { source: 'asterisk', codecs: ['ulaw', 'alaw', 'g722', 'opus'] },
  }),
}));
```

Replace the prior `TrunkForm_ShouldSubmitCodecs_WhenCreating` test body with:

```tsx
it('TrunkForm_ShouldSubmitCodecs_WhenCreating', async () => {
  render(<TrunkForm open mode="create" onOpenChange={() => {}} />);
  fireEvent.click(screen.getByTestId('trunk-form-advanced-toggle'));
  // seed via the "Recommended" preset, then submit
  fireEvent.click(screen.getByTestId('trunk-form-codecs-add-alaw')); // add a codec to a default state
  fireEvent.submit(screen.getByTestId('trunk-form-submit').closest('form')!);
  await waitFor(() => expect(createMutate).toHaveBeenCalled());
  const arg = createMutate.mock.calls[0][0] as Record<string, unknown>;
  expect(typeof arg.codecs).toBe('string');
});
```

Replace `TrunkForm_ShouldPrefillCodecs_WhenEditing` with an assertion that the saved codecs render as selected rows:

```tsx
it('TrunkForm_ShouldPrefillCodecs_WhenEditing', () => {
  render(<TrunkForm open mode="edit" onOpenChange={() => {}} trunk={existingTrunk} />);
  fireEvent.click(screen.getByTestId('trunk-form-advanced-toggle'));
  expect(screen.getByTestId('trunk-form-codecs-selected-ulaw')).toBeInTheDocument();
  expect(screen.getByTestId('trunk-form-codecs-selected-alaw')).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the trunk-form tests**

Run: `npx vitest run src/admin/trunks/trunk-form.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/admin/trunks/trunk-form.tsx src/admin/trunks/trunk-form.test.tsx
git commit -m "feat(trunks): use CodecSelector in the trunk edit form"
```

(The Transport placeholder/hint text is changed in Task 8 — it is i18n-only.)

---

## Task 7: Integrate `<CodecSelector>` into the realtime endpoint-profile form

**Files:**

- Modify: `src/admin/realtime/profile-form.tsx` (codecs field ~207-221)
- Test: `src/admin/realtime/profile-form.test.tsx` (if present; otherwise add a minimal render test)

- [ ] **Step 1: Replace the codecs `<Input>`**

Current (~207-221):

```tsx
<div className="space-y-1.5">
  <Label htmlFor="profile-codecs" required>
    {t('realtime.form.codecs')}
  </Label>
  <Input
    id="profile-codecs"
    placeholder="ulaw,alaw,g722"
    {...codecsA11y.inputProps}
    {...register('codecs')}
  />
  <FieldError
    id={codecsA11y.errorId}
    message={errors.codecs?.message ? t(errors.codecs.message) : undefined}
  />
</div>
```

Replace with (keep the `required` Label and `FieldError`; the Zod `min(1)` rule stays and fires when the selection is emptied):

```tsx
<div className="space-y-1.5">
  <Label htmlFor="profile-codecs" required>
    {t('realtime.form.codecs')}
  </Label>
  <Controller
    name="codecs"
    control={control}
    render={({ field }) => (
      <CodecSelector value={field.value ?? ''} onChange={field.onChange} testId="profile-codecs" />
    )}
  />
  <FieldError
    id={codecsA11y.errorId}
    message={errors.codecs?.message ? t(errors.codecs.message) : undefined}
  />
</div>
```

- [ ] **Step 2: Add imports**

```tsx
import { Controller } from 'react-hook-form';
import { CodecSelector } from '@/core/voice/codec-selector';
```

(`control` and `errors` come from this form's `useForm`/`formState`; add `control` to the destructure if missing.)

- [ ] **Step 3: Add the `useVoiceCodecs` mock to the profile test (if it renders the form)**

If `profile-form.test.tsx` exists, add at the top before importing the form:

```tsx
vi.mock('@/core/api/hooks/use-voice-codecs', () => ({
  useVoiceCodecs: () => ({
    data: { source: 'asterisk', codecs: ['ulaw', 'alaw', 'g722', 'opus', 'vp8', 'h264'] },
  }),
}));
```

Add one render assertion:

```tsx
it('ProfileForm_ShouldRenderSelectedCodecs_WhenEditing', () => {
  // render with a profile whose codecs = 'ulaw,alaw,g722' …
  expect(screen.getByTestId('profile-codecs-selected-ulaw')).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the realtime tests + type-check**

Run: `npx vitest run src/admin/realtime && npx tsc --noEmit`
Expected: PASS / 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/admin/realtime/profile-form.tsx src/admin/realtime/profile-form.test.tsx
git commit -m "feat(realtime): use CodecSelector in the endpoint-profile form"
```

---

## Task 8: i18n keys (3 locales) + Transport text clarification

**Files:**

- Modify: `public/locales/en-US/common.json`, `public/locales/es-419/common.json`, `public/locales/pt-BR/common.json` (add `voice.codecs.*`)
- Modify: `public/locales/en-US/admin.json`, `public/locales/es-419/admin.json`, `public/locales/pt-BR/admin.json` (clarify `trunks.form.transport_placeholder` + `transport_hint`)

- [ ] **Step 1: Add the `voice` block to each `common.json`**

Insert this object at the top level of `common.json`. **en-US:**

```json
"voice": {
  "codecs": {
    "preset": "Preset",
    "search": "Search codec…",
    "showAll": "Show all codecs",
    "showLess": "Show fewer codecs",
    "add": "Add",
    "addCustom": "Add custom codec",
    "addCustomPlaceholder": "e.g. speex",
    "remove": "Remove codec",
    "moveUp": "Move up",
    "moveDown": "Move down",
    "dragHandle": "Drag to reorder",
    "fallbackNote": "Couldn't verify against the server; showing the standard catalog.",
    "presets": {
      "recommended": "Recommended (compatibility)",
      "hd": "High quality (HD)",
      "lowband": "Low bandwidth",
      "webrtc": "WebRTC / Browser",
      "custom": "Custom"
    },
    "tiers": {
      "standard": "Standard telephony",
      "hd": "High-definition audio",
      "lowband": "Low bandwidth",
      "legacy": "Legacy / compatibility",
      "video": "Video / WebRTC",
      "others": "Others (installed)"
    },
    "badges": {
      "hd": "HD",
      "webrtc": "WebRTC",
      "license": "license",
      "module": "module",
      "notInstalled": "not installed",
      "outsideCatalog": "outside catalog"
    },
    "guardrails": {
      "empty": "Select at least one codec.",
      "no-g711": "No G.711 (ulaw/alaw): some carriers may reject calls.",
      "duplicate": "Duplicate codec: {{token}}.",
      "not-installed": "{{token}} is not installed on the server."
    },
    "names": {
      "ulaw": "Standard — best compatibility",
      "alaw": "Standard (A-law)",
      "g722": "HD voice",
      "opus": "Opus (HD / WebRTC)",
      "g729": "Low bandwidth",
      "gsm": "GSM (low bandwidth)",
      "ilbc": "iLBC (low bandwidth)",
      "g726": "G.726",
      "g726aal2": "G.726 AAL2",
      "adpcm": "ADPCM (legacy)",
      "speex": "Speex",
      "speex16": "Speex (HD)",
      "siren7": "Siren7 (HD)",
      "siren14": "Siren14 (HD)",
      "g719": "G.719 (HD)",
      "g723": "G.723.1",
      "lpc10": "LPC-10 (legacy)",
      "silk": "SILK (HD)",
      "vp8": "VP8 video",
      "vp9": "VP9 video",
      "h264": "H.264 video",
      "h263p": "H.263+ video",
      "h263": "H.263 video",
      "h261": "H.261 video",
      "mpeg4": "MPEG-4 video"
    }
  }
}
```

**es-419** (same keys, Spanish values):

```json
"voice": {
  "codecs": {
    "preset": "Preset",
    "search": "Buscar códec…",
    "showAll": "Mostrar todos los códecs",
    "showLess": "Mostrar menos códecs",
    "add": "Agregar",
    "addCustom": "Agregar códec personalizado",
    "addCustomPlaceholder": "p. ej. speex",
    "remove": "Quitar códec",
    "moveUp": "Subir",
    "moveDown": "Bajar",
    "dragHandle": "Arrastrar para reordenar",
    "fallbackNote": "No se pudo verificar contra el servidor; se muestra el catálogo estándar.",
    "presets": {
      "recommended": "Recomendado (compatibilidad)",
      "hd": "Alta calidad (HD)",
      "lowband": "Bajo ancho de banda",
      "webrtc": "WebRTC / Navegador",
      "custom": "Personalizado"
    },
    "tiers": {
      "standard": "Telefonía estándar",
      "hd": "Audio de alta definición",
      "lowband": "Bajo ancho de banda",
      "legacy": "Heredados / compatibilidad",
      "video": "Video / WebRTC",
      "others": "Otros (instalados)"
    },
    "badges": {
      "hd": "HD",
      "webrtc": "WebRTC",
      "license": "licencia",
      "module": "módulo",
      "notInstalled": "no instalado",
      "outsideCatalog": "fuera de catálogo"
    },
    "guardrails": {
      "empty": "Seleccioná al menos un códec.",
      "no-g711": "Sin G.711 (ulaw/alaw): algunas operadoras pueden rechazar llamadas.",
      "duplicate": "Códec duplicado: {{token}}.",
      "not-installed": "{{token}} no está instalado en el servidor."
    },
    "names": {
      "ulaw": "Estándar — máxima compatibilidad",
      "alaw": "Estándar (A-law)",
      "g722": "Voz HD",
      "opus": "Opus (HD / WebRTC)",
      "g729": "Bajo ancho de banda",
      "gsm": "GSM (bajo ancho de banda)",
      "ilbc": "iLBC (bajo ancho de banda)",
      "g726": "G.726",
      "g726aal2": "G.726 AAL2",
      "adpcm": "ADPCM (heredado)",
      "speex": "Speex",
      "speex16": "Speex (HD)",
      "siren7": "Siren7 (HD)",
      "siren14": "Siren14 (HD)",
      "g719": "G.719 (HD)",
      "g723": "G.723.1",
      "lpc10": "LPC-10 (heredado)",
      "silk": "SILK (HD)",
      "vp8": "Video VP8",
      "vp9": "Video VP9",
      "h264": "Video H.264",
      "h263p": "Video H.263+",
      "h263": "Video H.263",
      "h261": "Video H.261",
      "mpeg4": "Video MPEG-4"
    }
  }
}
```

**pt-BR** (same keys, Portuguese values):

```json
"voice": {
  "codecs": {
    "preset": "Predefinição",
    "search": "Buscar codec…",
    "showAll": "Mostrar todos os codecs",
    "showLess": "Mostrar menos codecs",
    "add": "Adicionar",
    "addCustom": "Adicionar codec personalizado",
    "addCustomPlaceholder": "ex.: speex",
    "remove": "Remover codec",
    "moveUp": "Mover para cima",
    "moveDown": "Mover para baixo",
    "dragHandle": "Arraste para reordenar",
    "fallbackNote": "Não foi possível verificar com o servidor; exibindo o catálogo padrão.",
    "presets": {
      "recommended": "Recomendado (compatibilidade)",
      "hd": "Alta qualidade (HD)",
      "lowband": "Baixa largura de banda",
      "webrtc": "WebRTC / Navegador",
      "custom": "Personalizado"
    },
    "tiers": {
      "standard": "Telefonia padrão",
      "hd": "Áudio de alta definição",
      "lowband": "Baixa largura de banda",
      "legacy": "Legado / compatibilidade",
      "video": "Vídeo / WebRTC",
      "others": "Outros (instalados)"
    },
    "badges": {
      "hd": "HD",
      "webrtc": "WebRTC",
      "license": "licença",
      "module": "módulo",
      "notInstalled": "não instalado",
      "outsideCatalog": "fora do catálogo"
    },
    "guardrails": {
      "empty": "Selecione pelo menos um codec.",
      "no-g711": "Sem G.711 (ulaw/alaw): algumas operadoras podem rejeitar chamadas.",
      "duplicate": "Codec duplicado: {{token}}.",
      "not-installed": "{{token}} não está instalado no servidor."
    },
    "names": {
      "ulaw": "Padrão — máxima compatibilidade",
      "alaw": "Padrão (A-law)",
      "g722": "Voz HD",
      "opus": "Opus (HD / WebRTC)",
      "g729": "Baixa largura de banda",
      "gsm": "GSM (baixa largura de banda)",
      "ilbc": "iLBC (baixa largura de banda)",
      "g726": "G.726",
      "g726aal2": "G.726 AAL2",
      "adpcm": "ADPCM (legado)",
      "speex": "Speex",
      "speex16": "Speex (HD)",
      "siren7": "Siren7 (HD)",
      "siren14": "Siren14 (HD)",
      "g719": "G.719 (HD)",
      "g723": "G.723.1",
      "lpc10": "LPC-10 (legado)",
      "silk": "SILK (HD)",
      "vp8": "Vídeo VP8",
      "vp9": "Vídeo VP9",
      "h264": "Vídeo H.264",
      "h263p": "Vídeo H.263+",
      "h263": "Vídeo H.263",
      "h261": "Vídeo H.261",
      "mpeg4": "Vídeo MPEG-4"
    }
  }
}
```

- [ ] **Step 2: Clarify the Transport text in each `admin.json`**

Under `trunks.form`, change `transport_placeholder` and `transport_hint`:

- **en-US:** `"transport_placeholder": "Server default (UDP)"`, `"transport_hint": "Leave empty to use UDP — the server's default transport."`
- **es-419:** `"transport_placeholder": "Predeterminado del servidor (UDP)"`, `"transport_hint": "Deje vacío para usar UDP, el transporte predeterminado del servidor."`
- **pt-BR:** `"transport_placeholder": "Padrão do servidor (UDP)"`, `"transport_hint": "Deixe vazio para usar UDP — o transporte padrão do servidor."`

- [ ] **Step 3: Run the i18n parity gate**

Run: `npm run i18n:check`
Expected: PASS (no missing/extra keys across es-419 / en-US / pt-BR). The script is `scripts/i18n-parity-check.mjs` (per CLAUDE.md). If it reports drift, fix the offending locale until all three match.

- [ ] **Step 4: Run full lint (ESLint + i18n)**

Run: `npm run lint`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add public/locales
git commit -m "feat(i18n): add voice.codecs keys (3 locales) + clarify trunk transport UDP default"
```

---

## Task 9: Playwright E2E — pick preset, reorder, save a trunk

**Files:**

- Create: `tests/e2e/trunk-codec-selector.spec.ts` (mirror an existing trunk E2E spec for auth/setup; adjust the file location to match the repo's `tests/e2e/` layout)

- [ ] **Step 1: Write the E2E spec**

Create `tests/e2e/trunk-codec-selector.spec.ts` (adapt the login/nav helpers to the repo's existing E2E conventions — copy the setup from a sibling trunk spec):

```ts
import { test, expect } from '@playwright/test';

test('codec selector: pick preset, reorder, save trunk', async ({ page }) => {
  // … reuse the repo's existing auth + navigation helper to reach /admin/trunks …
  await page.goto('/admin/trunks');
  await page.getByTestId('trunk-create-button').click();

  // open the wizard media step (adapt step navigation to the wizard's stepper testids)
  await page.getByTestId('trunk-wizard-codecs-preset').click();
  await page.getByRole('option', { name: /HD|Alta calidad|Alta qualidade/ }).click();

  // first selected codec should be opus (HD preset order: opus,g722,ulaw,alaw)
  await expect(page.getByTestId('trunk-wizard-codecs-selected-opus')).toBeVisible();

  // demote opus one position
  await page.getByTestId('trunk-wizard-codecs-down-0').click();
  await expect(page.getByTestId('trunk-wizard-codecs-selected-g722')).toBeVisible();

  // … fill remaining required fields + submit, then assert the trunk row appears …
});
```

- [ ] **Step 2: Run the E2E (requires the demo backend running)**

Run: `npx playwright test tests/e2e/trunk-codec-selector.spec.ts`
Expected: PASS. If the demo backend lacks the `/admin/voice/codecs` endpoint, the selector degrades to the fallback catalog and the preset/reorder assertions still pass (HD preset codecs are in the fallback set).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/trunk-codec-selector.spec.ts
git commit -m "test(e2e): codec selector preset + reorder + save"
```

---

## Final verification

- [ ] **Unit tests:** `npx vitest run` → all green (existing 1064+ suite + new codec tests).
- [ ] **Type-check + build:** `npm run build` → 0 errors.
- [ ] **Lint + i18n parity:** `npm run lint` → 0 errors.
- [ ] **Bundle:** the new component is small and used on already-lazy admin pages; confirm no unexpected shell-bundle growth.

---

## Spec coverage check (this plan ↔ spec "Frontend" acceptance)

- ✅ `<CodecSelector>` (string in/out, internal string[]) → Task 4.
- ✅ `CODEC_CATALOG` map → Task 1.
- ✅ `useVoiceCodecs()` hook → Task 3.
- ✅ Presets (recommended/hd/lowband/webrtc/custom) → Tasks 1, 4.
- ✅ Reorder by drag + ↑↓ buttons; per-row remove; friendly label + token + badges → Task 4.
- ✅ Grouped, searchable add catalog; selected excluded → Tasks 2, 4.
- ✅ Catalog reconciliation (installed∩catalog / installed∖catalog "others" / catalog∖installed disabled under showAll) → Tasks 2, 4.
- ✅ Advanced disclosure + custom-token add → Task 4.
- ✅ Guardrails (no-g711 / empty / duplicate / not-installed) → Tasks 2, 4.
- ✅ Integrated in all 3 surfaces; provider seed preserved; profile keeps ≥1 codec (Zod min(1)) → Tasks 5, 6, 7.
- ✅ Transport placeholder/hint clarified to UDP → Task 8.
- ✅ i18n 3 locales + parity gate → Task 8.
- ✅ A11y: keyboard reorder (↑↓ + dnd-kit KeyboardSensor), aria-labels, dnd-kit live announcements; data-\* selectors → Task 4.
- ✅ Vitest coverage + ≥1 Playwright E2E → Tasks 1-7, 9.
- ✅ Lint/TS/build/parity green → Final verification.

```

```
