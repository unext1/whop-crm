import { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useFetcher } from 'react-router';
import { Combobox } from './ui/combobox';
import { cn } from '~/utils';
import { Building2, User } from 'lucide-react';

interface EditableSelectFieldProps {
  value: string | null | undefined;
  fieldName: string;
  intent: string;
  fieldNameParam: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  groupedItems?: Array<{
    title?: string;
    items: Array<{ value: string; label: string; icon?: React.ReactNode; onSelect?: () => void }>;
  }>;
  className?: string;
}

export function EditableSelectField({
  value,
  fieldName,
  intent,
  fieldNameParam,
  placeholder = 'Set a value...',
  options,
  groupedItems,
  className,
}: EditableSelectFieldProps) {
  const fetcher = useFetcher();
  const [isEditing, setIsEditing] = useState(true);
  const displayRef = useRef<HTMLButtonElement>(null);

  // Use optimistic value from formData if available (like EditableField)
  let displayValue = value;
  if (fetcher.formData?.has(fieldName)) {
    displayValue = String(fetcher.formData.get(fieldName));
  }

  const selectedValue = displayValue || '';

  // Convert options to grouped items if needed (for attachmentType with companies/people)
  const processedGroupedItems = useMemo(() => {
    if (groupedItems) {
      // Add onSelect handlers to grouped items
      return groupedItems.map((group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          icon: item.icon ?? (null as React.ReactNode),
          onSelect: () => {
            const currentValue = value || '';
            // Only submit if value changed
            if (item.value !== currentValue) {
              const formData = new FormData();
              formData.append('intent', intent);
              formData.append('fieldName', fieldNameParam);
              formData.append(fieldName, item.value);
              fetcher.submit(formData, { method: 'post' });
            }
            flushSync(() => {
              setIsEditing(true);
            });
          },
        })),
      }));
    }

    if (options) {
      // Check if we have company/person options that should be grouped
      const hasCompanies = options.some((opt) => opt.value.startsWith('company:'));
      const hasPeople = options.some((opt) => opt.value.startsWith('person:'));

      if (hasCompanies || hasPeople) {
        const groups: Array<{
          title?: string;
          items: Array<{ value: string; label: string; icon: React.ReactNode; onSelect?: () => void }>;
        }> = [];

        // Add "None" option if present
        const noneOption = options.find((opt) => opt.value === 'none');
        if (noneOption) {
          groups.push({
            items: [
              {
                value: noneOption.value,
                label: noneOption.label,
                icon: null as React.ReactNode,
                onSelect: () => {
                  const currentValue = value || '';
                  if (noneOption.value !== currentValue) {
                    const formData = new FormData();
                    formData.append('intent', intent);
                    formData.append('fieldName', fieldNameParam);
                    formData.append(fieldName, noneOption.value);
                    fetcher.submit(formData, { method: 'post' });
                  }
                  flushSync(() => {
                    setIsEditing(true);
                  });
                },
              },
            ],
          });
        }

        // Add companies group
        if (hasCompanies) {
          groups.push({
            title: 'Companies',
            items: options
              .filter((opt) => opt.value.startsWith('company:'))
              .map((opt) => ({
                value: opt.value,
                label: opt.label,
                icon: <Building2 className="h-4 w-4 text-muted-foreground" />,
                onSelect: () => {
                  const currentValue = value || '';
                  if (opt.value !== currentValue) {
                    const formData = new FormData();
                    formData.append('intent', intent);
                    formData.append('fieldName', fieldNameParam);
                    formData.append(fieldName, opt.value);
                    fetcher.submit(formData, { method: 'post' });
                  }
                  flushSync(() => {
                    setIsEditing(true);
                  });
                },
              })),
          });
        }

        // Add people group
        if (hasPeople) {
          groups.push({
            title: 'People',
            items: options
              .filter((opt) => opt.value.startsWith('person:'))
              .map((opt) => ({
                value: opt.value,
                label: opt.label,
                icon: <User className="h-4 w-4 text-muted-foreground" />,
                onSelect: () => {
                  const currentValue = value || '';
                  if (opt.value !== currentValue) {
                    const formData = new FormData();
                    formData.append('intent', intent);
                    formData.append('fieldName', fieldNameParam);
                    formData.append(fieldName, opt.value);
                    fetcher.submit(formData, { method: 'post' });
                  }
                  flushSync(() => {
                    setIsEditing(true);
                  });
                },
              })),
          });
        }

        return groups;
      }

      // For simple options, convert to grouped items format
      return [
        {
          items: options.map((opt) => ({
            value: opt.value,
            label: opt.label,
            icon: null as React.ReactNode,
            onSelect: () => {
              const currentValue = value || '';
              if (opt.value !== currentValue) {
                const formData = new FormData();
                formData.append('intent', intent);
                formData.append('fieldName', fieldNameParam);
                formData.append(fieldName, opt.value);
                fetcher.submit(formData, { method: 'post' });
              }
              flushSync(() => {
                setIsEditing(true);
              });
            },
          })),
        },
      ];
    }

    return [];
  }, [options, groupedItems, value, intent, fieldNameParam, fieldName, fetcher]);

  // Find selected item
  const selectedItem = useMemo(() => {
    if (!selectedValue) return undefined;

    for (const group of processedGroupedItems) {
      const item = group.items.find((item) => item.value === selectedValue);
      if (item) {
        return {
          value: item.value,
          label: item.label,
          icon: item.icon,
        };
      }
    }

    return undefined;
  }, [selectedValue, processedGroupedItems]);

  const showValue = displayValue ? (
    selectedItem ? (
      <div className="flex items-center gap-2">
        {selectedItem.icon}
        <span>{selectedItem.label}</span>
      </div>
    ) : (
      displayValue
    )
  ) : (
    <span className="text-sm text-muted-foreground">{placeholder}</span>
  );

  if (isEditing) {
    return (
      <fetcher.Form
        method="post"
        className="flex-1"
        onSubmit={() => {
          flushSync(() => {
            setIsEditing(true);
          });
          displayRef.current?.focus();
        }}
      >
        <input type="hidden" name="intent" value={intent} />
        <input type="hidden" name="fieldName" value={fieldNameParam} />
        <input type="hidden" name={fieldName} value={selectedValue} />
        <Combobox
          key={selectedValue}
          groupedItems={processedGroupedItems}
          selectedItem={selectedItem}
          buttonTrigger={(item) => (
            <button
              type="button"
              className={cn(
                'h-7 text-sm border-none shadow-none px-0 text-left w-full flex items-center gap-2',
                'hover:bg-muted/50 rounded-sm transition-colors cursor-pointer',
                !item && 'text-muted-foreground',
              )}
            >
              {item ? (
                <>
                  {item.icon}
                  <span className="text-sm">{item.label}</span>
                </>
              ) : (
                <span className="text-sm">{placeholder}</span>
              )}
            </button>
          )}
          labels={{
            inputLabel: 'Search...',
            notFoundLabel: 'No items found.',
          }}
        />
      </fetcher.Form>
    );
  }

  return (
    <button
      ref={displayRef}
      type="button"
      aria-label={`Edit ${fieldNameParam}`}
      className={cn(
        'block w-full text-left text-sm min-h-[28px] py-1 px-0 cursor-pointer rounded-sm',
        'bg-transparent border-none outline-none',
        displayValue ? 'text-foreground capitalize' : 'text-muted-foreground',
        'hover:bg-muted/50 transition-colors',
        className,
      )}
      onClick={() => {
        flushSync(() => {
          setIsEditing(true);
        });
      }}
    >
      {showValue}
    </button>
  );
}
