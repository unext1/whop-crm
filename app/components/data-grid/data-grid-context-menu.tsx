import type { Table, TableMeta } from '@tanstack/react-table';
import { CopyIcon, EraserIcon, Trash2Icon } from 'lucide-react';
import * as React from 'react';
import { useFetcher } from 'react-router';
import type { UpdateCell } from '~/components/data-grid/types/data-types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { parseCellKey } from '~/utils/data-grid';
import { useToast } from '../ui/use-toast';

interface DataGridContextMenuProps<TData> {
  table: Table<TData>;
}

export function DataGridContextMenu<TData>({ table }: DataGridContextMenuProps<TData>) {
  const meta = table.options.meta;
  const contextMenu = meta?.contextMenu;
  const onContextMenuOpenChange = meta?.onContextMenuOpenChange;
  const selectionState = meta?.selectionState;
  const dataGridRef = meta?.dataGridRef;
  const onDataUpdate = meta?.onDataUpdate;
  const onRowsDelete = meta?.onRowsDelete;

  if (!contextMenu) return null;

  return (
    <ContextMenu
      table={table}
      dataGridRef={dataGridRef}
      contextMenu={contextMenu}
      onContextMenuOpenChange={onContextMenuOpenChange}
      selectionState={selectionState}
      onDataUpdate={onDataUpdate}
      onRowsDelete={onRowsDelete}
    />
  );
}

interface ContextMenuProps<TData>
  extends Pick<
      TableMeta<TData>,
      'dataGridRef' | 'onContextMenuOpenChange' | 'selectionState' | 'onDataUpdate' | 'onRowsDelete'
    >,
    Required<Pick<TableMeta<TData>, 'contextMenu'>> {
  table: Table<TData>;
}

const ContextMenu = React.memo(ContextMenuImpl, (prev, next) => {
  if (prev.contextMenu.open !== next.contextMenu.open) return false;
  if (!next.contextMenu.open) return true;
  if (prev.contextMenu.x !== next.contextMenu.x) return false;
  if (prev.contextMenu.y !== next.contextMenu.y) return false;

  const prevSize = prev.selectionState?.selectedCells?.size ?? 0;
  const nextSize = next.selectionState?.selectedCells?.size ?? 0;
  if (prevSize !== nextSize) return false;

  return true;
}) as typeof ContextMenuImpl;

