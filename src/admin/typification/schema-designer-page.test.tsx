import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMutate = vi.fn();
const updateMutate = vi.fn();
const publishMutate = vi.fn();

vi.mock('@/core/api/hooks/use-typification', () => ({
  useTypificationSchema: () => ({ data: undefined, isLoading: false }),
  useCreateTypificationSchema: () => ({ mutate: createMutate, isPending: false }),
  useUpdateTypificationSchema: () => ({ mutate: updateMutate, isPending: false }),
  usePublishTypificationSchema: () => ({
    mutate: publishMutate,
    isPending: false,
    data: undefined,
  }),
}));

// New-schema route — no id param.
vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'new' }),
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

describe('SchemaDesignerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SchemaDesignerPage_ShouldRenderEmptyEditors_WhenCreating', () => {
    render(<SchemaDesignerPage />);
    expect(screen.getByTestId('schema-designer-page')).toBeInTheDocument();
    expect(screen.getByTestId('nodes-editor')).toBeInTheDocument();
    expect(screen.getByTestId('fields-editor')).toBeInTheDocument();
    // New schema has no publish button (only after first save).
    expect(screen.queryByTestId('designer-publish-btn')).not.toBeInTheDocument();
  });

  it('SchemaDesignerPage_ShouldAddNodeRow_WhenAddNodeClicked', async () => {
    render(<SchemaDesignerPage />);
    fireEvent.click(screen.getByTestId('add-node-btn'));
    await waitFor(() => expect(screen.getByTestId('node-row-0')).toBeInTheDocument());
    expect(screen.getByTestId('node-label-0')).toBeInTheDocument();
    expect(screen.getByTestId('node-code-0')).toBeInTheDocument();
  });

  it('SchemaDesignerPage_ShouldRevealLeafOutcome_WhenIsLeafToggled', async () => {
    render(<SchemaDesignerPage />);
    fireEvent.click(screen.getByTestId('add-node-btn'));
    await waitFor(() => expect(screen.getByTestId('node-row-0')).toBeInTheDocument());

    // Leaf outcome block hidden until the isLeaf switch is on.
    expect(screen.queryByTestId('node-leaf-0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('node-isleaf-0'));
    await waitFor(() => expect(screen.getByTestId('node-leaf-0')).toBeInTheDocument());
    expect(screen.getByTestId('node-category-0')).toBeInTheDocument();
  });

  it('SchemaDesignerPage_ShouldRevealVisibleWhenEditor_WhenConditionToggled', async () => {
    render(<SchemaDesignerPage />);
    fireEvent.click(screen.getByTestId('add-field-btn'));
    await waitFor(() => expect(screen.getByTestId('field-row-0')).toBeInTheDocument());

    // The conditional visibleWhen editor is hidden until its switch is toggled.
    expect(screen.queryByTestId('field-visiblewhen-editor-0')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('field-visiblewhen-toggle-0'));
    await waitFor(() =>
      expect(screen.getByTestId('field-visiblewhen-editor-0')).toBeInTheDocument(),
    );
    // The condition sub-fields render.
    expect(screen.getByTestId('field-visiblewhen-reftype-0')).toBeInTheDocument();
    expect(screen.getByTestId('field-visiblewhen-op-0')).toBeInTheDocument();
    expect(screen.getByTestId('field-visiblewhen-ref-0')).toBeInTheDocument();
  });

  it('SchemaDesignerPage_ShouldBlockSubmit_WhenNameEmpty', async () => {
    render(<SchemaDesignerPage />);
    fireEvent.submit(screen.getByTestId('designer-save-btn').closest('form')!);
    await waitFor(() =>
      expect(screen.getByText('admin:typification.validation.nameRequired')).toBeInTheDocument(),
    );
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('SchemaDesignerPage_ShouldSubmitCreate_WithNameAndNode', async () => {
    render(<SchemaDesignerPage />);
    fireEvent.change(screen.getByTestId('schema-name'), { target: { value: 'Sales Outcomes' } });
    fireEvent.click(screen.getByTestId('add-node-btn'));
    await waitFor(() => expect(screen.getByTestId('node-row-0')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('node-label-0'), { target: { value: 'Sale' } });
    fireEvent.change(screen.getByTestId('node-code-0'), { target: { value: 'sale' } });

    fireEvent.submit(screen.getByTestId('designer-save-btn').closest('form')!);

    await waitFor(() => expect(createMutate).toHaveBeenCalledTimes(1));
    const [payload] = createMutate.mock.calls[0] as [
      { name: string; nodes: { label: string; code: string }[] },
    ];
    expect(payload.name).toBe('Sales Outcomes');
    expect(payload.nodes).toHaveLength(1);
    expect(payload.nodes[0]).toMatchObject({ label: 'Sale', code: 'sale' });
  });
});
