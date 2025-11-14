import type { ColumnDef } from '@tanstack/react-table';
import { and, eq, sql } from 'drizzle-orm';
import { CalendarIcon, Download, ImportIcon, Mail, MapPin, Phone, Plus, User, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { data, Form, Link, useActionData, useFetcher, useLoaderData, useNavigation } from 'react-router';
import { DataTable } from '~/components/data-table/data-table';
import { DataTableAdvancedToolbar } from '~/components/data-table/data-table-advanced-toolbar';
import { DataTableColumnHeader } from '~/components/data-table/data-table-column-header';
import { DataTableFilterList } from '~/components/data-table/data-table-filter-list';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Skeleton } from '~/components/ui/skeleton';
import { Switch } from '~/components/ui/switch';
import { Textarea } from '~/components/ui/textarea';
import { logPersonActivity } from '~/utils/activity.server';
import { db } from '~/db';
import {
  companiesPeopleTable,
  companiesTable,
  emailsTable,
  peopleEmailsTable,
  peopleTable,
  type PeopleType,
} from '~/db/schema';
import { useDataTable } from '~/hooks/use-data-table';
import { putToast } from '~/services/cookie.server';
import { getWhopCompanyMembers, requireUser, verifyWhopToken, whopSdk } from '~/services/whop.server';
import {
  buildOrderByClause,
  buildWhereClause,
  getColumnIds,
  getPaginationParams,
  parseDataTableSearchParams,
} from '~/utils/data-table.server';
import type { ExtendedColumnFilter } from '~/components/data-table/types/data-table';
import type { Route } from './+types';

type PeopleWithCompany = PeopleType & {
  company?: {
    id: string;
    name: string;
  };
  emails?: Array<{
    id: string;
    email: string;
    type: string | null;
    isPrimary: boolean | null;
  }>;
};

type WhopMember = {
  id: string;
  user: {
    id: string;
    name?: string | null;
    username?: string | null;
    email?: string | null;
  } | null;
  phone?: string | null;
};

