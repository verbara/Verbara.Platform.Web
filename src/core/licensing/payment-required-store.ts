import { create } from 'zustand';
import type { PaymentRequiredProblemDetails } from './types';

/**
 * Singleton store bridging non-React API errors (`PaymentRequiredError` thrown
 * from `core/api/client.ts`) into the React tree's
 * `<PaymentRequiredDialogHost />`. Pattern mirrors `tenant-store` and
 * `auth-store` — Zustand globals consumed by host components near the
 * application root.
 *
 * The store holds at most ONE active ProblemDetails. When a second 402 arrives
 * while the dialog is already open, the latest payload replaces the previous
 * one (most-recent-wins) — this avoids modal stacking when multiple TanStack
 * Query subscriptions fail concurrently against the same gated endpoint.
 */
interface PaymentRequiredState {
  /** Whether the modal is currently visible. */
  readonly open: boolean;

  /** The ProblemDetails payload behind the active modal, if any. */
  readonly current: PaymentRequiredProblemDetails | null;

  /** Open the modal with a fresh ProblemDetails payload. Most-recent-wins. */
  show(problemDetails: PaymentRequiredProblemDetails): void;

  /** Dismiss the modal. Next 402 reopens it cleanly. */
  dismiss(): void;
}

export const usePaymentRequiredStore = create<PaymentRequiredState>()((set) => ({
  open: false,
  current: null,
  show: (problemDetails) => set({ open: true, current: problemDetails }),
  dismiss: () => set({ open: false }),
  // Note: we keep `current` populated after dismiss so the dialog can finish
  // its close animation without flashing empty content. The next `show` call
  // replaces it.
}));
