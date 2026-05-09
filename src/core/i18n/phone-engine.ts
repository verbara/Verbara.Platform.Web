// Cohesive re-export so consumers can `await import('@/core/i18n/phone-engine')`
// and pull libphonenumber-js into the lazy chunk in one shot.
//
// IMPORTANT: never re-export this module statically — it must only be reached
// via dynamic import to keep the lazy chunking.
export { AsYouType, parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js/min';
export type { CountryCode } from 'libphonenumber-js/types';
