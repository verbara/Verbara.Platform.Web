import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock('@/core/api/hooks/use-reason-hints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/hooks/use-reason-hints')>();
  return {
    ...actual,
    useCreateReasonHint: () => ({ mutate: createMutate }),
    useUpdateReasonHint: () => ({ mutate: updateMutate }),
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { ReasonHintForm } from './reason-hint-form';
import { parseCodes, codesToText } from './reason-hint-codes';
import type { ReasonHint } from '@/core/api/hooks/use-reason-hints';

describe('ReasonHintForm helpers', () => {
  it('parseCodes_ShouldTrimAndDropBlanks_WhenGivenCommaList', () => {
    expect(parseCodes('CITAS, REPROG ,  , ')).toEqual(['CITAS', 'REPROG']);
  });

  it('codesToText_ShouldJoinArray_WhenGivenJsonArrayString', () => {
    expect(codesToText('["CITAS","REPROG"]')).toBe('CITAS, REPROG');
  });

  it('codesToText_ShouldReturnRaw_WhenNotValidJson', () => {
    expect(codesToText('CITAS')).toBe('CITAS');
  });
});

describe('ReasonHintForm fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ReasonHintForm_ShouldRenderFields_WhenCreating', () => {
    render(<ReasonHintForm open mode="create" onOpenChange={() => {}} />);

    expect(screen.getByTestId('reason-hint-form-scope')).toBeInTheDocument();
    expect(screen.getByTestId('reason-hint-form-scopeRef')).toBeInTheDocument();
    expect(screen.getByTestId('reason-hint-form-reasonCodes')).toBeInTheDocument();
    expect(screen.getByTestId('reason-hint-form-priority')).toBeInTheDocument();
    expect(screen.getByTestId('reason-hint-form-isActive')).toBeInTheDocument();
    expect(screen.getByTestId('reason-hint-form-submit')).toBeInTheDocument();
  });

  it('ReasonHintForm_ShouldBlockSubmit_WhenReasonPathEmpty', async () => {
    render(<ReasonHintForm open mode="create" onOpenChange={() => {}} />);

    fireEvent.change(screen.getByTestId('reason-hint-form-scopeRef'), {
      target: { value: '+541143218765' },
    });
    fireEvent.submit(screen.getByTestId('reason-hint-form-submit').closest('form')!);

    await waitFor(() =>
      expect(
        screen.getByText('admin:reasonHints.validation.reasonPathRequired'),
      ).toBeInTheDocument(),
    );
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('ReasonHintForm_ShouldSerializeCodesToJsonArray_WhenSubmitted', async () => {
    render(<ReasonHintForm open mode="create" onOpenChange={() => {}} />);

    fireEvent.change(screen.getByTestId('reason-hint-form-scopeRef'), {
      target: { value: '+541143218765' },
    });
    fireEvent.change(screen.getByTestId('reason-hint-form-reasonCodes'), {
      target: { value: 'CITAS, REPROG' },
    });
    fireEvent.submit(screen.getByTestId('reason-hint-form-submit').closest('form')!);

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const arg = createMutate.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.scope).toBe('Did');
    expect(arg.scopeRef).toBe('+541143218765');
    expect(arg.reasonPath).toBe('["CITAS","REPROG"]');
    expect(arg.priority).toBe(0);
    expect(arg.isActive).toBe(true);
  });

  it('ReasonHintForm_ShouldParseJsonArrayToCodes_WhenEditing', async () => {
    const existing: ReasonHint = {
      id: 'rh1',
      scope: 'Queue',
      scopeRef: 'queue-support',
      reasonPath: '["VENTAS","NUEVO"]',
      priority: 5,
      isActive: true,
    };
    render(<ReasonHintForm open mode="edit" reasonHint={existing} onOpenChange={() => {}} />);

    await waitFor(() => {
      const input = screen.getByTestId('reason-hint-form-reasonCodes') as HTMLInputElement;
      expect(input.value).toBe('VENTAS, NUEVO');
    });
    const scopeRef = screen.getByTestId('reason-hint-form-scopeRef') as HTMLInputElement;
    expect(scopeRef.value).toBe('queue-support');
  });

  it('ReasonHintForm_ShouldRenderChannelDropdown_WhenScopeIsChannel', async () => {
    // Editing a Channel-scoped hint seeds scope=Channel, so scopeRef renders as
    // the exact-enum Select trigger (a button), not a free-text input — guarding
    // against typos that would silently never match channel.ToString().
    const existing: ReasonHint = {
      id: 'rh-ch',
      scope: 'Channel',
      scopeRef: 'WhatsApp',
      reasonPath: '["SOPORTE"]',
      priority: 0,
      isActive: true,
    };
    render(<ReasonHintForm open mode="edit" reasonHint={existing} onOpenChange={() => {}} />);

    await waitFor(() => {
      const scopeRef = screen.getByTestId('reason-hint-form-scopeRef') as HTMLElement;
      // base-ui Select trigger is a <button>; a text input would be <input>.
      expect(scopeRef.tagName).toBe('BUTTON');
      expect(scopeRef.dataset.slot).toBe('select-trigger');
    });
    // The free-text input must NOT be an <input> for Channel scope.
    expect((screen.getByTestId('reason-hint-form-scopeRef') as HTMLElement).tagName).not.toBe(
      'INPUT',
    );
  });

  it('ReasonHintForm_ShouldKeepTextInput_WhenScopeIsDidOrQueue', async () => {
    // Did scope (the default) keeps the E.164 free-text input.
    const didHint: ReasonHint = {
      id: 'rh-did',
      scope: 'Did',
      scopeRef: '+541143218765',
      reasonPath: '["CITAS"]',
      priority: 0,
      isActive: true,
    };
    const { unmount } = render(
      <ReasonHintForm open mode="edit" reasonHint={didHint} onOpenChange={() => {}} />,
    );
    await waitFor(() => {
      const ref = screen.getByTestId('reason-hint-form-scopeRef') as HTMLInputElement;
      expect(ref.tagName).toBe('INPUT');
      expect(ref.value).toBe('+541143218765');
    });
    unmount();

    // Queue scope keeps a free-text queue-id input too.
    const queueHint: ReasonHint = {
      id: 'rh-q',
      scope: 'Queue',
      scopeRef: 'queue-support',
      reasonPath: '["VENTAS"]',
      priority: 0,
      isActive: true,
    };
    render(<ReasonHintForm open mode="edit" reasonHint={queueHint} onOpenChange={() => {}} />);
    await waitFor(() => {
      const ref = screen.getByTestId('reason-hint-form-scopeRef') as HTMLInputElement;
      expect(ref.tagName).toBe('INPUT');
      expect(ref.value).toBe('queue-support');
    });
  });
});
