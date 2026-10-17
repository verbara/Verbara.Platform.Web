import { describe, it, expect } from 'vitest';
import { isSipUri, registrationIssues } from './trunk-registration';

describe('trunk registration rules (#385)', () => {
  it('isSipUri_ShouldAcceptSipAndSips_WhenFollowedByAHost', () => {
    expect(isSipUri('sip:carrier.example')).toBe(true);
    expect(isSipUri('SIPS:acct@carrier.example:5061')).toBe(true);
    expect(isSipUri('carrier.example')).toBe(false);
    expect(isSipUri('sip:')).toBe(false);
    expect(isSipUri('sip:acct @carrier.example')).toBe(false);
  });

  it('registrationIssues_ShouldRequireClientUri_WhenCreatingWithARegistration', () => {
    expect(registrationIssues('sip:carrier.example', '')).toEqual([
      { field: 'clientUri', message: 'trunks.validation.clientUriRequired' },
    ]);
  });

  it('registrationIssues_ShouldFlagEachNonSipUri_WhenCreating', () => {
    expect(registrationIssues('carrier.example', 'acct@carrier.example')).toEqual([
      { field: 'registrationUri', message: 'trunks.validation.sipUriInvalid' },
      { field: 'clientUri', message: 'trunks.validation.sipUriInvalid' },
    ]);
  });

  it('registrationIssues_ShouldPass_WhenNoRegistrationOrBothValid', () => {
    expect(registrationIssues('', '')).toEqual([]);
    expect(registrationIssues(undefined, undefined)).toEqual([]);
    expect(registrationIssues('sip:carrier.example', 'sip:acct@carrier.example')).toEqual([]);
  });

  it('registrationIssues_ShouldIgnoreUnchangedStoredValues_WhenEditingALegacyTrunk', () => {
    // Stored before the rules: registration without client URI, or a bare host.
    expect(
      registrationIssues('sip:carrier.example', '', { registrationUri: 'sip:carrier.example' }),
    ).toEqual([]);
    expect(
      registrationIssues('carrier.example', 'sip:acct@carrier.example', {
        registrationUri: 'carrier.example',
        clientUri: 'sip:acct@carrier.example',
      }),
    ).toEqual([]);
  });

  it('registrationIssues_ShouldCheckOnlyTheChangedUri_WhenEditing', () => {
    // The stored bare host is not re-checked when only the client URI changes...
    expect(
      registrationIssues('carrier.example', 'sip:new@carrier.example', {
        registrationUri: 'carrier.example',
        clientUri: 'sip:old@carrier.example',
      }),
    ).toEqual([]);
    // ...but changing the registration URI of a trunk with no client URI needs one.
    expect(
      registrationIssues('sip:new.carrier.example', '', { registrationUri: 'sip:carrier.example' }),
    ).toEqual([{ field: 'clientUri', message: 'trunks.validation.clientUriRequired' }]);
  });
});
