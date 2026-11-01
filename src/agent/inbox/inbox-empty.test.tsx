import { cleanup, render, screen } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { afterEach, describe, expect, it } from 'vitest';
import { createLocaleI18n } from '@/test/locale-i18n';
import { InboxEmpty } from './inbox-empty';

afterEach(cleanup);

describe('InboxEmpty', () => {
  it.each([
    ['active', 'Sem conversas ativas'],
    ['waiting', 'Nada em espera'],
    ['wrapup', 'Sem pós-atendimentos pendentes'],
  ] as const)('ShouldShowThePtBrMessage_WhenTheFilterIs %s', async (filter, message) => {
    const i18n = await createLocaleI18n('pt-BR');

    render(
      <I18nextProvider i18n={i18n}>
        <InboxEmpty filter={filter} />
      </I18nextProvider>,
    );

    expect(screen.getByText(message)).toBeInTheDocument();
  });
});
