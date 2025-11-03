import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useFetcher } from 'react-router';
import { cn } from '~/utils';
import { Input } from './ui/input';

interface EditableFieldProps {
  value: string | null | undefined;
  fieldName: string;
  intent: string;
  fieldNameParam: string;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
}

export function EditableField({
  value,
  fieldName,
  intent,
  fieldNameParam,
  placeholder = 'Set a value...',
  className,
  inputClassName,
}: EditableFieldProps) {
  const fetcher = useFetcher();
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const displayRef = useRef<HTMLButtonElement>(null);

  let displayValue = value;
  if (fetcher.formData?.has(fieldName)) {
    displayValue = String(fetcher.formData.get(fieldName));
  }

  const showValue = displayValue ? (
    <span className="text-sm text-foreground truncate">{displayValue}</span>
  ) : (
    <span className="text-sm text-muted-foreground">{placeholder}</span>
  );

  if (isEditing) {
    return (
      <fetcher.Form
        method="post"
        className="flex-1"
        onSubmit={(event) => {
          event.preventDefault();
          flushSync(() => {
            setIsEditing(false);
            fetcher.submit(event?.currentTarget);
          });
          displayRef.current?.focus();
        }}
      >
        <input type="hidden" name="intent" value={intent} />
        <input type="hidden" name="fieldName" value={fieldNameParam} />
        <Input
          required
          ref={inputRef}
          type="text"
          name={fieldName}
          defaultValue={value || ''}
          className={cn('h-7 text-sm px-0', inputClassName)}
          aria-label={`Edit ${fieldName}`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              flushSync(() => {
                setIsEditing(false);
              });
              displayRef.current?.focus();
            }
          }}
          onBlur={(event) => {
            if (inputRef.current?.value !== value && inputRef.current?.value.trim() !== '') {
              const form = event.currentTarget.form;
              if (form) {
                fetcher.submit(form);
              }
            }
            setIsEditing(false);
          }}
          autoFocus
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
        'block w-full text-left text-sm min-h-[28px] py-1 px-0 cursor-text rounded-sm',
        'bg-transparent border-none outline-none',
        displayValue ? 'text-foreground' : 'text-muted-foreground',
        'hover:bg-muted/50 transition-colors',
        className,
      )}
      onClick={() => {
        flushSync(() => {
          setIsEditing(true);
        });
        inputRef.current?.select();
      }}
    >
      {showValue}
    </button>
  );
}
