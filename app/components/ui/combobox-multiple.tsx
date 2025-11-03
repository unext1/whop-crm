import { Check, ChevronsUpDown, X } from 'lucide-react';
import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { ScrollArea } from '~/components/ui/scroll-area';

export interface ComboboxMultipleOption {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  [key: string]: unknown;
}

interface ComboboxMultipleProps {
  options: ComboboxMultipleOption[];
  selectedIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
}

export function ComboboxMultiple({
  options,
  selectedIds,
  onSelectionChange,
  placeholder = 'Select items...',
  searchPlaceholder = 'Search...',
  emptyText = 'No items found.',
  className,
  disabled = false,
}: ComboboxMultipleProps) {
  const [open, setOpen] = React.useState(false);

  const toggleSelection = (value: string) => {
    const newSelection = selectedIds.includes(value) ? selectedIds.filter((v) => v !== value) : [...selectedIds, value];
    onSelectionChange(newSelection);
  };

  const removeSelection = (value: string) => {
    onSelectionChange(selectedIds.filter((v) => v !== value));
  };

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full p-1 relative"
            disabled={disabled}
          >
            <div className="flex flex-wrap w-full justify-start gap-1 pe-2.5">
              {selectedIds.length > 0 ? (
                selectedIds.map((val) => {
                  const option = options.find((o) => o.id === val);
                  return option ? (
                    <Badge key={val} variant="outline" className="gap-1.5">
                      {option.avatar && (
                        <Avatar className="size-4">
                          <AvatarImage src={option.avatar} alt={option.name} />
                          <AvatarFallback className="text-xs">{option.name[0]}</AvatarFallback>
                        </Avatar>
                      )}
                      <span className="font-medium">{option.name}</span>
                      <Badge
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSelection(val);
                        }}
                        className="cursor-pointer"
                      >
                        <X className="h-3 w-3" />
                      </Badge>
                    </Badge>
                  ) : null;
                })
              ) : (
                <span className="px-2.5">{placeholder}</span>
              )}
            </div>
            <ChevronsUpDown className="absolute top-2 end-3 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <ScrollArea className="max-h-[300px] [&>div]:block!">
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem key={option.id} value={option.name} onSelect={() => toggleSelection(option.id)}>
                      <span className="flex items-center gap-2 flex-1">
                        {option.avatar && (
                          <Avatar className="size-7">
                            <AvatarImage src={option.avatar} alt={option.name} />
                            <AvatarFallback>{option.name[0]}</AvatarFallback>
                          </Avatar>
                        )}
                        <span className="flex flex-col">
                          <span className="font-medium">{option.name}</span>
                          {option.email && <span className="text-muted-foreground text-sm">{option.email}</span>}
                        </span>
                      </span>
                      {selectedIds.includes(option.id) && <Check className="h-4 w-4" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </ScrollArea>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
