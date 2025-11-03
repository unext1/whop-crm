import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useFetcher } from 'react-router';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '~/utils';

interface EditableSelectFieldProps {
  value: string | null | undefined;
  fieldName: string;
  intent: string;
  fieldNameParam: string;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
  className?: string;
}

export function EditableSelectField({
  value,
  fieldName,
  intent,
  fieldNameParam,
  placeholder = 'Set a value...',
  options,
  className,
}: EditableSelectFieldProps) {
  const fetcher = useFetcher();
  const [isEditing, setIsEditing] = useState(false);
  const displayRef = useRef<HTMLButtonElement>(null);

  // Use optimistic value from formData if available (like EditableField)
  let displayValue = value;
  if (fetcher.formData?.has(fieldName)) {
    displayValue = String(fetcher.formData.get(fieldName));
  }

  const selectedValue = displayValue || '';

  const showValue = displayValue ? (
    options.find((opt) => opt.value === displayValue)?.label || displayValue
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
            setIsEditing(false);
          });
          displayRef.current?.focus();
        }}
      >
        <input type="hidden" name="intent" value={intent} />
        <input type="hidden" name="fieldName" value={fieldNameParam} />
        <input type="hidden" name={fieldName} value={selectedValue} />
        <Select
          value={selectedValue}
          onValueChange={(val) => {
            const currentValue = value || '';

            // Only submit if value changed
            if (val !== currentValue) {
              // Create and submit new FormData
              const formData = new FormData();
              formData.append('intent', intent);
              formData.append('fieldName', fieldNameParam);
              formData.append(fieldName, val);
              fetcher.submit(formData, { method: 'post' });
            }
            flushSync(() => {
              setIsEditing(false);
            });
          }}
        >
          <SelectTrigger className="h-7 text-sm border-none shadow-none px-0">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </fetcher.Form>
    );
  }

  return (
    <button
      ref={displayRef}
      type="button"
      aria-label={`Edit ${fieldNameParam}`}
      className={cn(
        'block w-full text-left text-sm min-h-[28px] py-1 px-0 cursor-text rounded-sm',
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