function ContextMenuImpl<TData>({
  table,
  dataGridRef,
  contextMenu,
  onContextMenuOpenChange,
  selectionState,
  onDataUpdate,
  onRowsDelete,
}: ContextMenuProps<TData>) {
  const deleteFetcher = useFetcher();
  const { toast } = useToast();

  const triggerStyle = React.useMemo<React.CSSProperties>(
    () => ({
      position: 'fixed',
      left: `${contextMenu.x}px`,
      top: `${contextMenu.y}px`,
      width: '1px',
      height: '1px',
      padding: 0,
      margin: 0,
      border: 'none',
      background: 'transparent',
      pointerEvents: 'none',
      opacity: 0,
    }),
    [contextMenu.x, contextMenu.y],
  );

  const onCloseAutoFocus: NonNullable<React.ComponentProps<typeof DropdownMenuContent>['onCloseAutoFocus']> =
    React.useCallback(
      (event) => {
        event.preventDefault();
        dataGridRef?.current?.focus();
      },
      [dataGridRef],
    );

  const onCopy = React.useCallback(() => {
    if (!selectionState?.selectedCells || selectionState.selectedCells.size === 0) return;

    const rows = table.getRowModel().rows;
    const columnIds: string[] = [];

    const selectedCellsArray = Array.from(selectionState.selectedCells);
    for (const cellKey of selectedCellsArray) {
      const { columnId } = parseCellKey(cellKey);
      if (columnId && !columnIds.includes(columnId)) {
        columnIds.push(columnId);
      }
    }

    const cellData = new Map<string, string>();
    for (const cellKey of selectedCellsArray) {
      const { rowIndex, columnId } = parseCellKey(cellKey);
      const row = rows[rowIndex];
      if (row) {
        const cell = row.getVisibleCells().find((c) => c.column.id === columnId);
        if (cell) {
          const value = cell.getValue();
          cellData.set(cellKey, String(value ?? ''));
        }
      }
    }

    const rowIndices = new Set<number>();
    const colIndices = new Set<number>();

    for (const cellKey of selectedCellsArray) {
      const { rowIndex, columnId } = parseCellKey(cellKey);
      rowIndices.add(rowIndex);
      const colIndex = columnIds.indexOf(columnId);
      if (colIndex >= 0) {
        colIndices.add(colIndex);
      }
    }

    const sortedRowIndices = Array.from(rowIndices).sort((a, b) => a - b);
    const sortedColIndices = Array.from(colIndices).sort((a, b) => a - b);
    const sortedColumnIds = sortedColIndices.map((i) => columnIds[i]);

    const tsvData = sortedRowIndices
      .map((rowIndex) =>
        sortedColumnIds
          .map((columnId) => {
            const cellKey = `${rowIndex}:${columnId}`;
            return cellData.get(cellKey) ?? '';
          })
          .join('\t'),
      )
      .join('\n');

    navigator.clipboard.writeText(tsvData);
    toast({
      title: `${selectionState.selectedCells.size} cell${selectionState.selectedCells.size !== 1 ? 's' : ''} copied`,
      description: 'The selected cells have been copied to the clipboard',
    });
  }, [table, selectionState, toast]);

  const onClear = React.useCallback(() => {
    if (!selectionState?.selectedCells || selectionState.selectedCells.size === 0) return;

    const updates: Array<UpdateCell> = [];

    for (const cellKey of selectionState.selectedCells) {
      const { rowIndex, columnId } = parseCellKey(cellKey);
      updates.push({ rowIndex, columnId, value: '' });
    }

    onDataUpdate?.(updates);

    toast({
      title: `${updates.length} cell${updates.length !== 1 ? 's' : ''} cleared`,
      description: 'The selected cells have been cleared',
    });
  }, [onDataUpdate, selectionState, toast]);

  const onDelete = React.useCallback(async () => {
    if (!selectionState?.selectedCells || selectionState.selectedCells.size === 0) return;

    const rowIndices = new Set<number>();
    for (const cellKey of selectionState.selectedCells) {
      const { rowIndex } = parseCellKey(cellKey);
      rowIndices.add(rowIndex);
    }

    const rowIndicesArray = Array.from(rowIndices).sort((a, b) => a - b);
    const rows = table.getRowModel().rows;
    const rowsToDelete = rowIndicesArray.map((index) => rows[index]?.original).filter(Boolean) as TData[];

    if (rowsToDelete.length === 0) return;

    // Extract IDs from rows (assuming rows have an 'id' property)
    const rowIds = rowsToDelete.map((row) => (row as { id?: string }).id).filter((id): id is string => Boolean(id));

    if (rowIds.length === 0) {
      // If no IDs, fall back to callback
      await onRowsDelete?.(rowsToDelete, rowIndicesArray);
      return;
    }

    // Call callback for optimistic updates (it will handle removing from UI immediately)
    // The callback should only do optimistic updates, not submit
    await onRowsDelete?.(rowsToDelete, rowIndicesArray);

    // Submit directly to the current route's action
    const formData = new FormData();
    formData.append('intent', 'deletePeople');
    rowIds.forEach((id) => {
      formData.append('personIds', id);
    });

    deleteFetcher.submit(formData, {
      method: 'post',
    });

    toast({
      title: `${rowsToDelete.length} row${rowsToDelete.length !== 1 ? 's' : ''} deleted`,
      description: 'The selected rows have been deleted',
    });
  }, [onRowsDelete, selectionState, table, deleteFetcher, toast]);

  return (
    <DropdownMenu open={contextMenu.open} onOpenChange={onContextMenuOpenChange}>
      <DropdownMenuTrigger style={triggerStyle} />
      <DropdownMenuContent data-grid-popover="" align="start" className="w-48" onCloseAutoFocus={onCloseAutoFocus}>
        <DropdownMenuItem onSelect={onCopy}>
          <CopyIcon />
          Copy
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onClear}>
          <EraserIcon />
          Clear
        </DropdownMenuItem>
        {onRowsDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2Icon />
              Delete rows
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
