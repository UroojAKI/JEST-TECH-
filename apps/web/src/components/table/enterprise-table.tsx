'use client';

import React, { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  flexRender,
  ColumnDef,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, Download, Search } from 'lucide-react';

interface EnterpriseTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, any>[];
  totalRows?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  pageIndex?: number;
  pageCount?: number;
  manualPagination?: boolean;
  manualFiltering?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  renderSubComponent?: (props: { row: TData }) => React.ReactNode;
}

export function EnterpriseTable<TData>({
  data,
  columns,
  totalRows,
  pageSize = 10,
  onPageChange,
  pageIndex = 0,
  pageCount,
  manualPagination = false,
  manualFiltering = false,
  searchValue,
  onSearchChange,
  renderSubComponent,
}: EnterpriseTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [internalFilter, setInternalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [expanded, setExpanded] = useState({});

  const globalFilter = searchValue ?? internalFilter;
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
      expanded,
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: (value) => {
      const next = typeof value === 'function' ? value(globalFilter) : value;
      if (onSearchChange) onSearchChange(next);
      else setInternalFilter(next);
    },
    onColumnVisibilityChange: setColumnVisibility,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    manualPagination,
    manualFiltering,
    pageCount: manualPagination ? pageCount ?? Math.ceil((totalRows ?? data.length) / pageSize) : undefined,
  });

  const currentPageCount = manualPagination
    ? pageCount ?? Math.max(1, Math.ceil((totalRows ?? data.length) / pageSize))
    : table.getPageCount() || 1;
  const currentPage = manualPagination ? pageIndex : table.getState().pagination.pageIndex;
  const visibleStart = (totalRows ?? data.length) === 0 ? 0 : currentPage * pageSize + 1;
  const visibleEnd = manualPagination
    ? Math.min((currentPage + 1) * pageSize, totalRows ?? data.length)
    : Math.min((currentPage + 1) * pageSize, data.length);

  const exportCSV = () => {
    const headers = columns.map((c) => (c.header as string) || '').join(',');
    const rows = data.map((row: any) =>
      columns.map((c) => {
        const value = row[c.id as string] ?? row[c.accessorKey as string];
        return value === undefined || value === null ? '' : `"${String(value).replaceAll('"', '""')}"`;
      }).join(','),
    );
    const link = document.createElement('a');
    link.href = encodeURI('data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n'));
    link.download = 'export.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const goToPage = (nextPage: number) => {
    if (nextPage < 0 || nextPage >= currentPageCount) return;
    if (manualPagination && onPageChange) onPageChange(nextPage);
    else table.setPageIndex(nextPage);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-card p-3 rounded-lg border">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input value={globalFilter} onChange={(e) => (onSearchChange ? onSearchChange(e.target.value) : setInternalFilter(e.target.value))} placeholder="Filter records..." className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <button onClick={exportCSV} className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border bg-muted/40 hover:bg-accent"><Download className="h-3.5 w-3.5" /><span>Export CSV</span></button>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>{headerGroup.headers.map((header) => <th key={header.id} onClick={header.column.getToggleSortingHandler()} className="px-4 py-3 cursor-pointer select-none"><div className="flex items-center space-x-1"><span>{flexRender(header.column.columnDef.header, header.getContext())}</span>{({ asc: ' 🔼', desc: ' 🔽' } as any)[header.column.getIsSorted() as string] ?? null}</div></th>)}</tr>
              ))}
            </thead>
            <tbody className="divide-y">
              {table.getRowModel().rows.length === 0 ? <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">No records found.</td></tr> : table.getRowModel().rows.map((row) => <React.Fragment key={row.id}><tr className="hover:bg-accent/40 transition-colors">{row.getVisibleCells().map((cell) => <td key={cell.id} className="px-4 py-3">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>{row.getIsExpanded() && renderSubComponent && <tr><td colSpan={row.getVisibleCells().length} className="bg-muted/20 p-4 border-b">{renderSubComponent({ row: row.original })}</td></tr>}</React.Fragment>)}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground">
          <div>Showing {visibleStart} to {visibleEnd} of {totalRows ?? data.length} entries</div>
          <div className="flex items-center space-x-2">
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 0} className="p-1 rounded border disabled:opacity-40 hover:bg-accent"><ChevronLeft className="h-4 w-4" /></button>
            <span className="font-semibold text-foreground">Page {currentPage + 1} of {currentPageCount}</span>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= currentPageCount - 1} className="p-1 rounded border disabled:opacity-40 hover:bg-accent"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
