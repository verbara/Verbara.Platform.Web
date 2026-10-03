/**
 * The user form's account-status field (spec `user-account-status`), rendered with the real form,
 * the real `@base-ui/react` Select and a real i18next instance loaded with the committed locale
 * files, so the assertions read the options and the text a user sees.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { ADMIN_LOCALES, TEST_LOCALES, createLocaleI18n, type TestLocale } from '@/test/locale-i18n';
import { UserForm, type UserFormValues } from './user-form';

const onSubmit = vi.fn<(values: UserFormValues) => void>();
const onOpenChange = vi.fn<(open: boolean) => void>();

const ANA = { email: 'ana@demo.test', displayName: 'Ana Rivera', role: 'supervisor' as const };

async function renderForm({
  mode = 'edit',
  currentStatus,
  lng = 'en-US',
}: {
  mode?: 'create' | 'edit';
  currentStatus?: string;
  lng?: TestLocale;
} = {}) {
  const i18n = await createLocaleI18n(lng);
  render(
    <I18nextProvider i18n={i18n}>
      <UserForm
        open
        onOpenChange={onOpenChange}
        mode={mode}
        defaultValues={mode === 'edit' ? ANA : undefined}
        currentStatus={currentStatus}
        onSubmit={onSubmit}
      />
    </I18nextProvider>,
  );
}

interface StatusOption {
  testId: string | null;
  label: string | null;
  selected: boolean;
}

/** Opens the status field and reads every option it offers, in order. */
async function openStatusOptions(): Promise<StatusOption[]> {
  fireEvent.click(screen.getByTestId('user-form-status'));
  const options = await screen.findAllByRole('option');
  return options.map((o) => ({
    testId: o.getAttribute('data-testid'),
    label: o.textContent,
    selected: o.getAttribute('aria-selected') === 'true',
  }));
}

/**
 * Opens the status field and clicks the option identified by `status`. The click starts with a
 * `pointerdown` on the option, as a real mouse click does: base-ui ignores a click whose press did
 * not start on the item (the opening press can land on an item aligned with the trigger).
 */
async function chooseStatus(status: string) {
  const offered = await openStatusOptions();
  expect(offered.map((o) => o.testId)).toContain(`user-form-status-option-${status}`);
  const option = screen.getByTestId(`user-form-status-option-${status}`);
  fireEvent.pointerDown(option);
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
}

/** The text the closed status field shows (the trigger's value slot, without its icon). */
function statusFieldText() {
  return screen.getByTestId('user-form-status').querySelector('[data-slot="select-value"]')
    ?.textContent;
}

function hint() {
  const el = screen.queryByTestId('user-form-status-hint');
  return el === null ? null : el.textContent;
}

function rename(displayName: string) {
  fireEvent.change(screen.getByTestId('user-form-displayName'), {
    target: { value: displayName },
  });
}

async function submit() {
  fireEvent.click(screen.getByTestId('user-form-submit'));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  return onSubmit.mock.calls[0]![0];
}

describe('UserForm account status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UserForm_ShouldOfferExactlyTheThreePlatformStatuses_WhenEditing', async () => {
    await renderForm({ currentStatus: 'active' });

    const options = await openStatusOptions();

    expect(options.map((o) => o.testId)).toEqual([
      'user-form-status-option-Active',
      'user-form-status-option-Suspended',
      'user-form-status-option-Deactivated',
    ]);
  });

  it('UserForm_ShouldOpenPreselectedOnSuspended_WhenTheUserIsReportedAsSuspended', async () => {
    await renderForm({ currentStatus: 'suspended' });

    const options = await openStatusOptions();

    expect(options.filter((o) => o.selected)).toEqual([
      { testId: 'user-form-status-option-Suspended', label: 'Suspended', selected: true },
    ]);
  });

  it('UserForm_ShouldSubmitTheSuspendedEnumName_WhenSuspendedIsSelected', async () => {
    await renderForm({ currentStatus: 'active' });

    await chooseStatus('Suspended');
    const values = await submit();

    expect(values).toEqual({ ...ANA, status: 'Suspended' });
  });

  it('UserForm_ShouldShowNoStatusFieldAndSubmitNoStatus_WhenCreating', async () => {
    // A status passed in create mode is ignored: the create endpoint takes none.
    await renderForm({ mode: 'create', currentStatus: 'suspended' });

    expect(screen.queryByTestId('user-form-status')).toBeNull();
    fireEvent.change(screen.getByTestId('user-form-email'), { target: { value: 'new@demo.test' } });
    rename('New User');
    const values = await submit();

    expect(values).toStrictEqual({
      email: 'new@demo.test',
      displayName: 'New User',
      role: 'agent',
    });
  });

  it('UserForm_ShouldSubmitNoStatusKey_WhenOnlyTheNameOfASuspendedUserChanged', async () => {
    await renderForm({ currentStatus: 'suspended' });

    rename('Ana R.');
    const values = await submit();

    expect(values).toStrictEqual({ ...ANA, displayName: 'Ana R.' });
    expect(Object.keys(values)).not.toContain('status');
  });

  it('UserForm_ShouldSubmitActive_WhenASuspendedUserIsReactivated', async () => {
    await renderForm({ currentStatus: 'suspended' });

    await chooseStatus('Active');
    const values = await submit();

    expect(values).toStrictEqual({ ...ANA, status: 'Active' });
  });

  it('UserForm_ShouldSubmitDeactivated_WhenDeactivatedIsSelected', async () => {
    await renderForm({ currentStatus: 'active' });

    await chooseStatus('Deactivated');
    const values = await submit();

    expect(values).toStrictEqual({ ...ANA, status: 'Deactivated' });
  });

  it('UserForm_ShouldSubmitNoStatusKey_WhenTheCurrentStatusIsSelectedAgain', async () => {
    await renderForm({ currentStatus: 'Suspended' });

    await chooseStatus('Suspended');
    const values = await submit();

    expect(values).toStrictEqual(ANA);
  });

  it.each(['ACTIVE', 'Active', ' active '])(
    'UserForm_ShouldOpenPreselectedOnActive_WhenTheStatusIsReportedAs_%j',
    async (reported) => {
      await renderForm({ currentStatus: reported });

      expect(statusFieldText()).toBe('Active');
      const options = await openStatusOptions();
      expect(options.filter((o) => o.selected).map((o) => o.testId)).toEqual([
        'user-form-status-option-Active',
      ]);
    },
  );
});

