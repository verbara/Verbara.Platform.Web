import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

const SUPPORTED = ['en-US', 'es-419', 'pt-BR'];

export async function initWebchatI18n(loadPath: string, locale?: string): Promise<typeof i18n> {
  await i18n
    .use(HttpBackend)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      lng: locale && SUPPORTED.includes(locale) ? locale : undefined,
      fallbackLng: 'en-US',
      supportedLngs: SUPPORTED,
      ns: ['webchat'],
      defaultNS: 'webchat',
      backend: {
        loadPath: `${loadPath}/{{lng}}/{{ns}}.json`,
      },
      detection: {
        order: ['querystring', 'navigator'],
        lookupQuerystring: 'locale',
      },
      interpolation: { escapeValue: false },
    });
  return i18n;
}
