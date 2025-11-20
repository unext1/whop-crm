import { SelectTrigger } from '@radix-ui/react-select';
import type { Table } from '@tanstack/react-table';
import type { LucideIcon } from 'lucide-react';
import {
  DataTableActionBar,
  DataTableActionBarAction,
  DataTableActionBarSelection,
} from '~/components/data-table/data-table-action-bar';
import { Select, SelectContent, SelectGroup, SelectItem } from '~/components/ui/select';
import { Separator } from '~/components/ui/separator';

export interface TableActionConfig<TData> {
  id: string;
  icon: LucideIcon;
  tooltip: string;
  onClick?: (rows: TData[]) => void | Promise<void>;
  isPending?: boolean;
  disabled?: boolean;
}

export interface TableSelectActionConfig<TData, TValue = string> {
  id: string;
  icon: LucideIcon;
  tooltip: string;
  options: Array<{ value: TValue; label: string }>;
  onValueChange: (value: TValue, rows: TData[]) => void | Promise<void>;
  isPending?: boolean;
  disabled?: boolean;
}

interface GenericTableActionBarProps<TData> {
  table: Table<TData>;
  actions?: Array<TableActionConfig<TData>>;
  selectActions?: Array<TableSelectActionConfig<TData>>;
}

export function GenericTableActionBar<TData>({
  table,
  actions = [],
  selectActions = [],
}: GenericTableActionBarProps<TData>) {
  const rows = table.getFilteredSelectedRowModel().rows;
  const selectedRows = rows.map((row) => row.original);

  if (rows.length === 0) return null;

  return (
    <DataTableActionBar table={table} visible={rows.length > 0}>
      <DataTableActionBarSelection table={table} />
      {(actions.length > 0 || selectActions.length > 0) && (
        <>
          <Separator orientation="vertical" className="hidden data-[orientation=vertical]:h-5 sm:block" />
          <div className="flex items-center gap-1.5">
            {selectActions.map((selectAction) => (
              <Select
                key={selectAction.id}
                onValueChange={(value) => {
                  // Select component returns string, but handler expects TValue
                  // Type assertion is necessary here since Select always returns string
                  // but the handler may expect a different type (e.g., enum values)
                  selectAction.onValueChange(
                    value as TableSelectActionConfig<TData, string>['options'][number]['value'],
                    selectedRows,
                  );
                }}
              >
                <SelectTrigger asChild>
                  <DataTableActionBarAction
                    size="icon"
                    tooltip={selectAction.tooltip}
                    isPending={selectAction.isPending}
                    disabled={selectAction.disabled}
                  >
                    <selectAction.icon />
                  </DataTableActionBarAction>
                </SelectTrigger>
                <SelectContent align="center">
                  <SelectGroup>
                    {selectAction.options.map((option) => (
                      <SelectItem key={String(option.value)} value={String(option.value)} className="capitalize">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            ))}
            {actions.map((action) => (
              <DataTableActionBarAction
                key={action.id}
                size="icon"
                tooltip={action.tooltip}
                isPending={action.isPending}
                disabled={action.disabled}
                onClick={() => action.onClick?.(selectedRows)}
              >
                <action.icon />
              </DataTableActionBarAction>
            ))}
          </div>
        </>
      )}
    </DataTableActionBar>
  );
}
