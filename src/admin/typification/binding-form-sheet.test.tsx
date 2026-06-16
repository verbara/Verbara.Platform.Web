import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SchemaBinding, TypificationSchema } from '@/core/api/hooks/use-typification';

const createMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock('@/core/api/hooks/use-typification', () => ({
  useCreateTypificationBinding: () => ({ mutate: createMutate, isPending: false }),
  useUpdateTypificationBinding: () => ({ mutate: updateMutate, isPending: false }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars && 'n' in vars ? `${key}:${vars.n}` : key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { BindingFormSheet } from './binding-form-sheet';

interface SubmittedAiConfig {
  enabled: boolean;
  mode: string;
  suggestThreshold: number;
  autoApplyThreshold: number;
  autonomousThreshold: number;
  autonomous: boolean;
  sentimentGating: boolean;
  dailyTokenBudget?: number | null;
  entityFieldMap: Record<string, string>;
  piiAllowStore: string[];
}

interface SubmittedBinding {
  scope: string;
  schemaId: string;
  priority: number;
  aiConfigOverride?: SubmittedAiConfig;
}

const SCHEMAS: TypificationSchema[] = [
  {
    schemaId: 'schema-1',
    name: 'Intake',
    version: 1,
    isPublished: true,
    maxDepth: 5,
    nodes: [],
    fields: [],
    aiConfig: {
      enabled: true,
      mode: 'Shadow',
      suggestThreshold: 0.7,
      autoApplyThreshold: 0.85,
      autonomousThreshold: 0.95,
      autonomous: false,
      sentimentGating: true,
      entityFieldMap: { email: 'customer_email' },
      piiAllowStore: ['Email'],
    },
    createdAt: '2026-06-08T00:00:00Z',
  },
];

function renderSheet(binding?: SchemaBinding | null) {
  return render(
    <BindingFormSheet open onOpenChange={vi.fn()} binding={binding ?? null} schemas={SCHEMAS} />,
  );
}

/** Pick the Intake schema in the binding form's schema <Select>. */
async function selectSchema() {
  fireEvent.click(screen.getByTestId('binding-schema'));
  fireEvent.click(await screen.findByRole('option', { name: 'Intake' }));
}

describe('BindingFormSheet AI override', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('BindingSheet_ShouldNotSendOverride_WhenToggleOff', async () => {
    renderSheet();
    await selectSchema();

    // Leave the override toggle OFF; submit.
    fireEvent.submit(screen.getByTestId('binding-submit').closest('form')!);

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const [payload] = createMutate.mock.calls[0] as [SubmittedBinding];
    expect(payload.aiConfigOverride).toBeUndefined();
  });

  it('BindingSheet_ShouldSendOverride_WhenToggleOnWithMode', async () => {
    renderSheet();
    await selectSchema();

    // Turn the override ON; the override section appears.
    fireEvent.click(screen.getByTestId('binding-ai-override-toggle'));
    await waitFor(() => expect(screen.getByTestId('binding-ai-override')).toBeInTheDocument());

    // Set mode to AutoFill.
    fireEvent.change(screen.getByTestId('binding-ai-override-mode'), {
      target: { value: 'AutoFill' },
    });

    fireEvent.submit(screen.getByTestId('binding-submit').closest('form')!);

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const [payload] = createMutate.mock.calls[0] as [SubmittedBinding];
    expect(payload.aiConfigOverride).toBeDefined();
    expect(payload.aiConfigOverride!.mode).toBe('AutoFill');
    // Carried fields are ALWAYS emitted (proving always-emit of piiAllowStore + entityFieldMap).
    expect(Array.isArray(payload.aiConfigOverride!.piiAllowStore)).toBe(true);
    expect(payload.aiConfigOverride).toHaveProperty('piiAllowStore');
    expect(typeof payload.aiConfigOverride!.entityFieldMap).toBe('object');
    expect(payload.aiConfigOverride).toHaveProperty('entityFieldMap');
  });

  it('BindingSheet_ShouldHydrateOverride_WhenEditingBindingWithOverride', async () => {
    renderSheet({
      bindingId: 'b1',
      scope: 'Queue',
      scopeRef: 'q-100',
      schemaId: 'schema-1',
      priority: 0,
      aiConfigOverride: {
        enabled: true,
        mode: 'SuggestOnly',
        suggestThreshold: 0.65,
        autoApplyThreshold: 0.8,
        autonomousThreshold: 0.92,
        autonomous: false,
        sentimentGating: true,
        entityFieldMap: {},
        piiAllowStore: ['Email'],
      },
    });

    // Toggle is on and the override section is visible.
    await waitFor(() => expect(screen.getByTestId('binding-ai-override')).toBeInTheDocument());
    expect(screen.getByTestId('binding-ai-override-toggle')).toHaveAttribute('data-checked');

    const mode = screen.getByTestId('binding-ai-override-mode') as HTMLSelectElement;
    expect(mode.value).toBe('SuggestOnly');

    const suggest = screen.getByTestId('binding-ai-override-suggest-threshold') as HTMLInputElement;
    expect(suggest.value).toBe('65');
  });

  it('BindingSheet_ShouldSeedFromSchema_WhenOverrideEnabledFresh', async () => {
    renderSheet();
    await selectSchema();

    // Turn the override ON with no existing override → it seeds from the selected
    // schema's aiConfig (suggestThreshold 0.7 → 70 percent).
    fireEvent.click(screen.getByTestId('binding-ai-override-toggle'));
    await waitFor(() => expect(screen.getByTestId('binding-ai-override')).toBeInTheDocument());

    await waitFor(() => {
      const suggest = screen.getByTestId(
        'binding-ai-override-suggest-threshold',
      ) as HTMLInputElement;
      expect(suggest.value).toBe('70');
    });
  });
});
