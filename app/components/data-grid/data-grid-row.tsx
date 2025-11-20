import { flexRender, type Row } from '@tanstack/react-table';
import type { Virtualizer } from '@tanstack/react-virtual';
import * as React from 'react';
import { useComposedRefs } from '~/components/data-table/compose-refs';
import { getRowHeightValue } from '~/utils/data-grid';
import { getCommonPinningStyles } from '~/components/data-table/lib/data-table';
import { cn } from '~/utils';
import type { CellPosition, RowHeightValue } from '~/components/data-grid/types/data-types';

interface DataGridRowProps<TData> extends React.ComponentProps<'div'> {
  row: Row<TData>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualRowIndex: number;
  rowMapRef: React.RefObject<Map<number, HTMLDivElement>>;
  rowHeight: RowHeightValue;
  focusedCell: CellPosition | null;
}

export const DataGridRow = React.memo(DataGridRowImpl, (prev, next) => {
  if (prev.row.id !== next.row.id) {
    return false;
  }

  const prevRowIndex = prev.virtualRowIndex;
  const nextRowIndex = next.virtualRowIndex;

  const prevHasFocus = prev.focusedCell?.rowIndex === prevRowIndex;
  const nextHasFocus = next.focusedCell?.rowIndex === nextRowIndex;

  if (prevHasFocus !== nextHasFocus) {
    return false;
  }

  if (nextHasFocus && prevHasFocus) {
    const prevFocusedCol = prev.focusedCell?.columnId;
    const nextFocusedCol = next.focusedCell?.columnId;
    if (prevFocusedCol !== nextFocusedCol) {
      return false;
    }
  }

  if (next.rowVirtualizer.isScrolling) {
    return true;
  }

  return false;
}) as typeof DataGridRowImpl;

function DataGridRowImpl<TData>({
  row,
  virtualRowIndex,
  rowVirtualizer,
  rowMapRef,
  rowHeight,
  focusedCell,
  ref,
  className,
  ...props
}: DataGridRowProps<TData>) {
  const onRowChange = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (typeof virtualRowIndex === 'undefined') return;

      if (node) {
        rowVirtualizer.measureElement(node);
        rowMapRef.current?.set(virtualRowIndex, node);
        // Set position immediately using virtualizer's current state
        const virtualItem = rowVirtualizer.getVirtualItems().find((item) => item.index === virtualRowIndex);
        if (virtualItem) {
          node.style.transform = `translateY(${virtualItem.start}px)`;
          node.style.top = '0';
        }
      } else {
        rowMapRef.current?.delete(virtualRowIndex);
      }
    },
    [virtualRowIndex, rowVirtualizer, rowMapRef],
  );

  const rowRef = useComposedRefs(ref, onRowChange);
  const isRowSelected = row.getIsSelected();

  // Update position when virtualizer items change
  React.useLayoutEffect(() => {
    const virtualItem = rowVirtualizer.getVirtualItems().find((item) => item.index === virtualRowIndex);
    const node = rowMapRef.current?.get(virtualRowIndex);
    if (virtualItem && node) {
      node.style.transform = `translateY(${virtualItem.start}px)`;
      node.style.top = '0';
    }
  }, [virtualRowIndex, rowVirtualizer, rowMapRef]);

  return (
    /* biome-ignore lint/a11y/useSemanticElements: Custom grid widget requires div with ARIA roles for virtualization */
    <div
      key={row.id}
      role="row"
      aria-rowindex={virtualRowIndex + 2}
      aria-selected={isRowSelected}
      data-index={virtualRowIndex}
      data-slot="grid-row"
      ref={rowRef}
      tabIndex={-1}
      className={cn('absolute flex w-full border-b', className)}
      style={{
        height: `${getRowHeightValue(rowHeight)}px`,
        top: 0, // Ensure top is 0 so transform works correctly
      }}
      {...props}
    >
      {row.getVisibleCells().map((cell, colIndex) => {
        const isCellFocused = focusedCell?.rowIndex === virtualRowIndex && focusedCell?.columnId === cell.column.id;
        const isPinned = cell.column.getIsPinned() !== false;

        return (
          /* biome-ignore lint/a11y/useSemanticElements: Custom grid widget requires div with ARIA roles for virtualization */
          <div
            key={cell.id}
            role="gridcell"
            aria-colindex={colIndex + 1}
            data-highlighted={isCellFocused ? '' : undefined}
            data-slot="grid-cell"
            tabIndex={-1}
            className={cn({
              'border-r': cell.column.id !== 'select',
              'bg-background': cell.column.id === 'select' || isPinned,
            })}
            style={{
              ...getCommonPinningStyles({ column: cell.column }),
              width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
            }}
          >
            {typeof cell.column.columnDef.header === 'function' ? (
              <div
                className={cn('size-full px-3 py-1.5', {
                  'bg-primary/10': isRowSelected,
                })}
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            ) : (
              flexRender(cell.column.columnDef.cell, cell.getContext())
            )}
          </div>
        );
      })}
    </div>
  );
}
