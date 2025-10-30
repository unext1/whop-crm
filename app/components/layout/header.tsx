import { Building2 } from 'lucide-react';
import type React from 'react';
import { Separator } from '~/components/ui/separator';
import { SidebarTrigger } from '~/components/ui/sidebar';
import { cn } from '~/utils';

interface HeaderProps extends React.ComponentPropsWithRef<'header'> {
  fixed?: boolean;
}

export const Header = ({ className, fixed, children, ...props }: HeaderProps) => {
  return (
    <header
      className={cn(
        'bg-background flex items-center gap-3 pr-4 py-2 sm:gap-4 rounded-b-lg',
        fixed && 'header-fixed peer/header fixed z-50 w-[inherit]',
        className,
      )}
      {...props}
    >
      <SidebarTrigger variant="outline" />
      <div className="flex items-center">
        <Building2 className="h-4 w-4" />
        <span className="text-sm ml-2">Route name</span>
      </div>
      <Separator orientation="vertical" className="h-6" />
      {children}
    </header>
  );
};

Header.displayName = 'Header';
