import i18next, { type i18n } from 'i18next';
import enAdmin from '../../public/locales/en-US/admin.json';
import esAdmin from '../../public/locales/es-419/admin.json';
import ptAdmin from '../../public/locales/pt-BR/admin.json';
import enAgent from '../../public/locales/en-US/agent.json';
import esAgent from '../../public/locales/es-419/agent.json';
import ptAgent from '../../public/locales/pt-BR/agent.json';
import enCommon from '../../public/locales/en-US/common.json';
import esCommon from '../../public/locales/es-419/common.json';
import ptCommon from '../../public/locales/pt-BR/common.json';
import enOperations from '../../public/locales/en-US/operations.json';
import esOperations from '../../public/locales/es-419/operations.json';
import ptOperations from '../../public/locales/pt-BR/operations.json';

export type TestLocale = 'en-US' | 'es-419' | 'pt-BR';

export const TEST_LOCALES: readonly TestLocale[] = ['en-US', 'es-419', 'pt-BR'];

/** The committed `admin.json` of each locale, for assertions on the text a user sees. */
export const ADMIN_LOCALES: Record<TestLocale, typeof enAdmin> = {
  'en-US': enAdmin,
  'es-419': esAdmin,
  'pt-BR': ptAdmin,
};

/** The committed `operations.json` of each locale, for assertions on the text a user sees. */
export const OPERATIONS_LOCALES: Record<TestLocale, typeof enOperations> = {
  'en-US': enOperations,
  'es-419': esOperations,
  'pt-BR': ptOperations,
};

/**
 * A real i18next instance loaded with the committed `admin`, `agent`, `common` and `operations`
 * files of all three locales. There is no fallback language, so a key missing from the active
 * locale renders as the raw key and fails the assertion that reads it.
 */
export async function createLocaleI18n(lng: TestLocale): Promise<i18n> {
  const instance = i18next.createInstance();
  await instance.init({
    lng,
    fallbackLng: false,
    resources: {
      'en-US': { admin: enAdmin, agent: enAgent, common: enCommon, operations: enOperations },
      'es-419': { admin: esAdmin, agent: esAgent, common: esCommon, operations: esOperations },
      'pt-BR': { admin: ptAdmin, agent: ptAgent, common: ptCommon, operations: ptOperations },
    },
    ns: ['admin', 'agent', 'common', 'operations'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return instance;
}
