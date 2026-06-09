import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  TypificationField,
  TypificationFormResponse,
  TypificationNode,
  TypificationSuggestionResponse,
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
const mockSuggestionMutate = vi.fn();

// Holder the suggestion-hook mock returns: tests set `.data` / `.isPending` to
// simulate the AI suggestion mutation's result. `mutate` is a no-op spy (the
// real LLM call is not exercised in jsdom).
const suggestionState: {
  data: TypificationSuggestionResponse | undefined;
  isPending: boolean;
} = { data: undefined, isPending: false };

vi.mock('@/core/api/hooks/use-typification', async () => {
  const actual = await vi.importActual<typeof import('@/core/api/hooks/use-typification')>(
    '@/core/api/hooks/use-typification',
  );
  return {
    ...actual,
    useTypificationForm: () => mockUseTypificationForm(),
    useTypify: () => ({ mutate: mockMutate, isPending: false }),
    useTypificationSuggestion: () => ({
      mutate: mockSuggestionMutate,
      data: suggestionState.data,
      isPending: suggestionState.isPending,
    }),
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

interface FormResponseExtras {
  subtreeRootNodeId?: string;
  prefilledNodePath?: string[];
  prefilledFieldValues?: Record<string, string>;
}

function formResponse(
  nodes: TypificationNode[],
  fields: TypificationField[],
  extras: string | FormResponseExtras = {},
): TypificationFormResponse {
  const normalized: FormResponseExtras =
    typeof extras === 'string' ? { subtreeRootNodeId: extras } : extras;
  return {
    subtreeRootNodeId: normalized.subtreeRootNodeId,
    prefilledNodePath: normalized.prefilledNodePath,
    prefilledFieldValues: normalized.prefilledFieldValues,
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
  mockSuggestionMutate.mockReset();
  suggestionState.data = undefined;
  suggestionState.isPending = false;
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

  // --- M3: server prefill hydration ---------------------------------------

  it('DynamicTypificationForm_ShouldPreselectCascade_WhenPrefilledNodePathProvided', () => {
    // No subtree binding: the full prefilledNodePath is the subtree-relative path.
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
        { prefilledNodePath: ['root', 'child'] },
      ),
    );

    render(<DynamicTypificationForm conversationId="conv-1" />);

    // Both cascade levels render with the preselected nodes already chosen.
    expect((screen.getByTestId('typification-node-0') as HTMLSelectElement).value).toBe('root');
    expect((screen.getByTestId('typification-node-1') as HTMLSelectElement).value).toBe('child');
    // Path ends at a leaf -> submit enabled straight away (agent just confirms).
    expect(screen.getByTestId('typification-submit')).toBeEnabled();
  });

  it('DynamicTypificationForm_ShouldStripAncestorPrefix_WhenSubtreeBinding', () => {
    // Subtree binding rooted at 'mid'. The server sends the FULL root→leaf path
    // ['root','mid','leafA']; the UI cascade is rooted at mid's children, so the
    // subtree-relative selection must be just ['leafA'] (inverse of
    // ancestorChainInclusive = ['root','mid']).
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
        { subtreeRootNodeId: 'mid', prefilledNodePath: ['root', 'mid', 'leafA'] },
      ),
    );

    render(<DynamicTypificationForm conversationId="conv-1" />);

    // The single cascade level lists mid's children and 'leafA' is preselected.
    expect((screen.getByTestId('typification-node-0') as HTMLSelectElement).value).toBe('leafA');
    expect(screen.queryByTestId('typification-node-1')).toBeNull();
    expect(screen.getByTestId('typification-submit')).toBeEnabled();

    // Submitting re-prepends the ancestor chain to the full server path.
    fireEvent.click(screen.getByTestId('typification-submit'));
    expect(mockMutate).toHaveBeenCalledTimes(1);
    const payload = mockMutate.mock.calls[0]?.[0] as { selectedNodePath: string[] };
    expect(payload.selectedNodePath).toEqual(['root', 'mid', 'leafA']);
  });

  it('DynamicTypificationForm_ShouldPrefillFields_WhenPrefilledFieldValuesProvided', () => {
    setForm(
      formResponse(
        [node({ nodeId: 'sale', isLeaf: true, code: 'SALE', label: 'Sale' })],
        [
          field({ fieldId: 'f1', key: 'reason', label: 'Reason', type: 'Text' }),
          field({ fieldId: 'f2', key: 'amount', label: 'Amount', type: 'Number' }),
        ],
        { prefilledNodePath: ['sale'], prefilledFieldValues: { reason: 'renewal', amount: '42' } },
      ),
    );

    render(<DynamicTypificationForm conversationId="conv-1" />);

    expect((screen.getByTestId('typification-field-reason') as HTMLInputElement).value).toBe(
      'renewal',
    );
    expect((screen.getByTestId('typification-field-amount') as HTMLInputElement).value).toBe('42');
  });

  it('DynamicTypificationForm_ShouldAllowAgentOverride_WhenPrefilled', () => {
    setForm(
      formResponse(
        [
          node({ nodeId: 'root', label: 'Root', code: 'ROOT', isLeaf: false, sortOrder: 0 }),
          node({
            nodeId: 'leafA',
            parentNodeId: 'root',
            label: 'Leaf A',
            code: 'LEAF_A',
            isLeaf: true,
            sortOrder: 0,
          }),
          node({
            nodeId: 'leafB',
            parentNodeId: 'root',
            label: 'Leaf B',
            code: 'LEAF_B',
            isLeaf: true,
            sortOrder: 1,
          }),
        ],
        [field({ fieldId: 'f1', key: 'reason', label: 'Reason', type: 'Text' })],
        { prefilledNodePath: ['root', 'leafA'], prefilledFieldValues: { reason: 'renewal' } },
      ),
    );

    render(<DynamicTypificationForm conversationId="conv-1" />);

    // Sanity: hydrated values present.
    expect((screen.getByTestId('typification-node-1') as HTMLSelectElement).value).toBe('leafA');
    expect((screen.getByTestId('typification-field-reason') as HTMLInputElement).value).toBe(
      'renewal',
    );

    // Agent overrides the leaf and the field; hydration must NOT re-clobber.
    fireEvent.change(screen.getByTestId('typification-node-1'), { target: { value: 'leafB' } });
    fireEvent.change(screen.getByTestId('typification-field-reason'), {
      target: { value: 'cancellation' },
    });

    expect((screen.getByTestId('typification-node-1') as HTMLSelectElement).value).toBe('leafB');
    expect((screen.getByTestId('typification-field-reason') as HTMLInputElement).value).toBe(
      'cancellation',
    );

    fireEvent.click(screen.getByTestId('typification-submit'));
    expect(mockMutate).toHaveBeenCalledTimes(1);
    const payload = mockMutate.mock.calls[0]?.[0] as {
      selectedNodePath: string[];
      fieldValues: Record<string, string>;
    };
    expect(payload.selectedNodePath).toEqual(['root', 'leafB']);
    expect(payload.fieldValues.reason).toBe('cancellation');
  });

  it('DynamicTypificationForm_ShouldRenderDatePrefill_WhenIsoInstantProvided', () => {
    // The server seeds a Date field with a full UTC ISO instant; the
    // <input type="datetime-local"> only accepts "YYYY-MM-DDTHH:mm", so the form
    // must convert the instant to the local datetime-local format on hydration —
    // otherwise the input renders empty and the prefill is lost.
    const instant = '2026-06-08T14:30:00Z';
    setForm(
      formResponse(
        [node({ nodeId: 'sale', isLeaf: true, code: 'SALE', label: 'Sale' })],
        [field({ fieldId: 'f1', key: 'callback_date', label: 'Callback', type: 'Date' })],
        { prefilledNodePath: ['sale'], prefilledFieldValues: { callback_date: instant } },
      ),
    );

    render(<DynamicTypificationForm conversationId="conv-1" />);

    const input = screen.getByTestId('typification-field-callback_date') as HTMLInputElement;
    // Local wall-clock derived from the instant (TZ-agnostic assertion).
    const d = new Date(instant);
    const pad = (n: number) => String(n).padStart(2, '0');
    const expected = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    expect(input.value).toBe(expected);
    // It is NOT the raw instant (which the control would reject and render empty).
    expect(input.value).not.toContain('Z');
  });

  it('DynamicTypificationForm_ShouldResetState_WhenHydrationKeyChangesWithoutPrefill', () => {
    // Conversation A loads WITH prefill, then the same mounted instance is reused
    // for conversation B which has NO prefill: prior selections must be cleared so
    // A's state can't leak into B (defensive — the Sheet normally unmounts).
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
        [field({ fieldId: 'f1', key: 'reason', label: 'Reason', type: 'Text' })],
        { prefilledNodePath: ['root', 'child'], prefilledFieldValues: { reason: 'renewal' } },
      ),
    );

    const { rerender } = render(<DynamicTypificationForm conversationId="conv-A" />);

    // Conversation A hydrated.
    expect((screen.getByTestId('typification-node-0') as HTMLSelectElement).value).toBe('root');
    expect((screen.getByTestId('typification-node-1') as HTMLSelectElement).value).toBe('child');
    expect((screen.getByTestId('typification-field-reason') as HTMLInputElement).value).toBe(
      'renewal',
    );

    // Switch to conversation B (new hydration key) with NO prefill.
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
        [field({ fieldId: 'f1', key: 'reason', label: 'Reason', type: 'Text' })],
      ),
    );
    rerender(<DynamicTypificationForm conversationId="conv-B" />);

    // A's selection/field state must be cleared, not leaked into B.
    expect((screen.getByTestId('typification-node-0') as HTMLSelectElement).value).toBe('');
    expect(screen.queryByTestId('typification-node-1')).toBeNull();
    expect((screen.getByTestId('typification-field-reason') as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('typification-submit')).toBeDisabled();
  });

  it('DynamicTypificationForm_ShouldRenderEmpty_WhenNoPrefill', () => {
    // Regression: no prefill members -> the manual flow is unchanged (nothing
    // preselected, submit blocked until the agent picks a leaf).
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
        [field({ fieldId: 'f1', key: 'reason', label: 'Reason', type: 'Text' })],
      ),
    );

    render(<DynamicTypificationForm conversationId="conv-1" />);

    expect((screen.getByTestId('typification-node-0') as HTMLSelectElement).value).toBe('');
    expect(screen.queryByTestId('typification-node-1')).toBeNull();
    expect((screen.getByTestId('typification-field-reason') as HTMLInputElement).value).toBe('');
    expect(screen.getByTestId('typification-submit')).toBeDisabled();
  });

  // --- P2a: AI suggestion overlay -----------------------------------------

  function aiSchema(): TypificationFormResponse {
    return formResponse(
      [
        node({ nodeId: 'root', label: 'Root', code: 'ROOT', isLeaf: false, sortOrder: 0 }),
        node({
          nodeId: 'leafA',
          parentNodeId: 'root',
          label: 'Leaf A',
          code: 'LEAF_A',
          isLeaf: true,
          sortOrder: 0,
        }),
        node({
          nodeId: 'leafB',
          parentNodeId: 'root',
          label: 'Leaf B',
          code: 'LEAF_B',
          isLeaf: true,
          sortOrder: 1,
        }),
      ],
      [field({ fieldId: 'f1', key: 'reason', label: 'Reason', type: 'Text' })],
    );
  }

  it('DynamicTypificationForm_ShouldShowAiSuggestion_WhenSuggestionReturned', () => {
    setForm(aiSchema());
    suggestionState.data = {
      suggestedNodePath: ['root', 'leafA'],
      suggestedFieldValues: { reason: 'renewal' },
      confidence: 0.92,
      sentiment: 'Positive',
    };

    render(<DynamicTypificationForm conversationId="conv-1" />);

    // The suggestion fires once after the form loads.
    expect(mockSuggestionMutate).toHaveBeenCalledWith('conv-1');
    // Banner with path + confidence + sentiment is shown; cascade NOT auto-seeded.
    expect(screen.getByTestId('typification-ai-suggestion')).toBeInTheDocument();
    expect(screen.getByTestId('typification-ai-confidence')).toBeInTheDocument();
    expect(screen.getByTestId('typification-ai-sentiment')).toBeInTheDocument();
    expect(screen.getByTestId('typification-ai-path').textContent).toContain('Root');
    expect(screen.getByTestId('typification-ai-path').textContent).toContain('Leaf A');
    // AI must NOT auto-apply over the (empty) cascade — agent must click Accept.
    expect((screen.getByTestId('typification-node-0') as HTMLSelectElement).value).toBe('');
  });

  it('DynamicTypificationForm_ShouldSeedCascadeOnAccept_WhenAiSuggestionAccepted', () => {
    setForm(aiSchema());
    suggestionState.data = {
      suggestedNodePath: ['root', 'leafA'],
      suggestedFieldValues: { reason: 'renewal' },
      confidence: 0.92,
      sentiment: 'Positive',
    };

    render(<DynamicTypificationForm conversationId="conv-1" />);

    fireEvent.click(screen.getByTestId('typification-ai-accept'));

    // Cascade + field seeded from the suggestion; banner gone.
    expect((screen.getByTestId('typification-node-0') as HTMLSelectElement).value).toBe('root');
    expect((screen.getByTestId('typification-node-1') as HTMLSelectElement).value).toBe('leafA');
    expect((screen.getByTestId('typification-field-reason') as HTMLInputElement).value).toBe(
      'renewal',
    );
    expect(screen.queryByTestId('typification-ai-suggestion')).toBeNull();
    expect(screen.getByTestId('typification-submit')).toBeEnabled();
  });

  it('DynamicTypificationForm_ShouldHideAiAffordance_WhenNoSuggestion', () => {
    setForm(aiSchema());
    // 402 / empty suggestion → hook resolves to {} (no path).
    suggestionState.data = {};

    render(<DynamicTypificationForm conversationId="conv-1" />);

    // No banner, no analyzing spinner (resolved), manual flow intact.
    expect(screen.queryByTestId('typification-ai-suggestion')).toBeNull();
    expect(screen.queryByTestId('typification-ai-analyzing')).toBeNull();
    expect(screen.getByTestId('typification-node-0')).toBeInTheDocument();
  });

  it('DynamicTypificationForm_ShouldSendAutoAiFlags_WhenSubmittingAcceptedSuggestion', () => {
    setForm(aiSchema());
    suggestionState.data = {
      suggestedNodePath: ['root', 'leafA'],
      suggestedFieldValues: { reason: 'renewal' },
      confidence: 0.92,
      sentiment: 'Positive',
    };

    render(<DynamicTypificationForm conversationId="conv-1" />);

    fireEvent.click(screen.getByTestId('typification-ai-accept'));
    fireEvent.click(screen.getByTestId('typification-submit'));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const payload = mockMutate.mock.calls[0]?.[0] as {
      selectedNodePath: string[];
      aiSuggested?: boolean;
      aiConfidence?: number;
      aiAccepted?: boolean;
    };
    expect(payload.selectedNodePath).toEqual(['root', 'leafA']);
    expect(payload.aiSuggested).toBe(true);
    expect(payload.aiAccepted).toBe(true);
    expect(payload.aiConfidence).toBe(0.92);
  });

  it('DynamicTypificationForm_ShouldNotSendAiFlags_WhenSuggestionDismissed', () => {
    setForm(aiSchema());
    suggestionState.data = {
      suggestedNodePath: ['root', 'leafA'],
      confidence: 0.92,
    };

    render(<DynamicTypificationForm conversationId="conv-1" />);

    // Dismiss the suggestion, then classify manually.
    fireEvent.click(screen.getByTestId('typification-ai-dismiss'));
    expect(screen.queryByTestId('typification-ai-suggestion')).toBeNull();

    // Manual classification: pick root (reveals level 1), then leafB.
    fireEvent.change(screen.getByTestId('typification-node-0'), { target: { value: 'root' } });
    fireEvent.change(screen.getByTestId('typification-node-1'), { target: { value: 'leafB' } });
    fireEvent.click(screen.getByTestId('typification-submit'));

    expect(mockMutate).toHaveBeenCalledTimes(1);
    const payload = mockMutate.mock.calls[0]?.[0] as {
      selectedNodePath: string[];
      aiSuggested?: boolean;
      aiAccepted?: boolean;
      aiConfidence?: number;
    };
    expect(payload.selectedNodePath).toEqual(['root', 'leafB']);
    expect(payload.aiSuggested).toBe(false);
    expect(payload.aiAccepted).toBe(false);
    expect(payload.aiConfidence).toBeUndefined();
  });
});
