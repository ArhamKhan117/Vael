"use client";

import React, { useEffect, useState } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  onSelectionChange?: (selectedRows: number, totalRows: number) => void;
  onSelectedRowsChange?: (selectedRows: TData[]) => void;
  onRowClick?: (row: TData) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  onSelectionChange,
  onSelectedRowsChange,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [columnVisibility, setColumnVisibility] =
    useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  // Notify parent of selection changes
  useEffect(() => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;

    // Ambil hanya ID-nya saja
    const selectedIds = selectedRows.map((row) => row.original);

    if (onSelectedRowsChange) {
      onSelectedRowsChange(selectedIds);
    }
    if (onSelectionChange) {
      const selectedCount = table.getFilteredSelectedRowModel().rows.length;
      const totalCount = table.getFilteredRowModel().rows.length;
      onSelectionChange(selectedCount, totalCount);
    }
  }, [table, onSelectionChange, onSelectedRowsChange, rowSelection]);

  useEffect(() => {
    // Ambil semua rowId valid dari data baru
    const validRowIds = new Set(
      table.getRowModel().rows.map((row) => row.id)
    );

    // Filter rowSelection agar hanya berisi id yang masih ada
    setRowSelection((prev) => {
      const next: Record<string, boolean> = {};
      for (const key in prev) {
        if (validRowIds.has(key)) next[key] = prev[key];
      }
      return next;
    });
  }, [data, table]);

  return (
    <div className="overflow-hidden rounded border border-[#1A1A1A]">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                return (
                  <TableHead className="text-xs text-white border-none " key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className="bg-black [&>tr:hover]:!bg-white/10">
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  // Ignore clicks originating from interactive elements
                  if (
                    target.closest('button, input, a, [role="checkbox"], [data-stop-row-click]')
                  ) {
                    return;
                  }
                  onRowClick?.(row.original);
                }}
                className={onRowClick ? "cursor-pointer" : ""}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell className="text-xs py-4" key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
