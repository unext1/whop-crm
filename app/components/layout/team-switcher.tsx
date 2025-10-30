import { DashboardIcon } from '@radix-ui/react-icons';
import { ChevronsUpDown, DoorOpenIcon, LogInIcon, Plus } from 'lucide-react';
import { href, Link, useParams } from 'react-router';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '~/components/ui/sidebar';
import type { OrganizationType } from '~/db/schema';

export function TeamSwitcher({
  organizations,
  selectedOrganization,
}: {
  organizations: OrganizationType[];
  selectedOrganization: string;
}) {
  const { isMobile } = useSidebar();
  const params = useParams();
  const companyInfo = organizations.find((org) => org.id === params.companyId);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {companyInfo ? (
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <LogInIcon />

                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{companyInfo.name}</span>
                  <span className="truncate text-xs">{companyInfo.ownerId}</span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                <DoorOpenIcon />

                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold text-muted-foreground">Select a Company</span>
                </div>
                <ChevronsUpDown className="ml-auto" />
              </SidebarMenuButton>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            align="start"
            side={isMobile ? 'bottom' : 'right'}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">Organizations</DropdownMenuLabel>
            {organizations.map((org, index) => (
              <DropdownMenuItem key={org.name} className="gap-2 p-2" asChild>
                <Link to={href('/dashboard/:companyId', { companyId: org.id })} className="flex gap-2 items-center">
                  <div className="flex size-6 items-center justify-center rounded-sm border">
                    <DashboardIcon />
                  </div>
                  {org.name}
                  <DropdownMenuShortcut>⌘{index + 1}</DropdownMenuShortcut>
                </Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2" asChild>
              <Link to="/organizations/new">
                <div className="bg-background flex size-6 items-center justify-center rounded-md border">
                  <Plus className="size-4" />
                </div>
                <div className="text-muted-foreground font-medium">Add Company</div>
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
