import { CalendarIcon, Check, ChevronsUpDown, GripVertical, ListFilter, Trash2 } from 'lucide-react';
import { parseAsStringEnum, useQueryState } from 'nuqs';
import * as React from 'react';

import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Calendar } from '~/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '~/components/ui/command';
import {
  Faceted,
  FacetedBadgeList,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedList,
  FacetedTrigger,
} from '~/components/ui/faceted';
import { Input } from '~/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Sortable, SortableContent, SortableItem, SortableItemHandle, SortableOverlay } from '~/components/ui/sortable';
import { useDebouncedCallback } from '~/hooks/use-debounced-callback';
import { cn } from '~/utils';
import { dataTableConfig } from '../data-table/config/data-table';
import { formatDate } from '../data-table/format';
import { generateId } from '../data-table/id';
import { getDefaultFilterOperator, getFilterOperators } from '../data-table/lib/data-table';
import { getFiltersStateParser } from '../data-table/parsers';
import type { FilterOperator, JoinOperator } from '../data-table/types/data-table';

interface KanbanColumnFilter {
  id: string;
  value: string | string[];
  variant: 'text' | 'number' | 'date' | 'dateRange' | 'boolean' | 'select' | 'multiSelect';
  operator: FilterOperator;
  filterId: string;
}

const DEBOUNCE_MS = 300;
const THROTTLE_MS = 50;
const FILTER_SHORTCUT_KEY = 'f';
const REMOVE_FILTER_SHORTCUTS = ['backspace', 'delete'];

interface KanbanFilterListProps {
  tasks: any[];
  companies: any[];
  people: any[];
  onFilteredTasksChange: (filteredTasks: any[]) => void;
  debounceMs?: number;
  throttleMs?: number;
  shallow?: boolean;
  additionalFields?: Array<{
    id: string;
    label: string;
    variant: 'text' | 'number' | 'date' | 'dateRange' | 'boolean' | 'select' | 'multiSelect';
    placeholder?: string;
    options?: Array<{ value: string; label: string }>;
  }>;
}

