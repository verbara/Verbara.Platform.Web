import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { TypificationSchema, PublishResult } from '@/core/api/hooks/use-typification';

const { useSchemasMock, usePublishMock, publishMutate } = vi.hoisted(() => ({
  useSchemasMock: vi.fn(),
  usePublishMock: vi.fn(),
  publishMutate: vi.fn(),
}));

vi.mock('@/core/api/hooks/use-typification', () => ({
  useTypificationSchemas: () => useSchemasMock(),
  useDeleteTypificationSchema: () => ({ mutate: vi.fn(), isPending: false }),
  usePublishTypificationSchema: () => usePublishMock(),
  useTypificationBindings: () => ({ data: [], isLoading: false }),
  useDeleteTypificationBinding: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateTypificationBinding: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTypificationBinding: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars && 'name' in vars ? `${key}:${vars.name}` : key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// Render PermissionButton as a plain button so action clicks work without auth store.
vi.mock('@/core/ui/permission-button', () => ({
  PermissionButton: ({
    children,
    requires: _requires,
    requiresAny: _requiresAny,
    ...props
  }: {
    children: React.ReactNode;
    requires?: string;
    requiresAny?: string[];
  } & Record<string, unknown>) => <button {...props}>{children}</button>,
}));

// The bindings tab pulls a sheet form with extra hooks; stub it.
vi.mock('./binding-form-sheet', () => ({
  BindingFormSheet: () => null,
}));

import TypificationListPage from './typification-list-page';

function makeSchema(overrides: Partial<TypificationSchema> = {}): TypificationSchema {
  return {
    schemaId: 's1',
    name: 'Default Schema',
    version: 2,
    isPublished: false,
    maxDepth: 5,
    nodes: [{ nodeId: 'n1', label: 'Root', code: 'root', sortOrder: 0, isLeaf: false }],
    fields: [],
    createdAt: '2026-06-01T00:00:00Z',
    ...overrides,
  };
}

describe('TypificationListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePublishMock.mockReturnValue({ mutate: publishMutate, isPending: false, data: undefined });
  });

  it('TypificationListPage_ShouldRenderEmptyState_WhenNoSchemas', () => {
    useSchemasMock.mockReturnValue({ data: [], isLoading: false });
    render(<TypificationListPage />);
    expect(screen.getByText('admin:typification.list.empty')).toBeInTheDocument();
    expect(screen.getByTestId('typification-create-btn')).toBeInTheDocument();
  });

  it('TypificationListPage_ShouldRenderTable_WhenSchemasExist', () => {
    useSchemasMock.mockReturnValue({ data: [makeSchema()], isLoading: false });
    render(<TypificationListPage />);
    expect(screen.getByText('Default Schema')).toBeInTheDocument();
    expect(screen.getByTestId('publish-schema-s1')).toBeInTheDocument();
    expect(screen.getByTestId('edit-schema-s1')).toBeInTheDocument();
    expect(screen.getByTestId('delete-schema-s1')).toBeInTheDocument();
  });

  it('TypificationListPage_ShouldShowPublishErrors_WhenPublishFails', async () => {
    const result: PublishResult = {
      ok: false,
      errors: [
        { field: 'nodes', message: 'A schema must have at least one leaf node.' },
        { field: 'fields.0.key', message: 'Duplicate field key.' },
      ],
    };
    // The dialog reads errors off the hook's `data`; publish() invokes onSuccess(result).
    usePublishMock.mockReturnValue({
      mutate: (_id: string, opts?: { onSuccess?: (r: PublishResult) => void }) =>
        opts?.onSuccess?.(result),
      isPending: false,
      data: result,
    });
    useSchemasMock.mockReturnValue({ data: [makeSchema()], isLoading: false });

    render(<TypificationListPage />);
    fireEvent.click(screen.getByTestId('publish-schema-s1'));

    await waitFor(() => expect(screen.getByTestId('publish-errors-dialog')).toBeInTheDocument());
    const items = screen.getAllByTestId('publish-error-item');
    expect(items).toHaveLength(2);
    expect(screen.getByText('A schema must have at least one leaf node.')).toBeInTheDocument();
    expect(screen.getByText('Duplicate field key.')).toBeInTheDocument();
  });
});
