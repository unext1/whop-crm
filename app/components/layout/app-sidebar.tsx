import { Building2Icon, CheckSquareIcon, KanbanIcon, LayoutDashboardIcon, UsersIcon } from 'lucide-react';
import { href, Link, useParams } from 'react-router';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  useSidebar,
} from '~/components/ui/sidebar';
import type { OrganizationType, UserType } from '~/db/schema';
import { NavGroup } from './nav-group';
import { NavUser } from './nav-user';

export function AppSidebar({
  user,
  organization,
  ...props
}: { user: UserType; organization: OrganizationType } & React.ComponentProps<typeof Sidebar>) {
  const params = useParams();

  const navGroups = [
    {
      title: 'Workspace',
      items: [
        {
          title: 'Dashboard',
          url: href('/dashboard/:companyId', { companyId: params.companyId || '' }),
          icon: LayoutDashboardIcon,
        },
        {
          title: 'Tasks',
          url: href('/dashboard/:companyId/tasks', { companyId: params.companyId || '' }),
          icon: CheckSquareIcon,
        },
      ],
    },
    {
      title: 'Records',
      items: [
        {
          title: 'Companies',
          url: href('/dashboard/:companyId/company', { companyId: params.companyId || '' }),
          icon: Building2Icon,
        },
        {
          title: 'People',
          url: href('/dashboard/:companyId/people', { companyId: params.companyId || '' }),
          icon: UsersIcon,
        },
        {
          title: 'Deals',
          url: href('/dashboard/:companyId/projects', { companyId: params.companyId || '' }),
          icon: KanbanIcon,
        },
      ],
    },
  ];

  const { state } = useSidebar();
  return (
    <Sidebar collapsible="icon" variant="sidebar" {...props}>
      <SidebarHeader className="border-b flex items-start justify-center overflow-hidden ">
        <div className="w-full py-1.5">
          <Link
            to={href('/dashboard/:companyId', { companyId: params.companyId as string })}
            className="flex items-center justify-center"
          >
            {state === 'collapsed' ? (
              <div className="text-xs font-bold mt-[4px] text-black">
                <img src="/logo.png" alt="Logo" className="w-5 h-5 rounded" />
              </div>
            ) : (
              <div className="text-base font-bold ml-2 flex items-center gap-2">
                <img src="/logo.png" alt="Logo" className="w-5 h-5 rounded" />

                <span className="truncate whitespace-nowrap max-w-[160px] block overflow-hidden text-ellipsis">
                  {organization.name}
                </span>
              </div>
            )}
          </Link>

          {/* <TeamSwitcher organizations={organizations} selectedOrganization={selectedOrganization} /> */}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {/* <div className="flex flex-wrap items-center gap-4 px-2 mt-2">
          <div className="px-2 w-full border rounded-lg text-xs p-1 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <SearchIcon className="size-3" />
              Search
            </div>
            <div className="flex items-center gap-2">
              <Kbd>⌘</Kbd> <Kbd>K</Kbd>
            </div>
          </div>
        </div> */}
        {navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user.name ?? 'Anonymous',
            email: user.lastName ?? 'Anonymous',
            avatar:
              user.profilePictureUrl ??
              'https://static-00.iconduck.com/assets.00/avatar-default-symbolic-icon-479x512-n8sg74wg.png',
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
