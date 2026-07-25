import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TypificationSchema } from '@/core/api/hooks/use-typification';

const createMutate = vi.fn();
const updateMutate = vi.fn();
const publishMutate = vi.fn();

// Mutable holder so individual tests can swap the loaded schema (edit route).
const schemaState: { data: TypificationSchema | undefined } = { data: undefined };
// Mutable holder so individual tests can swap the route param (new vs edit).
const routeState: { id: string } = { id: 'new' };

vi.mock('@/core/api/hooks/use-typification', () => ({
  useTypificationSchema: () => ({ data: schemaState.data, isLoading: false }),
  useCalibrationStatus: () => ({
    data: { samples: 0, accuracy: 0, autoFillReady: false, autonomousReady: false },
  }),
  useCreateTypificationSchema: () => ({ mutate: createMutate, isPending: false }),
  useUpdateTypificationSchema: () => ({ mutate: updateMutate, isPending: false }),
  usePublishTypificationSchema: () => ({
    mutate: publishMutate,
    isPending: false,
    data: undefined,
  }),
}));

vi.mock('react-router', () => ({
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

interface SubmittedField {
  key: string;
  prefillSource?: { kind: string; ref: string };
}

describe('FieldEditor prefill source', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schemaState.data = undefined;
    routeState.id = 'new';
  });

  it('FieldEditor_ShouldEmitMetadataPrefillSource_WhenEnabledWithKey', async () => {
    render(<SchemaDesignerPage />);
    fireEvent.change(screen.getByTestId('schema-name'), { target: { value: 'Intake' } });
    fireEvent.click(screen.getByTestId('add-field-btn'));
    await waitFor(() => expect(screen.getByTestId('field-row-0')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('field-key-0'), { target: { value: 'patient' } });
    fireEvent.change(screen.getByTestId('field-label-0'), { target: { value: 'Patient' } });

    // Prefill editor hidden until toggled.
    expect(screen.queryByTestId('field-prefill-editor-0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('field-prefill-toggle-0'));
    await waitFor(() => expect(screen.getByTestId('field-prefill-editor-0')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('field-prefill-ref-0'), {
      target: { value: 'patientId' },
    });

    fireEvent.submit(screen.getByTestId('designer-save-btn').closest('form')!);

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const [payload] = createMutate.mock.calls[0] as [{ fields: SubmittedField[] }];
    expect(payload.fields).toHaveLength(1);
    expect(payload.fields[0]?.prefillSource).toEqual({ kind: 'Metadata', ref: 'patientId' });
  });

  it('FieldEditor_ShouldOmitPrefillSource_WhenDisabled', async () => {
    render(<SchemaDesignerPage />);
    fireEvent.change(screen.getByTestId('schema-name'), { target: { value: 'Intake' } });
    fireEvent.click(screen.getByTestId('add-field-btn'));
    await waitFor(() => expect(screen.getByTestId('field-row-0')).toBeInTheDocument());

    fireEvent.change(screen.getByTestId('field-key-0'), { target: { value: 'patient' } });
    fireEvent.change(screen.getByTestId('field-label-0'), { target: { value: 'Patient' } });

    // Leave the prefill toggle off.
    fireEvent.submit(screen.getByTestId('designer-save-btn').closest('form')!);

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const [payload] = createMutate.mock.calls[0] as [{ fields: SubmittedField[] }];
    expect(payload.fields).toHaveLength(1);
    expect(payload.fields[0]?.prefillSource).toBeUndefined();
  });

  it('FieldEditor_ShouldHydratePrefillControl_WhenEditingFieldWithPrefillSource', async () => {
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
          fieldId: 'field-1',
          key: 'patient',
          label: 'Patient',
          type: 'Text',
          required: false,
          prefillSource: { kind: 'Metadata', ref: 'patientId' },
          sortOrder: 0,
        },
      ],
      createdAt: '2026-06-08T00:00:00Z',
    };

    render(<SchemaDesignerPage />);

    // Editing -> prefill toggle is on and the metadata-key input is hydrated.
    await waitFor(() => expect(screen.getByTestId('field-prefill-editor-0')).toBeInTheDocument());
    const refInput = screen.getByTestId('field-prefill-ref-0') as HTMLInputElement;
    expect(refInput.value).toBe('patientId');
  });
});
