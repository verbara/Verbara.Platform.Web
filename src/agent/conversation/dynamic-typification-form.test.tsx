import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  TypificationField,
  TypificationFormResponse,
  TypificationNode,
} from '@/core/api/hooks/use-typification';

// --- Mocks ----------------------------------------------------------------

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts && typeof opts === 'object' && !('defaultValue' in opts) ? key : (opts ?? key),
    i18n: { changeLanguage: vi.fn() },
  }),
}));

const mockUseTypificationForm = vi.fn();
const mockMutate = vi.fn();

vi.mock('@/core/api/hooks/use-typification', async () => {
  const actual = await vi.importActual<typeof import('@/core/api/hooks/use-typification')>(
    '@/core/api/hooks/use-typification',
  );
  return {
    ...actual,
    useTypificationForm: () => mockUseTypificationForm(),
    useTypify: () => ({ mutate: mockMutate, isPending: false }),
  };
});

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

// PhoneInput lazy-imports the phone engine; stub it out for jsdom.
vi.mock('@/core/i18n/phone-engine', () => ({}));

import { DynamicTypificationForm } from './dynamic-typification-form';

// --- Fixtures -------------------------------------------------------------

function node(
  overrides: Partial<TypificationNode> & Pick<TypificationNode, 'nodeId'>,
): TypificationNode {
  return {
    parentNodeId: undefined,
    label: overrides.nodeId,
    code: overrides.nodeId,
    sortOrder: 0,
    isLeaf: false,
    ...overrides,
  };
}

function field(
  overrides: Partial<TypificationField> & Pick<TypificationField, 'fieldId' | 'key'>,
): TypificationField {
  return {
    label: overrides.key,
    type: 'Text',
    required: false,
    sortOrder: 0,
    ...overrides,
  };
}

function formResponse(
  nodes: TypificationNode[],
  fields: TypificationField[],
  subtreeRootNodeId?: string,
): TypificationFormResponse {
  return {
    subtreeRootNodeId,
    schema: {
      schemaId: 'schema-1',
      name: 'Test schema',
      version: 1,
      isPublished: true,
      maxDepth: 3,
      nodes,
      fields,
      createdAt: '2026-06-07T00:00:00Z',
    },
  };
}

function setForm(data: TypificationFormResponse) {
  mockUseTypificationForm.mockReturnValue({ data, isLoading: false, isError: false });
}