describe('UserForm with a status the console does not know', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UserForm_ShouldSelectNothingAndShowTheReportedValue_WhenTheStatusIsUnknown', async () => {
    await renderForm({ currentStatus: 'pending_review' });

    expect(statusFieldText()).toBe('pending_review');
    expect(hint()).toBeNull();
    const options = await openStatusOptions();
    expect(options.filter((o) => o.selected)).toEqual([]);
  });

  it('UserForm_ShouldPassValidationAndSubmitNoStatusKey_WhenOnlyTheNameChanged', async () => {
    await renderForm({ currentStatus: 'pending_review' });

    rename('Ana R.');
    const values = await submit();

    expect(values).toStrictEqual({ ...ANA, displayName: 'Ana R.' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('UserForm_ShouldSubmitTheChosenStatus_WhenAKnownStatusReplacesTheUnknownOne', async () => {
    await renderForm({ currentStatus: 'pending_review' });

    await chooseStatus('Active');
    const values = await submit();

    expect(values).toStrictEqual({ ...ANA, status: 'Active' });
  });
});

describe('UserForm leaving-Active hint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UserForm_ShouldShowTheHintForSuspendedAndHideItForActive_WhenEditingAnActiveUser', async () => {
    await renderForm({ currentStatus: 'active' });
    const shown = [hint()];

    await chooseStatus('Suspended');
    shown.push(hint());
    await chooseStatus('Active');
    shown.push(hint());
    await chooseStatus('Deactivated');
    shown.push(hint());

    const text = ADMIN_LOCALES['en-US'].users.status_hint_inactive;
    expect(shown).toEqual([null, text, null, text]);
  });

  it('UserForm_ShouldNotShowTheHint_WhenTheSelectedStatusIsTheUsersCurrentOne', async () => {
    await renderForm({ currentStatus: 'suspended' });
    const shown = [hint()];

    await chooseStatus('Deactivated');
    shown.push(hint());
    await chooseStatus('Suspended');
    shown.push(hint());

    expect(shown).toEqual([null, ADMIN_LOCALES['en-US'].users.status_hint_inactive, null]);
  });

  it.each(['suspended', 'deactivated', 'pending_review'])(
    'UserForm_ShouldNotShowTheHint_WhenActiveIsSelectedForAUserReportedAs_%j',
    async (reported) => {
      await renderForm({ currentStatus: reported });

      await chooseStatus('Active');

      expect(hint()).toBeNull();
    },
  );

  it('UserForm_ShouldDescribeTheStatusFieldWithTheHint_WhileTheHintIsShown', async () => {
    await renderForm({ currentStatus: 'active' });
    const trigger = screen.getByTestId('user-form-status');
    expect(trigger.getAttribute('aria-describedby')).toBeNull();

    await chooseStatus('Suspended');

    expect(trigger.getAttribute('aria-describedby')).toBe(
      screen.getByTestId('user-form-status-hint').id,
    );
  });
});

describe.each(TEST_LOCALES)('UserForm status labels in %s', (lng) => {
  const statuses = ADMIN_LOCALES[lng].users.statuses;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UserForm_ShouldLabelEveryStatusFromTheActiveLocale_WhileTheIdsStayTheEnumNames', async () => {
    await renderForm({ currentStatus: 'suspended', lng });

    expect(statusFieldText()).toBe(statuses.suspended);
    const options = await openStatusOptions();
    expect(options.map(({ testId, label }) => ({ testId, label }))).toEqual([
      { testId: 'user-form-status-option-Active', label: statuses.active },
      { testId: 'user-form-status-option-Suspended', label: statuses.suspended },
      { testId: 'user-form-status-option-Deactivated', label: statuses.deactivated },
    ]);
  });

  it('UserForm_ShouldShowTheHintInTheActiveLocale_WhenSuspendedIsSelected', async () => {
    await renderForm({ currentStatus: 'active', lng });

    await chooseStatus('Suspended');

    expect(hint()).toBe(ADMIN_LOCALES[lng].users.status_hint_inactive);
  });
});
