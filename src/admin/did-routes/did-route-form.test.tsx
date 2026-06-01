import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const createMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock('@/core/api/hooks/use-did-routes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/core/api/hooks/use-did-routes')>();
  return {
    ...actual,
    useCreateDidRoute: () => ({ mutate: createMutate }),
    useUpdateDidRoute: () => ({ mutate: updateMutate }),
  };
});

// Two active queues + one inactive one (filtered out of the destination Select).
vi.mock('@/core/api/hooks/use-queues', () => ({
  useQueues: () => ({
    data: [
      { id: 'queue-support', name: 'Support', isActive: true, requiredSkills: [], createdAt: '' },
      { id: 'queue-sales', name: 'Sales', isActive: true, requiredSkills: [], createdAt: '' },
      { id: 'queue-old', name: 'Retired', isActive: false, requiredSkills: [], createdAt: '' },
    ],
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue ?? key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { DidRouteForm } from './did-route-form';

describe('DidRouteForm fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('DidRouteForm_ShouldRenderFields_WhenCreating', () => {
    render(<DidRouteForm open mode="create" onOpenChange={() => {}} />);

    expect(screen.getByTestId('did-route-form-did')).toBeInTheDocument();
    expect(screen.getByTestId('did-route-form-queueId')).toBeInTheDocument();
    expect(screen.getByTestId('did-route-form-isActive')).toBeInTheDocument();
    expect(screen.getByTestId('did-route-form-submit')).toBeInTheDocument();
  });

  it('DidRouteForm_ShouldBlockSubmit_WhenQueueEmpty', async () => {
    render(<DidRouteForm open mode="create" onOpenChange={() => {}} />);

    // Valid DID but no queue selected — the #1 rule: never a DID without a queue.
    fireEvent.change(screen.getByTestId('did-route-form-did'), {
      target: { value: '+541143218765' },
    });
    fireEvent.submit(screen.getByTestId('did-route-form-submit').closest('form')!);

    await waitFor(() =>
      expect(screen.getByText('admin:didRoutes.validation.queueRequired')).toBeInTheDocument(),
    );
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('DidRouteForm_ShouldBlockSubmit_WhenDidNotE164', async () => {
    render(<DidRouteForm open mode="create" onOpenChange={() => {}} />);

    fireEvent.change(screen.getByTestId('did-route-form-did'), {
      target: { value: 'not-a-number' },
    });
    fireEvent.submit(screen.getByTestId('did-route-form-submit').closest('form')!);

    await waitFor(() =>
      expect(screen.getByText('admin:didRoutes.validation.didInvalid')).toBeInTheDocument(),
    );
    expect(createMutate).not.toHaveBeenCalled();
  });

  it('DidRouteForm_ShouldSubmitValidCreate_WithDidQueueAndIsActive', async () => {
    render(<DidRouteForm open mode="create" onOpenChange={() => {}} />);

    fireEvent.change(screen.getByTestId('did-route-form-did'), {
      target: { value: '+541143218765' },
    });

    // Select a destination queue (shadcn-style Select uses role=option).
    fireEvent.click(screen.getByTestId('did-route-form-queueId'));
    fireEvent.click(await screen.findByRole('option', { name: 'Support' }));

    fireEvent.submit(screen.getByTestId('did-route-form-submit').closest('form')!);

    await waitFor(() => expect(createMutate).toHaveBeenCalled());
    const arg = createMutate.mock.calls[0][0] as Record<string, unknown>;
    expect(arg.did).toBe('+541143218765');
    expect(arg.queueId).toBe('queue-support');
    expect(arg.isActive).toBe(true);
  });
});
