export type CodecTier = 'standard' | 'hd' | 'lowband' | 'legacy' | 'video';

export interface CodecMeta {
  /** Exact PJSIP allow= token — load-bearing, never translated. */
  readonly token: string;
  /** i18n key (namespace 'common') for the friendly name, under voice.codecs.names.*. */
  readonly nameKey: string;
  readonly tier: CodecTier;
  /** Shown in the default picker; non-curated codecs live behind "show all". */
  readonly curated: boolean;
  readonly webrtc?: boolean;
  readonly needsLicense?: boolean;
  readonly needsModule?: boolean;
}

export const CODEC_TIERS: readonly CodecTier[] = ['standard', 'hd', 'lowband', 'legacy', 'video'];

export const CODEC_CATALOG: Readonly<Record<string, CodecMeta>> = {
  ulaw: { token: 'ulaw', nameKey: 'voice.codecs.names.ulaw', tier: 'standard', curated: true },
  alaw: { token: 'alaw', nameKey: 'voice.codecs.names.alaw', tier: 'standard', curated: true },
  g722: { token: 'g722', nameKey: 'voice.codecs.names.g722', tier: 'hd', curated: true },
  opus: {
    token: 'opus',
    nameKey: 'voice.codecs.names.opus',
    tier: 'hd',
    curated: true,
    webrtc: true,
    needsModule: true,
  },
  g729: {
    token: 'g729',
    nameKey: 'voice.codecs.names.g729',
    tier: 'lowband',
    curated: true,
    needsLicense: true,
  },
  gsm: { token: 'gsm', nameKey: 'voice.codecs.names.gsm', tier: 'lowband', curated: true },
  ilbc: { token: 'ilbc', nameKey: 'voice.codecs.names.ilbc', tier: 'lowband', curated: true },
  g726: { token: 'g726', nameKey: 'voice.codecs.names.g726', tier: 'lowband', curated: false },
  g726aal2: {
    token: 'g726aal2',
    nameKey: 'voice.codecs.names.g726aal2',
    tier: 'lowband',
    curated: false,
  },
  adpcm: { token: 'adpcm', nameKey: 'voice.codecs.names.adpcm', tier: 'legacy', curated: false },
  speex: { token: 'speex', nameKey: 'voice.codecs.names.speex', tier: 'lowband', curated: false },
  speex16: { token: 'speex16', nameKey: 'voice.codecs.names.speex16', tier: 'hd', curated: false },
  siren7: { token: 'siren7', nameKey: 'voice.codecs.names.siren7', tier: 'hd', curated: false },
  siren14: { token: 'siren14', nameKey: 'voice.codecs.names.siren14', tier: 'hd', curated: false },
  g719: { token: 'g719', nameKey: 'voice.codecs.names.g719', tier: 'hd', curated: false },
  g723: { token: 'g723', nameKey: 'voice.codecs.names.g723', tier: 'lowband', curated: false },
  lpc10: { token: 'lpc10', nameKey: 'voice.codecs.names.lpc10', tier: 'legacy', curated: false },
  silk: {
    token: 'silk',
    nameKey: 'voice.codecs.names.silk',
    tier: 'hd',
    curated: false,
    needsModule: true,
  },
  vp8: {
    token: 'vp8',
    nameKey: 'voice.codecs.names.vp8',
    tier: 'video',
    curated: true,
    webrtc: true,
  },
  vp9: {
    token: 'vp9',
    nameKey: 'voice.codecs.names.vp9',
    tier: 'video',
    curated: false,
    webrtc: true,
  },
  h264: {
    token: 'h264',
    nameKey: 'voice.codecs.names.h264',
    tier: 'video',
    curated: true,
    webrtc: true,
  },
  h263p: { token: 'h263p', nameKey: 'voice.codecs.names.h263p', tier: 'video', curated: false },
  h263: { token: 'h263', nameKey: 'voice.codecs.names.h263', tier: 'video', curated: false },
  h261: { token: 'h261', nameKey: 'voice.codecs.names.h261', tier: 'video', curated: false },
  mpeg4: { token: 'mpeg4', nameKey: 'voice.codecs.names.mpeg4', tier: 'video', curated: false },
};

/** Preset key → ordered token list (order = negotiation preference). 'custom' = no preset applied. */
export const CODEC_PRESETS: Readonly<Record<string, readonly string[]>> = {
  recommended: ['ulaw', 'alaw', 'g722'],
  hd: ['opus', 'g722', 'ulaw', 'alaw'],
  lowband: ['g729', 'ulaw', 'alaw'],
  webrtc: ['opus', 'ulaw', 'alaw', 'vp8', 'h264'],
};
