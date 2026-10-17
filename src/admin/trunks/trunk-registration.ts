/**
 * Client-side mirror of the trunk API's registration rules (Platform #385): a trunk that registers with its
 * carrier needs a `sip:`/`sips:` registration URI AND a `sip:`/`sips:` client URI — Asterisk refuses a
 * registration with an empty `client_uri`, so such a trunk would save and silently never register. The API
 * answers those saves with 400 `client-uri-required` / `invalid-sip-uri`; checking here first keeps the
 * operator on the field instead of a toast.
 *
 * On edit, values equal to the stored ones are not re-checked (the API ignores an echoed, unchanged URI), so a
 * trunk saved before these rules stays editable for its other fields.
 */

/** `sip:` or `sips:` (any case) followed by at least one non-whitespace character and no whitespace. */
const SIP_URI = /^sips?:\S+$/i;

export function isSipUri(value: string): boolean {
  return SIP_URI.test(value);
}

export type RegistrationField = 'registrationUri' | 'clientUri';

export interface RegistrationIssue {
  field: RegistrationField;
  /** i18n key in the `admin` namespace. */
  message: string;
}

export interface StoredRegistration {
  registrationUri?: string | null;
  clientUri?: string | null;
}

export function registrationIssues(
  registrationUri: string | undefined,
  clientUri: string | undefined,
  stored?: StoredRegistration,
): RegistrationIssue[] {
  const reg = registrationUri?.trim() ?? '';
  const cli = clientUri?.trim() ?? '';

  // Per field, as the API does: only a URI that differs from the stored one is checked for its shape, and the
  // client-URI requirement applies once either URI changed (on create, `stored` is absent: everything changed).
  const regChanged = !stored || reg !== (stored.registrationUri ?? '').trim();
  const cliChanged = !stored || cli !== (stored.clientUri ?? '').trim();
  if (!regChanged && !cliChanged) {
    return [];
  }

  const issues: RegistrationIssue[] = [];
  if (regChanged && reg && !isSipUri(reg)) {
    issues.push({ field: 'registrationUri', message: 'trunks.validation.sipUriInvalid' });
  }
  if (cliChanged && cli && !isSipUri(cli)) {
    issues.push({ field: 'clientUri', message: 'trunks.validation.sipUriInvalid' });
  } else if (reg && !cli) {
    issues.push({ field: 'clientUri', message: 'trunks.validation.clientUriRequired' });
  }
  return issues;
}
