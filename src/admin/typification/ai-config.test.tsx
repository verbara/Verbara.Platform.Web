import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TypificationSchema } from '@/core/api/hooks/use-typification';

const createMutate = vi.fn();
const updateMutate = vi.fn();
const publishMutate = vi.fn();

// Mutable holders so individual tests can swap the loaded schema / route param.
const schemaState: { data: TypificationSchema | undefined } = { data: undefined };
const routeState: { id: string } = { id: 'new' };

vi.mock('@/core/api/hooks/use-typification', () => ({
  useTypificationSchema: () => ({ data: schemaState.data, isLoading: false }),
  useCreateTypificationSchema: () => ({ mutate: createMutate, isPending: false }),
  useUpdateTypificationSchema: () => ({ mutate: updateMutate, isPending: false }),
  usePublishTypificationSchema: () => ({
    mutate: publishMutate,
    isPending: false,
    data: undefined,
  }),
}));

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: routeState.id }),
  useNavigate: () => vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars && 'n' in vars ? `${key}:${vars.n}` : key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import SchemaDesignerPage from './schema-designer-page';

interface SubmittedAiConfig {
  enabled: boolean;
  mode: string;
  confidenceThreshold: number;
  sentimentGating: boolean;
}

describe('SchemaDesigner AI config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schemaState.data = undefined;
    routeState.id = 'new';
  });

  it('SchemaDesigner_ShouldEmitAiConfig_WhenEnabledWithThreshold', async () => {
    render(<SchemaDesignerPage />);
    fireEvent.change(screen.getByTestId('schema-name'), { target: { value: 'Intake' } });

    // Editor hidden until enabled.
    expect(screen.queryByTestId('ai-config-editor')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ai-config-enabled'));
    await waitFor(() => expect(screen.getByTestId('ai-config-editor')).toBeInTheDocument());

    // Mode is fixed to SuggestOnly (the control is disabled in P2a).
    expect(screen.getByTestId('ai-config-mode')).toBeDisabled();

    // Set a 80% confidence threshold.
    fireEvent.change(screen.getByTestId('ai-config-threshold'), { target: { value: '80' } });
    fireEvent.click(screen.getByTestId('ai-config-sentiment-gating'));

    fireEvent.submit(screen.getByTestId('designer-save-btn').closest('form')!);

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const [payload] = createMutate.mock.calls[0] as [{ aiConfig: SubmittedAiConfig }];
    expect(payload.aiConfig.enabled).toBe(true);
    expect(payload.aiConfig.mode).toBe('SuggestOnly');
    // Percent (80) is mapped to a 0–1 fraction.
    expect(payload.aiConfig.confidenceThreshold).toBeCloseTo(0.8, 5);
    expect(payload.aiConfig.sentimentGating).toBe(true);
  });

  it('SchemaDesigner_ShouldEmitDisabledAiConfig_WhenLeftOff', async () => {
    render(<SchemaDesignerPage />);
    fireEvent.change(screen.getByTestId('schema-name'), { target: { value: 'Intake' } });

    fireEvent.submit(screen.getByTestId('designer-save-btn').closest('form')!);

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const [payload] = createMutate.mock.calls[0] as [{ aiConfig: SubmittedAiConfig }];
    expect(payload.aiConfig.enabled).toBe(false);
    expect(payload.aiConfig.mode).toBe('SuggestOnly');
  });

  it('SchemaDesigner_ShouldHydrateAiConfig_WhenEditingSchemaWithAiConfig', async () => {
    routeState.id = 'schema-1';
    schemaState.data = {
      schemaId: 'schema-1',
      name: 'Intake',
      version: 1,
      isPublished: false,
      maxDepth: 5,
      nodes: [],
      fields: [],
      aiConfig: {
        enabled: true,
        mode: 'SuggestOnly',
        confidenceThreshold: 0.65,
        sentimentGating: true,
      },
      createdAt: '2026-06-08T00:00:00Z',
    };

    render(<SchemaDesignerPage />);

    // Enabled -> editor visible; threshold hydrated as a percent (0.65 -> 65).
    await waitFor(() => expect(screen.getByTestId('ai-config-editor')).toBeInTheDocument());
    const threshold = screen.getByTestId('ai-config-threshold') as HTMLInputElement;
    expect(threshold.value).toBe('65');
  });

  it('SchemaDesigner_ShouldDisplayActualMode_WhenEditingAutoApplySchema', async () => {
    routeState.id = 'schema-1';
    schemaState.data = {
      schemaId: 'schema-1',
      name: 'Intake',
      version: 1,
      isPublished: false,
      maxDepth: 5,
      nodes: [],
      fields: [],
      aiConfig: {
        enabled: true,
        // Out-of-band AutoApply config — the designer must DISPLAY it, not
        // misleadingly show "SuggestOnly".
        mode: 'AutoApplyAboveThreshold',
        confidenceThreshold: 0.9,
        sentimentGating: false,
      },
      createdAt: '2026-06-08T00:00:00Z',
    };

    render(<SchemaDesignerPage />);

    await waitFor(() => expect(screen.getByTestId('ai-config-editor')).toBeInTheDocument());
    const mode = screen.getByTestId('ai-config-mode') as HTMLSelectElement;
    // Still read-only in P2a, but reflects the persisted mode (not SuggestOnly).
    expect(mode).toBeDisabled();
    expect(mode.value).toBe('AutoApplyAboveThreshold');
  });
});
