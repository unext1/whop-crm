import type { ColumnDef } from '@tanstack/react-table';
import { and, eq, sql } from 'drizzle-orm';
import { Building2, CalendarIcon, Globe, MapPin, Phone, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { data, Form, Link, useActionData, useLoaderData, useNavigation } from 'react-router';
import { DataTable } from '~/components/data-table/data-table';
import { DataTableAdvancedToolbar } from '~/components/data-table/data-table-advanced-toolbar';
import { DataTableColumnHeader } from '~/components/data-table/data-table-column-header';
import { DataTableFilterList } from '~/components/data-table/data-table-filter-list';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Label } from '~/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select';
import { Switch } from '~/components/ui/switch';
import { Textarea } from '~/components/ui/textarea';
import { logCompanyActivity } from '~/utils/activity.server';
import { db } from '~/db';
import { companiesTable, type CompanyType } from '~/db/schema';
import { useDataTable } from '~/hooks/use-data-table';
import { putToast } from '~/services/cookie.server';
import { verifyWhopToken, whopSdk } from '~/services/whop.server';
import {
  buildOrderByClause,
  buildWhereClause,
  getColumnIds,
  getPaginationParams,
  parseDataTableSearchParams,
} from '~/utils/data-table.server';
import type { Route } from './+types';

