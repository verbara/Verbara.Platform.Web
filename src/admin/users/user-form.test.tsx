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

const ANA = { email: 'ana@demo.test', displayName: 'Ana Rivera' };
/** What an unchanged edit of Ana submits: the name only (no email, no unchanged role or status). */
const ANA_EDIT = { displayName: 'Ana Rivera' };

async function renderForm({
  mode = 'edit',
  currentStatus,
  currentRole = 'supervisor',
  lng = 'en-US',
}: {
  mode?: 'create' | 'edit';
  currentStatus?: string;
  currentRole?: string;
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
        currentRole={currentRole}
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

    expect(values).toEqual({ ...ANA_EDIT, status: 'Suspended' });
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
      role: 'Agent',
    });
  });

  it('UserForm_ShouldSubmitNoStatusKey_WhenOnlyTheNameOfASuspendedUserChanged', async () => {
    await renderForm({ currentStatus: 'suspended' });

    rename('Ana R.');
    const values = await submit();

    expect(values).toStrictEqual({ displayName: 'Ana R.' });
    expect(Object.keys(values)).not.toContain('status');
  });

  it('UserForm_ShouldSubmitActive_WhenASuspendedUserIsReactivated', async () => {
    await renderForm({ currentStatus: 'suspended' });

    await chooseStatus('Active');
    const values = await submit();

    expect(values).toStrictEqual({ ...ANA_EDIT, status: 'Active' });
  });

  it('UserForm_ShouldSubmitDeactivated_WhenDeactivatedIsSelected', async () => {
    await renderForm({ currentStatus: 'active' });

    await chooseStatus('Deactivated');
    const values = await submit();

    expect(values).toStrictEqual({ ...ANA_EDIT, status: 'Deactivated' });
  });

  it('UserForm_ShouldSubmitNoStatusKey_WhenTheCurrentStatusIsSelectedAgain', async () => {
    await renderForm({ currentStatus: 'Suspended' });

    await chooseStatus('Suspended');
    const values = await submit();

    expect(values).toStrictEqual(ANA_EDIT);
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

    expect(values).toStrictEqual({ displayName: 'Ana R.' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('UserForm_ShouldSubmitTheChosenStatus_WhenAKnownStatusReplacesTheUnknownOne', async () => {
    await renderForm({ currentStatus: 'pending_review' });

    await chooseStatus('Active');
    const values = await submit();

    expect(values).toStrictEqual({ ...ANA_EDIT, status: 'Active' });
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

/** The options the role field offers, in order, as a user reads them. */
async function openRoleOptions() {
  fireEvent.click(screen.getByTestId('user-form-role'));
  const options = await screen.findAllByRole('option');
  return options.map((o) => ({ testId: o.getAttribute('data-testid'), label: o.textContent }));
}

function sheetText(slot: 'sheet-title' | 'sheet-description') {
  return document.querySelector(`[data-slot="${slot}"]`)?.textContent;
}

describe('UserForm roles (H1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UserForm_ShouldOfferExactlyThePlatformUserRolesWithTranslatedLabels_WhenEditing', async () => {
    await renderForm({ currentStatus: 'active' });

    const options = await openRoleOptions();

    const names = ADMIN_LOCALES['en-US'].users.role_names;
    expect(options.map((o) => o.label)).not.toContain('readonly');
    expect(options.map((o) => o.label)).toEqual([
      names.admin,
      names.supervisor,
      names.agent,
      names.api,
    ]);
  });
});

describe('UserForm sheet text (H5)', () => {
  it('UserForm_ShouldTitleAndDescribeTheEditSheetInPortuguese_WhenTheLocaleIsPtBR', async () => {
    await renderForm({ currentStatus: 'active', lng: 'pt-BR' });

    expect({
      title: sheetText('sheet-title'),
      description: sheetText('sheet-description'),
    }).toEqual({
      title: ADMIN_LOCALES['pt-BR'].users.edit,
      description: ADMIN_LOCALES['pt-BR'].users.edit_description,
    });
  });
});

/** Opens the role field and clicks `role`'s option, the press starting on the option. */
async function chooseRole(role: string) {
  fireEvent.click(screen.getByTestId('user-form-role'));
  const option = await screen.findByTestId(`user-form-role-option-${role}`);
  fireEvent.pointerDown(option);
  fireEvent.click(option);
  await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
}

function roleFieldText() {
  return screen.getByTestId('user-form-role').querySelector('[data-slot="select-value"]')
    ?.textContent;
}

function roleHint() {
  const el = screen.queryByTestId('user-form-role-hint');
  return el === null ? null : el.textContent;
}

describe('UserForm roles against Platform UserRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UserForm_ShouldIdentifyEveryRoleOptionByItsEnumName_WhenTheRoleFieldOpens', async () => {
    await renderForm({ currentStatus: 'active' });

    const options = await openRoleOptions();

    expect(options.map((o) => o.testId)).toEqual([
      'user-form-role-option-Admin',
      'user-form-role-option-Supervisor',
      'user-form-role-option-Agent',
      'user-form-role-option-Api',
    ]);
  });

  it.each(['api', 'API', 'Api'])(
    'UserForm_ShouldOpenOnApiAndSubmit_WhenTheUsersRoleIsReportedAs_%j',
    async (reported) => {
      await renderForm({ currentStatus: 'active', currentRole: reported });

      expect(roleFieldText()).toBe(ADMIN_LOCALES['en-US'].users.role_names.api);
      const values = await submit();

      expect(values).toStrictEqual(ANA_EDIT);
    },
  );

  it('UserForm_ShouldShowTheReportedRoleAndStillSubmit_WhenTheRoleIsUnknown', async () => {
    await renderForm({ currentStatus: 'active', currentRole: 'readonly' });

    expect(roleFieldText()).toBe('readonly');
    const values = await submit();

    expect(values).toStrictEqual(ANA_EDIT);
  });

  it('UserForm_ShouldSubmitTheRoleEnumName_WhenAnotherRoleIsChosen', async () => {
    await renderForm({ currentStatus: 'active' });

    await chooseRole('Admin');
    const values = await submit();

    expect(values).toStrictEqual({ ...ANA_EDIT, role: 'Admin' });
  });

  it('UserForm_ShouldSubmitNoRoleKey_WhenTheCurrentRoleIsChosenAgain', async () => {
    await renderForm({ currentStatus: 'active' });

    await chooseRole('Supervisor');
    const values = await submit();

    expect(values).toStrictEqual(ANA_EDIT);
  });

  it('UserForm_ShouldSubmitTheChosenRoleAndTheEmail_WhenCreating', async () => {
    await renderForm({ mode: 'create' });

    fireEvent.change(screen.getByTestId('user-form-email'), { target: { value: 'new@demo.test' } });
    rename('New User');
    await chooseRole('Api');
    const values = await submit();

    expect(values).toStrictEqual({ email: 'new@demo.test', displayName: 'New User', role: 'Api' });
  });

  it('UserForm_ShouldKeepTheEmailEditable_WhenCreating', async () => {
    await renderForm({ mode: 'create' });

    expect((screen.getByTestId('user-form-email') as HTMLInputElement).readOnly).toBe(false);
  });

  it('UserForm_ShouldShowTheEmailReadOnlyAndNotSubmitIt_WhenEditing', async () => {
    await renderForm({ currentStatus: 'active' });

    const email = screen.getByTestId('user-form-email') as HTMLInputElement;
    expect(email.readOnly).toBe(true);
    const values = await submit();
    expect(Object.keys(values)).not.toContain('email');
  });
});

describe('UserForm lower-role hint (H15)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['supervisor', 'Agent'],
    ['supervisor', 'Api'],
    ['admin', 'Supervisor'],
    ['agent', 'Api'],
  ])('UserForm_ShouldShowTheHint_WhenA_%s_IsLoweredTo_%s', async (current, next) => {
    await renderForm({ currentStatus: 'active', currentRole: current });
    expect(roleHint()).toBeNull();

    await chooseRole(next);

    expect(roleHint()).toBe(ADMIN_LOCALES['en-US'].users.role_hint_lower);
  });

  it.each([
    ['agent', 'Supervisor'],
    ['supervisor', 'Admin'],
    ['api', 'Agent'],
    ['supervisor', 'Supervisor'],
  ])('UserForm_ShouldNotShowTheHint_WhenA_%s_IsSetTo_%s', async (current, next) => {
    await renderForm({ currentStatus: 'active', currentRole: current });

    await chooseRole(next);

    expect(roleHint()).toBeNull();
  });

  it('UserForm_ShouldNotShowTheHint_WhenTheCurrentRoleIsUnknown', async () => {
    await renderForm({ currentStatus: 'active', currentRole: 'readonly' });

    await chooseRole('Api');

    expect(roleHint()).toBeNull();
  });

  it('UserForm_ShouldNotShowTheHint_WhenCreating', async () => {
    await renderForm({ mode: 'create' });

    await chooseRole('Api');

    expect(roleHint()).toBeNull();
  });

  it('UserForm_ShouldDescribeTheRoleFieldWithTheHint_WhileTheHintIsShown', async () => {
    await renderForm({ currentStatus: 'active' });
    const trigger = screen.getByTestId('user-form-role');
    expect(trigger.getAttribute('aria-describedby')).toBeNull();

    await chooseRole('Agent');

    expect(trigger.getAttribute('aria-describedby')).toBe(
      screen.getByTestId('user-form-role-hint').id,
    );
  });
});