beforeEach(() => {
  mockUseTypificationForm.mockReset();
  mockMutate.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

// --- Tests ----------------------------------------------------------------

describe('DynamicTypificationForm', () => {
  it('DynamicTypificationForm_ShouldShowField_WhenVisibleWhenConditionMet', () => {
    setForm(
      formResponse(
        [node({ nodeId: 'sale', isLeaf: true, code: 'SALE' })],
        [
          field({ fieldId: 'f1', key: 'reason', label: 'Reason', type: 'Text' }),
          field({
            fieldId: 'f2',
            key: 'detail',
            label: 'Detail',
            type: 'Text',
            visibleWhen: { refType: 'Field', ref: 'reason', op: 'Eq', value: 'show' },
          }),
        ],
      ),
    );

    render(<DynamicTypificationForm conversationId="conv-1" />);

    // Detail is hidden until reason === 'show'.
    expect(screen.queryByTestId('typification-field-detail')).toBeNull();

    fireEvent.change(screen.getByTestId('typification-field-reason'), {
      target: { value: 'show' },
    });

    expect(screen.getByTestId('typification-field-detail')).toBeInTheDocument();
  });

  it('DynamicTypificationForm_ShouldHideField_WhenConditionUnmet', () => {
    setForm(
      formResponse(
        [node({ nodeId: 'sale', isLeaf: true, code: 'SALE' })],
        [
          field({ fieldId: 'f1', key: 'reason', label: 'Reason', type: 'Text' }),
          field({
            fieldId: 'f2',
            key: 'detail',
            label: 'Detail',
            type: 'Text',
            visibleWhen: { refType: 'Field', ref: 'reason', op: 'Eq', value: 'show' },
          }),
        ],
      ),
    );

    render(<DynamicTypificationForm conversationId="conv-1" />);

    fireEvent.change(screen.getByTestId('typification-field-reason'), {
      target: { value: 'something-else' },
    });

    expect(screen.queryByTestId('typification-field-detail')).toBeNull();
  });

  it('DynamicTypificationForm_ShouldDisableSubmit_WhenRequiredFieldEmpty', () => {
    setForm(
      formResponse(
        [node({ nodeId: 'sale', isLeaf: true, code: 'SALE', label: 'Sale' })],
        [field({ fieldId: 'f1', key: 'reason', label: 'Reason', type: 'Text', required: true })],
      ),
    );

    render(<DynamicTypificationForm conversationId="conv-1" />);

    // Pick the leaf so the path-ends-at-leaf gate is satisfied; submit is still
    // blocked by the empty required field.
    fireEvent.change(screen.getByTestId('typification-node-0'), { target: { value: 'sale' } });
    expect(screen.getByTestId('typification-submit')).toBeDisabled();

    // Fill the required field -> submit enabled.
    fireEvent.change(screen.getByTestId('typification-field-reason'), {
      target: { value: 'customer happy' },
    });
    expect(screen.getByTestId('typification-submit')).toBeEnabled();
  });

  it('DynamicTypificationForm_ShouldSubmitFullPath_WhenSubtreeBinding', () => {
    // Schema: root -> mid(subtreeRoot) -> { leafA, leafB }. The cascade UI is
    // rooted at mid's children, but the submitted path must be root -> mid -> leaf.
    setForm(
      formResponse(
        [
          node({ nodeId: 'root', label: 'Root', code: 'ROOT', isLeaf: false, sortOrder: 0 }),
          node({
            nodeId: 'mid',
            parentNodeId: 'root',
            label: 'Mid',
            code: 'MID',
            isLeaf: false,
            sortOrder: 0,
          }),
          node({
            nodeId: 'leafA',
            parentNodeId: 'mid',
            label: 'Leaf A',
            code: 'LEAF_A',
            isLeaf: true,
            sortOrder: 0,
          }),
          node({
            nodeId: 'leafB',
            parentNodeId: 'mid',
            label: 'Leaf B',
            code: 'LEAF_B',
            isLeaf: true,
            sortOrder: 1,
          }),
        ],
        [],
        'mid',
      ),
    );

    render(<DynamicTypificationForm conversationId="conv-1" />);

    // The first (only) cascade level lists mid's children directly.
    fireEvent.change(screen.getByTestId('typification-node-0'), { target: { value: 'leafA' } });
    expect(screen.getByTestId('typification-submit')).toBeEnabled();

    fireEvent.click(screen.getByTestId('typification-submit'));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const payload = mockMutate.mock.calls[0]?.[0] as { selectedNodePath: string[] };
    expect(payload.selectedNodePath).toEqual(['root', 'mid', 'leafA']);
  });

  it('DynamicTypificationForm_ShouldSubmitDateAsUtcIso_WhenDateFieldFilled', () => {
    setForm(
      formResponse(
        [node({ nodeId: 'sale', isLeaf: true, code: 'SALE', label: 'Sale' })],
        [field({ fieldId: 'f1', key: 'callback_date', label: 'Callback', type: 'Date' })],
      ),
    );

    render(<DynamicTypificationForm conversationId="conv-1" />);

    fireEvent.change(screen.getByTestId('typification-node-0'), { target: { value: 'sale' } });

    const localValue = '2026-06-08T14:30';
    fireEvent.change(screen.getByTestId('typification-field-callback_date'), {
      target: { value: localValue },
    });

    fireEvent.click(screen.getByTestId('typification-submit'));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const payload = mockMutate.mock.calls[0]?.[0] as { fieldValues: Record<string, string> };
    const submitted = payload.fieldValues.callback_date;
    expect(submitted).toBe(new Date(localValue).toISOString());
    expect(submitted).toMatch(/\dT.*Z$/);
  });

  it('DynamicTypificationForm_ShouldAdvanceCascade_WhenParentNodeSelected', () => {
    setForm(
      formResponse(
        [
          node({ nodeId: 'root', label: 'Root', code: 'ROOT', isLeaf: false, sortOrder: 0 }),
          node({
            nodeId: 'child',
            parentNodeId: 'root',
            label: 'Child leaf',
            code: 'CHILD',
            isLeaf: true,
            sortOrder: 0,
          }),
        ],
        [],
      ),
    );

    render(<DynamicTypificationForm conversationId="conv-1" />);

    // Only level 0 exists initially.
    expect(screen.getByTestId('typification-node-0')).toBeInTheDocument();
    expect(screen.queryByTestId('typification-node-1')).toBeNull();
    // Path not at a leaf yet -> submit disabled.
    expect(screen.getByTestId('typification-submit')).toBeDisabled();

    // Selecting the parent reveals level 1 (its children).
    fireEvent.change(screen.getByTestId('typification-node-0'), { target: { value: 'root' } });
    expect(screen.getByTestId('typification-node-1')).toBeInTheDocument();
    // Still not at a leaf.
    expect(screen.getByTestId('typification-submit')).toBeDisabled();

    // Selecting the leaf child enables submit.
    fireEvent.change(screen.getByTestId('typification-node-1'), { target: { value: 'child' } });
    expect(screen.getByTestId('typification-submit')).toBeEnabled();
  });
});
