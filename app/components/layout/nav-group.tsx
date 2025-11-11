import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Badge } from '~/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '~/components/ui/sidebar';
import type { MenuItem, NavCollapsible, NavGroupProps, NavItem } from './types';

export function NavGroup({ title, items }: NavGroupProps) {
  const { state } = useSidebar();
  const { pathname: href } = useLocation();

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-[12px] text-muted-foreground">{title}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const key = `${item.title}-${item.url}`;

          if (!item.items) return <SidebarMenuLink key={key} item={item} href={href} />;

          if (state === 'collapsed') return <SidebarMenuCollapsedDropdown key={key} item={item} href={href} />;

          return <SidebarMenuCollapsible key={key} item={item} href={href} />;
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

const NavBadge = ({ children }: { children: ReactNode }) => (
  <Badge className="rounded-full px-1 py-0 text-xs">{children}</Badge>
);

const SidebarMenuLink = ({ item, href }: { item: MenuItem; href: string }) => {
  const { setOpenMobile } = useSidebar();
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={checkIsActive(href, item)}
        tooltip={item.title}
        className="data-[active=true]:bg-linear-to-bl data-[active=true]:from-muted data-[active=true]:to-muted/30 data-[active=true]:shadow-s data-[active=true]:border-0 hover:bg-muted text-sm py-0"
      >
        <Link to={item.url} onClick={() => setOpenMobile(false)}>
          {item.icon && <item.icon />}
          <span>{item.title}</span>
          {item.badge && <NavBadge>{item.badge}</NavBadge>}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

const SidebarMenuCollapsible = ({ item, href }: { item: NavCollapsible; href: string }) => {
  const { setOpenMobile } = useSidebar();
  const isActive = checkIsActive(href, item, true);
  return (
    <Collapsible asChild defaultOpen={isActive} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={isActive}
            className="data-[active=true]:bg-linear-to-bl data-[active=true]:from-muted data-[active=true]:to-muted/30 data-[active=true]:shadow-s data-[active=true]:border-0 hover:bg-muted"
          >
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent className="CollapsibleContent">
          <SidebarMenuSub>
            {item.items.map((subItem) => (
              <SidebarMenuSubItem key={subItem.title}>
                <SidebarMenuSubButton
                  asChild
                  isActive={checkIsActive(href, subItem)}
                  className="data-[active=true]:bg-linear-to-bl data-[active=true]:from-muted data-[active=true]:to-muted/30 data-[active=true]:shadow-s data-[active=true]:border-0 hover:bg-muted"
                >
                  <Link to={subItem.url} onClick={() => setOpenMobile(false)}>
                    {subItem.icon && <subItem.icon />}
                    <span>{subItem.title}</span>
                    {subItem.badge && <NavBadge>{subItem.badge}</NavBadge>}
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
};

const SidebarMenuCollapsedDropdown = ({ item, href }: { item: NavCollapsible; href: string }) => {
  const isActive = checkIsActive(href, item, true);
  return (
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={item.title}
            isActive={isActive}
            className="data-[active=true]:bg-linear-to-bl data-[active=true]:from-muted data-[active=true]:to-muted/30 data-[active=true]:shadow-s data-[active=true]:border-0 hover:bg-muted"
          >
            {item.icon && <item.icon />}
            <span>{item.title}</span>
            {item.badge && <NavBadge>{item.badge}</NavBadge>}
            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" sideOffset={4}>
          <DropdownMenuLabel>
            {item.title} {item.badge ? `(${item.badge})` : ''}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {item.items.map((sub) => (
            <DropdownMenuItem key={`${sub.title}-${sub.url}`} asChild>
              <NavLink
                to={sub.url}
                className={`${checkIsActive(href, sub) ? 'bg-linear-to-bl from-muted to-muted/30 shadow-s border-0' : ''} hover:bg-muted`}
              >
                {sub.icon && <sub.icon />}
                <span className="max-w-52 text-wrap">{sub.title}</span>
                {sub.badge && <span className="ml-auto text-xs">{sub.badge}</span>}
              </NavLink>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};
function checkIsActive(href: string, item: NavItem, mainNav = false) {
  const currentPath = href.split('?')[0];

  // Handle collapsible items (with sub-items) - type guard
  const isCollapsible = (navItem: NavItem): navItem is NavCollapsible => {
    return 'items' in navItem && Array.isArray(navItem.items);
  };

  if (isCollapsible(item)) {
    // Check if any sub-item matches
    const subItemMatch = item.items.some((subItem) => {
      if (!subItem.url) return false;
      const subItemPath = subItem.url.split('?')[0];
      return currentPath === subItemPath || currentPath.startsWith(subItemPath + '/');
    });
    if (subItemMatch) return true;

    // For main nav collapsible items, check if we're on a matching route pattern
    // This handles cases like "Deals" highlighting when on /projects/:projectId
    if (mainNav) {
      // Check if we're on a projects route (for "Deals" collapsible)
      // Match patterns like /dashboard/:companyId/projects or /dashboard/:companyId/projects/:projectId
      const projectsMatch = /\/projects(\/|$)/.test(currentPath);
      if (projectsMatch) return true;
    }
  }

  // Handle regular menu items (with url) - type guard
  const isMenuItem = (navItem: NavItem): navItem is MenuItem => {
    return 'url' in navItem && typeof navItem.url === 'string';
  };

  if (isMenuItem(item)) {
    const itemPath = item.url.split('?')[0];

    // Exact match
    if (currentPath === itemPath) return true;

    // Routes that should only match exactly (not their children):
    // - Base dashboard route: /dashboard/:companyId (Overview)
    // - Tasks route: /dashboard/:companyId/tasks
    const isExactOnlyRoute = itemPath.match(/^\/dashboard\/[^/]+$/) || itemPath.endsWith('/tasks');

    // For routes that should match child routes (like /company matching /company/:id)
    // Only apply startsWith if the item path is not an exact-only route
    if (!isExactOnlyRoute && currentPath.startsWith(itemPath + '/')) {
      return true;
    }

    // For main nav items, check if the route segment matches (e.g., /company matches /company/:id)
    if (mainNav && !isExactOnlyRoute) {
      const currentSegments = currentPath.split('/').filter(Boolean);
      const itemSegments = itemPath.split('/').filter(Boolean);

      // Check if all item segments match the beginning of current segments
      if (itemSegments.length > 0 && currentSegments.length >= itemSegments.length) {
        return itemSegments.every((segment, index) => segment === currentSegments[index]);
      }
    }
  }

  return false;
}
