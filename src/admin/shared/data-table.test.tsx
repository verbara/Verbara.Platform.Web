import { render } from '@testing-library/react';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { DataTable } from './data-table';
import { type ColumnDef } from '@tanstack/react-table';

interface Row {
  id: number;
  name: string;
}

void i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: {
      admin: {
        shared: {
          data_table: {
            search_placeholder: 'Search',
            no_results: 'None',
            page_info: '{{current}}/{{total}}',
            previous: 'Prev',
            next: 'Next',
          },
        },
      },
    },
  },
});

const columns: ColumnDef<Row>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
];

describe('DataTable virtualized mode', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(400);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Renders_BoundedRowCount_WhenVirtualized_AndDatasetIs5k', () => {
    const data: Row[] = Array.from({ length: 5_000 }, (_, i) => ({ id: i, name: `Row ${i}` }));
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <div style={{ height: 400 }}>
          <DataTable data={data} columns={columns} virtualized />
        </div>
      </I18nextProvider>,
    );
    const rows = container.querySelectorAll('[data-virtual-row]');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(80);
  });

  it('Defaults_NotVirtualized_WhenPropOmitted', () => {
    const data: Row[] = Array.from({ length: 30 }, (_, i) => ({ id: i, name: `Row ${i}` }));
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <DataTable data={data} columns={columns} pageSize={10} />
      </I18nextProvider>,
    );
    expect(container.querySelectorAll('[data-virtual-row]').length).toBe(0);
    expect(container.querySelectorAll('tbody tr').length).toBe(10);
  });
});

describe('DataTable a11y', () => {
  it('StandardMode_HeaderCells_HaveScopeCol', () => {
    const data = [{ id: 1, name: 'A' }];
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <DataTable data={data} columns={columns} />
      </I18nextProvider>,
    );
    const ths = container.querySelectorAll('th');
    expect(ths.length).toBeGreaterThan(0);
    ths.forEach((th) => expect(th.getAttribute('scope')).toBe('col'));
  });

  it('SearchInput_HasAriaLabel_FromPlaceholder', () => {
    const { container } = render(
      <I18nextProvider i18n={i18n}>
        <DataTable data={[]} columns={[]} searchPlaceholder="Search users" />
      </I18nextProvider>,
    );
    const input = container.querySelector('[data-testid="data-table-search"]') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('Search users');
  });
});
