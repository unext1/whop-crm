import { Check, ChevronsUpDown, User, X } from 'lucide-react';
import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { ScrollArea } from '~/components/ui/scroll-area';

export interface ComboboxMultipleOption {
  id: string;
  name: string;
  email?: string;
  profilePictureUrl?: string;
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

  const selectedOptions = selectedIds
    .map((id) => options.find((o) => o.id === id))
    .filter((option): option is NonNullable<typeof option> => option !== undefined);
  const maxVisible = 10;
  const visibleOptions = selectedOptions.slice(0, maxVisible);
  const remainingCount = selectedOptions.length - maxVisible;

  return (
    <div className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between hover:bg-transparent p-1.5 has-[>svg]:px-1 text-xs"
            disabled={disabled}
          >
            <div className="flex gap-1 flex-1 min-w-0 overflow-x-scroll scrollbar-thin">
              {selectedIds.length > 0 ? (
                <>
                  {visibleOptions.map((option) => (
                    <div key={option.id} className="flex items-center gap-1 bg-muted rounded px-2 py-1 text-xs">
                      {option.profilePictureUrl ? (
                        <Avatar className="size-3">
                          <AvatarImage src={option.profilePictureUrl} alt={option.name} />
                          <AvatarFallback className="text-[10px]">{option.name[0]}</AvatarFallback>
                        </Avatar>
                      ) : (
                        <User className="size-3" />
                      )}
                      <span className="truncate max-w-20 text-xs">{option.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeSelection(option.id);
                        }}
                        className="ml-1 hover:bg-muted-foreground/20 rounded p-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                  {remainingCount > 0 && (
                    <div className="bg-muted rounded px-2 py-1 text-xs text-muted-foreground">+{remainingCount}</div>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground text-xs px-2">{placeholder}</span>
              )}
            </div>
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command className="bg-muted/30 backdrop-blur-sm shadow-s">
            <CommandInput placeholder={searchPlaceholder} className="text-xs" />
            <CommandList>
              <ScrollArea className="max-h-[300px] [&>div]:block!">
                <CommandEmpty>{emptyText}</CommandEmpty>
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem key={option.id} value={option.name} onSelect={() => toggleSelection(option.id)}>
                      <span className="flex items-center gap-2 flex-1">
                        {option.profilePictureUrl ? (
                          <Avatar className="size-7">
                            <AvatarImage src={option.profilePictureUrl} alt={option.name} />
                            <AvatarFallback>{option.name[0]}</AvatarFallback>
                          </Avatar>
                        ) : (
                          <User className="size-3" />
                        )}
                        <span className="flex flex-col">
                          <span className="font-medium text-xs">{option.name}</span>
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
