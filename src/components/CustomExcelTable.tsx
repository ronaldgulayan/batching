import React, { useEffect, useMemo, useState } from 'react';
import { ScrollArea } from '@mantine/core';
import './excel.css';

type CellType = 'text' | 'number' | 'date' | 'autocomplete';

export type ExcelColumn<T> = {
  key: keyof T & string;
  label: string;
  type?: CellType;
  width?: number;
  suggestions?: readonly string[];
  sortable?: boolean;
};

type Props<T extends { id: string | number }> = {
  columns: readonly ExcelColumn<T>[];
  data: T[];
  editable?: boolean;
  onChange?: (rows: T[]) => void;
  renderRowActions?: (row: T, rowIndex: number) => React.ReactNode;
  onRowClick?: (row: T, rowIndex: number) => void;
  getRowClassName?: (row: T, rowIndex: number) => string;
  getRowStyle?: (row: T, rowIndex: number) => React.CSSProperties;
  page?: number;
  onPageChange?: (page: number) => void;
};

export function CustomExcelTable<T extends { id: string | number }>({
  columns,
  data,
  editable = false,
  onChange,
  renderRowActions,
  onRowClick,
  getRowClassName,
  getRowStyle,
  page,
  onPageChange,
}: Props<T>) {
  const [rows, setRows] = useState<T[]>(data);
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [sortConfig, setSortConfig] = useState<{ key: keyof T & string; direction: 'asc' | 'desc' } | null>(null);
  const [internalPage, setInternalPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setRows(data);
  }, [data]);

  const currentPage = page ?? internalPage;
  const setCurrentPage = onPageChange ?? setInternalPage;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;

  const paginatedRows = useMemo(() => rows.slice(startIndex, startIndex + pageSize), [rows, startIndex, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, setCurrentPage, totalPages]);

  function formatDisplayValue(value: unknown, col: ExcelColumn<T>) {
    if (value === undefined || value === null || value === '') return '';

    if (col.type === 'number') {
      const number = Number(value);
      if (Number.isNaN(number)) return String(value);

      const key = col.key.toLowerCase();
      if (key.includes('price') || key.includes('amount') || key.includes('total') || key.includes('balance')) {
        return `PHP ${number.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      }

      return number.toLocaleString();
    }

    return String(value);
  }

  function sortRows(key: keyof T & string) {
    const direction = sortConfig?.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    const sortedRows = [...rows].sort((a, b) => {
      const aValue = a[key];
      const bValue = b[key];
      const aNumber = Number(aValue);
      const bNumber = Number(bValue);

      if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) {
        return direction === 'asc' ? aNumber - bNumber : bNumber - aNumber;
      }

      const compared = String(aValue ?? '').localeCompare(String(bValue ?? ''), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      return direction === 'asc' ? compared : -compared;
    });

    setSortConfig({ key, direction });
    setRows(sortedRows);
    onChange?.(sortedRows);
  }

  return (
    <div className="excel-container">
      <ScrollArea className="excel-scroll-area" type="auto">
        <div className="excel-grid-container" tabIndex={0}>
          <table className="excel-grid-table">
            <thead>
              <tr className="excel-header-row">
                <th style={{ width: 50, textAlign: 'center' }} />
                {columns.map((col) => (
                  <th key={col.key} style={{ width: col.width ? `${col.width}px` : undefined }}>
                    <div className="excel-header-content">
                      <span>{col.label}</span>
                    </div>
                    {col.sortable && (
                      <button
                        type="button"
                        className="excel-header-sort-icon"
                        onClick={() => sortRows(col.key)}
                        aria-label={`Sort ${col.label}`}
                      >
                        {sortConfig?.key === col.key ? (sortConfig.direction === 'asc' ? '^' : 'v') : '<>'}
                      </button>
                    )}
                  </th>
                ))}
                {renderRowActions && <th style={{ width: 160, textAlign: 'center' }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, relativeRowIndex) => {
                const rowIndex = startIndex + relativeRowIndex;
                return (
                  <tr
                    key={row.id}
                    className={getRowClassName?.(row, rowIndex) ?? ''}
                    style={getRowStyle?.(row, rowIndex)}
                  >
                    <td className="excel-row-header">{rowIndex + 1}</td>
                    {columns.map((col, colIndex) => {
                      const isActive = activeCell?.row === rowIndex && activeCell.col === colIndex;
                      const isNumber = col.type === 'number';
                      return (
                        <td
                          key={col.key}
                          className={isActive ? 'active-cell' : ''}
                          style={{ width: col.width ? `${col.width}px` : undefined }}
                          onClick={() => {
                            setActiveCell({ row: rowIndex, col: colIndex });
                            onRowClick?.(row, rowIndex);
                          }}
                        >
                          <div className={`excel-cell-display ${isNumber ? 'cell-right' : 'cell-left'}`}>
                            {formatDisplayValue(row[col.key], col)}
                            {editable && col.type === 'autocomplete' && (
                              <span className="excel-cell-dropdown-arrow">v</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    {renderRowActions && <td className="excel-action-cell">{renderRowActions(row, rowIndex)}</td>}
                  </tr>
                );
              })}
              {!paginatedRows.length && (
                <tr>
                  <td className="excel-row-header">0</td>
                  <td colSpan={columns.length + (renderRowActions ? 1 : 0)}>
                    <div className="excel-cell-display">No records to display</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ScrollArea>

      <div className="excel-pagination-bar">
        <div className="excel-pagination-info">
          <span>
            Showing {rows.length === 0 ? 0 : startIndex + 1} to {Math.min(startIndex + pageSize, rows.length)} of{' '}
            {rows.length} records
          </span>
          <label className="excel-pagination-limit">
            Rows per page:
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.currentTarget.value));
                setCurrentPage(1);
              }}
              className="excel-pagination-limit-select"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>
        <div className="excel-pagination-buttons">
          <button className="excel-pagination-btn" disabled={currentPage === 1} onClick={() => setCurrentPage(1)}>
            First
          </button>
          <button
            className="excel-pagination-btn"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Prev
          </button>
          <button className="excel-pagination-btn active">{currentPage}</button>
          <button
            className="excel-pagination-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
          <button
            className="excel-pagination-btn"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(totalPages)}
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
}
