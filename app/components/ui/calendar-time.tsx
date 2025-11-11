import { CalendarIcon } from '@radix-ui/react-icons';
import { format } from 'date-fns';
import * as React from 'react';

import { Button } from '~/components/ui/button';
import { Calendar } from '~/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '~/components/ui/popover';
import { ScrollArea, ScrollBar } from '~/components/ui/scroll-area';
import { cn } from '~/utils';

interface DateTimePicker24hProps {
  name?: string;
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

export function DateTimePicker24h({
  name,
  value,
  onChange,
  placeholder = 'MM/DD/YYYY hh:mm',
  className,
}: DateTimePicker24hProps) {
  const [date, setDate] = React.useState<Date | undefined>(value);
  const [isOpen, setIsOpen] = React.useState(false);

  // Sync internal state with external value
  React.useEffect(() => {
    setDate(value);
  }, [value]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      const newDate = date ? new Date(date) : new Date(selectedDate);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setDate(newDate);
      onChange?.(newDate);
    }
  };

  const handleTimeChange = (type: 'hour' | 'minute', value: string) => {
    const currentDate = date || new Date();
    const newDate = new Date(currentDate);
    if (type === 'hour') {
      newDate.setHours(Number.parseInt(value));
    } else if (type === 'minute') {
      newDate.setMinutes(Number.parseInt(value));
    }
    setDate(newDate);
    onChange?.(newDate);
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={date ? date.toISOString() : ''} />}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground', className)}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, 'MM/dd/yyyy hh:mm') : <span>{placeholder}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <div className="sm:flex">
            <Calendar mode="single" selected={date} onSelect={handleDateSelect} initialFocus />
            <div className="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x">
              <ScrollArea className="w-64 sm:w-auto">
                <div className="flex sm:flex-col p-2">
                  {hours.reverse().map((hour) => (
                    <Button
                      key={hour}
                      size="icon"
                      variant={date && date.getHours() === hour ? 'default' : 'ghost'}
                      className="sm:w-full shrink-0 aspect-square"
                      onClick={() => handleTimeChange('hour', hour.toString())}
                    >
                      {hour}
                    </Button>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" className="sm:hidden" />
              </ScrollArea>
              <ScrollArea className="w-64 sm:w-auto">
                <div className="flex sm:flex-col p-2">
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                    <Button
                      key={minute}
                      size="icon"
                      variant={date && date.getMinutes() === minute ? 'default' : 'ghost'}
                      className="sm:w-full shrink-0 aspect-square"
                      onClick={() => handleTimeChange('minute', minute.toString())}
                    >
                      {minute.toString().padStart(2, '0')}
                    </Button>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" className="sm:hidden" />
              </ScrollArea>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}
