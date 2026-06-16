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
  dailyTokenBudget?: number | null;
  confidenceThreshold?: number;
  entityFieldMap: Record<string, string>;
  piiAllowStore: string[];
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

  it('SchemaDesigner_ShouldPreserveAutonomousAndBudget_WhenEditingAndSaving', async () => {
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
        suggestThreshold: 0.6,
        autoApplyThreshold: 0.85,
        autonomousThreshold: 0.95,
        // Server-persisted, security-sensitive values with NO editing UI yet
        // (Batch E). A designer save must round-trip them untouched.
        autonomous: true,
        dailyTokenBudget: 50000,
        sentimentGating: true,
      },
      createdAt: '2026-06-08T00:00:00Z',
    };

    render(<SchemaDesignerPage />);

    // Wait for the form to hydrate from the loaded schema.
    await waitFor(() => expect(screen.getByTestId('ai-config-editor')).toBeInTheDocument());

    // Make an unrelated edit (rename) to prove a normal save still preserves them.
    fireEvent.change(screen.getByTestId('schema-name'), { target: { value: 'Intake Renamed' } });
    fireEvent.submit(screen.getByTestId('designer-save-btn').closest('form')!);

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    const [payload] = updateMutate.mock.calls[0] as [{ aiConfig: SubmittedAiConfig }];
    // The server-persisted autonomous flag + token budget survive the save.
    expect(payload.aiConfig.autonomous).toBe(true);
    expect(payload.aiConfig.dailyTokenBudget).toBe(50000);
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

  it('SchemaDesigner_ShouldShowNewSchemaCalibrationNote_WhenNewWithAiEnabled', async () => {
    render(<SchemaDesignerPage />);
    fireEvent.change(screen.getByTestId('schema-name'), { target: { value: 'Intake' } });

    // Hidden until AI is enabled.
    expect(screen.queryByTestId('ai-calibration-new-note')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('ai-config-enabled'));

    const note = await screen.findByTestId('ai-calibration-new-note');
    expect(note).toHaveTextContent('admin:typification.ai.calibration.newSchemaNote');
    // The calibration status panel itself is for existing schemas only.
    expect(screen.queryByTestId('ai-calibration-panel')).not.toBeInTheDocument();
  });

  it('SchemaDesigner_ShouldNotShowNewSchemaCalibrationNote_WhenEditingExistingSchema', async () => {
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
    expect(screen.queryByTestId('ai-calibration-new-note')).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // P2b D4 — entity-field-map + PII allow-list editor.
  // -------------------------------------------------------------------------

  it('SchemaDesigner_ShouldAlwaysEmitPiiAllowStore_EvenWhenEmpty', async () => {
    render(<SchemaDesignerPage />);
    fireEvent.change(screen.getByTestId('schema-name'), { target: { value: 'Intake' } });
    fireEvent.click(screen.getByTestId('ai-config-enabled'));
    await waitFor(() => expect(screen.getByTestId('ai-config-editor')).toBeInTheDocument());

    // Submit WITHOUT touching the PII allow-list.
    fireEvent.submit(screen.getByTestId('designer-save-btn').closest('form')!);

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const [payload] = createMutate.mock.calls[0] as [{ aiConfig: SubmittedAiConfig }];
    // HARD REQUIREMENT: piiAllowStore is ALWAYS present (an empty array, not undefined).
    expect(payload.aiConfig.piiAllowStore).toEqual([]);
    expect(payload.aiConfig).toHaveProperty('piiAllowStore');
    expect(payload.aiConfig.entityFieldMap).toEqual({});
  });

  it('SchemaDesigner_ShouldEmitEntityFieldMap_WhenRowsAdded', async () => {
    // Hydrate an editing schema with a field so the dropdown has an option.
    routeState.id = 'schema-1';
    schemaState.data = {
      schemaId: 'schema-1',
      name: 'Intake',
      version: 1,
      isPublished: false,
      maxDepth: 5,
      nodes: [],
      fields: [
        {
          fieldId: 'f1',
          key: 'customer_email',
          label: 'Customer email',
          type: 'Text',
          required: false,
          sortOrder: 0,
        },
      ],
      aiConfig: {
        enabled: true,
        mode: 'SuggestOnly',
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

    // Add an entity-map row, type entity "email", pick the field Key.
    fireEvent.click(screen.getByTestId('ai-entity-map-add'));
    await waitFor(() => expect(screen.getByTestId('ai-entity-map-entity-0')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('ai-entity-map-entity-0'), {
      target: { value: 'email' },
    });
    fireEvent.change(screen.getByTestId('ai-entity-map-field-0'), {
      target: { value: 'customer_email' },
    });

    fireEvent.submit(screen.getByTestId('designer-save-btn').closest('form')!);

    await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
    const [payload] = updateMutate.mock.calls[0] as [{ aiConfig: SubmittedAiConfig }];
    expect(payload.aiConfig.entityFieldMap).toEqual({ email: 'customer_email' });
  });

  it('SchemaDesigner_ShouldEmitPiiAllowStore_WhenTypeChecked', async () => {
    render(<SchemaDesignerPage />);
    fireEvent.change(screen.getByTestId('schema-name'), { target: { value: 'Intake' } });
    fireEvent.click(screen.getByTestId('ai-config-enabled'));
    await waitFor(() => expect(screen.getByTestId('ai-config-editor')).toBeInTheDocument());

    // Check the Email PII box.
    fireEvent.click(screen.getByTestId('ai-pii-allow-Email'));

    fireEvent.submit(screen.getByTestId('designer-save-btn').closest('form')!);

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const [payload] = createMutate.mock.calls[0] as [{ aiConfig: SubmittedAiConfig }];
    expect(payload.aiConfig.piiAllowStore).toContain('Email');
  });

  it('SchemaDesigner_ShouldHydrateEntityMapAndPii_WhenEditingSchema', async () => {
    routeState.id = 'schema-1';
    schemaState.data = {
      schemaId: 'schema-1',
      name: 'Intake',
      version: 1,
      isPublished: false,
      maxDepth: 5,
      nodes: [],
      fields: [
        {
          fieldId: 'f1',
          key: 'customer_email',
          label: 'Customer email',
          type: 'Text',
          required: false,
          sortOrder: 0,
        },
      ],
      aiConfig: {
        enabled: true,
        mode: 'SuggestOnly',
        suggestThreshold: 0.6,
        autoApplyThreshold: 0.85,
        autonomousThreshold: 0.95,
        autonomous: false,
        sentimentGating: true,
        entityFieldMap: { email: 'customer_email' },
        piiAllowStore: ['Phone'],
      },
      createdAt: '2026-06-08T00:00:00Z',
    };

    render(<SchemaDesignerPage />);
    await waitFor(() => expect(screen.getByTestId('ai-config-editor')).toBeInTheDocument());

    // The entity row renders with entity "email" + the field selected.
    const entity = screen.getByTestId('ai-entity-map-entity-0') as HTMLInputElement;
    expect(entity.value).toBe('email');
    const field = screen.getByTestId('ai-entity-map-field-0') as HTMLSelectElement;
    expect(field.value).toBe('customer_email');

    // The Phone PII box is checked; Email is not.
    expect(screen.getByTestId('ai-pii-allow-Phone')).toHaveAttribute('data-checked');
    expect(screen.getByTestId('ai-pii-allow-Email')).not.toHaveAttribute('data-checked');
  });

  it('SchemaDesigner_ShouldDropBlankEntityRows_WhenSubmitting', async () => {
    render(<SchemaDesignerPage />);
    fireEvent.change(screen.getByTestId('schema-name'), { target: { value: 'Intake' } });
    fireEvent.click(screen.getByTestId('ai-config-enabled'));
    await waitFor(() => expect(screen.getByTestId('ai-config-editor')).toBeInTheDocument());

    // Add a row but leave the entity name blank.
    fireEvent.click(screen.getByTestId('ai-entity-map-add'));
    await waitFor(() => expect(screen.getByTestId('ai-entity-map-entity-0')).toBeInTheDocument());

    fireEvent.submit(screen.getByTestId('designer-save-btn').closest('form')!);

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const [payload] = createMutate.mock.calls[0] as [{ aiConfig: SubmittedAiConfig }];
    expect(payload.aiConfig.entityFieldMap).toEqual({});
  });
});