const columns: ColumnDef<PeopleWithCompany>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} label="Person" />,
    cell: ({ row }) => {
      const name = row.getValue('name') as string;
      const person = row.original;
      return (
        <Link to={`${row.original.id}`} className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
            {name?.charAt(0) || 'P'}
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-sm group-hover:text-primary transition-colors truncate">
                {name || 'Unnamed Person'}
              </span>
              {person.whopUserId && (
                <Badge variant="outline" className="h-4 text-[10px] px-2 mt-0.5 bg-primary">
                  Whop
                </Badge>
              )}
            </div>
            {person.jobTitle && <span className="text-xs text-muted-foreground truncate">{person.jobTitle}</span>}
          </div>
        </Link>
      );
    },
    meta: {
      label: 'Person',
      placeholder: 'Search people...',
      variant: 'text',
      icon: User,
    },
    enableColumnFilter: true,
  },
  {
    id: 'company',
    accessorFn: (row) => {
      const personWithCompany = row as PeopleWithCompany;
      return personWithCompany.company?.name || '';
    },
    header: ({ column }) => <DataTableColumnHeader column={column} label="Company" />,
    cell: ({ row }) => {
      const personWithCompany = row.original as PeopleWithCompany;
      const company = personWithCompany.company;
      return company?.name ? (
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{company.name}</span>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      );
    },
    meta: {
      label: 'Company',
      placeholder: 'Search companies...',
      variant: 'text',
      icon: User,
    },
    enableColumnFilter: false,
  },
  {
    id: 'emails',
    accessorFn: (row) => {
      const personWithCompany = row as PeopleWithCompany;
      return personWithCompany.emails?.map((e) => e.email).join(', ') || '';
    },
    header: ({ column }) => <DataTableColumnHeader column={column} label="Emails" />,
    cell: ({ row }) => {
      const personWithCompany = row.original as PeopleWithCompany;
      const emails = personWithCompany.emails || [];

      if (emails.length === 0) {
        return <span className="text-sm text-muted-foreground">—</span>;
      }

      // Sort emails so primary comes first, or just use original order
      const sortedEmails = [...emails].sort((a, b) => {
        if (a.isPrimary) return -1;
        if (b.isPrimary) return 1;
        return 0;
      });

      return (
        <div className="flex gap-1.5 max-w-[200px] scrollbar-thin overflow-x-auto">
          {sortedEmails.map((email, index) => (
            <Badge
              key={email.id}
              variant={index === 0 ? 'default' : 'secondary'}
              className="text-xs font-normal shrink-0"
            >
              <Mail className="h-2.5 w-2.5 mr-1 shrink-0" />
              <span className="truncate">{email.email}</span>
            </Badge>
          ))}
        </div>
      );
    },
    meta: {
      label: 'Emails',
      placeholder: 'Search emails...',
      variant: 'text',
      icon: Mail,
    },
    enableColumnFilter: true,
  },
  {
    id: 'phone',
    accessorKey: 'phone',
    header: ({ column }) => <DataTableColumnHeader column={column} label="Phone" />,
    cell: ({ row }) => {
      const phone = row.getValue('phone') as string;
      return phone ? (
        <div className="flex items-center gap-1.5">
          <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-sm">{phone}</span>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      );
    },
    meta: {
      label: 'Phone',
      placeholder: 'Search phone numbers...',
      variant: 'text',
      icon: Phone,
    },
    enableColumnFilter: true,
  },
  {
    id: 'address',
    accessorKey: 'address',
    header: ({ column }) => <DataTableColumnHeader column={column} label="Address" />,
    cell: ({ row }) => {
      const address = row.getValue('address') as string;
      return address ? (
        <div className="flex items-center gap-1.5 max-w-[250px]">
          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-sm truncate">{address}</span>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      );
    },
    meta: {
      label: 'Address',
      placeholder: 'Search addresses...',
      variant: 'text',
      icon: MapPin,
    },
    enableColumnFilter: true,
  },
  {
    id: 'createdAt',
    accessorKey: 'createdAt',
    header: ({ column }) => <DataTableColumnHeader column={column} label="Created" />,
    cell: ({ row }) => {
      const date = row.getValue('createdAt') as string;
      return date ? (
        <div className="flex items-center gap-1.5">
          <CalendarIcon className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">
            {new Date(date).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      );
    },
    meta: {
      label: 'Created',
      variant: 'date',
      icon: CalendarIcon,
    },
    enableColumnFilter: true,
  },
];

export const loader = async ({ params, request }: Route.LoaderArgs) => {
  const { companyId } = params;
  const { userId } = await verifyWhopToken(request);
  const { access_level } = await whopSdk.users.checkAccess(companyId, { id: userId });

  // Parse data table state from URL
  const url = new URL(request.url);
  const columnIds = getColumnIds(columns);

  const { filters, sorting, joinOperator, page, perPage } = parseDataTableSearchParams<PeopleType>(
    url.searchParams,
    columnIds,
  );

  // Map column IDs to Drizzle columns
  const columnMap = {
    name: peopleTable.name,
    phone: peopleTable.phone,
    address: peopleTable.address,
    createdAt: peopleTable.createdAt,
  };

  // Custom column handlers for complex relationships
  const customColumnHandlers = {
    emails: (filter: ExtendedColumnFilter<PeopleWithCompany>) => {
      const { operator, value } = filter;

      // Handle empty operators
      if (operator === 'isEmpty') {
        // People with no emails - use NOT IN subquery
        return sql`${peopleTable.id} NOT IN (SELECT person_id FROM people_emails)`;
      }
      if (operator === 'isNotEmpty') {
        // People with at least one email - use IN subquery
        return sql`${peopleTable.id} IN (SELECT person_id FROM people_emails)`;
      }

      // Skip if value is empty
      if (!value || (Array.isArray(value) && value.length === 0)) {
        return undefined;
      }

      // For other operators, use IN subqueries (no correlation needed)
      if (operator === 'iLike') {
        return sql`${peopleTable.id} IN (
          SELECT pe.person_id FROM people_emails pe
          INNER JOIN emails e ON pe.email_id = e.id
          WHERE e.email LIKE ${`%${value}%`}
        )`;
      }

      if (operator === 'notILike') {
        return sql`${peopleTable.id} NOT IN (
          SELECT pe.person_id FROM people_emails pe
          INNER JOIN emails e ON pe.email_id = e.id
          WHERE e.email LIKE ${`%${value}%`}
        )`;
      }

      if (operator === 'eq') {
        return sql`${peopleTable.id} IN (
          SELECT pe.person_id FROM people_emails pe
          INNER JOIN emails e ON pe.email_id = e.id
          WHERE e.email = ${value as string}
        )`;
      }

      // For other operators, you could add more logic here
      return undefined;
    },
  };

  // Build query conditions
  const filterWhere = buildWhereClause(filters, joinOperator, columnMap, customColumnHandlers);
  const orderBy = buildOrderByClause(sorting, columnMap);
  const { offset, limit } = getPaginationParams(page, perPage);

  // Combine with base condition
  const baseWhere = eq(peopleTable.organizationId, companyId);
  const where = filterWhere ? and(baseWhere, filterWhere) : baseWhere;

  // Fetch data with many-to-many company relationships and emails
  const peopleData = await db.query.peopleTable.findMany({
    where: where,
    orderBy: orderBy.length > 0 ? orderBy : [peopleTable.createdAt],
    limit: limit,
    offset: offset,
    with: {
      companiesPeople: {
        with: {
          company: true,
        },
      },
      peopleEmails: {
        with: {
          email: true,
        },
      },
    },
  });

  // Transform data to include companies and emails arrays
  const people = peopleData.map((person) => ({
    ...person,
    companies: person.companiesPeople.map((cp) => cp.company),
    // For backward compatibility, include the first company as 'company'
    company: person.companiesPeople[0]?.company,
    emails: person.peopleEmails.map((pe) => pe.email),
    // Include the primary email for quick access
    primaryEmail: person.peopleEmails.find((pe) => pe.email.isPrimary)?.email || person.peopleEmails[0]?.email,
  }));

  // Get total count
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(peopleTable).where(where);
  const totalCount = Number(count);

  // Fetch companies for the create form
  const companies = await db.query.companiesTable.findMany({
    where: eq(companiesTable.organizationId, companyId),
  });

  return {
    userId,
    access_level,
    companyId,
    people,
    companies,
    totalCount,
    pageCount: Math.ceil(totalCount / perPage),
  };
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { user } = await requireUser(request, params.companyId);
  const userId = user.id;
  const formData = await request.formData();
  const intent = formData.get('intent');

  // Load Whop members for import
  if (intent === 'loadWhopMembers') {
    try {
      const allPeople = await db.query.peopleTable.findMany({
        where: eq(peopleTable.organizationId, params.companyId),
      });
      const allWhopCompanyMembers = await getWhopCompanyMembers({ request, companyId: params.companyId });

      // Filter out members without user or user.email
      const validMembers = allWhopCompanyMembers.filter(
        (member) => member.user?.email && !allPeople.some((p) => p.whopUserId === member.id),
      );

      return data({ members: validMembers });
    } catch {
      return data({ members: [], error: 'Failed to load members' }, { status: 500 });
    }
  }

  // Import selected Whop members
  if (intent === 'importWhopMembers') {
    const selectedMemberIds = formData.getAll('memberIds');
    const membersData = formData.get('membersData');

    if (!membersData || !selectedMemberIds.length) {
      const headers = await putToast({
        title: 'Error',
        message: 'No members selected for import',
        variant: 'destructive',
      });
      return data({ error: 'No members selected', close: false }, { headers, status: 400 });
    }

    try {
      const members = JSON.parse(membersData.toString()) as WhopMember[];
      const selectedMembers = members.filter((m) => selectedMemberIds.includes(m.id));

      // Batch insert the selected members with their emails
      const insertedPeople = await Promise.all(
        selectedMembers.map(async (member) => {
          // Create the person
          const [newPerson] = await db
            .insert(peopleTable)
            .values({
              name: member.user?.name || member.user?.username || 'Unknown',
              organizationId: params.companyId,
              phone: member.phone || undefined,
              whopUserId: member.id,
            })
            .returning();

          // Create email if member has one
          if (member.user?.email) {
            const [newEmail] = await db
              .insert(emailsTable)
              .values({
                email: member.user.email,
                type: 'work',
                isPrimary: true,
                organizationId: params.companyId,
              })
              .returning();

            // Link person to email
            await db.insert(peopleEmailsTable).values({
              personId: newPerson.id,
              emailId: newEmail.id,
            });
          }

          // Log activity for imported person
          await logPersonActivity({
            personId: newPerson.id,
            userId,
            activityType: 'created',
            description: 'Imported from Whop',
          });

          return newPerson;
        }),
      );

      const headers = await putToast({
        title: 'Success',
        message: `Successfully imported ${insertedPeople.length} ${insertedPeople.length === 1 ? 'person' : 'people'}`,
        variant: 'default',
      });

      return data({ error: null, close: true, imported: insertedPeople.length }, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to import members',
        variant: 'destructive',
      });
      return data({ error: 'Failed to import members', close: false }, { headers, status: 500 });
    }
  }

  if (intent === 'createPerson') {
    const name = formData.get('name')?.toString();
    const description = formData.get('description')?.toString();
    const jobTitle = formData.get('jobTitle')?.toString();
    const phone = formData.get('phone')?.toString();
    const linkedin = formData.get('linkedin')?.toString();
    const twitter = formData.get('twitter')?.toString();
    const website = formData.get('website')?.toString();
    const address = formData.get('address')?.toString();
    const notes = formData.get('notes')?.toString();
    const companyId = formData.get('companyId')?.toString();

    if (!name) {
      const headers = await putToast({
        title: 'Error',
        message: 'Person name is required',
        variant: 'destructive',
      });
      return data({ error: 'Person name is required', close: false }, { headers, status: 400 });
    }

    try {
      const [newPerson] = await db
        .insert(peopleTable)
        .values({
          name,
          description: description || undefined,
          jobTitle: jobTitle || undefined,
          phone: phone || undefined,
          linkedin: linkedin || undefined,
          twitter: twitter || undefined,
          website: website || undefined,
          address: address || undefined,
          notes: notes || undefined,
          organizationId: params.companyId,
        })
        .returning();

      // If a company is selected, create the many-to-many relationship
      if (companyId && companyId.trim() !== '') {
        await db.insert(companiesPeopleTable).values({
          companyId: companyId,
          personId: newPerson.id,
        });

        // Log activity for company association
        await logPersonActivity({
          personId: newPerson.id,
          userId,
          activityType: 'company_linked',
          description: 'Linked to company',
          relatedEntityId: companyId,
          relatedEntityType: 'company',
        });
      }

      // Log activity for person creation
      await logPersonActivity({
        personId: newPerson.id,
        userId,
        activityType: 'created',
        description: `Person "${name}" was created`,
      });

      const headers = await putToast({
        title: 'Success',
        message: 'Person created successfully',
        variant: 'default',
      });

      return data({ error: null, close: true }, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to create person',
        variant: 'destructive',
      });
      return data({ error: 'Failed to create person', close: false }, { headers, status: 500 });
    }
  }

  const headers = await putToast({
    title: 'Success',
    message: 'Operation completed',
    variant: 'default',
  });

  return data({ error: null, close: true }, { headers });
};

