import { describe, it, expect } from 'vitest';
import { CODEC_CATALOG, CODEC_TIERS, CODEC_PRESETS } from './codec-catalog';

describe('codec-catalog', () => {
  it('CODEC_CATALOG_ShouldKeyEachEntryByItsOwnToken', () => {
    for (const [key, meta] of Object.entries(CODEC_CATALOG)) {
      expect(meta.token).toBe(key);
    }
  });

  it('CODEC_CATALOG_ShouldMarkCommonCodecsCurated', () => {
    for (const token of ['ulaw', 'alaw', 'g722', 'opus', 'g729', 'gsm', 'ilbc', 'vp8', 'h264']) {
      expect(CODEC_CATALOG[token]?.curated).toBe(true);
    }
  });

  it('CODEC_CATALOG_ShouldFlagBadges', () => {
    expect(CODEC_CATALOG.opus?.webrtc).toBe(true);
    expect(CODEC_CATALOG.opus?.needsModule).toBe(true);
    expect(CODEC_CATALOG.g729?.needsLicense).toBe(true);
  });

  it('CODEC_PRESETS_ShouldOnlyReferenceCatalogTokens', () => {
    for (const tokens of Object.values(CODEC_PRESETS)) {
      for (const token of tokens) expect(CODEC_CATALOG[token]).toBeDefined();
    }
  });

  it('CODEC_TIERS_ShouldCoverEveryCatalogTier', () => {
    for (const meta of Object.values(CODEC_CATALOG)) {
      expect(CODEC_TIERS).toContain(meta.tier);
    }
  });
});