export function KanbanFilterList({
  tasks,
  companies,
  people,
  onFilteredTasksChange,
  debounceMs = DEBOUNCE_MS,
  throttleMs = THROTTLE_MS,
  shallow = true,
  additionalFields = [],
}: KanbanFilterListProps) {
  const id = React.useId();
  const labelId = React.useId();
  const descriptionId = React.useId();
  const [open, setOpen] = React.useState(false);
  const addButtonRef = React.useRef<HTMLButtonElement>(null);

  // Define kanban-specific filterable fields
  const filterableFields = React.useMemo(
    () => [
      {
        id: 'name',
        label: 'Task Name',
        variant: 'text' as const,
        placeholder: 'Enter task name...',
      },
      {
        id: 'assignee',
        label: 'Assignee',
        variant: 'multiSelect' as const,
        options: people.map((person) => ({
          value: person.id,
          label: person.name,
        })),
      },
      {
        id: 'creator',
        label: 'Created By',
        variant: 'select' as const,
        options: people.map((person) => ({
          value: person.id,
          label: person.name,
        })),
      },
      {
        id: 'company',
        label: 'Company',
        variant: 'select' as const,
        options: companies.map((company) => ({
          value: company.id,
          label: company.name,
        })),
      },
      {
        id: 'person',
        label: 'Person',
        variant: 'select' as const,
        options: people.map((person) => ({
          value: person.id,
          label: person.name,
        })),
      },
      {
        id: 'amount',
        label: 'Amount',
        variant: 'number' as const,
        placeholder: 'Enter amount...',
      },
      {
        id: 'content',
        label: 'Content',
        variant: 'text' as const,
        placeholder: 'Enter content...',
      },
      {
        id: 'createdAt',
        label: 'Created Date',
        variant: 'date' as const,
      },
      ...additionalFields,
    ],
    [companies, people, additionalFields],
  );

  const [filters, setFilters] = useQueryState(
    'kanban-filters',
    getFiltersStateParser(filterableFields.map((field) => field.id as string))
      .withDefault([])
      .withOptions({
        clearOnDefault: true,
        shallow,
        throttleMs,
      }),
  ) as [
    KanbanColumnFilter[],
    (value: KanbanColumnFilter[] | ((old: KanbanColumnFilter[]) => KanbanColumnFilter[] | null) | null) => void,
  ];
  const debouncedSetFilters = useDebouncedCallback(setFilters, debounceMs);

  const [joinOperator, setJoinOperator] = useQueryState(
    'kanban-join-operator',
    parseAsStringEnum(['and', 'or']).withDefault('and').withOptions({
      clearOnDefault: true,
      shallow,
    }),
  );

  // Apply filters to tasks
  React.useEffect(() => {
    if (filters.length === 0) {
      onFilteredTasksChange(tasks);
      return;
    }

    const filteredTasks = tasks.filter((task) => {
      return filters[joinOperator === 'or' ? 'some' : 'every']((filter) => {
        const field = filterableFields.find((f) => f.id === filter.id);
        if (!field) return true;

        const taskValue = getTaskFieldValue(task, filter.id);

        switch (filter.operator) {
          case 'eq':
            return String(taskValue).toLowerCase() === String(filter.value).toLowerCase();
          case 'ne':
            return String(taskValue).toLowerCase() !== String(filter.value).toLowerCase();
          case 'iLike':
            return String(taskValue).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'notILike':
            return !String(taskValue).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'isEmpty':
            return !taskValue || String(taskValue).trim() === '';
          case 'isNotEmpty':
            return taskValue && String(taskValue).trim() !== '';
          case 'gt':
            return Number(taskValue) > Number(filter.value);
          case 'lt':
            return Number(taskValue) < Number(filter.value);
          case 'gte':
            return Number(taskValue) >= Number(filter.value);
          case 'lte':
            return Number(taskValue) <= Number(filter.value);
          case 'isBetween': {
            if (!Array.isArray(filter.value)) return false;
            const numValue = Number(taskValue);
            return numValue >= Number(filter.value[0]) && numValue <= Number(filter.value[1]);
          }
          case 'inArray':
            if (!Array.isArray(filter.value)) return false;
            return filter.value.includes(String(taskValue));
          case 'notInArray':
            if (!Array.isArray(filter.value)) return false;
            return !filter.value.includes(String(taskValue));
          default:
            return true;
        }
      });
    });

    onFilteredTasksChange(filteredTasks);
  }, [filters, tasks, joinOperator, filterableFields]);

  const onFilterAdd = React.useCallback(() => {
    const field = filterableFields[0];

    if (!field) return;

    debouncedSetFilters([
      ...filters,
      {
        id: field.id as Extract<keyof any, string>,
        value: '',
        variant: field.variant,
        operator: getDefaultFilterOperator(field.variant),
        filterId: generateId({ length: 8 }),
      },
    ]);
  }, [filterableFields, filters, debouncedSetFilters]);

  const onFilterUpdate = React.useCallback(
    (filterId: string, updates: Partial<Omit<KanbanColumnFilter, 'filterId'>>) => {
      debouncedSetFilters((prevFilters) => {
        const updatedFilters = prevFilters.map((filter) => {
          if (filter.filterId === filterId) {
            return { ...filter, ...updates } as KanbanColumnFilter;
          }
          return filter;
        });
        return updatedFilters;
      });
    },
    [debouncedSetFilters],
  );

  const onFilterRemove = React.useCallback(
    (filterId: string) => {
      const updatedFilters = filters.filter((filter) => filter.filterId !== filterId);
      void setFilters(updatedFilters);
      requestAnimationFrame(() => {
        addButtonRef.current?.focus();
      });
    },
    [filters, setFilters],
  );

  const onFiltersReset = React.useCallback(() => {
    void setFilters(null);
    void setJoinOperator('and');
  }, [setFilters, setJoinOperator]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        (event.target instanceof HTMLElement && event.target.contentEditable === 'true')
      ) {
        return;
      }

      if (event.key.toLowerCase() === FILTER_SHORTCUT_KEY && (event.ctrlKey || event.metaKey) && event.shiftKey) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const onTriggerKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (REMOVE_FILTER_SHORTCUTS.includes(event.key.toLowerCase()) && filters.length > 0) {
        event.preventDefault();
        onFilterRemove(filters[filters.length - 1]?.filterId ?? '');
      }
    },
    [filters, onFilterRemove],
  );

  return (
    <Sortable value={filters} onValueChange={setFilters} getItemValue={(item) => item.filterId}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-normal shadow-s shadow-sm border-0"
            onKeyDown={onTriggerKeyDown}
          >
            <ListFilter className="h-3.5 w-3.5 text-muted-foreground" />
            Filter
            {filters.length > 0 && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                {filters.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          aria-describedby={descriptionId}
          aria-labelledby={labelId}
          align="start"
          className="flex w-full max-w-(--radix-popover-content-available-width) flex-col gap-4 p-0 sm:min-w-[420px] bg-muted/30 backdrop-blur-md border-none shadow-lg"
        >
          {/* Header */}
          <div className="flex flex-col gap-1.5 border-b border-border px-4 pt-4 pb-3 bg-muted/40">
            <h4 id={labelId} className="text-sm font-semibold leading-none">
              {filters.length > 0 ? 'Filters' : 'No filters applied'}
            </h4>
            <p id={descriptionId} className={cn('text-xs text-muted-foreground', filters.length > 0 && 'sr-only')}>
              {filters.length > 0 ? 'Modify filters to refine your tasks.' : 'Add filters to refine your tasks.'}
            </p>
          </div>
          {/* Content */}
          <div className="overflow-auto max-h-[400px] px-4">
            {filters.length > 0 ? (
              <SortableContent asChild>
                <ul className="flex flex-col gap-2.5 py-2">
                  {filters.map((filter, index) => (
                    <KanbanFilterItem
                      key={filter.filterId}
                      filter={filter}
                      index={index}
                      filterItemId={`${id}-filter-${filter.filterId}`}
                      joinOperator={joinOperator}
                      setJoinOperator={setJoinOperator}
                      filterableFields={filterableFields}
                      onFilterUpdate={onFilterUpdate}
                      onFilterRemove={onFilterRemove}
                    />
                  ))}
                </ul>
              </SortableContent>
            ) : (
              <div className="py-4 text-center">
                <p className="text-xs text-muted-foreground">No filters applied yet</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex w-full items-center justify-between gap-2 border-t border-border px-4 pb-4 pt-3 bg-muted/40">
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-8 text-xs" ref={addButtonRef} onClick={onFilterAdd}>
                Add filter
              </Button>
              {filters.length > 0 && (
                <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent" onClick={onFiltersReset}>
                  Reset all
                </Button>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <SortableOverlay>
        <div className="flex items-center gap-2">
          <div className="h-8 min-w-[72px] rounded-sm bg-primary/10" />
          <div className="h-8 w-32 rounded-sm bg-primary/10" />
          <div className="h-8 w-32 rounded-sm bg-primary/10" />
          <div className="h-8 min-w-36 flex-1 rounded-sm bg-primary/10" />
          <div className="size-8 shrink-0 rounded-sm bg-primary/10" />
          <div className="size-8 shrink-0 rounded-sm bg-primary/10" />
        </div>
      </SortableOverlay>
    </Sortable>
  );
}

interface KanbanFilterItemProps {
  filter: KanbanColumnFilter;
  index: number;
  filterItemId: string;
  joinOperator: JoinOperator;
  setJoinOperator: (value: JoinOperator) => void;
  filterableFields: any[];
  onFilterUpdate: (filterId: string, updates: Partial<Omit<KanbanColumnFilter, 'filterId'>>) => void;
  onFilterRemove: (filterId: string) => void;
}

function KanbanFilterItem({
  filter,
  index,
  filterItemId,
  joinOperator,
  setJoinOperator,
  filterableFields,
  onFilterUpdate,
  onFilterRemove,
}: KanbanFilterItemProps) {
  const [showFieldSelector, setShowFieldSelector] = React.useState(false);
  const [showOperatorSelector, setShowOperatorSelector] = React.useState(false);
  const [showValueSelector, setShowValueSelector] = React.useState(false);

  const field = filterableFields.find((field) => field.id === filter.id);

  const joinOperatorListboxId = `${filterItemId}-join-operator-listbox`;
  const fieldListboxId = `${filterItemId}-field-listbox`;
  const operatorListboxId = `${filterItemId}-operator-listbox`;
  const inputId = `${filterItemId}-input`;

  const filterOperators = getFilterOperators(filter.variant);

  const onItemKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLLIElement>) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (showFieldSelector || showOperatorSelector || showValueSelector) {
        return;
      }

      if (REMOVE_FILTER_SHORTCUTS.includes(event.key.toLowerCase())) {
        event.preventDefault();
        onFilterRemove(filter.filterId);
      }
    },
    [filter.filterId, showFieldSelector, showOperatorSelector, showValueSelector, onFilterRemove],
  );

  if (!field) return null;

  return (
    <SortableItem value={filter.filterId} asChild>
      <li id={filterItemId} tabIndex={-1} className="flex items-center gap-2.5" onKeyDown={onItemKeyDown}>
        <div className="min-w-[72px] text-center">
          {index === 0 ? (
            <span className="text-muted-foreground text-xs font-medium">Where</span>
          ) : index === 1 ? (
            <Select value={joinOperator} onValueChange={(value: JoinOperator) => setJoinOperator(value)}>
              <SelectTrigger
                aria-label="Select join operator"
                aria-controls={joinOperatorListboxId}
                className="h-8 text-xs rounded lowercase data-size:h-8"
              >
                <SelectValue placeholder={joinOperator} />
              </SelectTrigger>
              <SelectContent
                id={joinOperatorListboxId}
                position="popper"
                className="min-w-(--radix-select-trigger-width) lowercase"
              >
                {dataTableConfig.joinOperators.map((joinOperator) => (
                  <SelectItem key={joinOperator} value={joinOperator}>
                    {joinOperator}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-muted-foreground text-xs font-medium">{joinOperator}</span>
          )}
        </div>
        <Popover open={showFieldSelector} onOpenChange={setShowFieldSelector}>
          <PopoverTrigger asChild>
            <Button
              aria-controls={fieldListboxId}
              variant="outline"
              size="sm"
              className="h-8 w-32 justify-between text-xs rounded font-normal"
            >
              <span className="truncate">{field.label}</span>
              <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            id={fieldListboxId}
            align="start"
            className="w-40 p-0 bg-muted/30 backdrop-blur-md border-none shadow-lg"
          >
            <Command>
              <CommandInput placeholder="Search fields..." />
              <CommandList>
                <CommandEmpty>No fields found.</CommandEmpty>
                <CommandGroup>
                  {filterableFields.map((field) => (
                    <CommandItem
                      key={field.id}
                      value={field.id}
                      onSelect={(value) => {
                        const selectedField = filterableFields.find((f) => f.id === value);
                        onFilterUpdate(filter.filterId, {
                          id: value as Extract<keyof any, string>,
                          variant: selectedField?.variant ?? 'text',
                          operator: getDefaultFilterOperator(selectedField?.variant ?? 'text'),
                          value: '',
                        });

                        setShowFieldSelector(false);
                      }}
                    >
                      <span className="truncate">{field.label}</span>
                      <Check className={cn('ml-auto', field.id === filter.id ? 'opacity-100' : 'opacity-0')} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Select
          open={showOperatorSelector}
          onOpenChange={setShowOperatorSelector}
          value={filter.operator}
          onValueChange={(value: FilterOperator) =>
            onFilterUpdate(filter.filterId, {
              operator: value,
              value: value === 'isEmpty' || value === 'isNotEmpty' ? '' : filter.value,
            })
          }
        >
          <SelectTrigger aria-controls={operatorListboxId} className="h-8 w-32 text-xs rounded lowercase data-size:h-8">
            <div className="truncate">
              <SelectValue placeholder={filter.operator} />
            </div>
          </SelectTrigger>
          <SelectContent id={operatorListboxId}>
            {filterOperators.map((operator) => (
              <SelectItem key={operator.value} value={operator.value} className="lowercase text-xs">
                {operator.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="min-w-36 flex-1">
          {renderFilterInput({
            filter,
            inputId,
            field,
            onFilterUpdate,
            showValueSelector,
            setShowValueSelector,
          })}
        </div>
        <Button
          aria-controls={filterItemId}
          variant="outline"
          size="icon"
          className="size-8 rounded shrink-0"
          onClick={() => onFilterRemove(filter.filterId)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <SortableItemHandle asChild>
          <Button variant="outline" size="icon" className="size-8 rounded shrink-0">
            <GripVertical className="h-3.5 w-3.5" />
          </Button>
        </SortableItemHandle>
      </li>
    </SortableItem>
  );
}

function renderFilterInput({
  filter,
  inputId,
  field,
  onFilterUpdate,
  showValueSelector,
  setShowValueSelector,
}: {
  filter: KanbanColumnFilter;
  inputId: string;
  field: any;
  onFilterUpdate: (filterId: string, updates: Partial<Omit<KanbanColumnFilter, 'filterId'>>) => void;
  showValueSelector: boolean;
  setShowValueSelector: (value: boolean) => void;
}) {
  if (filter.operator === 'isEmpty' || filter.operator === 'isNotEmpty') {
    return (
      <output
        id={inputId}
        aria-label={`${field.label} filter is ${filter.operator === 'isEmpty' ? 'empty' : 'not empty'}`}
        aria-live="polite"
        className="h-8 w-full rounded border bg-transparent dark:bg-input/30"
      />
    );
  }

  switch (filter.variant) {
    case 'text': {
      return (
        <Input
          id={inputId}
          type="text"
          aria-label={`${field.label} filter value`}
          aria-describedby={`${inputId}-description`}
          placeholder={field.placeholder ?? 'Enter a value...'}
          className="h-8 w-full text-xs rounded"
          defaultValue={typeof filter.value === 'string' ? filter.value : undefined}
          onChange={(event) =>
            onFilterUpdate(filter.filterId, {
              value: event.target.value,
            })
          }
        />
      );
    }

    case 'number': {
      if ((filter.variant === 'number' && filter.operator === 'isBetween') || filter.operator === 'isBetween') {
        return (
          <Input
            id={inputId}
            type="number"
            aria-label={`${field.label} filter value`}
            aria-describedby={`${inputId}-description`}
            placeholder={field.placeholder ?? 'Enter a number...'}
            className="h-8 w-full text-xs rounded"
            defaultValue={typeof filter.value === 'string' ? filter.value : undefined}
            onChange={(event) =>
              onFilterUpdate(filter.filterId, {
                value: event.target.value,
              })
            }
          />
        );
      }

      return (
        <Input
          id={inputId}
          type="number"
          aria-label={`${field.label} filter value`}
          aria-describedby={`${inputId}-description`}
          placeholder={field.placeholder ?? 'Enter a number...'}
          className="h-8 w-full text-xs rounded"
          defaultValue={typeof filter.value === 'string' ? filter.value : undefined}
          onChange={(event) =>
            onFilterUpdate(filter.filterId, {
              value: event.target.value,
            })
          }
        />
      );
    }

    case 'select':
    case 'multiSelect': {
      const inputListboxId = `${inputId}-listbox`;

      const multiple = filter.variant === 'multiSelect';
      const selectedValues = multiple
        ? Array.isArray(filter.value)
          ? filter.value
          : []
        : typeof filter.value === 'string'
          ? filter.value
          : undefined;

      return (
        <Faceted
          open={showValueSelector}
          onOpenChange={setShowValueSelector}
          value={selectedValues}
          onValueChange={(value) => {
            onFilterUpdate(filter.filterId, {
              value,
            });
          }}
          multiple={multiple}
        >
          <FacetedTrigger asChild>
            <Button
              id={inputId}
              aria-controls={inputListboxId}
              aria-label={`${field.label} filter value${multiple ? 's' : ''}`}
              variant="outline"
              size="sm"
              className="h-8 w-full text-xs rounded font-normal"
            >
              <FacetedBadgeList
                options={field.options}
                placeholder={field.placeholder ?? `Select option${multiple ? 's' : ''}...`}
              />
            </Button>
          </FacetedTrigger>
          <FacetedContent id={inputListboxId} className="w-[200px]">
            <FacetedInput
              aria-label={`Search ${field.label} options`}
              placeholder={field.placeholder ?? 'Search options...'}
            />
            <FacetedList>
              <FacetedEmpty>No options found.</FacetedEmpty>
              <FacetedGroup>
                {field.options?.map((option: { value: string; label: string }) => (
                  <FacetedItem key={option.value} value={option.value}>
                    <span>{option.label}</span>
                  </FacetedItem>
                ))}
              </FacetedGroup>
            </FacetedList>
          </FacetedContent>
        </Faceted>
      );
    }

    case 'date':
    case 'dateRange': {
      const inputListboxId = `${inputId}-listbox`;

      const dateValue = Array.isArray(filter.value)
        ? filter.value.filter(Boolean)
        : [filter.value, filter.value].filter(Boolean);

      const displayValue =
        filter.operator === 'isBetween' && dateValue.length === 2
          ? `${formatDate(new Date(Number(dateValue[0])))} - ${formatDate(new Date(Number(dateValue[1])))}`
          : dateValue[0]
            ? formatDate(new Date(Number(dateValue[0])))
            : 'Pick a date';

      return (
        <Popover open={showValueSelector} onOpenChange={setShowValueSelector}>
          <PopoverTrigger asChild>
            <Button
              id={inputId}
              aria-controls={inputListboxId}
              aria-label={`${field.label} date filter`}
              variant="outline"
              size="sm"
              className={cn(
                'h-8 w-full text-xs justify-start rounded text-left font-normal',
                !filter.value && 'text-muted-foreground',
              )}
            >
              <CalendarIcon className="h-3.5 w-3.5" />
              <span className="truncate">{displayValue}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent id={inputListboxId} align="start" className="w-auto p-0">
            {filter.operator === 'isBetween' ? (
              <Calendar
                aria-label={`Select ${field.label} date range`}
                autoFocus
                captionLayout="dropdown"
                mode="range"
                selected={
                  dateValue.length === 2
                    ? {
                        from: new Date(Number(dateValue[0])),
                        to: new Date(Number(dateValue[1])),
                      }
                    : {
                        from: new Date(),
                        to: new Date(),
                      }
                }
                onSelect={(date) => {
                  onFilterUpdate(filter.filterId, {
                    value: date ? [(date.from?.getTime() ?? '').toString(), (date.to?.getTime() ?? '').toString()] : [],
                  });
                }}
              />
            ) : (
              <Calendar
                aria-label={`Select ${field.label} date`}
                autoFocus
                captionLayout="dropdown"
                mode="single"
                selected={dateValue[0] ? new Date(Number(dateValue[0])) : undefined}
                onSelect={(date) => {
                  onFilterUpdate(filter.filterId, {
                    value: (date?.getTime() ?? '').toString(),
                  });
                }}
              />
            )}
          </PopoverContent>
        </Popover>
      );
    }

    default:
      return null;
  }
}

// Helper function to get task field value
function getTaskFieldValue(task: any, fieldId: string): any {
  switch (fieldId) {
    case 'name':
      return task.name;
    case 'content':
      return task.content;
    case 'assignee':
      return task.assignees?.map((a: any) => a.user?.id).join(',') || '';
    case 'creator':
      return task.owner?.id || task.ownerId;
    case 'company':
      return task.company?.id || task.companyId;
    case 'person':
      return task.person?.id || task.personId;
    case 'amount':
      return task.amount;
    case 'createdAt':
      return task.createdAt;
    case 'priority':
      return task.priority;
    case 'dueDate':
      return task.dueDate;
    case 'status':
      return task.status;
    default:
      return '';
  }
}
