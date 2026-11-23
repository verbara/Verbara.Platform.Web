/**
 * The holiday calendar detail page's dialing window, rendered with the real page, query hooks and a
 * real i18next instance. Only `customFetch` is stubbed: it plays Platform's holiday routes, whose
 * `AddHolidayRequest` and `HolidayDto` carry the window as `allowedStart` / `allowedEnd`
 * (`HolidayCalendarEndpoints.cs`, and the generated `openapi.d.ts`).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { I18nextProvider } from 'react-i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as client from '@/core/api/client';
import type { components } from '@/core/api/generated/openapi';
import { createLocaleI18n } from '@/test/locale-i18n';
import HolidayCalendarDetailPage from './holiday-calendar-detail';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/core/api/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/core/api/client')>()),
  customFetch: vi.fn(),
}));

type HolidayDto = components['schemas']['HolidayDto'];

const CALENDAR_URL = '/api/v1/admin/holiday-calendars/3';
const HOLIDAYS_URL = `${CALENDAR_URL}/holidays`;

/** The holidays the fake Platform holds for calendar 3. */
let stored: HolidayDto[];
/** Every `POST` body the page sent, in order. */
let posts: unknown[];

beforeEach(() => {
  posts = [];
  stored = [
    {
      id: 10,
      date: '2026-12-24',
      name: 'Christmas Eve',
      allowedStart: '09:00',
      allowedEnd: '13:00',
    },
    { id: 11, date: '2026-12-25', name: 'Christmas', allowedStart: null, allowedEnd: null },
  ];
  vi.mocked(client.customFetch).mockReset();
  vi.mocked(client.customFetch).mockImplementation(async (config) => {
    const route = `${config.method} ${config.url}`;
    if (route === `GET ${CALENDAR_URL}`) return { id: 3, name: 'Holidays 2026' };
    if (route === `GET ${HOLIDAYS_URL}`) return stored.map((h) => ({ ...h }));
    if (route === `POST ${HOLIDAYS_URL}`) {
      posts.push(config.data);
      return { id: 0, ...(config.data as object) };
    }
    throw new Error(`unexpected ${route}`);
  });
});

async function renderPage() {
  const i18n = await createLocaleI18n('en-US');
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/admin/holiday-calendars/3']}>
          <Routes>
            <Route
              path="/admin/holiday-calendars/:calendarId"
              element={<HolidayCalendarDetailPage />}
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
  await screen.findByLabelText('Name');
}

describe('HolidayCalendarDetailPage dialing window', () => {
  it('saveHoliday_ShouldSendTheWindowUnderTheApiFieldNames_WhenAWindowIsTyped', async () => {
    await renderPage();

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'New Year' },
    });
    fireEvent.change(document.getElementById('holidayDate')!, {
      target: { value: '2026-12-31' },
    });
    fireEvent.change(document.getElementById('allowedStart')!, { target: { value: '10:00' } });
    fireEvent.change(document.getElementById('allowedEnd')!, { target: { value: '14:30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add Holiday' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({
      name: 'New Year',
      date: '2026-12-31',
      allowedStart: '10:00',
      allowedEnd: '14:30',
    });
  });

  it('saveHoliday_ShouldOmitTheWindow_WhenNoWindowIsTyped', async () => {
    await renderPage();

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'New Year' },
    });
    fireEvent.change(document.getElementById('holidayDate')!, {
      target: { value: '2026-12-31' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add Holiday' }));

    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ name: 'New Year', date: '2026-12-31' });
  });

  it('holidayList_ShouldShowTheStoredWindow_WhenPlatformReturnsIt', async () => {
    await renderPage();

    const row = (await screen.findByText('Christmas Eve')).closest('tr')!;
    expect(within(row).getByText('09:00')).toBeTruthy();
    expect(within(row).getByText('13:00')).toBeTruthy();
  });

  it('holidayList_ShouldShowADash_WhenPlatformReturnsNoWindow', async () => {
    await renderPage();

    const row = (await screen.findByText('Christmas')).closest('tr')!;
    expect(within(row).getAllByText('—')).toHaveLength(2);
  });
});
