/* eslint-disable react-hooks/incompatible-library -- TanStack Table useReactTable() internal subscriptions */
import { useState, useEffect, useRef } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/core/ui/button';
import { Input } from '@/core/ui/input';

export interface DataTableProps<T> {
  data: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[];
  searchPlaceholder?: string;
  noResultsMessage?: string;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  virtualized?: boolean;
  virtualRowEstimate?: number;
}

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder,
  noResultsMessage,
  pageSize = 10,
  onRowClick,
  virtualized = false,
  virtualRowEstimate = 48,
}: DataTableProps<T>) {
  const { t } = useTranslation('admin');
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('shared.data_table.search_placeholder');
  const resolvedNoResults = noResultsMessage ?? t('shared.data_table.no_results');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter: debouncedSearch },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });

  const scrollerRef = useRef<HTMLDivElement>(null);
  const rowsForRender = virtualized ? table.getFilteredRowModel().rows : table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: rowsForRender.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => virtualRowEstimate,
    overscan: 10,
  });
  const gridTemplateColumns = `repeat(${columns.length}, minmax(0, 1fr))`;

  return (
    <>
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={resolvedSearchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
          data-testid="data-table-search"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border">
        {!virtualized && (
          <table className="w-full text-sm" data-testid="data-table">
            <thead className="border-b bg-muted/50 sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left font-medium text-muted-foreground"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y">
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`transition-colors hover:bg-muted/50${onRowClick ? ' cursor-pointer' : ''}`}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {resolvedNoResults}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {virtualized && (
          <div role="table" data-testid="data-table" className="w-full text-sm">
            <div
              role="rowgroup"
              className="border-b bg-muted/50 sticky top-0 z-10"
              style={{ display: 'grid', gridTemplateColumns: gridTemplateColumns }}
            >
              {table.getHeaderGroups().map((headerGroup) =>
                headerGroup.headers.map((header) => (
                  <div
                    key={header.id}
                    role="columnheader"
                    className="px-4 py-3 text-left font-medium text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </div>
                )),
              )}
            </div>
            <div
              ref={scrollerRef}
              data-virtual-scroller
              role="rowgroup"
              className="max-h-[600px] overflow-auto"
            >
              {rowsForRender.length === 0 ? (
                <div className="px-4 py-8 text-center text-muted-foreground">
                  {resolvedNoResults}
                </div>
              ) : (
                <div
                  style={{
                    height: rowVirtualizer.getTotalSize(),
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((vi) => {
                    const row = rowsForRender[vi.index]!;
                    return (
                      <div
                        key={row.id}
                        role="row"
                        data-virtual-row
                        ref={rowVirtualizer.measureElement}
                        data-index={vi.index}
                        className={`border-b transition-colors hover:bg-muted/50${onRowClick ? ' cursor-pointer' : ''}`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${vi.start}px)`,
                          display: 'grid',
                          gridTemplateColumns: gridTemplateColumns,
                        }}
                        tabIndex={onRowClick ? 0 : undefined}
                        onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                        onKeyDown={
                          onRowClick
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') onRowClick(row.original);
                              }
                            : undefined
                        }
                      >
                        {row.getVisibleCells().map((cell) => (
                          <div key={cell.id} role="cell" className="px-4 py-3">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!virtualized && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground" data-testid="data-table-page-info">
            {t('shared.data_table.page_info', {
              current: table.getState().pagination.pageIndex + 1,
              total: table.getPageCount(),
            })}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              data-testid="data-table-prev"
            >
              {t('shared.data_table.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              data-testid="data-table-next"
            >
              {t('shared.data_table.next')}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
