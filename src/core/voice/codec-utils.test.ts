import { describe, it, expect } from 'vitest';
import { parseCodecs, serializeCodecs, computeGuardrails, availableToAdd } from './codec-utils';

describe('codec-utils', () => {
  it('parseCodecs_ShouldSplitTrimLowercase', () => {
    expect(parseCodecs(' ULAW , Alaw ,g722 ')).toEqual(['ulaw', 'alaw', 'g722']);
  });

  it('parseCodecs_ShouldReturnEmpty_WhenNullOrBlank', () => {
    expect(parseCodecs(null)).toEqual([]);
    expect(parseCodecs('')).toEqual([]);
  });

  it('serializeCodecs_ShouldJoinWithCommas', () => {
    expect(serializeCodecs(['opus', 'ulaw'])).toBe('opus,ulaw');
  });

  it('computeGuardrails_ShouldFlagEmpty', () => {
    expect(computeGuardrails([], ['ulaw'])).toEqual([{ kind: 'empty' }]);
  });

  it('computeGuardrails_ShouldFlagMissingG711', () => {
    expect(computeGuardrails(['opus'], null)).toContainEqual({ kind: 'no-g711' });
  });

  it('computeGuardrails_ShouldNotFlagG711_WhenUlawPresent', () => {
    expect(computeGuardrails(['ulaw', 'opus'], null)).not.toContainEqual({ kind: 'no-g711' });
  });

  it('computeGuardrails_ShouldFlagDuplicate', () => {
    expect(computeGuardrails(['ulaw', 'ulaw'], null)).toContainEqual({
      kind: 'duplicate',
      token: 'ulaw',
    });
  });

  it('computeGuardrails_ShouldFlagNotInstalled_WhenServerListPresent', () => {
    expect(computeGuardrails(['ulaw', 'opus'], ['ulaw'])).toContainEqual({
      kind: 'not-installed',
      token: 'opus',
    });
  });

  it('availableToAdd_ShouldExcludeSelected', () => {
    const entries = availableToAdd(['ulaw'], null, false);
    expect(entries.find((e) => e.token === 'ulaw')).toBeUndefined();
    expect(entries.find((e) => e.token === 'alaw')).toBeDefined();
  });

  it('availableToAdd_ShouldHideNonCuratedUntilShowAll', () => {
    expect(availableToAdd([], null, false).find((e) => e.token === 'speex')).toBeUndefined();
    expect(availableToAdd([], null, true).find((e) => e.token === 'speex')).toBeDefined();
  });

  it('availableToAdd_ShouldHideCatalogCodecServerLacks_WhenNotShowAll', () => {
    expect(
      availableToAdd([], ['ulaw', 'alaw'], false).find((e) => e.token === 'g722'),
    ).toBeUndefined();
  });

  it('availableToAdd_ShouldOfferInstalledUnknownToken', () => {
    const entries = availableToAdd([], ['ulaw', 'weirdcodec'], false);
    const weird = entries.find((e) => e.token === 'weirdcodec');
    expect(weird).toEqual({ token: 'weirdcodec', known: false, installed: true });
  });
});
