import { forwardRef, useState } from 'react';
import { cn } from '~/utils';
import { Input } from './input';

interface CurrencyInputProps extends Omit<React.ComponentProps<typeof Input>, 'onChange' | 'value'> {
  value?: number;
  onValueChange?: (value: number) => void;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, value, onValueChange, ...props }, ref) => {
    const [displayValue, setDisplayValue] = useState(() => {
      if (value) {
        return value.toLocaleString('en-US');
      }
      return '';
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target.value;

      // Remove all non-numeric characters except decimal point
      const numericValue = input.replace(/[^0-9]/g, '');

      if (numericValue === '') {
        setDisplayValue('');
        onValueChange?.(0);
        return;
      }

      // Convert to number and format with commas
      const numValue = Number.parseInt(numericValue, 10);
      const formatted = numValue.toLocaleString('en-US');

      setDisplayValue(formatted);
      onValueChange?.(numValue);
    };

    const handleBlur = () => {
      if (displayValue === '' || displayValue === '0') {
        setDisplayValue('');
        onValueChange?.(0);
      }
    };

    return (
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">$</div>
        <Input
          {...props}
          ref={ref}
          className={cn('pl-6', className)}
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="0"
        />
      </div>
    );
  },
);

CurrencyInput.displayName = 'CurrencyInput';