describe.each(TEST_LOCALES)('UserForm role labels and sheet text in %s', (lng) => {
  const users = ADMIN_LOCALES[lng].users;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UserForm_ShouldLabelEveryRoleFromTheActiveLocale', async () => {
    await renderForm({ currentStatus: 'active', lng });

    expect(roleFieldText()).toBe(users.role_names.supervisor);
    const options = await openRoleOptions();
    expect(options.map((o) => o.label)).toEqual([
      users.role_names.admin,
      users.role_names.supervisor,
      users.role_names.agent,
      users.role_names.api,
    ]);
  });

  it('UserForm_ShouldShowTheRoleHintInTheActiveLocale_WhenTheRoleIsLowered', async () => {
    await renderForm({ currentStatus: 'active', lng });

    await chooseRole('Agent');

    expect(roleHint()).toBe(users.role_hint_lower);
  });

  it('UserForm_ShouldTitleDescribeAndLabelTheEditSheetFromTheActiveLocale', async () => {
    await renderForm({ currentStatus: 'active', lng });

    expect({
      title: sheetText('sheet-title'),
      description: sheetText('sheet-description'),
      submit: screen.getByTestId('user-form-submit').textContent,
    }).toEqual({ title: users.edit, description: users.edit_description, submit: users.save });
  });

  it('UserForm_ShouldTitleAndDescribeTheCreateSheetFromTheActiveLocale', async () => {
    await renderForm({ mode: 'create', lng });

    expect({
      title: sheetText('sheet-title'),
      description: sheetText('sheet-description'),
    }).toEqual({ title: users.create, description: users.create_description });
  });
});
