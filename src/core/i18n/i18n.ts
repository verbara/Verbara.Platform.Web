import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

export const SUPPORTED_LANGUAGES = ['es-419', 'en-US', 'pt-BR'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_STORAGE_KEY = 'verbara.lang';

// v3.1.2-web fix: drop `nonExplicitSupportedLngs: true` + `load: 'currentOnly'`
// which together with i18next v26.x + LanguageDetector v8.x produced
// `languages: []` (empty language chain) at runtime, causing
// HttpBackend to never fetch any namespace JSON. Resolved by using
// i18next's default load strategy ('all', meaning load detected lang +
// fallback) and explicit-only supportedLngs match. Verified via Playwright
// against the K8s lab — `auth.*`, `app.*`, etc. now resolve from the
// pre-existing common.json bundle in /usr/share/nginx/html/locales/.
i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'es-419',
    supportedLngs: [...SUPPORTED_LANGUAGES],
    ns: ['common', 'admin', 'agent', 'operations', 'analytics'],
    defaultNS: 'common',
    backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
    interpolation: { escapeValue: false },
    react: { useSuspense: true },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

export default i18n;
