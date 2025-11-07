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
              <div className="text-xs font-bold mt-[5px]">
                <svg
                  fill="#ffffff"
                  height="14px"
                  width="14px"
                  version="1.1"
                  id="Layer_1"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 512 512"
                  xmlnsXlink="http://www.w3.org/1999/xlink"
                >
                  <g id="SVGRepo_bgCarrier" strokeWidth="0" />
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round" />
                  <g id="SVGRepo_iconCarrier">
                    <g>
                      <g>
                        <path d="M133.12,149.049H5.689c-3.141,0-5.689,2.547-5.689,5.689V471.04c0,9.425,7.641,17.067,17.067,17.067H133.12 c3.141,0,5.689-2.547,5.689-5.689v-327.68C138.809,151.596,136.261,149.049,133.12,149.049z M89.889,418.702h-40.96 c-9.425,0-17.067-7.641-17.067-17.067s7.641-17.067,17.067-17.067h40.96c9.425,0,17.067,7.641,17.067,17.067 S99.315,418.702,89.889,418.702z M89.889,335.644h-40.96c-9.425,0-17.067-7.641-17.067-17.067c0-9.425,7.641-17.067,17.067-17.067 h40.96c9.425,0,17.067,7.641,17.067,17.067C106.956,328.003,99.315,335.644,89.889,335.644z M89.889,252.587h-40.96 c-9.425,0-17.067-7.641-17.067-17.067s7.641-17.067,17.067-17.067h40.96c9.425,0,17.067,7.641,17.067,17.067 S99.315,252.587,89.889,252.587z" />
                      </g>
                    </g>
                    <g>
                      <g>
                        <path d="M494.933,23.893H17.067C7.641,23.893,0,31.535,0,40.96v68.267c0,3.141,2.547,5.689,5.689,5.689h500.622 c3.141,0,5.689-2.547,5.689-5.689V40.96C512,31.535,504.359,23.893,494.933,23.893z M64.853,80.782 c-6.284,0-11.378-5.094-11.378-11.378c0-6.284,5.094-11.378,11.378-11.378s11.378,5.094,11.378,11.378 C76.231,75.688,71.137,80.782,64.853,80.782z M110.364,80.782c-6.284,0-11.378-5.094-11.378-11.378 c0-6.284,5.094-11.378,11.378-11.378s11.378,5.094,11.378,11.378C121.742,75.688,116.648,80.782,110.364,80.782z M155.876,80.782 c-6.284,0-11.378-5.094-11.378-11.378c0-6.284,5.094-11.378,11.378-11.378s11.378,5.094,11.378,11.378 C167.253,75.688,162.159,80.782,155.876,80.782z" />
                      </g>
                    </g>
                    <g>
                      <g>
                        <path d="M506.311,149.049h-327.68c-3.141,0-5.689,2.547-5.689,5.689v327.68c0,3.141,2.547,5.689,5.689,5.689h316.302 c9.425,0,17.067-7.641,17.067-17.067V154.738C512,151.596,509.453,149.049,506.311,149.049z M405.049,364.089V409.6 c0,9.425-7.641,17.067-17.067,17.067H296.96c-9.425,0-17.067-7.641-17.067-17.067v-45.511c0-17.92,7.583-34.092,19.695-45.511 c-41.186-38.831-13.463-108.089,42.883-108.089c56.395,0,84.023,69.303,42.883,108.089 C397.466,329.996,405.049,346.169,405.049,364.089z" />
                      </g>
                    </g>
                  </g>
                </svg>
              </div>
            ) : (
              <div className="text-base font-bold ml-2 flex items-center gap-2">
                <svg
                  fill="#ffffff"
                  height="14px"
                  width="14px"
                  version="1.1"
                  id="Layer_1"
                  te
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 512 512"
                  xmlnsXlink="http://www.w3.org/1999/xlink"
                >
                  <g id="SVGRepo_bgCarrier" strokeWidth="0" />
                  <g id="SVGRepo_tracerCarrier" strokeLinecap="round" strokeLinejoin="round" />
                  <g id="SVGRepo_iconCarrier">
                    <g>
                      <g>
                        <path d="M133.12,149.049H5.689c-3.141,0-5.689,2.547-5.689,5.689V471.04c0,9.425,7.641,17.067,17.067,17.067H133.12 c3.141,0,5.689-2.547,5.689-5.689v-327.68C138.809,151.596,136.261,149.049,133.12,149.049z M89.889,418.702h-40.96 c-9.425,0-17.067-7.641-17.067-17.067s7.641-17.067,17.067-17.067h40.96c9.425,0,17.067,7.641,17.067,17.067 S99.315,418.702,89.889,418.702z M89.889,335.644h-40.96c-9.425,0-17.067-7.641-17.067-17.067c0-9.425,7.641-17.067,17.067-17.067 h40.96c9.425,0,17.067,7.641,17.067,17.067C106.956,328.003,99.315,335.644,89.889,335.644z M89.889,252.587h-40.96 c-9.425,0-17.067-7.641-17.067-17.067s7.641-17.067,17.067-17.067h40.96c9.425,0,17.067,7.641,17.067,17.067 S99.315,252.587,89.889,252.587z" />
                      </g>
                    </g>
                    <g>
                      <g>
                        <path d="M494.933,23.893H17.067C7.641,23.893,0,31.535,0,40.96v68.267c0,3.141,2.547,5.689,5.689,5.689h500.622 c3.141,0,5.689-2.547,5.689-5.689V40.96C512,31.535,504.359,23.893,494.933,23.893z M64.853,80.782 c-6.284,0-11.378-5.094-11.378-11.378c0-6.284,5.094-11.378,11.378-11.378s11.378,5.094,11.378,11.378 C76.231,75.688,71.137,80.782,64.853,80.782z M110.364,80.782c-6.284,0-11.378-5.094-11.378-11.378 c0-6.284,5.094-11.378,11.378-11.378s11.378,5.094,11.378,11.378C121.742,75.688,116.648,80.782,110.364,80.782z M155.876,80.782 c-6.284,0-11.378-5.094-11.378-11.378c0-6.284,5.094-11.378,11.378-11.378s11.378,5.094,11.378,11.378 C167.253,75.688,162.159,80.782,155.876,80.782z" />
                      </g>
                    </g>
                    <g>
                      <g>
                        <path d="M506.311,149.049h-327.68c-3.141,0-5.689,2.547-5.689,5.689v327.68c0,3.141,2.547,5.689,5.689,5.689h316.302 c9.425,0,17.067-7.641,17.067-17.067V154.738C512,151.596,509.453,149.049,506.311,149.049z M405.049,364.089V409.6 c0,9.425-7.641,17.067-17.067,17.067H296.96c-9.425,0-17.067-7.641-17.067-17.067v-45.511c0-17.92,7.583-34.092,19.695-45.511 c-41.186-38.831-13.463-108.089,42.883-108.089c56.395,0,84.023,69.303,42.883,108.089 C397.466,329.996,405.049,346.169,405.049,364.089z" />
                      </g>
                    </g>
                  </g>
                </svg>
                {organization.name}
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
