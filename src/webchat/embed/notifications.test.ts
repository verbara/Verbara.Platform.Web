import { describe, it, expect, beforeEach } from 'vitest';
import { loadSoundPreference, setSoundEnabled, isSoundEnabled } from './notifications';

beforeEach(() => {
  localStorage.clear();
  setSoundEnabled(false);
});

describe('sound preference', () => {
  it('LoadDefaultsToFalse', () => {
    expect(loadSoundPreference()).toBe(false);
  });
  it('PersistsAcrossLoads', () => {
    setSoundEnabled(true);
    expect(loadSoundPreference()).toBe(true);
  });
  it('IsSoundEnabled_ReflectsCurrent', () => {
    setSoundEnabled(true);
    expect(isSoundEnabled()).toBe(true);
    setSoundEnabled(false);
    expect(isSoundEnabled()).toBe(false);
  });
});
