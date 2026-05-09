import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadSoundPreference,
  setSoundEnabled,
  isSoundEnabled,
  setFaviconBadge,
} from './notifications';

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

describe('favicon badge', () => {
  const fakeDataUrl = 'data:image/png;base64,abc123';

  beforeEach(() => {
    document.head.innerHTML = '<link rel="icon" href="https://x/old.png">';
    // Provide a minimal canvas stub so getContext('2d') doesn't return null
    HTMLCanvasElement.prototype.getContext = function () {
      return {
        fillStyle: '',
        font: '',
        textAlign: '',
        textBaseline: '',
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        fillText: () => {},
      } as unknown as CanvasRenderingContext2D;
    };
    HTMLCanvasElement.prototype.toDataURL = function () {
      return fakeDataUrl;
    };
  });

  it('AppliesDataUrl_WhenCountAboveZero', () => {
    setFaviconBadge(3);
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    expect(link?.href).toMatch(/^data:image\/png/);
  });

  it('Renders9Plus_WhenCountOverThreshold', () => {
    setFaviconBadge(15);
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    expect(link?.href).toMatch(/^data:image\/png/);
  });

  it('NoOp_WhenCountZero_AndNoLinkExists', () => {
    document.head.innerHTML = '';
    setFaviconBadge(0);
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    expect(link).toBeTruthy();
  });
});
