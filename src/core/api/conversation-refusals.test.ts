import { describe, it, expect } from 'vitest';
import enCommon from '../../../public/locales/en-US/common.json';
import esCommon from '../../../public/locales/es-419/common.json';
import ptCommon from '../../../public/locales/pt-BR/common.json';
import { ApiError, describeApiError, entriesOf } from './api-error';
import {
  conversationRefusals,
  refusedFieldLabels,
  refusedFieldsOf,
  typifyInvalid,
  type ConversationAction,
} from './conversation-refusals';

const ALL_ACTIONS: readonly ConversationAction[] = [
  'send',
  'accept',
  'reject',
  'transfer',
  'close',
  'hold',
  'unhold',
  'create',
  'takeover',
  'supervisor-close',
  'reassign',
  'typify',
];

function codeFor(status: number, body: unknown, action: ConversationAction): string {
  return describeApiError(new ApiError(status, body), conversationRefusals, action).code;
}

describe('conversationRefusals', () => {
  describe('machine codes', () => {
    it.each([
      [403, 'not-an-agent', 'takeover'],
      [403, 'not-an-agent', 'create'],
      [403, 'not-owner', 'send'],
      [403, 'not-owner', 'hold'],
      [403, 'not-owner', 'unhold'],
      [403, 'not-owner', 'close'],
      [403, 'not-owner', 'typify'],
      [403, 'not-offered-to-you', 'accept'],
      [403, 'not-offered-to-you', 'reject'],
      [400, 'target-agent-not-found', 'transfer'],
      [400, 'target-queue-not-found', 'transfer'],
      [400, 'target-agent-not-found', 'reassign'],
      [400, 'target-queue-not-found', 'reassign'],
    ] as const)(
      'describeApiError_ShouldReportTheMachineCode_WhenPlatformAnswers%s %s on %s',
      (status, code, action) => {
        expect(codeFor(status, { error: code }, action)).toBe(code);
      },
    );

    it('describeApiError_ShouldReportTheCodeOverTheActionStatus_WhenA400OnReassignCarriesACode', () => {
      expect(codeFor(400, { error: 'target-queue-not-found' }, 'reassign')).toBe(
        'target-queue-not-found',
      );
    });
  });

  describe('status fallbacks without a code', () => {
    it.each(ALL_ACTIONS.filter((a) => a !== 'create'))(
      'describeApiError_ShouldReportConversationNotFound_WhenPlatformAnswers404 on %s',
      (action) => {
        expect(codeFor(404, null, action)).toBe('conversation-not-found');
      },
    );

    it('describeApiError_ShouldReportContactNotFound_WhenStartingAConversationAnswers404', () => {
      expect(codeFor(404, { error: 'Contact not found' }, 'create')).toBe('contact-not-found');
    });

    it.each(['accept', 'reject', 'transfer', 'takeover'] as const)(
      'describeApiError_ShouldReportTheConflict_WhenPlatformAnswers409WithProse on %s',
      (action) => {
        expect(codeFor(409, { error: 'Agent has no capacity.' }, action)).toBe(
          'conversation-conflict',
        );
      },
    );

    it.each(['hold', 'unhold', 'reassign'] as const)(
      'describeApiError_ShouldReportTheConflict_WhenPlatformAnswers400WithoutACode on %s',
      (action) => {
        expect(codeFor(400, { error: 'Cannot hold conversation' }, action)).toBe(
          'conversation-conflict',
        );
      },
    );

    it('describeApiError_ShouldReportTheGenericFailure_WhenTransferAnswers400WithoutACode', () => {
      expect(
        codeFor(400, { error: 'Either targetQueueId or targetAgentId is required' }, 'transfer'),
      ).toBe('conversation-failed');
    });

    it('describeApiError_ShouldReportTypifyInvalid_WhenTypifyAnswers400WithFieldErrors', () => {
      expect(
        codeFor(400, { errors: [{ field: 'reason', message: 'Field is required.' }] }, 'typify'),
      ).toBe('typify-invalid');
    });

    it('describeApiError_ShouldReportTheGenericFailure_WhenTypifyAnswers400WithoutFieldErrors', () => {
      expect(codeFor(400, { error: 'Schema is not published' }, 'typify')).toBe(
        'conversation-failed',
      );
      expect(codeFor(400, { errors: ['A policy message'] }, 'typify')).toBe('conversation-failed');
    });

    it.each([
      [403, { error: 'Forbidden' }],
      [500, null],
      [403, { error: 'some-unknown-code' }],
    ] as const)(
      'describeApiError_ShouldReportTheGenericFailure_WhenTheMapDoesNotKnowStatus %s',
      (status, body) => {
        expect(codeFor(status, body, 'send')).toBe('conversation-failed');
      },
    );

    it('describeApiError_ShouldReportTheGenericFailure_WhenTheErrorIsNotAnApiError', () => {
      expect(
        describeApiError(new TypeError('Failed to fetch'), conversationRefusals, 'send').code,
      ).toBe('conversation-failed');
    });
  });

  describe('refused fields', () => {
    const err = new ApiError(400, {
      errors: [
        { field: 'reason', message: "Field 'reason' is required." },
        { field: 'reason', message: "Field 'reason' is too long." },
        { field: 'path', message: 'Selected node path must not be empty.' },
        { field: 'unlabelled_key', message: 'x' },
        { message: 'no field' },
      ],
    });

    it('refusedFieldsOf_ShouldListEachFieldOnceInOrder_WhenTheErrorsListRepeatsAField', () => {
      expect(refusedFieldsOf(err)).toEqual(['reason', 'path', 'unlabelled_key']);
    });

    it('refusedFieldLabels_ShouldNameFieldsByTheFormLabelAndFallBackToTheKey_WhenAFieldHasNoLabel', () => {
      const labels: Record<string, string> = { reason: 'Motivo', path: 'Resultado' };
      expect(refusedFieldLabels(err, (f) => labels[f])).toBe('Motivo, Resultado, unlabelled_key');
    });

    it('refusedFieldsOf_ShouldBeEmpty_WhenTheErrorIsNotAnApiError', () => {
      expect(refusedFieldsOf(new Error('x'))).toEqual([]);
    });
  });
});

/** Resolves a dotted i18n key against a locale's `common.json`. */
function hasKey(resource: unknown, key: string): boolean {
  let node: unknown = resource;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null || !Object.hasOwn(node, part)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' && node.length > 0;
}

describe('conversationRefusals locale coverage', () => {
  // `entriesOf` lists the static entries; typify's rule is a function, so its entry is added here.
  const entries = [...entriesOf(conversationRefusals), typifyInvalid];
  const locales = { 'en-US': enCommon, 'es-419': esCommon, 'pt-BR': ptCommon } as const;

  it('conversationRefusals_ShouldCoverEveryCodeTheSpecNames', () => {
    expect(new Set(entries.map((e) => e.code))).toEqual(
      new Set([
        'not-an-agent',
        'not-owner',
        'not-offered-to-you',
        'target-agent-not-found',
        'target-queue-not-found',
        'conversation-not-found',
        'contact-not-found',
        'conversation-conflict',
        'typify-invalid',
        'conversation-failed',
      ]),
    );
  });

  it.each(Object.keys(locales) as (keyof typeof locales)[])(
    'conversationRefusals_ShouldResolveEveryEntryToAKeyPresentIn %s',
    (locale) => {
      const missing = entries.filter((e) => !hasKey(locales[locale], e.key)).map((e) => e.key);
      expect(missing).toEqual([]);
    },
  );
});
