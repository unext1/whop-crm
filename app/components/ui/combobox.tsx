import { Check, ChevronsUpDown, PlusCircle } from 'lucide-react';
import { forwardRef, useId, useMemo, useState, type ReactNode } from 'react';
import { Form, type FormProps } from 'react-router';

import { Button } from '~/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '~/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { cn } from '~/utils';

type ComboboxItem<T> = T & {
  value: string;
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
};
type GroupedCombobox<T> = {
  items?: never;
  groupedItems: { title?: string; items: ComboboxItem<T>[] }[];
};
type NotGroupedCombobox<T> = {
  items: ComboboxItem<T>[];
  groupedItems?: never;
};
type MainComboboxProps<T> = {
  name?: string;
  selectedItem?: ComboboxItem<T> | undefined;
  buttonTrigger?: (item: ComboboxItem<T> | undefined, open: boolean) => ReactNode;
  children?: (setClose: () => void) => ReactNode;
  labels?: {
    buttonLabel?: string;
    inputLabel?: string;
    notFoundLabel?: string;
  };
};
type ComboboxProps<T> = MainComboboxProps<T> & (GroupedCombobox<T> | NotGroupedCombobox<T>);

export const Combobox = <T,>({
  name,
  buttonTrigger,
  items,
  groupedItems,
  selectedItem,
  children,
  labels,
}: ComboboxProps<T>) => {
  const id = useId();
  const [opened, setOpened] = useState(false);
  const [selected, setSelected] = useState<ComboboxItem<T> | undefined>(selectedItem);

  const [allItems, flatItems] = useMemo(() => {
    const allItems = (groupedItems ? groupedItems : [{ title: '', items: items ?? [] }]).filter(
      (i) => i.items.length > 0,
    );
    const flatItems = allItems.map((group) => group.items).flat();
    return [allItems, flatItems];
  }, [groupedItems, items]);

  return (
    <Popover open={opened} onOpenChange={setOpened}>
      {name ? <input name={name} type="hidden" value={selected?.value || ''} /> : null}
      <PopoverTrigger asChild>
        {buttonTrigger ? (
          buttonTrigger(selected, opened)
        ) : (
          <TriggerButton
            id={id}
            isOpen={opened}
            text={
              labels?.buttonLabel
                ? selected?.label
                  ? selected.label
                  : labels.buttonLabel
                : (selected?.label ?? 'Select item...')
            }
          />
        )}
      </PopoverTrigger>
      <PopoverContent id={id} className="p-0 w-full" align="start">
        <Command
          filter={(value, search) => {
            if (value === 'create') return 1;
            const label = flatItems.find((i) => i.value === value)?.label.toLocaleLowerCase();
            return label?.includes(search.toLocaleLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={labels?.inputLabel ? labels.inputLabel : 'Search item...'} />
          <CommandEmpty>{labels?.notFoundLabel ? labels.notFoundLabel : 'No item found.'}</CommandEmpty>

          <CommandList>
            {allItems.map((group, index) => (
              <CommandGroup key={`${group.title || ''}-${index}`} heading={group.title}>
                {group.items.map(({ label, value, icon, onSelect }) => {
                  const isSelected = selected?.value === value;

                  return (
                    <CommandItem
                      key={value}
                      value={value}
                      onSelect={(currentValue) => {
                        setSelected(group.items.find((item) => item.value === currentValue));
                        setOpened(false);
                        onSelect && selected?.value !== value && onSelect();
                      }}
                      disabled={isSelected}
                    >
                      {icon && !isSelected ? (
                        icon
                      ) : (
                        <Check className={cn('mr-2 h-4 w-4 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                      )}
                      <span className="truncate">{label}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>

          {children ? children(() => setOpened(false)) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
};

const TriggerButton = forwardRef<HTMLButtonElement, { id: string; text: string; isOpen: boolean }>(
  ({ id, text, isOpen, ...props }, ref) => (
    <button
      ref={ref}
      {...props}
      role="combobox"
      aria-controls={id}
      aria-expanded={isOpen}
      className={cn(
        'flex w-full rounded-md border bg-input px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-70',
      )}
    >
      <div className="inline-flex items-center justify-between w-full">
        <span className="truncate">{text}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </div>
    </button>
  ),
);
TriggerButton.displayName = 'TriggerButton';

type ComboboxWithDialogProps<T> = {
  combobox: ComboboxProps<T>;
  dialog: {
    title: string;
    description?: string;
  };
  form: FormProps;
  children: ReactNode;
};
export const ComboboxWithAction = <T,>({ combobox, dialog, form, children }: ComboboxWithDialogProps<T>) => {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog} modal>
      <Combobox {...combobox}>
        {(setClose) => (
          <>
            <CommandSeparator />
            <CommandList>
              <CommandGroup>
                <DialogTrigger asChild>
                  <CommandItem
                    onSelect={() => {
                      setClose();
                      setShowDialog(true);
                    }}
                  >
                    <PlusCircle className="mr-2 h-5 w-5" />
                    {dialog.title}
                  </CommandItem>
                </DialogTrigger>
              </CommandGroup>
            </CommandList>
          </>
        )}
      </Combobox>
      <DialogContent>
        <Form {...form}>
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>{dialog.title}</DialogTitle>
              {dialog.description ? <DialogDescription>{dialog.description}</DialogDescription> : null}
            </DialogHeader>

            <div className="space-y-2">{children}</div>

            <DialogFooter>
              <Button type="button" className="btn-outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="btn-neutral">
                Continue
              </Button>
            </DialogFooter>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

type DialogFormProps = {
  dialog: {
    title: string;
    description?: string;
  };
  form: FormProps;
  children: ReactNode;
};
export const DialogForm = ({ dialog, form, children }: DialogFormProps) => {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog} modal>
      <DialogTrigger asChild>
        <button type="button">me</button>
      </DialogTrigger>
      <DialogContent>
        <Form {...form}>
          <div className="space-y-4">
            <DialogHeader>
              <DialogTitle>{dialog.title}</DialogTitle>
              {dialog.description ? <DialogDescription>{dialog.description}</DialogDescription> : null}
            </DialogHeader>

            <div className="space-y-2">{children}</div>

            <DialogFooter>
              <Button type="button" className="btn-outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" className="btn-neutral">
                Continue
              </Button>
            </DialogFooter>
          </div>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