// Import Whop Members Dialog Component
const ImportWhopMembersDialog = () => {
  const [open, setOpen] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const fetcher = useFetcher<typeof action>();
  const importFetcher = useFetcher<typeof action>();

  // Load members when dialog opens
  useEffect(() => {
    if (open && !fetcher.data && fetcher.state === 'idle') {
      fetcher.submit({ intent: 'loadWhopMembers' }, { method: 'post' });
    }
  }, [open, fetcher.data, fetcher.state, fetcher.submit]);

  // Close dialog after successful import
  useEffect(() => {
    if (importFetcher.data && 'close' in importFetcher.data && importFetcher.data.close) {
      setOpen(false);
      setSelectedMembers(new Set());
    }
  }, [importFetcher.data]);

  const members: WhopMember[] = fetcher.data && 'members' in fetcher.data ? (fetcher.data.members as WhopMember[]) : [];
  const isLoading = fetcher.state === 'loading' || fetcher.state === 'submitting';
  const isImporting = importFetcher.state === 'submitting';

  const handleToggleMember = (memberId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const handleToggleAll = () => {
    if (selectedMembers.size === members.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(members.map((m) => m.id)));
    }
  };

  const handleImport = () => {
    if (selectedMembers.size === 0) return;

    const formData = new FormData();
    formData.append('intent', 'importWhopMembers');
    formData.append('membersData', JSON.stringify(members));
    Array.from(selectedMembers).forEach((id) => {
      formData.append('memberIds', id);
    });

    importFetcher.submit(formData, { method: 'post' });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8 text-xs shadow-s border-0">
          <ImportIcon className="mr-1.5 h-3.5 w-3.5" />
          Import from Whop
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[700px] p-0 gap-0 overflow-hidden bg-muted/30 backdrop-blur-md border-none shadow-s"
        showCloseButton={false}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
              <Download className="h-3.5 w-3.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold m-0">Import Whop Members</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground m-0 p-0">
                Already imported members are not shown here.
              </DialogDescription>
            </div>
          </div>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </DialogClose>
        </div>

        {/* Content */}
        <div className="overflow-auto max-h-[calc(100vh-240px)] p-6">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12 w-full bg-muted" />
              <Skeleton className="h-12 w-full bg-muted" />
              <Skeleton className="h-12 w-full bg-muted" />
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No members found</h3>
              <p className="text-sm text-muted-foreground">No Whop members with email addresses were found.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Select All */}
              <div className="flex items-center gap-3 p-3 border border-border rounded-lg bg-muted/50">
                <Checkbox
                  checked={selectedMembers.size === members.length && members.length > 0}
                  onCheckedChange={handleToggleAll}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">Select All</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedMembers.size} of {members.length} selected
                  </p>
                </div>
              </div>

              {/* Member List */}
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      checked={selectedMembers.has(member.id)}
                      onCheckedChange={() => handleToggleMember(member.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                          {member.user?.name?.charAt(0) || member.user?.username?.charAt(0) || 'U'}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-sm truncate">
                            {member.user?.name || member.user?.username || 'Unknown'}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">{member.user?.email}</span>
                        </div>
                      </div>
                    </div>
                    {member.phone && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        <span className="text-xs">{member.phone}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex h-14 items-center justify-between border-t border-border px-6 bg-muted/30">
          <div className="text-sm text-muted-foreground">
            {selectedMembers.size > 0 &&
              `${selectedMembers.size} member${selectedMembers.size !== 1 ? 's' : ''} selected`}
          </div>
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" disabled={isImporting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              onClick={handleImport}
              disabled={selectedMembers.size === 0 || isImporting}
            >
              {isImporting ? 'Importing...' : `Import ${selectedMembers.size > 0 ? selectedMembers.size : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const DashboardPage = () => {
  const {
    userId: _userId,
    access_level: _access_level,
    companyId: _companyId,
    people,
    companies,
    totalCount,
    pageCount,
  } = useLoaderData<typeof loader>();

  const { table } = useDataTable<PeopleWithCompany>({
    data: people as PeopleWithCompany[],
    columns,
    pageCount,
    initialState: {
      pagination: { pageIndex: 0, pageSize: 10 },
    },
    getRowId: (row) => row.id,
    shallow: false,
  });

  const actionData = useActionData<typeof action>();

  const [open, setOpen] = useState(false);
  const [createMore, setCreateMore] = useState(false);

  useEffect(() => {
    if (actionData && 'close' in actionData && actionData.close) {
      if (createMore) {
        setOpen(true);
      } else {
        setOpen(false);
      }
    }
  }, [actionData, createMore]);

  const navigation = useNavigation();

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
            <User className="h-3.5 w-3.5" />
          </div>
          <h1 className="text-base font-semibold">People</h1>
          {totalCount > 0 && (
            <Badge variant="secondary" className="h-5 text-xs font-normal">
              {totalCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ImportWhopMembersDialog />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs shadow-s">
                <Plus className="md:mr-1.5 h-3.5 w-3.5" />
                <span className="hidden md:block">Add Person</span>
              </Button>
            </DialogTrigger>
            <DialogContent
              className="sm:max-w-[600px] p-0 gap-0 overflow-hidden bg-muted/30 backdrop-blur-md border-none shadow-s"
              showCloseButton={false}
            >
              {/* Header */}
              <div className="flex h-16 items-center justify-between border-b border-border px-6 bg-muted/30">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <DialogTitle className="text-base font-semibold m-0">Create Person</DialogTitle>
                </div>
                <DialogClose asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </Button>
                </DialogClose>
              </div>

              {/* Form Content */}
              <div className="overflow-auto max-h-[calc(100vh-180px)]">
                <Form method="post" id="person-form" className="space-y-4 p-6">
                  <input type="hidden" name="intent" value="createPerson" />

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm text-muted-foreground">
                        Person name <span className="text-muted-foreground">(required)</span>
                      </Label>
                      <Input id="name" name="name" placeholder="Set Person name..." required className="h-9" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="companyId" className="text-sm text-muted-foreground">
                        Company
                      </Label>
                      {companies.length > 0 ? (
                        <Select name="companyId">
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="Select Company..." />
                          </SelectTrigger>
                          <SelectContent>
                            {companies.map((company) => (
                              <SelectItem key={company.id} value={company.id}>
                                {company.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex h-9 items-center px-3 text-sm text-muted-foreground border border-border rounded-md bg-muted/30">
                          No companies available
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="jobTitle" className="text-sm text-muted-foreground">
                        Job Title
                      </Label>
                      <Input id="jobTitle" name="jobTitle" placeholder="Set Job Title..." className="h-9" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm text-muted-foreground">
                        Phone
                      </Label>
                      <Input id="phone" name="phone" placeholder="Set Phone..." className="h-9" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-sm text-muted-foreground">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      name="description"
                      placeholder="Set Description..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="website" className="text-sm text-muted-foreground">
                        Website
                      </Label>
                      <Input id="website" name="website" placeholder="Set Website..." className="h-9" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="address" className="text-sm text-muted-foreground">
                        Address
                      </Label>
                      <Input id="address" name="address" placeholder="Set Address..." className="h-9" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="linkedin" className="text-sm text-muted-foreground">
                        LinkedIn
                      </Label>
                      <Input id="linkedin" name="linkedin" placeholder="Set LinkedIn..." className="h-9" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="twitter" className="text-sm text-muted-foreground">
                        Twitter
                      </Label>
                      <Input id="twitter" name="twitter" placeholder="Set Twitter..." className="h-9" />
                    </div>
                  </div>
                </Form>
              </div>

              {/* Footer */}
              <div className="flex h-14 items-center justify-between border-t border-border px-6 bg-muted/30">
                <div className="flex items-center gap-2">
                  <Switch id="create-more" checked={createMore} onCheckedChange={setCreateMore} />
                  <Label htmlFor="create-more" className="text-sm font-normal cursor-pointer">
                    Create more
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <DialogTrigger asChild>
                    <Button type="button" variant="ghost" size="sm" className="h-8 text-xs">
                      Cancel
                    </Button>
                  </DialogTrigger>
                  <Button type="submit" form="person-form" size="sm" className="h-8 text-xs shadow-s">
                    Create record
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 scrollbar-thin">
        <DataTable table={table} loading={navigation.state === 'loading'}>
          <DataTableAdvancedToolbar table={table}>
            <DataTableFilterList table={table} shallow={false} />
          </DataTableAdvancedToolbar>
        </DataTable>
      </div>
    </div>
  );
};

export default DashboardPage;
