import type { Table } from '@tanstack/react-table';
import { Check, Settings2 } from 'lucide-react';
import * as React from 'react';
import { Button } from '~/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { cn } from '~/utils';

interface DataTableViewOptionsProps<TData> extends React.ComponentProps<typeof PopoverContent> {
  table: Table<TData>;
}

export function DataTableViewOptions<TData>({ table, ...props }: DataTableViewOptionsProps<TData>) {
  const columns = React.useMemo(
    () => table.getAllColumns().filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide()),
    [table],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label="Toggle columns"
          role="combobox"
          variant="outline"
          size="sm"
          className="ml-auto hidden h-8 font-normal lg:flex shadow-s shadow-sm border-0"
        >
          <Settings2 className="text-muted-foreground" />
          <span className="text-xs">View</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-0 " {...props}>
        <Command className="bg-muted/30 backdrop-blur-md border-none shadow-lg text-xs">
          <CommandInput placeholder="Search columns..." />
          <CommandList>
            <CommandEmpty>No columns found.</CommandEmpty>
            <CommandGroup>
              {columns.map((column) => (
                <CommandItem key={column.id} onSelect={() => column.toggleVisibility(!column.getIsVisible())}>
                  <span className="truncate text-xs">{column.columnDef.meta?.label ?? column.id}</span>
                  <Check
                    className={cn('ml-auto size-3 shrink-0', column.getIsVisible() ? 'opacity-100' : 'opacity-0')}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
