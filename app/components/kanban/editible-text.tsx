import { useFetcher } from 'react-router';
import { flushSync } from 'react-dom';
import { forwardRef, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '~/utils';

export const SaveButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>((props, ref) => {
  return <Button ref={ref} tabIndex={0} {...props} variant="default" size="sm" />;
});

export const CancelButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  (props, ref) => {
    return (
      <Button
        ref={ref}
        type="button"
        tabIndex={0}
        {...props}
        variant="destructive"
        size="sm"
        className="bg-red-500 hover:bg-red-600"
      />
    );
  },
);

export function EditableText({
  children,
  fieldName,
  value,
  inputLabel,
  buttonLabel,
  size,
  className,
}: {
  children: React.ReactNode;
  fieldName: string;
  value: string;
  inputLabel: string;
  buttonLabel: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const fetcher = useFetcher();
  const [edit, setEdit] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  if (fetcher.formData?.has(fieldName)) {
    value = String(fetcher.formData.get(fieldName));
  }

  return edit ? (
    <fetcher.Form
      method="post"
      className="w-full"
      onSubmit={(event) => {
        event.preventDefault();
        flushSync(() => {
          setEdit(false);
          fetcher.submit(event?.currentTarget);
        });
        buttonRef.current?.focus();
      }}
    >
      {children}
      <Input
        required
        ref={inputRef}
        type="text"
        className={cn(
          size === 'sm' && 'w-full h-8 text-xs font-semibold',
          size === 'md' && 'w-full h-8 text-xs md:text-xs font-semibold',
          size === 'lg' && 'w-full h-12 text-base md:text-xl font-semibold px-0 md:px-0',
          size === undefined && 'w-full h-8 md:text-xs text-xs font-semibold',
          className,
        )}
        aria-label={inputLabel}
        name={fieldName}
        defaultValue={value}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            flushSync(() => {
              setEdit(false);
            });
            buttonRef.current?.focus();
          }
        }}
        onBlur={(event) => {
          if (inputRef.current?.value !== value && inputRef.current?.value.trim() !== '') {
            fetcher.submit(event.currentTarget);
          }
          setEdit(false);
        }}
      />
    </fetcher.Form>
  ) : (
    <Button
      variant="ghost"
      aria-label={buttonLabel}
      type="button"
      className={cn(
        size === 'sm' && 'text-xs justify-start h-8 w-full px-[13px] font-semibold ',
        size === 'md' && 'text-xs justify-start h-8 w-full px-[13px] font-semibold ',
        size === 'lg' && 'text-base md:text-xl justify-start h-12 w-full px-0 md:px-0 font-semibold ',
        size === undefined && 'text-xs justify-start h-8 w-full px-[13px] font-semibold ',
        'hover:bg-muted',
        className,
      )}
      ref={buttonRef}
      onClick={() => {
        flushSync(() => {
          setEdit(true);
        });
        inputRef.current?.select();
      }}
    >
      {value || <span className="text-primary">Edit</span>}
    </Button>
  );
}
