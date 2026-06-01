// Provider templates for the trunk creation wizard. Kept in a separate module
// (not the wizard .tsx) so the wizard file only exports its component — the
// `react-refresh/only-export-components` lint rule forbids mixing a default
// component export with value exports in the same file.

export type AuthMode = 'ip-acl' | 'register';
export type ProviderId = 'twilio' | 'telnyx' | 'flowroute' | 'voipms' | 'generic';

export interface ProviderTemplate {
  id: ProviderId;
  /** Drives which auth fields the connection step shows. */
  authMode: AuthMode;
  /** Suggested codecs seeded into the media step. */
  codecs: string;
  /** `true` for generic: the operator picks the auth mode in step 2. */
  askAuthMode: boolean;
}

export const PROVIDER_TEMPLATES: Record<ProviderId, ProviderTemplate> = {
  twilio: { id: 'twilio', authMode: 'ip-acl', codecs: 'ulaw,opus', askAuthMode: false },
  telnyx: { id: 'telnyx', authMode: 'ip-acl', codecs: 'ulaw,alaw', askAuthMode: false },
  flowroute: { id: 'flowroute', authMode: 'ip-acl', codecs: 'ulaw,alaw', askAuthMode: false },
  voipms: { id: 'voipms', authMode: 'register', codecs: 'ulaw,alaw', askAuthMode: false },
  generic: { id: 'generic', authMode: 'ip-acl', codecs: 'ulaw,alaw', askAuthMode: true },
};

export const PROVIDER_ORDER: ProviderId[] = ['twilio', 'telnyx', 'flowroute', 'voipms', 'generic'];