const columns: ColumnDef<CompanyType>[] = [
  {
    id: 'name',
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} label="Company" />,
    cell: ({ row }) => {
      const name = row.getValue('name') as string;
      const company = row.original;
      return (
        <Link to={`${row.original.id}`} className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary text-xs font-semibold text-primary-foreground">
            {name?.charAt(0) || 'C'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-medium text-sm group-hover:text-primary transition-colors truncate">
              {name || 'Unnamed Company'}
            </span>
            {company.industry && <span className="text-xs text-muted-foreground truncate">{company.industry}</span>}
          </div>
        </Link>
      );
    },
    meta: {
      label: 'Company',
      placeholder: 'Search companies...',
      variant: 'text',
      icon: Building2,
    },
    enableColumnFilter: true,
  },
  {
    id: 'domain',
    accessorKey: 'domain',
    header: ({ column }) => <DataTableColumnHeader column={column} label="Domain" />,
    cell: ({ row }) => {
      const domain = row.getValue('domain') as string;
      return domain ? (
        <div className="flex items-center gap-1.5">
          <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
          <a
            href={`https://${domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm hover:text-primary transition-colors truncate max-w-[200px]"
          >
            {domain}
          </a>
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      );
    },
    meta: {
      label: 'Domain',
      placeholder: 'Search domains...',
      variant: 'text',
      icon: Globe,
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

  const { filters, sorting, joinOperator, page, perPage } = parseDataTableSearchParams<CompanyType>(
    url.searchParams,
    columnIds,
  );

  // Map column IDs to Drizzle columns
  const columnMap = {
    name: companiesTable.name,
    domain: companiesTable.domain,
    phone: companiesTable.phone,
    address: companiesTable.address,
    createdAt: companiesTable.createdAt,
  };

  // Build query conditions
  const filterWhere = buildWhereClause(filters, joinOperator, columnMap);
  const orderBy = buildOrderByClause(sorting, columnMap);
  const { offset, limit } = getPaginationParams(page, perPage);

  // Combine with base condition
  const baseWhere = eq(companiesTable.organizationId, companyId);
  const where = filterWhere ? and(baseWhere, filterWhere) : baseWhere;

  // Fetch data
  const companies = await db
    .select()
    .from(companiesTable)
    .where(where)
    .orderBy(...(orderBy.length > 0 ? orderBy : [companiesTable.createdAt]))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(companiesTable).where(where);
  const totalCount = Number(count);

  return {
    userId,
    access_level,
    companyId,
    companies,
    totalCount,
    pageCount: Math.ceil(totalCount / perPage),
  };
};

export const action = async ({ request, params }: Route.ActionArgs) => {
  const { userId } = await verifyWhopToken(request);
  const formData = await request.formData();
  const intent = formData.get('intent');

  if (intent === 'createCompany') {
    const name = formData.get('name')?.toString();
    const description = formData.get('description')?.toString();
    const domain = formData.get('domain')?.toString();
    const website = formData.get('website')?.toString();
    const industry = formData.get('industry')?.toString();
    const address = formData.get('address')?.toString();
    const phone = formData.get('phone')?.toString();
    const linkedin = formData.get('linkedin')?.toString();
    const twitter = formData.get('twitter')?.toString();

    if (!name) {
      const headers = await putToast({
        title: 'Error',
        message: 'Company name is required',
        variant: 'destructive',
      });
      return data({ error: 'Company name is required', close: false }, { headers, status: 400 });
    }

    try {
      const [newCompany] = await db
        .insert(companiesTable)
        .values({
          name,
          description,
          domain,
          website,
          industry,
          address,
          phone,
          linkedin,
          twitter,
          organizationId: params.companyId,
        })
        .returning();

      // Log activity for company creation
      await logCompanyActivity({
        companyId: newCompany.id,
        userId,
        activityType: 'created',
        description: `Company "${name}" was created`,
      });

      const headers = await putToast({
        title: 'Success',
        message: 'Company created successfully',
        variant: 'default',
      });

      return data({ error: null, close: true }, { headers });
    } catch {
      const headers = await putToast({
        title: 'Error',
        message: 'Failed to create company',
        variant: 'destructive',
      });
      return data({ error: 'Failed to create company', close: false }, { headers, status: 500 });
    }
  }

  const headers = await putToast({
    title: 'Success',
    message: 'Operation completed',
    variant: 'default',
  });

  return data({ error: null, close: true }, { headers });
};

const DashboardPage = () => {
  const {
    userId: _userId,
    access_level: _access_level,
    companyId: _companyId,
    companies,
    totalCount,
    pageCount,
  } = useLoaderData<typeof loader>();

  const { table } = useDataTable({
    data: companies,
    columns,
    pageCount,
    initialState: {
      pagination: { pageIndex: 0, pageSize: Number.POSITIVE_INFINITY },
    },
    getRowId: (row) => row.id,
    shallow: false, // Important: Set to false to trigger React Router navigation and loader revalidation
  });

  const actionData = useActionData<typeof action>();

  const [open, setOpen] = useState(false);
  const [createMore, setCreateMore] = useState(false);

  useEffect(() => {
    if (actionData?.close) {
      if (createMore) {
        // Reset form but keep dialog open
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
            <Building2 className="h-3.5 w-3.5" />
          </div>
          <h1 className="text-base font-semibold">Companies</h1>
          {totalCount > 0 && (
            <Badge variant="secondary" className="h-5 text-xs font-normal">
              {totalCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs shadow-s">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Company
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
                    <Building2 className="h-3.5 w-3.5" />
                  </div>
                  <DialogTitle className="text-base font-semibold m-0">Create Company</DialogTitle>
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
                <Form method="post" id="company-form" className="space-y-4 p-6">
                  <input type="hidden" name="intent" value="createCompany" />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="text-sm text-muted-foreground">
                        Company name <span className="text-muted-foreground">(required)</span>
                      </Label>
                      <Input id="name" name="name" placeholder="Set Company name..." required className="h-9" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="domain" className="text-sm text-muted-foreground">
                        Domain
                      </Label>
                      <Input id="domain" name="domain" placeholder="Set Domain..." className="h-9" />
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
                      <Label htmlFor="industry" className="text-sm text-muted-foreground">
                        Industry
                      </Label>
                      <Select name="industry">
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Set Industry..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Technology">Technology</SelectItem>
                          <SelectItem value="Healthcare">Healthcare</SelectItem>
                          <SelectItem value="Finance">Finance</SelectItem>
                          <SelectItem value="Retail">Retail</SelectItem>
                          <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                          <SelectItem value="Education">Education</SelectItem>
                          <SelectItem value="Consulting">Consulting</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="website" className="text-sm text-muted-foreground">
                        Website
                      </Label>
                      <Input id="website" name="website" placeholder="Set Website..." className="h-9" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm text-muted-foreground">
                        Phone
                      </Label>
                      <Input id="phone" name="phone" placeholder="Set Phone..." className="h-9" />
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
                  <Button type="submit" form="company-form" size="sm" className="h-8 text-xs">
                    Create record
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
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
