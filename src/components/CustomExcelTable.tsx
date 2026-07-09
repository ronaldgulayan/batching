import React, { useEffect, useMemo, useRef, useState } from "react";
import { ScrollArea } from "@mantine/core";
import "./excel.css";

type CellType = "text" | "number" | "date" | "autocomplete";

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
  renderCell?: (row: T, column: ExcelColumn<T>, rowIndex: number) => React.ReactNode;
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
  renderCell,
  renderRowActions,
  onRowClick,
  getRowClassName,
  getRowStyle,
  page,
  onPageChange,
}: Props<T>) {
  const [rows, setRows] = useState<T[]>(data);
  const [activeCell, setActiveCell] = useState<{
    row: number;
    col: number;
  } | null>(null);
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T & string;
    direction: "asc" | "desc";
  } | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string | number>>(
    () => new Set(),
  );
  const [selectedColumnKeys, setSelectedColumnKeys] = useState<
    Set<keyof T & string>
  >(() => new Set());
  const [selectedCellKeys, setSelectedCellKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const [internalPage, setInternalPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const dragStartRef = useRef<
    | { type: "cell"; row: number; col: number }
    | { type: "row"; row: number }
    | { type: "column"; col: number }
    | null
  >(null);
  const isDraggingRef = useRef(false);
  const didDragRef = useRef(false);
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRows(data);
  }, [data]);

  useEffect(() => {
    setSelectedRowIds((current) => {
      const validIds = new Set(data.map((row) => row.id));
      return new Set([...current].filter((id) => validIds.has(id)));
    });
    setSelectedColumnKeys((current) => {
      const validKeys = new Set(columns.map((column) => column.key));
      return new Set([...current].filter((key) => validKeys.has(key)));
    });
    setSelectedCellKeys((current) => {
      const validIds = new Set(data.map((row) => row.id));
      const validKeys = new Set(columns.map((column) => column.key));
      return new Set(
        [...current].filter((key) => {
          const [rowId, columnKey] = key.split("::");
          return validIds.has(rowId) && validKeys.has(columnKey as keyof T & string);
        }),
      );
    });
  }, [columns, data]);

  useEffect(() => {
    function stopDragSelection() {
      isDraggingRef.current = false;
      dragStartRef.current = null;
    }

    window.addEventListener("mouseup", stopDragSelection);
    return () => window.removeEventListener("mouseup", stopDragSelection);
  }, []);

  const currentPage = page ?? internalPage;
  const setCurrentPage = onPageChange ?? setInternalPage;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;

  const paginatedRows = useMemo(
    () => rows.slice(startIndex, startIndex + pageSize),
    [rows, startIndex, pageSize],
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, setCurrentPage, totalPages]);

  function toggleRowSelection(rowId: string | number) {
    setSelectedRowIds((current) => {
      const next = new Set(current);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  function toggleColumnSelection(key: keyof T & string) {
    setSelectedColumnKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function cellKey(row: T, column: ExcelColumn<T>) {
    return `${String(row.id)}::${column.key}`;
  }

  function selectCellRange(start: { row: number; col: number }, end: { row: number; col: number }) {
    const minRow = Math.max(0, Math.min(start.row, end.row));
    const maxRow = Math.min(rows.length - 1, Math.max(start.row, end.row));
    const minCol = Math.max(0, Math.min(start.col, end.col));
    const maxCol = Math.min(columns.length - 1, Math.max(start.col, end.col));
    const next = new Set<string>();

    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      const row = rows[rowIndex];
      if (!row) continue;

      for (let colIndex = minCol; colIndex <= maxCol; colIndex += 1) {
        const column = columns[colIndex];
        if (!column) continue;
        next.add(cellKey(row, column));
      }
    }

    setSelectedCellKeys(next);
  }

  function selectRowRange(startRow: number, endRow: number) {
    const minRow = Math.max(0, Math.min(startRow, endRow));
    const maxRow = Math.min(rows.length - 1, Math.max(startRow, endRow));
    const next = new Set<string | number>();

    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
      const row = rows[rowIndex];
      if (row) next.add(row.id);
    }

    setSelectedRowIds(next);
  }

  function selectColumnRange(startCol: number, endCol: number) {
    const minCol = Math.max(0, Math.min(startCol, endCol));
    const maxCol = Math.min(columns.length - 1, Math.max(startCol, endCol));
    const next = new Set<keyof T & string>();

    for (let colIndex = minCol; colIndex <= maxCol; colIndex += 1) {
      const column = columns[colIndex];
      if (column) next.add(column.key);
    }

    setSelectedColumnKeys(next);
  }

  function startCellSelection(rowIndex: number, colIndex: number) {
    const position = { row: rowIndex, col: colIndex };
    dragStartRef.current = { type: "cell", ...position };
    isDraggingRef.current = true;
    didDragRef.current = false;
    setSelectedRowIds(new Set());
    setSelectedColumnKeys(new Set());
    selectCellRange(position, position);
  }

  function extendCellSelection(rowIndex: number, colIndex: number) {
    if (!isDraggingRef.current || !dragStartRef.current) return;
    if (dragStartRef.current.type !== "cell") return;

    didDragRef.current = true;
    selectCellRange(dragStartRef.current, { row: rowIndex, col: colIndex });
  }

  function startRowSelection(rowIndex: number) {
    dragStartRef.current = { type: "row", row: rowIndex };
    isDraggingRef.current = true;
    didDragRef.current = false;
    setSelectedCellKeys(new Set());
    setSelectedColumnKeys(new Set());
    selectRowRange(rowIndex, rowIndex);
  }

  function extendRowSelection(rowIndex: number) {
    if (!isDraggingRef.current || !dragStartRef.current) return;
    if (dragStartRef.current.type !== "row") return;

    didDragRef.current = true;
    selectRowRange(dragStartRef.current.row, rowIndex);
  }

  function startColumnSelection(colIndex: number) {
    dragStartRef.current = { type: "column", col: colIndex };
    isDraggingRef.current = true;
    didDragRef.current = false;
    setSelectedCellKeys(new Set());
    setSelectedRowIds(new Set());
    selectColumnRange(colIndex, colIndex);
  }

  function extendColumnSelection(colIndex: number) {
    if (!isDraggingRef.current || !dragStartRef.current) return;
    if (dragStartRef.current.type !== "column") return;

    didDragRef.current = true;
    selectColumnRange(dragStartRef.current.col, colIndex);
  }

  function isCellSelected(row: T, column: ExcelColumn<T>) {
    return (
      selectedRowIds.has(row.id) ||
      selectedColumnKeys.has(column.key) ||
      selectedCellKeys.has(cellKey(row, column))
    );
  }

  const selectionStats = useMemo(() => {
    let count = 0;
    let numericCount = 0;
    let sum = 0;

    for (const row of rows) {
      for (const column of columns) {
        if (!isCellSelected(row, column)) continue;

        count += 1;
        if (column.type !== "number") continue;

        const value = Number(row[column.key]);
        if (Number.isNaN(value)) continue;

        numericCount += 1;
        sum += value;
      }
    }

    return {
      count,
      numericCount,
      sum,
      average: numericCount > 0 ? sum / numericCount : 0,
    };
  }, [columns, rows, selectedCellKeys, selectedColumnKeys, selectedRowIds]);

  const hasSelection = selectionStats.count > 0;

  function formatDisplayValue(value: unknown, col: ExcelColumn<T>) {
    if (value === undefined || value === null || value === "") return "";

    if (col.type === "number") {
      const number = Number(value);
      if (Number.isNaN(number)) return String(value);

      const key = col.key.toLowerCase();
      if (
        key.includes("price") ||
        key.includes("amount") ||
        key.includes("total") ||
        key.includes("balance")
      ) {
        return `₱${number.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;
      }

      return number.toLocaleString();
    }

    return String(value);
  }

  function sortRows(key: keyof T & string) {
    const direction =
      sortConfig?.key === key && sortConfig.direction === "asc"
        ? "desc"
        : "asc";
    const sortedRows = [...rows].sort((a, b) => {
      const aValue = a[key];
      const bValue = b[key];
      const aNumber = Number(aValue);
      const bNumber = Number(bValue);

      if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) {
        return direction === "asc" ? aNumber - bNumber : bNumber - aNumber;
      }

      const compared = String(aValue ?? "").localeCompare(
        String(bValue ?? ""),
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        },
      );
      return direction === "asc" ? compared : -compared;
    });

    setSortConfig({ key, direction });
    setRows(sortedRows);
    onChange?.(sortedRows);
  }

  function formatStatNumber(value: number) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const isCopy = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c";
    if (isCopy) {
      // Find the range of selected cells
      let minRow = -1;
      let maxRow = -1;
      let minCol = -1;
      let maxCol = -1;

      // Find bounding box
      for (let r = 0; r < rows.length; r++) {
        const row = rows[r];
        for (let c = 0; c < columns.length; c++) {
          const col = columns[c];
          if (isCellSelected(row, col)) {
            if (minRow === -1 || r < minRow) minRow = r;
            if (r > maxRow) maxRow = r;
            if (minCol === -1 || c < minCol) minCol = c;
            if (c > maxCol) maxCol = c;
          }
        }
      }

      if (minRow === -1) {
        // Nothing is selected, copy activeCell if it exists
        if (activeCell) {
          const row = rows[activeCell.row];
          const col = columns[activeCell.col];
          if (row && col) {
            const val = String(row[col.key] ?? "");
            navigator.clipboard.writeText(val).catch(() => {});
          }
        }
        event.preventDefault();
        return;
      }

      // Build tab and newline separated string
      const lines: string[] = [];
      for (let r = minRow; r <= maxRow; r++) {
        const row = rows[r];
        if (!row) continue;
        const lineCells: string[] = [];
        for (let c = minCol; c <= maxCol; c++) {
          const col = columns[c];
          if (!col) continue;
          if (isCellSelected(row, col)) {
            lineCells.push(String(row[col.key] ?? ""));
          } else {
            lineCells.push("");
          }
        }
        lines.push(lineCells.join("\t"));
      }

      const textToCopy = lines.join("\n");
      navigator.clipboard.writeText(textToCopy).catch((err) => {
        console.error("Failed to copy text: ", err);
      });

      event.preventDefault();
    }
  }

  return (
    <div className='excel-container'>
      <ScrollArea
        className='excel-scroll-area'
        type='auto'
      >
        <div
          ref={gridContainerRef}
          className='excel-grid-container'
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <table className='excel-grid-table'>
            <thead>
              <tr className='excel-header-row'>
                <th
                  style={{ width: 50, textAlign: "center" }}
                  onClick={() => {
                    setSelectedRowIds(new Set());
                    setSelectedColumnKeys(new Set());
                    setSelectedCellKeys(new Set());
                    gridContainerRef.current?.focus();
                  }}
                  title='Clear selection'
                />
                {columns.map((col, colIndex) => (
                  <th
                    key={col.key}
                    className={
                      selectedColumnKeys.has(col.key) ? "header-selected" : ""
                    }
                    style={{ width: col.width ? `${col.width}px` : undefined }}
                    onClick={() => {
                      if (didDragRef.current) {
                        didDragRef.current = false;
                        return;
                      }
                      toggleColumnSelection(col.key);
                    }}
                    onMouseDown={(event) => {
                      if (event.button !== 0) return;
                      event.preventDefault();
                      startColumnSelection(colIndex);
                      gridContainerRef.current?.focus();
                    }}
                    onMouseEnter={() => extendColumnSelection(colIndex)}
                  >
                    <div className='excel-header-content'>
                      <span>{col.label}</span>
                    </div>
                    {col.sortable && (
                      <button
                        type='button'
                        className='excel-header-sort-icon'
                        onClick={(event) => {
                          event.stopPropagation();
                          didDragRef.current = false;
                          sortRows(col.key);
                        }}
                        onMouseDown={(event) => event.stopPropagation()}
                        aria-label={`Sort ${col.label}`}
                      >
                        {sortConfig?.key === col.key
                          ? sortConfig.direction === "asc"
                            ? "^"
                            : "v"
                          : "<>"}
                      </button>
                    )}
                  </th>
                ))}
                {renderRowActions && (
                  <th style={{ width: 160, textAlign: "center" }}>Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, relativeRowIndex) => {
                const rowIndex = startIndex + relativeRowIndex;
                const isRowSelected = selectedRowIds.has(row.id);
                return (
                  <tr
                    key={row.id}
                    className={getRowClassName?.(row, rowIndex) ?? ""}
                    style={getRowStyle?.(row, rowIndex)}
                  >
                    <td
                      className={`excel-row-header ${isRowSelected ? "header-selected" : ""}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (didDragRef.current) {
                          didDragRef.current = false;
                          return;
                        }
                        toggleRowSelection(row.id);
                      }}
                      onMouseDown={(event) => {
                        if (event.button !== 0) return;
                        event.preventDefault();
                        event.stopPropagation();
                        startRowSelection(rowIndex);
                        gridContainerRef.current?.focus();
                      }}
                      onMouseEnter={() => extendRowSelection(rowIndex)}
                    >
                      {rowIndex + 1}
                    </td>
                    {columns.map((col, colIndex) => {
                      const isActive =
                        activeCell?.row === rowIndex &&
                        activeCell.col === colIndex;
                      const isNumber = col.type === "number";
                      const selected = isCellSelected(row, col);
                      return (
                        <td
                          key={col.key}
                          className={`${isActive ? "active-cell" : ""} ${selected ? "selected-cell" : ""}`}
                          style={{
                            width: col.width ? `${col.width}px` : undefined,
                          }}
                          onClick={() => {
                            if (didDragRef.current) {
                              didDragRef.current = false;
                              return;
                            }
                            setActiveCell({ row: rowIndex, col: colIndex });
                            onRowClick?.(row, rowIndex);
                          }}
                          onMouseDown={(event) => {
                            if (event.button !== 0) return;
                            event.preventDefault();
                            setActiveCell({ row: rowIndex, col: colIndex });
                            startCellSelection(rowIndex, colIndex);
                            gridContainerRef.current?.focus();
                          }}
                          onMouseEnter={() => extendCellSelection(rowIndex, colIndex)}
                        >
                          <div
                            className={`excel-cell-display ${isNumber ? "cell-right" : "cell-left"}`}
                          >
                            {renderCell?.(row, col, rowIndex) ?? formatDisplayValue(row[col.key], col)}
                            {editable && col.type === "autocomplete" && (
                              <span className='excel-cell-dropdown-arrow'>
                                v
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                    {renderRowActions && (
                      <td className='excel-action-cell'>
                        {renderRowActions(row, rowIndex)}
                      </td>
                    )}
                  </tr>
                );
              })}
              {!paginatedRows.length && (
                <tr>
                  <td className='excel-row-header'>0</td>
                  <td colSpan={columns.length + (renderRowActions ? 1 : 0)}>
                    <div className='excel-cell-display'>
                      No records to display
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ScrollArea>

      {hasSelection && (
        <div className='excel-status-bar'>
          <div className='excel-status-group'>
            <span className='excel-status-item'>Count: {selectionStats.count}</span>
            <span className='excel-status-divider'>|</span>
            <span className='excel-status-item'>
              Sum: {selectionStats.numericCount > 0 ? formatStatNumber(selectionStats.sum) : "-"}
            </span>
            <span className='excel-status-divider'>|</span>
            <span className='excel-status-item'>
              Average: {selectionStats.numericCount > 0 ? formatStatNumber(selectionStats.average) : "-"}
            </span>
          </div>
        </div>
      )}

      <div className='excel-pagination-bar'>
        <div className='excel-pagination-info'>
          <span>
            Showing {rows.length === 0 ? 0 : startIndex + 1} to{" "}
            {Math.min(startIndex + pageSize, rows.length)} of {rows.length}{" "}
            records
          </span>
          <label className='excel-pagination-limit'>
            Rows per page:
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.currentTarget.value));
                setCurrentPage(1);
              }}
              className='excel-pagination-limit-select'
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </label>
        </div>
        <div className='excel-pagination-buttons'>
          <button
            className='excel-pagination-btn'
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(1)}
          >
            First
          </button>
          <button
            className='excel-pagination-btn'
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Prev
          </button>
          <button className='excel-pagination-btn active'>{currentPage}</button>
          <button
            className='excel-pagination-btn'
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
          <button
            className='excel-pagination-btn'
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
