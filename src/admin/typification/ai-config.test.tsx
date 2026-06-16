import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  TypificationSchema,
  TypificationCalibrationStatus,
} from '@/core/api/hooks/use-typification';

const createMutate = vi.fn();
const updateMutate = vi.fn();
const publishMutate = vi.fn();

// Mutable holders so individual tests can swap the loaded schema / route param /
// calibration status without re-mocking the module.
const schemaState: { data: TypificationSchema | undefined } = { data: undefined };
const routeState: { id: string } = { id: 'new' };
const calibrationState: { data: TypificationCalibrationStatus } = {
  data: { samples: 0, accuracy: 0, autoFillReady: false, autonomousReady: false },
};

vi.mock('@/core/api/hooks/use-typification', () => ({
  useTypificationSchema: () => ({ data: schemaState.data, isLoading: false }),
  useCalibrationStatus: () => ({ data: calibrationState.data }),
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
  suggestThreshold: number;
  autoApplyThreshold: number;
  autonomousThreshold: number;
  autonomous: boolean;
  sentimentGating: boolean;
  confidenceThreshold?: number;
}

describe('SchemaDesigner AI config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schemaState.data = undefined;
    routeState.id = 'new';
    calibrationState.data = {
      samples: 0,
      accuracy: 0,
      autoFillReady: false,
      autonomousReady: false,
    };
  });

  it('SchemaDesigner_ShouldEmitBands_WhenEnabledWithThresholds', async () => {
    render(<SchemaDesignerPage />);
    fireEvent.change(screen.getByTestId('schema-name'), { target: { value: 'Intake' } });

    // Editor hidden until enabled.
    expect(screen.queryByTestId('ai-config-editor')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ai-config-enabled'));
    await waitFor(() => expect(screen.getByTestId('ai-config-editor')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('ai-config-suggest-threshold'), {
      target: { value: '60' },
    });
    fireEvent.change(screen.getByTestId('ai-config-autoapply-threshold'), {
      target: { value: '85' },
    });
    fireEvent.change(screen.getByTestId('ai-config-autonomous-threshold'), {
      target: { value: '95' },
    });

    fireEvent.submit(screen.getByTestId('designer-save-btn').closest('form')!);

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const [payload] = createMutate.mock.calls[0] as [{ aiConfig: SubmittedAiConfig }];
    expect(payload.aiConfig.enabled).toBe(true);
    // Default mode for a new schema is Shadow.
    expect(payload.aiConfig.mode).toBe('Shadow');
    expect(payload.aiConfig.suggestThreshold).toBeCloseTo(0.6, 5);
    expect(payload.aiConfig.autoApplyThreshold).toBeCloseTo(0.85, 5);
    expect(payload.aiConfig.autonomousThreshold).toBeCloseTo(0.95, 5);
    expect(payload.aiConfig.autonomous).toBe(false);
    // No legacy single-threshold field on the wire.
    expect(payload.aiConfig).not.toHaveProperty('confidenceThreshold');
  });

  it('SchemaDesigner_ShouldEnableModeSelect_WhenAiEnabled', async () => {
    render(<SchemaDesignerPage />);
    fireEvent.change(screen.getByTestId('schema-name'), { target: { value: 'Intake' } });
    fireEvent.click(screen.getByTestId('ai-config-enabled'));
    await waitFor(() => expect(screen.getByTestId('ai-config-editor')).toBeInTheDocument());

    // The mode select is no longer hard-disabled (P2b un-gates it).
    expect(screen.getByTestId('ai-config-mode')).not.toBeDisabled();
  });

  it('SchemaDesigner_ShouldDisableAutoFillOption_WhenCalibrationNotReady', async () => {
    calibrationState.data = {
      samples: 10,
      accuracy: 0.5,
      autoFillReady: false,
      autonomousReady: false,
    };
    render(<SchemaDesignerPage />);
    fireEvent.change(screen.getByTestId('schema-name'), { target: { value: 'Intake' } });
    fireEvent.click(screen.getByTestId('ai-config-enabled'));
    await waitFor(() => expect(screen.getByTestId('ai-config-editor')).toBeInTheDocument());

    const optionDisabled = (): boolean => {
      const select = screen.getByTestId('ai-config-mode') as HTMLSelectElement;
      const autoFill = Array.from(select.options).find((o) => o.value === 'AutoFill')!;
      return autoFill.disabled;
    };
    expect(optionDisabled()).toBe(true);

    // Flip calibration to ready and re-render → the AutoFill option enables.
    cleanup();
    calibrationState.data = {
      samples: 300,
      accuracy: 0.95,
      autoFillReady: true,
      autonomousReady: false,
    };
    render(<SchemaDesignerPage />);
    fireEvent.change(screen.getByTestId('schema-name'), { target: { value: 'Intake' } });
    fireEvent.click(screen.getByTestId('ai-config-enabled'));
    await waitFor(() => expect(screen.getByTestId('ai-config-editor')).toBeInTheDocument());
    expect(optionDisabled()).toBe(false);
  });

  it('SchemaDesigner_ShouldHydrateBands_WhenEditingSchema', async () => {
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
        suggestThreshold: 0.65,
        autoApplyThreshold: 0.8,
        autonomousThreshold: 0.92,
        autonomous: false,
        sentimentGating: true,
      },
      createdAt: '2026-06-08T00:00:00Z',
    };

    render(<SchemaDesignerPage />);

    await waitFor(() => expect(screen.getByTestId('ai-config-editor')).toBeInTheDocument());
    const suggest = screen.getByTestId('ai-config-suggest-threshold') as HTMLInputElement;
    expect(suggest.value).toBe('65');
  });

  it('SchemaDesigner_ShouldRenderCalibrationPanel_WhenEditingExistingSchema', async () => {
    routeState.id = 'schema-1';
    calibrationState.data = {
      samples: 250,
      accuracy: 0.9,
      autoFillReady: true,
      autonomousReady: false,
    };
    schemaState.data = {
      schemaId: 'schema-1',
      name: 'Intake',
      version: 1,
      isPublished: false,
      maxDepth: 5,
      nodes: [],
      fields: [],
      createdAt: '2026-06-08T00:00:00Z',
    };

    render(<SchemaDesignerPage />);

    const panel = await screen.findByTestId('ai-calibration-panel');
    expect(panel).toHaveTextContent('250');
    // AutoFill-ready badge reflects the ready state.
    expect(screen.getByTestId('ai-calibration-autofill-ready')).toHaveTextContent(
      'admin:typification.ai.calibration.autoFillReady',
    );
  });

  it('SchemaDesigner_ShouldDisplayPersistedAutoFillMode_WhenEditingAutoFillSchema', async () => {
    routeState.id = 'schema-1';
    // Calibration NOT ready, yet the persisted mode is AutoFill.
    calibrationState.data = {
      samples: 5,
      accuracy: 0.4,
      autoFillReady: false,
      autonomousReady: false,
    };
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
        mode: 'AutoFill',
        suggestThreshold: 0.6,
        autoApplyThreshold: 0.85,
        autonomousThreshold: 0.95,
        autonomous: false,
        sentimentGating: true,
      },
      createdAt: '2026-06-08T00:00:00Z',
    };

    render(<SchemaDesignerPage />);

    await waitFor(() => expect(screen.getByTestId('ai-config-editor')).toBeInTheDocument());
    const mode = screen.getByTestId('ai-config-mode') as HTMLSelectElement;
    // The persisted AutoFill mode is preserved (option not stripped).
    expect(mode.value).toBe('AutoFill');
    const autoFill = Array.from(mode.options).find((o) => o.value === 'AutoFill')!;
    expect(autoFill.disabled).toBe(false);
  });

  it('SchemaDesigner_ShouldEmitDisabledAiConfig_WhenLeftOff', async () => {
    render(<SchemaDesignerPage />);
    fireEvent.change(screen.getByTestId('schema-name'), { target: { value: 'Intake' } });

    fireEvent.submit(screen.getByTestId('designer-save-btn').closest('form')!);

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const [payload] = createMutate.mock.calls[0] as [{ aiConfig: SubmittedAiConfig }];
    expect(payload.aiConfig.enabled).toBe(false);
    expect(payload.aiConfig.mode).toBe('Shadow');
    expect(payload.aiConfig.autonomous).toBe(false);
  });
});
