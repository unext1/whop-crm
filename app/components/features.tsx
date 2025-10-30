import { cn } from '~/utils';

export function TextComponent({
  number,
  title,
  content,
  isOpen,
  loadingWidthPercent
}: Readonly<{
  number: number;
  title: string;
  content: string;
  isOpen: boolean;
  loadingWidthPercent?: number;
}>) {
  return (
    <div className={cn('transform-gpu rounded-lg border transition-all p-4', isOpen ? 'opacity-100' : 'opacity-40')}>
      <div className="flex w-full items-center gap-4">
        <p
          className={cn(
            'inline-flex size-6 text-xs shrink-0 items-center justify-center rounded-md border border-primary'
          )}
        >
          {number}
        </p>
        <h2 className={cn('text-left text-lg font-medium')}>{title}</h2>
      </div>

      <div
        className={cn(
          'w-full transform-gpu overflow-hidden text-left transition-all duration-500 text-muted-foreground mt-4',
          isOpen ? ' max-h-64' : 'max-h-0'
        )}
      >
        <p className="text-sm">{content}</p>
        <div className="w-full mt-2">
          <div className="relative h-1 w-full overflow-hidden rounded-full">
            <div className={cn('absolute left-0 top-0 h-1 bg-muted')} style={{ width: `${loadingWidthPercent}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
