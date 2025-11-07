import { useRef } from 'react';
import { useFetcher } from 'react-router';
import { cn } from '~/utils';
import { Calendar as CalendarComponent } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

interface EditableDateFieldProps {
  value: string | null | undefined;
  fieldName: string;
  intent: string;
  fieldNameParam: string;
  placeholder?: string;
  className?: string;
}

export function EditableDateField({
  value,
  fieldName,
  intent,
  fieldNameParam,
  placeholder = 'Set a date...',
  className,
}: EditableDateFieldProps) {
  const fetcher = useFetcher();
  const displayRef = useRef<HTMLButtonElement>(null);

  // Use optimistic value from formData if available (like EditableField)
  let displayValue = value;
  if (fetcher.formData?.has(fieldName)) {
    displayValue = String(fetcher.formData.get(fieldName));
  }

  const selectedDate = displayValue ? new Date(displayValue + 'T00:00:00') : undefined;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDateForInput = (date: Date | undefined) => {
    if (!date) return '';
    // Use local date to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const showValue = displayValue ? (
    formatDate(new Date(displayValue))
  ) : (
    <span className="text-sm text-muted-foreground">{placeholder}</span>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          ref={displayRef}
          type="button"
          aria-label={`Edit ${fieldNameParam}`}
          className={cn(
            'block w-full text-left text-sm min-h-[28px] py-1 px-0 cursor-text rounded-sm',
            'bg-transparent border-none outline-none',
            displayValue ? 'text-foreground' : 'text-muted-foreground',
            'hover:bg-muted/50 transition-colors',
            className,
          )}
        >
          {showValue}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value={intent} />
          <input type="hidden" name="fieldName" value={fieldNameParam} />
          <CalendarComponent
            mode="single"
            selected={selectedDate}
            onSelect={(date) => {
              if (date) {
                const dateValue = formatDateForInput(date);
                const currentValue = value || '';
                // Only submit if value changed
                if (dateValue !== currentValue) {
                  // Create and submit new FormData
                  const formData = new FormData();
                  formData.append('intent', intent);
                  formData.append('fieldName', fieldNameParam);
                  formData.append(fieldName, dateValue);
                  fetcher.submit(formData, { method: 'post' });
                }
              }
            }}
          />
        </fetcher.Form>
      </PopoverContent>
    </Popover>
  );
}
